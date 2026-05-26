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
        // Webhook receiver — async processing stub.
        // Full FB Graph API processing happens once admin saves a Page Access Token.
        try {
          const body = await request.json();
          await supabaseAdmin.from("analytics_events").insert({
            event_type: "fb_webhook_received",
            meta: body,
          });
        } catch (e) {
          console.error("FB webhook error", e);
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});