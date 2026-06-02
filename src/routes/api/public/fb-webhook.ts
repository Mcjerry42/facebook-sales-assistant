import { createFileRoute } from "@tanstack/react-router";
import { metapilotSupabaseAdmin } from "@/lib/metapilot-supabase.server";

export const Route = createFileRoute("/api/public/fb-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = "lovable_fb_verify_token";
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
  if (!text && !hasAttachments) return;

  const messageText = text || "";

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
  const audioBuffers: ArrayBuffer[] = [];

  for (const att of attachments) {
    const attType: string = att.type || "";
    const payloadUrl: string | undefined = att.payload?.url;
    if (attType === "image" && payloadUrl) {
      const downloaded = await downloadFbAttachment(payloadUrl);
      if (downloaded) {
        imageContents.push({ type: "image", image: `data:${downloaded.mime};base64,${downloaded.base64}` });
      }
    } else if (attType === "audio" || attType === "voice") {
      hasAudio = true;
      if (payloadUrl) {
        try {
          const buf = await downloadFbAttachment(payloadUrl);
          if (buf) audioBuffers.push(Buffer.from(buf.base64, "base64"));
        } catch {}
      }
    }
  }

  async function analyzeImageWithGemini(base64DataUrl: string, apiKey: string): Promise<string | null> {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{ role: "user", content: [
            { type: "text", text: "Analyze this customer image. Be concise." },
            { type: "image_url", image_url: { url: base64DataUrl } },
          ]}],
          max_tokens: 200,
        }),
      });
      const j = await r.json();
      return j.choices?.[0]?.message?.content || null;
    } catch { return null; }
  }

  async function transcribeWithGemini(audioBuf: ArrayBuffer, apiKey: string): Promise<string | null> {
    try {
      const base64 = Buffer.from(audioBuf).toString("base64");
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{ role: "user", content: [
            { type: "text", text: "Transcribe this audio exactly as spoken." },
            { type: "input_audio", input_audio: { data: base64, format: "wav" } },
          ]}],
          max_tokens: 200,
        }),
      });
      const j = await r.json();
      return j.choices?.[0]?.message?.content || null;
    } catch { return null; }
  }

  // Use 'clients' table for bot config
  const { data: clientRow } = await metapilotSupabaseAdmin
    .from("clients" as any)
    .select("page_token, page_id, status")
    .eq("page_id", pageId)
    .limit(1)
    .maybeSingle();

  const pageToken = (clientRow as any)?.page_token;
  if (!pageToken) {
    console.warn("No page_token configured; skipping reply");
    return;
  }

  // Check if bot is enabled
  if ((clientRow as any)?.status !== "on") {
    console.log("Bot is disabled; skipping reply");
    return;
  }

  // Fetch AI settings and knowledge base
  const [settingsRes, kbRes, convRes] = await Promise.all([
    metapilotSupabaseAdmin.from("ai_settings").select("*").limit(1).maybeSingle(),
    metapilotSupabaseAdmin.from("knowledge_entries").select("question,answer,category").limit(200),
    metapilotSupabaseAdmin.from("conversations").select("*").eq("fb_user_id", senderId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const settings = settingsRes.data;
  const kb = kbRes.data;
  let conv = convRes.data;

  let fbUserName: string | null = null;
  let fbUserAvatar: string | null = null;
  if (!conv) {
    try {
      const profRes = await fetch(`https://graph.facebook.com/v21.0/${senderId}?fields=name,profile_pic&access_token=${encodeURIComponent(pageToken)}`);
      if (profRes.ok) { const prof: any = await profRes.json(); fbUserName = prof.name ?? null; fbUserAvatar = prof.profile_pic ?? null; }
    } catch {}
    const { data: created } = await metapilotSupabaseAdmin.from("conversations").insert({
      fb_user_id: senderId, fb_user_name: fbUserName, fb_user_avatar: fbUserAvatar,
      last_message: displayText, last_message_at: new Date().toISOString(), unread_count: 1,
    }).select("*").single();
    conv = created!;
  } else {
    await metapilotSupabaseAdmin.from("conversations").update({
      last_message: displayText, last_message_at: new Date().toISOString(), unread_count: (conv.unread_count ?? 0) + 1,
    }).eq("id", conv.id);
  }

  const [historyRes] = await Promise.all([
    metapilotSupabaseAdmin.from("messages").select("sender,text,is_ai,created_at").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(10),
    metapilotSupabaseAdmin.from("messages").insert({ conversation_id: conv.id, sender: "user", text: displayText, is_ai: false }),
  ]);
  const history = historyRes.data;

  if (conv.human_takeover) return;
  if (settings && (settings as any).auto_reply_messages === false) return;

  const { createAiProvider } = await import("@/lib/ai-gateway.server");
  const { generateText } = await import("ai");

  let model;
  try {
    const gateway = createAiProvider({ provider: (settings as any)?.provider ?? "lovable", model: (settings as any)?.model ?? "google/gemini-2.0-flash", api_key: (settings as any)?.api_key ?? null, base_url: (settings as any)?.base_url ?? null });
    model = gateway((settings as any)?.model ?? "google/gemini-2.0-flash");
  } catch (err) { console.error("AI provider creation failed:", err); return; }

  const kbText = (kb ?? []).map((k: any) => `Q: ${k.question}\nA: ${k.answer}`).join("\n---\n");
  const system = `${(settings as any)?.system_instructions ?? ""}\n\nKnowledge Base:\n${kbText || "(empty)"}`;
  const recent = (history ?? []).slice().reverse().map((m: any) => ({ role: m.is_ai ? ("assistant" as const) : ("user" as const), content: m.text }));

  const apiKey = (settings as any)?.api_key ?? "";
  const extraContext: string[] = [];
  for (const img of imageContents) { if (img.type === "image") { const desc = await analyzeImageWithGemini(img.image, apiKey); if (desc) extraContext.push(`[Customer's image: ${desc}]`); } }
  for (const buf of audioBuffers) { if (buf) { const transcript = await transcribeWithGemini(buf, apiKey); if (transcript) extraContext.push(`[Customer's audio transcription: ${transcript}]`); } }

  const fullMessage = [messageText, ...extraContext, ...(hasAudio && !extraContext.some(e => e.includes("transcription")) ? ["[Customer sent audio but transcription failed. Ask them to type.]"] : [])].filter(Boolean).join("\n");
  recent.push({ role: "user", content: fullMessage || displayText });

  let replyText = "";
  try { const result = await generateText({ model, system, messages: recent }); replyText = result.text?.trim() ?? ""; } catch (err) { console.error("AI generation failed", err); return; }
  if (!replyText) return;

  const sendRes = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: senderId }, message: { text: replyText }, messaging_type: "RESPONSE" }),
  });
  if (!sendRes.ok) { const errText = await sendRes.text(); console.error("FB send failed", sendRes.status, errText); return; }

  await metapilotSupabaseAdmin.from("messages").insert({ conversation_id: conv.id, sender: "ai", text: replyText, is_ai: true });
  await metapilotSupabaseAdmin.from("conversations").update({ last_message: replyText, last_message_at: new Date().toISOString(), unread_count: 0 }).eq("id", conv.id);
}

async function handleFeedChange(change: any, pageId: string) {
  if (change?.field !== "feed") return;
  const v = change.value ?? {};
  if (v.item !== "comment" || v.verb !== "add") return;
  const commentId: string | undefined = v.comment_id;
  const postId: string | undefined = v.post_id;
  const text: string = v.message ?? "";
  const fromId: string | undefined = v.from?.id;
  const fromName: string | undefined = v.from?.name;
  if (!commentId || !postId) return;
  if (fromId && fromId === pageId) return;

  const { data: clientRow } = await metapilotSupabaseAdmin.from("clients" as any).select("page_token, page_id").eq("page_id", pageId).limit(1).maybeSingle();
  const pageToken = (clientRow as any)?.page_token;
  if (!pageToken) return;

  const { data: settings } = await metapilotSupabaseAdmin.from("ai_settings").select("*").limit(1).maybeSingle();

  await metapilotSupabaseAdmin.from("comments").insert({ comment_id: commentId, post_id: postId, commenter_id: fromId ?? null, commenter_name: fromName ?? null, text, action: "received" });

  if (settings && (settings as any).auto_reply_comments === false) return;

  const { createAiProvider } = await import("@/lib/ai-gateway.server");
  const { generateText, Output } = await import("ai");
  const { z } = await import("zod");

  let model;
  try {
    const gateway = createAiProvider({ provider: (settings as any)?.provider ?? "lovable", model: (settings as any)?.model ?? "google/gemini-2.0-flash", api_key: (settings as any)?.api_key ?? null, base_url: (settings as any)?.base_url ?? null });
    model = gateway((settings as any)?.model ?? "google/gemini-2.0-flash");
  } catch (err) { console.error("AI provider creation failed:", err); return; }

  const system = `${(settings as any)?.system_instructions ?? ""}\n\nYou are moderating a Facebook page. For each comment, output JSON:\n- is_abusive: true if hateful/abusive/spam/scam. Otherwise false.\n- public_reply: short warm reply. Empty if abusive.\n- private_message: longer DM. Empty if abusive.`;

  let aiOut: { is_abusive: boolean; public_reply: string; private_message: string } | null = null;
  try {
    const result = await generateText({ model, system, prompt: `Commenter: ${fromName ?? "Unknown"}\nComment: ${text || "(no text)"}`,
      output: Output.object({ schema: z.object({ is_abusive: z.boolean(), public_reply: z.string(), private_message: z.string() }) }),
    });
    aiOut = (result as any).output ?? null;
  } catch (err) { console.error("comment AI failed", err); return; }
  if (!aiOut) return;

  if (aiOut.is_abusive) {
    if ((settings as any)?.auto_hide_abusive !== false) {
      await fetch(`https://graph.facebook.com/v21.0/${commentId}?access_token=${encodeURIComponent(pageToken)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_hidden: true }) });
      await metapilotSupabaseAdmin.from("comments").update({ action: "hidden", hidden: true }).eq("comment_id", commentId);
    }
    return;
  }

  if (aiOut.public_reply?.trim()) {
    await fetch(`https://graph.facebook.com/v21.0/${commentId}/comments?access_token=${encodeURIComponent(pageToken)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: aiOut.public_reply.trim() }) });
    await metapilotSupabaseAdmin.from("comments").update({ action: "replied" }).eq("comment_id", commentId);
  }

  if (aiOut.private_message?.trim()) {
    await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageToken)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: aiOut.private_message.trim() }, messaging_type: "RESPONSE" }) });
    await metapilotSupabaseAdmin.from("comments").update({ dm_sent: true }).eq("comment_id", commentId);
  }
}