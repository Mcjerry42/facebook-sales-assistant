import { createFileRoute } from "@tanstack/react-router";
import { metapilotSupabaseAdmin } from "@/lib/metapilot-supabase.server";
import { tryExtractAndSaveOrder } from "@/lib/order-extractor.server";

export const Route = createFileRoute("/api/public/fb-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const { data } = await metapilotSupabaseAdmin.from("fb_config").select("verify_token").not("verify_token", "is", null).limit(1).maybeSingle();
        const expected = data?.verify_token ?? "lovable_fb_verify_token";
        if (mode === "subscribe" && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          await metapilotSupabaseAdmin.from("analytics_events").insert({
            event_type: "fb_webhook_received",
            meta: body,
          });
          if (body?.object === "page" && Array.isArray(body.entry)) {
            for (const entry of body.entry) {
              const messaging = entry.messaging ?? [];
              for (const ev of messaging) {
                try {
                  await handleMessagingEvent(ev, entry.id);
                } catch (err) {
                  console.error("handleMessagingEvent error", err);
                  await metapilotSupabaseAdmin.from("analytics_events").insert({
                    event_type: "fb_webhook_error",
                    meta: { error: String(err), event: ev },
                  });
                }
              }
              const changes = entry.changes ?? [];
              for (const ch of changes) {
                try {
                  await handleFeedChange(ch, entry.id);
                } catch (err) {
                  console.error("handleFeedChange error", err);
                  await metapilotSupabaseAdmin.from("analytics_events").insert({
                    event_type: "fb_webhook_error",
                    meta: { error: String(err), change: ch },
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error("FB webhook error", e);
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});

async function handleMessagingEvent(ev: any, pageId: string) {
  const senderId: string | undefined = ev?.sender?.id;
  const text: string | undefined = ev?.message?.text;
  const isEcho: boolean = !!ev?.message?.is_echo;
  const attachments: any[] = ev?.message?.attachments ?? [];
  const hasAttachments = attachments.length > 0;
  if (!senderId || isEcho) return;
  if (senderId === pageId) return;
  // If there's no text AND no attachments, nothing to process
  if (!text && !hasAttachments) return;
  
  const messageText = text || "";

  // Build a display text based on attachments (for DB storage)
  function buildDisplayText(): string {
    if (messageText) return messageText;
    const parts: string[] = [];
    for (const att of attachments) {
      const t = att.type || "attachment";
      if (t === "audio" || t === "voice") parts.push("[Audio message]");
      else if (t === "image") parts.push("[Image]");
      else if (t === "video") parts.push("[Video]");
      else if (t === "file") parts.push("[File]");
      else parts.push(`[${t}]`);
    }
    return parts.join(" ") || "[Attachment]";
  }
  const displayText = buildDisplayText();

  // Download and process image/audio attachments from Facebook
  async function downloadFbAttachment(url: string): Promise<{ base64: string; mime: string } | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const mime = res.headers.get("content-type") || "image/jpeg";
      const base64 = Buffer.from(buf).toString("base64");
      return { base64, mime };
    } catch { return null; }
  }

  const imageContents: Array<{ type: "image"; image: string }> = [];
  let hasAudio = false;
  let audioCaptions: string[] = [];
  const audioBuffers: ArrayBuffer[] = [];

  for (const att of attachments) {
    const attType: string = att.type || "";
    const payloadUrl: string | undefined = att.payload?.url;
    
    if (attType === "image" && payloadUrl) {
      const downloaded = await downloadFbAttachment(payloadUrl);
      if (downloaded) {
        imageContents.push({
          type: "image",
          image: `data:${downloaded.mime};base64,${downloaded.base64}`,
        });
      }
    } else if (attType === "audio" || attType === "voice") {
      hasAudio = true;
      const duration = att.payload?.duration || 0;
      audioCaptions.push(`[Audio message${duration ? ` (${Math.round(duration/1000)}s)` : ""}]`);
      // Download audio for transcription
      if (payloadUrl) {
        try {
          const buf = await downloadFbAttachment(payloadUrl);
          if (buf) {
            const audioData = Buffer.from(buf.base64, "base64");
            audioBuffers.push(audioData);
          }
        } catch {}
      }
    } else if (payloadUrl) {
      audioCaptions.push(`[${attType} attachment]`);
    }
  }

  // --- Vision: use Gemini via OpenRouter to analyze images ---
  async function analyzeImageWithGemini(base64DataUrl: string, apiKey: string): Promise<string | null> {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "You are a sales agent assistant. Analyze this customer's image and describe what you see in Bengali/English. If it's a product photo, describe the product details. If it's a screenshot, describe the conversation. Be concise." },
              { type: "image_url", image_url: { url: base64DataUrl } },
            ],
          }],
          max_tokens: 200,
        }),
      });
      const j = await r.json();
      return j.choices?.[0]?.message?.content || null;
    } catch { return null; }
  }

  // --- Audio: use Gemini to transcribe audio ---
  async function transcribeWithGemini(audioBuf: ArrayBuffer, apiKey: string): Promise<string | null> {
    try {
      const base64 = Buffer.from(audioBuf).toString("base64");
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio message exactly as spoken. The customer is speaking Bengali or English. Reply only with the transcription." },
              { type: "input_audio", input_audio: { data: base64, format: "wav" } },
            ],
          }],
          max_tokens: 200,
        }),
      });
      const j = await r.json();
      return j.choices?.[0]?.message?.content || null;
    } catch { return null; }
  }

  // Fetch config and settings in parallel
  const { data: cfg } = await metapilotSupabaseAdmin
    .from("fb_config")
    .select("page_access_token, page_id, user_id")
    .eq("page_id", pageId)
    .limit(1)
    .maybeSingle();
  if (!cfg?.page_access_token || !cfg?.user_id) {
    console.warn("No page_access_token or user_id configured; skipping reply");
    return;
  }

  // Check if bot is enabled for this user
  if ((cfg as any).bot_enabled === false) {
    console.log("Bot is disabled for this user; skipping reply");
    return;
  }

  // Fetch settings, KB, and find conversation in parallel
  const [settingsRes, kbRes, convRes] = await Promise.all([
    metapilotSupabaseAdmin
      .from("ai_settings")
      .select("*")
      .eq("user_id", cfg.user_id)
      .limit(1)
      .maybeSingle(),
    metapilotSupabaseAdmin
      .from("knowledge_entries")
      .select("question,answer,category")
      .eq("user_id", cfg.user_id)
      .limit(200),
    metapilotSupabaseAdmin
      .from("conversations")
      .select("*")
      .eq("user_id", cfg.user_id)
      .eq("fb_user_id", senderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const settings = settingsRes.data;
  const kb = kbRes.data;
  let conv = convRes.data;

  let fbUserName: string | null = null;
  let fbUserAvatar: string | null = null;
  if (!conv) {
    try {
      const profRes = await fetch(
        `https://graph.facebook.com/v21.0/${senderId}?fields=name,profile_pic&access_token=${encodeURIComponent(cfg.page_access_token)}`,
      );
      if (profRes.ok) {
        const prof: any = await profRes.json();
        fbUserName = prof.name ?? null;
        fbUserAvatar = prof.profile_pic ?? null;
      }
    } catch {}
    const { data: created } = await metapilotSupabaseAdmin
      .from("conversations")
      .insert({
        user_id: cfg.user_id,
        fb_user_id: senderId,
        fb_user_name: fbUserName,
        fb_user_avatar: fbUserAvatar,
        last_message: displayText,
        last_message_at: new Date().toISOString(),
        unread_count: 1,
      })
      .select("*")
      .single();
    conv = created!;
  } else {
    await metapilotSupabaseAdmin
      .from("conversations")
      .update({
        last_message: displayText,
        last_message_at: new Date().toISOString(),
        unread_count: (conv.unread_count ?? 0) + 1,
      })
      .eq("id", conv.id);
  }

  // Save inbound message and load history in parallel
  const [historyRes] = await Promise.all([
    metapilotSupabaseAdmin
      .from("messages")
      .select("sender,text,is_ai,created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(10),
    metapilotSupabaseAdmin.from("messages").insert({
      user_id: cfg.user_id,
      conversation_id: conv.id,
      sender: "user",
      text: displayText,
      is_ai: false,
    }),
  ]);
  const history = historyRes.data;

  // Stop here if human takeover or auto-reply disabled
  if (conv.human_takeover) return;
  if (settings && settings.auto_reply_messages === false) return;

  const { createAiProvider } = await import("@/lib/ai-gateway.server");
  const { generateText } = await import("ai");

  let model;
  try {
    const gateway = createAiProvider({
      provider: settings?.provider ?? "lovable",
      model: settings?.model ?? "google/gemini-2.0-flash",
      api_key: settings?.api_key ?? null,
      base_url: (settings as any)?.base_url ?? null,
    });
    model = gateway(settings?.model ?? "google/gemini-2.0-flash");
  } catch (err) {
    console.error("AI provider creation failed:", err);
    return;
  }
  const kbText = (kb ?? [])
    .map((k: any) => `Q: ${k.question}\nA: ${k.answer}`)
    .join("\n---\n");
  const system = `${settings?.system_instructions ?? ""}\n\nKnowledge Base:\n${kbText || "(empty)"}`;
  const recent = (history ?? [])
    .slice()
    .reverse()
    .map((m: any) => ({ role: m.is_ai ? ("assistant" as const) : ("user" as const), content: m.text }));
  
  // Since history was fetched in parallel with the insert, it might not contain the current message
  // Just in case, append the current message.
  // Analyze images and transcribe audio before sending to main AI (DeepSeek)
  const apiKey = settings?.api_key ?? "";
  const extraContext: string[] = [];

  // Use Gemini to analyze each image
  for (const img of imageContents) {
    if (img.type === "image") {
      const desc = await analyzeImageWithGemini(img.image, apiKey);
      if (desc) extraContext.push(`[Customer's image: ${desc}]`);
    }
  }

  // Use Gemini to transcribe audio
  for (const buf of audioBuffers) {
    if (buf) {
      const transcript = await transcribeWithGemini(buf, apiKey);
      if (transcript) extraContext.push(`[Customer's audio transcription: ${transcript}]`);
    }
  }

  // Build the message for the main AI
  const fullMessage = [
    messageText,
    ...extraContext,
    ...(hasAudio && !extraContext.some(e => e.includes("transcription")) ? ["[Customer sent an audio message but it couldn't be transcribed. Please ask them to type their message instead.]"] : []),
  ].filter(Boolean).join("\n");

  recent.push({ role: "user", content: fullMessage || displayText });

  let replyText = "";
  try {
    const result = await generateText({
      model,
      system,
      messages: recent,
    });
    replyText = result.text?.trim() ?? "";
  } catch (err) {
    console.error("AI generation failed", err);
    return;
  }
  if (!replyText) return;

  // Send reply via FB Send API
  const sendRes = await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(cfg.page_access_token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: { text: replyText },
        messaging_type: "RESPONSE",
      }),
    },
  );
  if (!sendRes.ok) {
    const errText = await sendRes.text();
    console.error("FB send failed", sendRes.status, errText);
    await metapilotSupabaseAdmin.from("analytics_events").insert({
      user_id: cfg.user_id,
      event_type: "fb_send_failed",
      meta: { status: sendRes.status, body: errText },
    });
    return;
  }

  await metapilotSupabaseAdmin.from("messages").insert({
    user_id: cfg.user_id,
    conversation_id: conv.id,
    sender: "ai",
    text: replyText,
    is_ai: true,
  });
  await metapilotSupabaseAdmin
    .from("conversations")
    .update({
      last_message: replyText,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    })
    .eq("id", conv.id);

  // Best-effort: try to extract a completed order from the conversation.
  try {
    await tryExtractAndSaveOrder({
      conversationId: conv.id,
      model: settings?.model ?? "google/gemini-2.0-flash",
      userId: cfg.user_id,
    });
  } catch (err) {
    console.error("order extraction error", err);
  }
}

async function handleFeedChange(change: any, pageId: string) {
  if (change?.field !== "feed") return;
  const v = change.value ?? {};
  if (v.item !== "comment") return;
  if (v.verb !== "add") return; // only new comments

  const commentId: string | undefined = v.comment_id;
  const postId: string | undefined = v.post_id;
  const text: string = v.message ?? "";
  const fromId: string | undefined = v.from?.id;
  const fromName: string | undefined = v.from?.name;
  if (!commentId || !postId) return;
  // Skip our own page's comments
  if (fromId && fromId === pageId) return;

  const { data: cfg } = await metapilotSupabaseAdmin
    .from("fb_config")
    .select("page_access_token, monitored_post_ids, user_id")
    .eq("page_id", pageId)
    .limit(1)
    .maybeSingle();
  if (!cfg?.page_access_token || !cfg?.user_id) return;

  const monitored: string[] = cfg.monitored_post_ids ?? [];
  // Match either the full post_id ("pageId_postId") or just the suffix.
  const isMonitored = monitored.some((m) => postId === m || postId.endsWith("_" + m) || m.endsWith("_" + postId.split("_").pop()));
  if (!isMonitored) {
    await metapilotSupabaseAdmin.from("analytics_events").insert({
      user_id: cfg.user_id,
      event_type: "fb_comment_skipped",
      meta: { post_id: postId, reason: "not_monitored" },
    });
    return;
  }

  const [settingsRes, kbRes2] = await Promise.all([
    metapilotSupabaseAdmin
      .from("ai_settings")
      .select("*")
      .eq("user_id", cfg.user_id)
      .limit(1)
      .maybeSingle(),
    metapilotSupabaseAdmin
      .from("knowledge_entries")
      .select("question,answer,category")
      .eq("user_id", cfg.user_id)
      .limit(200),
  ]);

  const settings = settingsRes.data;
  const kb = kbRes2.data;

  // Record the comment
  await metapilotSupabaseAdmin.from("comments").insert({
    user_id: cfg.user_id,
    comment_id: commentId,
    post_id: postId,
    commenter_id: fromId ?? null,
    commenter_name: fromName ?? null,
    text,
    action: "received",
  });

  if (settings && settings.auto_reply_comments === false) return;

  const { createAiProvider } = await import("@/lib/ai-gateway.server");
  const { generateText, Output } = await import("ai");
  const { z } = await import("zod");

  let model;
  try {
    const gateway = createAiProvider({
      provider: settings?.provider ?? "lovable",
      model: settings?.model ?? "google/gemini-2.0-flash",
      api_key: settings?.api_key ?? null,
      base_url: (settings as any)?.base_url ?? null,
    });
    model = gateway(settings?.model ?? "google/gemini-2.0-flash");
  } catch (err) {
    console.error("AI provider creation failed:", err);
    return;
  }
  const kbText = (kb ?? []).map((k: any) => `Q: ${k.question}\nA: ${k.answer}`).join("\n---\n");

  const system = `${settings?.system_instructions ?? ""}

You are moderating a Facebook page. For each public comment you receive, output STRICT JSON with:
- is_abusive: true if the comment is hateful, abusive, spam, scam, sexual harassment, or clearly off-topic trolling. Otherwise false. A simple greeting like "hi" is NOT abusive.
- public_reply: a short (1-2 sentences) warm public reply in the commenter's language. If they asked about price/details/order, invite them to inbox. Leave empty string if is_abusive is true.
- private_message: a friendlier longer DM (2-4 sentences) sent privately to the same commenter. Greet by name if available. Answer their question using the Knowledge Base. If they showed buying intent, ask for product, quantity, name, phone, address. Leave empty string if is_abusive is true.

Knowledge Base:
${kbText || "(empty)"}`;

  let aiOut: { is_abusive: boolean; public_reply: string; private_message: string } | null = null;
  try {
    const result = await generateText({
      model,
      system,
      prompt: `Commenter name: ${fromName ?? "Unknown"}\nComment: ${text || "(no text)"}`,
      output: Output.object({
        schema: z.object({
          is_abusive: z.boolean(),
          public_reply: z.string(),
          private_message: z.string(),
        }),
      }),
    });
    aiOut = (result as any).output ?? null;
  } catch (err) {
    console.error("comment AI failed", err);
    return;
  }
  if (!aiOut) return;

  const token = cfg.page_access_token;

  // Abusive → hide (and optionally delete). Don't reply.
  if (aiOut.is_abusive) {
    if (settings?.auto_hide_abusive !== false) {
      const hideRes = await fetch(
        `https://graph.facebook.com/v21.0/${commentId}?access_token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_hidden: true }),
        },
      );
      if (hideRes.ok) {
        await metapilotSupabaseAdmin
          .from("comments")
          .update({ action: "hidden", hidden: true })
          .eq("comment_id", commentId);
        await metapilotSupabaseAdmin.from("analytics_events").insert({
          user_id: cfg.user_id,
          event_type: "fb_comment_hidden",
          meta: { post_id: postId, comment_id: commentId },
        });
      } else {
        const errText = await hideRes.text();
        await metapilotSupabaseAdmin.from("analytics_events").insert({
          user_id: cfg.user_id,
          event_type: "fb_comment_hide_failed",
          meta: { status: hideRes.status, body: errText, comment_id: commentId },
        });
      }
    }
    return;
  }

  // Public reply on the comment thread.
  if (aiOut.public_reply?.trim()) {
    const replyRes = await fetch(
      `https://graph.facebook.com/v21.0/${commentId}/comments?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: aiOut.public_reply.trim() }),
      },
    );
    if (!replyRes.ok) {
      const errText = await replyRes.text();
      await metapilotSupabaseAdmin.from("analytics_events").insert({
        user_id: cfg.user_id,
        event_type: "fb_comment_reply_failed",
        meta: { status: replyRes.status, body: errText, post_id: postId },
      });
    } else {
      await metapilotSupabaseAdmin
        .from("comments")
        .update({ action: "replied" })
        .eq("comment_id", commentId);
      await metapilotSupabaseAdmin.from("analytics_events").insert({
        user_id: cfg.user_id,
        event_type: "fb_comment_replied",
        meta: { post_id: postId, comment_id: commentId },
      });
    }
  }

  // Private reply (DM) to the same commenter via the comment id.
  if (aiOut.private_message?.trim()) {
    const pmRes = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { comment_id: commentId },
          message: { text: aiOut.private_message.trim() },
          messaging_type: "RESPONSE",
        }),
      },
    );
    if (!pmRes.ok) {
      const errText = await pmRes.text();
      await metapilotSupabaseAdmin.from("analytics_events").insert({
        user_id: cfg.user_id,
        event_type: "fb_comment_dm_failed",
        meta: { status: pmRes.status, body: errText, comment_id: commentId },
      });
    } else {
      await metapilotSupabaseAdmin
        .from("comments")
        .update({ dm_sent: true })
        .eq("comment_id", commentId);
      await metapilotSupabaseAdmin.from("analytics_events").insert({
        user_id: cfg.user_id,
        event_type: "fb_comment_dm_sent",
        meta: { comment_id: commentId },
      });
    }
  }
}