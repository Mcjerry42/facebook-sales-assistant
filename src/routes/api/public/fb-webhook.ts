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
  if (!senderId || !text || isEcho) return;
  if (senderId === pageId) return;

  const { data: cfg } = await metapilotSupabaseAdmin
    .from("fb_config")
    .select("page_access_token, page_id, user_id")
    .eq("page_id", pageId)
    .limit(1)
    .maybeSingle();
  if (!cfg?.page_access_token) {
    console.warn("No page_access_token configured; skipping reply");
    return;
  }

  const { data: settings } = await metapilotSupabaseAdmin
    .from("ai_settings")
    .select("*")
    .eq("user_id", cfg.user_id)
    .limit(1)
    .maybeSingle();

  // Find or create conversation
  let { data: conv } = await metapilotSupabaseAdmin
    .from("conversations")
    .select("*")
    .eq("user_id", cfg.user_id)
    .eq("user_id", cfg.user_id)
    .eq("fb_user_id", senderId)
    .maybeSingle();

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
        last_message: text,
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
        last_message: text,
        last_message_at: new Date().toISOString(),
        unread_count: (conv.unread_count ?? 0) + 1,
      })
      .eq("id", conv.id);
  }

  // Save inbound message
  await metapilotSupabaseAdmin.from("messages").insert({
    user_id: cfg.user_id,
    conversation_id: conv.id,
    sender: "user",
    text,
    is_ai: false,
  });

  // Stop here if human takeover or auto-reply disabled
  if (conv.human_takeover) return;
  if (settings && settings.auto_reply_messages === false) return;

  // Load knowledge base (recent history is also nice but keep it simple)
  const { data: kb } = await metapilotSupabaseAdmin
    .from("knowledge_entries")
    .select("question,answer,category")
    .eq("user_id", cfg.user_id)
    .limit(200);

  const { data: history } = await metapilotSupabaseAdmin
    .from("messages")
    .select("sender,text,is_ai,created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.error("Missing LOVABLE_API_KEY");
    return;
  }

  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const { generateText } = await import("ai");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway(settings?.model ?? "google/gemini-3-flash-preview");
  const kbText = (kb ?? [])
    .map((k: any) => `Q: ${k.question}\nA: ${k.answer}`)
    .join("\n---\n");
  const system = `${settings?.system_instructions ?? ""}\n\nKnowledge Base:\n${kbText || "(empty)"}`;
  const recent = (history ?? [])
    .slice()
    .reverse()
    .map((m: any) => ({ role: m.is_ai ? ("assistant" as const) : ("user" as const), content: m.text }));

  let replyText = "";
  try {
    const result = await generateText({
      model,
      system,
      messages: recent.length > 0 ? recent : [{ role: "user", content: text }],
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
      model: settings?.model ?? "google/gemini-3-flash-preview",
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
  if (!cfg?.page_access_token) return;

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

  const { data: settings } = await metapilotSupabaseAdmin
    .from("ai_settings")
    .select("*")
    .eq("user_id", cfg.user_id)
    .limit(1)
    .maybeSingle();

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

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return;

  const { data: kb } = await metapilotSupabaseAdmin
    .from("knowledge_entries")
    .select("question,answer,category")
    .eq("user_id", cfg.user_id)
    .limit(200);

  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const { generateText, Output } = await import("ai");
  const { z } = await import("zod");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway(settings?.model ?? "google/gemini-3-flash-preview");
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