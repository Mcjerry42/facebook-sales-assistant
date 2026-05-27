import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/fb-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const { data } = await supabaseAdmin.from("fb_config").select("verify_token").limit(1).maybeSingle();
        const expected = data?.verify_token ?? "lovable_fb_verify_token";
        if (mode === "subscribe" && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          await supabaseAdmin.from("analytics_events").insert({
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
                  await supabaseAdmin.from("analytics_events").insert({
                    event_type: "fb_webhook_error",
                    meta: { error: String(err), event: ev },
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

  const { data: cfg } = await supabaseAdmin
    .from("fb_config")
    .select("page_access_token, page_id")
    .limit(1)
    .maybeSingle();
  if (!cfg?.page_access_token) {
    console.warn("No page_access_token configured; skipping reply");
    return;
  }

  const { data: settings } = await supabaseAdmin
    .from("ai_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  // Find or create conversation
  let { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("*")
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
    const { data: created } = await supabaseAdmin
      .from("conversations")
      .insert({
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
    await supabaseAdmin
      .from("conversations")
      .update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        unread_count: (conv.unread_count ?? 0) + 1,
      })
      .eq("id", conv.id);
  }

  // Save inbound message
  await supabaseAdmin.from("messages").insert({
    conversation_id: conv.id,
    sender: "user",
    text,
    is_ai: false,
  });

  // Stop here if human takeover or auto-reply disabled
  if (conv.human_takeover) return;
  if (settings && settings.auto_reply_messages === false) return;

  // Load knowledge base (recent history is also nice but keep it simple)
  const { data: kb } = await supabaseAdmin
    .from("knowledge_entries")
    .select("question,answer,category")
    .limit(200);

  const { data: history } = await supabaseAdmin
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
    await supabaseAdmin.from("analytics_events").insert({
      event_type: "fb_send_failed",
      meta: { status: sendRes.status, body: errText },
    });
    return;
  }

  await supabaseAdmin.from("messages").insert({
    conversation_id: conv.id,
    sender: "ai",
    text: replyText,
    is_ai: true,
  });
  await supabaseAdmin
    .from("conversations")
    .update({
      last_message: replyText,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    })
    .eq("id", conv.id);
}