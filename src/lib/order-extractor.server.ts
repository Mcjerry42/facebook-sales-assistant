import { metapilotSupabaseAdmin } from "@/lib/metapilot-supabase.server";

/**
 * Attempts to extract a structured order from the recent conversation
 * using the Lovable AI gateway. If a complete order is found and not
 * already saved for this conversation, inserts into `orders` (which
 * triggers an analytics_events row via DB trigger).
 */
export async function tryExtractAndSaveOrder(args: {
  conversationId: string;
  model: string;
  userId: string;
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { saved: false, reason: "no_api_key" };

  // Don't double-create an order for the same conversation in the last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await metapilotSupabaseAdmin
    .from("orders")
    .select("id")
    .eq("conversation_id", args.conversationId)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (existing) return { saved: false, reason: "already_exists" };

  const { data: history } = await metapilotSupabaseAdmin
    .from("messages")
    .select("sender,text,is_ai,created_at")
    .eq("conversation_id", args.conversationId)
    .order("created_at", { ascending: false })
    .limit(30);
  const recent = (history ?? []).slice().reverse();
  if (recent.length < 2) return { saved: false, reason: "too_short" };

  const transcript = recent
    .map((m: any) => `${m.is_ai ? "AGENT" : "CUSTOMER"}: ${m.text}`)
    .join("\n");

  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const { generateText } = await import("ai");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway(args.model);

  const system = `You extract orders from chat transcripts (Bengali / English / Banglish).
  Return STRICT JSON only, no markdown, matching this TypeScript type:
  { "is_order": boolean, "customer_name": string|null, "phone": string|null, "address": string|null, "items": Array<{ "name": string, "quantity": number, "price": number|null }>, "total": number|null, "notes": string|null }

  Rules:
  - "is_order" = true ONLY if the customer has CONFIRMED an order AND we have at least: name, phone, address, and at least one item.
  - Phone must look like a valid phone number (can contain digits, spaces, hyphens, parentheses, or +; must have at least 8 digits). If unsure, set is_order=false.
  - If anything required is missing or ambiguous, set is_order=false and leave fields null.
  - Do NOT invent data. If the customer is only asking questions, is_order=false.`;

  let parsed: any = null;
  try {
    const result = await generateText({
      model,
      system,
      prompt: `Transcript:\n${transcript}\n\nReturn JSON only.`,
    });
    const text = result.text?.trim() ?? "";
    const jsonStr = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error("order extraction failed", err);
    try {
      await metapilotSupabaseAdmin.from("analytics_events").insert({
        user_id: args.userId,
        event_type: "order_extraction_failed",
        meta: {
          conversation_id: args.conversationId,
          error: String(err),
        }
      });
    } catch (e) {
      console.error("failed to log extraction error", e);
    }
    return { saved: false, reason: "parse_error" };
  }

  // Log the extraction attempt with parsed results
  try {
    await metapilotSupabaseAdmin.from("analytics_events").insert({
      user_id: args.userId,
      event_type: "order_extraction_attempt",
      meta: {
        conversation_id: args.conversationId,
        is_order: parsed?.is_order,
        extracted: parsed,
      }
    });
  } catch (e) {
    console.error("failed to log extraction attempt", e);
  }

  if (!parsed?.is_order) return { saved: false, reason: "not_order" };
  if (!parsed.customer_name || !parsed.phone || !parsed.address) {
    return { saved: false, reason: "missing_fields" };
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (items.length === 0) return { saved: false, reason: "no_items" };

  const total = Number(
    parsed.total ??
      items.reduce((s: number, it: any) => s + Number(it.price ?? 0) * Number(it.quantity ?? 1), 0),
  );

  const { data: inserted, error } = await metapilotSupabaseAdmin
    .from("orders")
    .insert({
      user_id: args.userId,
      conversation_id: args.conversationId,
      customer_name: String(parsed.customer_name).slice(0, 200),
      phone: String(parsed.phone).slice(0, 50),
      address: String(parsed.address).slice(0, 1000),
      items,
      total: isFinite(total) ? total : 0,
      notes: parsed.notes ? String(parsed.notes).slice(0, 1000) : null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    console.error("order insert failed", error);
    return { saved: false, reason: error.message };
  }

  // Best-effort push to Google Sheets if a sheet URL is configured.
  try {
    await pushOrderToSheet(inserted, args.userId);
  } catch (err) {
    console.error("sheet push failed", err);
  }

  return { saved: true, order: inserted };
}

async function pushOrderToSheet(order: any, userId: string) {
  const { data: cfg } = await metapilotSupabaseAdmin
    .from("sheets_config")
    .select("orders_sheet_url")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const url = cfg?.orders_sheet_url;
  if (!url) return;
  // Expect a Google Apps Script Web App URL that accepts POST JSON.
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: order.id,
      created_at: order.created_at,
      customer_name: order.customer_name,
      phone: order.phone,
      address: order.address,
      items: order.items,
      total: order.total,
      status: order.status,
      notes: order.notes,
    }),
  });
  await metapilotSupabaseAdmin
    .from("sheets_config")
    .update({ orders_last_synced_at: new Date().toISOString() })
    .eq("id", (await metapilotSupabaseAdmin.from("sheets_config").select("id").eq("user_id", userId).limit(1).maybeSingle()).data!.id);
}