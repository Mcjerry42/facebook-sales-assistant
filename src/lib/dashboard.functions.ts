import { createServerFn } from "@tanstack/react-start";
import { requireMetapilotAuth } from "@/lib/metapilot-auth-middleware";
import { z } from "zod";

type DbError = { message: string } | null;
type RoleSelector = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: DbError }>;
      };
    };
  };
};
type RoleClient = {
  from: (table: string) => unknown;
};
type KnowledgeEntry = { question: string | null; answer: string | null };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function assertAdmin(supabase: RoleClient, userId: string) {
  const userRoles = supabase.from("user_roles") as RoleSelector;
  const { data, error } = await userRoles
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin role required");
}

export const getDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireMetapilotAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [convs, orders, comments, msgs, settings, fb, sheets] = await Promise.all([
      supabase
        .from("conversations")
        .select("id,fb_user_name,last_message,last_message_at,unread_count,human_takeover")
        .order("last_message_at", { ascending: false })
        .limit(50),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("comments").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("messages").select("id", { count: "exact", head: true }),
      supabase.from("ai_settings").select("*").limit(1).maybeSingle(),
      supabase.from("fb_config").select("*").limit(1).maybeSingle(),
      supabase.from("sheets_config").select("*").limit(1).maybeSingle(),
    ]);
    return {
      conversations: convs.data ?? [],
      orders: orders.data ?? [],
      comments: comments.data ?? [],
      messageCount: msgs.count ?? 0,
      aiSettings: settings.data,
      fbConfig: fb.data,
      sheetsConfig: sheets.data,
    };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireMetapilotAuth])
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return msgs ?? [];
  });

export const getAdminControls = createServerFn({ method: "GET" })
  .middleware([requireMetapilotAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [profiles, settings] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,full_name,is_approved,approved_until,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("app_settings")
        .select(
          "id,price_bdt,duration_days,whatsapp_number,package_name,paywall_title,paywall_message,updated_at",
        )
        .limit(1)
        .maybeSingle(),
    ]);

    if (profiles.error) throw new Error(profiles.error.message);
    if (settings.error) throw new Error(settings.error.message);

    return {
      profiles: profiles.data ?? [],
      settings: settings.data,
    };
  });

export const updateUserApproval = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        is_approved: z.boolean(),
        approved_until: z.string().datetime().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabase
      .from("profiles")
      .update({
        is_approved: data.is_approved,
        approved_until: data.approved_until ?? null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PackageSettingsSchema = z.object({
  price_bdt: z.coerce.number().min(0).max(10000000),
  duration_days: z.coerce.number().int().min(1).max(3650),
  whatsapp_number: z.string().max(50).nullable().optional(),
  package_name: z.string().min(1).max(100),
  paywall_title: z.string().min(1).max(200),
  paywall_message: z.string().min(1).max(1200),
});

export const savePackageSettings = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((input: unknown) => PackageSettingsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: existing, error: findError } = await supabase
      .from("app_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    const payload = {
      ...data,
      whatsapp_number: data.whatsapp_number || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("app_settings").update(payload).eq("id", existing.id)
      : await supabase.from("app_settings").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AiSettingsSchema = z.object({
  provider: z.enum(["lovable", "openai", "gemini"]),
  model: z.string().min(1).max(100),
  api_key: z.string().max(500).nullable().optional(),
  system_instructions: z.string().max(8000),
  language_mode: z.enum(["auto", "bn", "en"]),
  auto_reply_messages: z.boolean(),
  auto_reply_comments: z.boolean(),
  auto_hide_abusive: z.boolean(),
  comment_trigger_keywords: z.array(z.string().min(1).max(50)).max(50),
});

export const saveAiSettings = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((input: unknown) => AiSettingsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: existing } = await supabase
      .from("ai_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("ai_settings")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("ai_settings").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const FbConfigSchema = z.object({
  page_id: z.string().max(100).nullable().optional(),
  page_name: z.string().max(200).nullable().optional(),
  page_access_token: z.string().max(1000).nullable().optional(),
  verify_token: z.string().max(200).nullable().optional(),
  app_secret: z.string().max(500).nullable().optional(),
  monitored_post_ids: z.array(z.string().min(1).max(100)).max(100).optional(),
});

export const saveFbConfig = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((input: unknown) => FbConfigSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: existing } = await supabase.from("fb_config").select("id").limit(1).maybeSingle();
    const payload = {
      ...data,
      connected: !!data.page_access_token,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { error } = await supabase.from("fb_config").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("fb_config").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const SheetsSchema = z.object({
  sheet_url: z.string().url().max(500),
  sheet_name: z.string().max(100).default("Sheet1"),
});

function extractSheetId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

export const connectSheet = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((input: unknown) => SheetsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const sheetId = extractSheetId(data.sheet_url);
    if (!sheetId) throw new Error("Invalid Google Sheets URL");

    // Fetch as CSV (sheet must be publicly viewable via link)
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(data.sheet_name)}`;
    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(
        "Could not read the sheet. Make sure sharing is set to 'Anyone with the link'.",
      );
    }
    const csv = await res.text();
    const rows = parseCsv(csv);
    if (rows.length < 1) throw new Error("Sheet is empty");

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const qIdx = headers.findIndex((h) => h.includes("question") || h.includes("প্রশ্ন"));
    const aIdx = headers.findIndex((h) => h.includes("answer") || h.includes("উত্তর"));
    const cIdx = headers.findIndex((h) => h.includes("category") || h.includes("ক্যাটাগরি"));

    // Clear and re-insert
    await supabase
      .from("knowledge_entries")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    const entries = rows
      .slice(1)
      .filter((r) => r.some((c) => c.trim()))
      .map((row) => ({
        question: qIdx >= 0 ? row[qIdx] : row[0],
        answer: aIdx >= 0 ? row[aIdx] : row.slice(1).join(" | "),
        category: cIdx >= 0 ? row[cIdx] : null,
        raw_row: row.reduce((acc, val, i) => ({ ...acc, [headers[i] ?? `col${i}`]: val }), {}),
      }));
    if (entries.length > 0) {
      const { error } = await supabase.from("knowledge_entries").insert(entries);
      if (error) throw new Error(error.message);
    }

    const { data: existing } = await supabase
      .from("sheets_config")
      .select("id")
      .limit(1)
      .maybeSingle();
    const payload = {
      sheet_url: data.sheet_url,
      sheet_id: sheetId,
      sheet_name: data.sheet_name,
      last_synced_at: new Date().toISOString(),
      row_count: entries.length,
      connected: true,
      updated_at: new Date().toISOString(),
    };
    if (existing) await supabase.from("sheets_config").update(payload).eq("id", existing.id);
    else await supabase.from("sheets_config").insert(payload);

    return { ok: true, rowCount: entries.length };
  });

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (ch === "\r") {
        /* skip */
      } else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

export const askAi = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((d: unknown) => z.object({ message: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: settings } = await supabase
      .from("ai_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    const { data: kb } = await supabase
      .from("knowledge_entries")
      .select("question,answer,category")
      .limit(200);

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText } = await import("ai");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway(settings?.model ?? "google/gemini-3-flash-preview");
    const kbText = ((kb ?? []) as KnowledgeEntry[])
      .map((k) => `Q: ${k.question}\nA: ${k.answer}`)
      .join("\n---\n");
    const system = `${settings?.system_instructions ?? ""}\n\nKnowledge Base:\n${kbText || "(empty — admin has not connected Google Sheets yet)"}`;

    const result = await generateText({
      model,
      system,
      prompt: data.message,
    });
    return { text: result.text };
  });

export const toggleHumanTakeover = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((d: unknown) =>
    z.object({ conversationId: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("conversations")
      .update({ human_takeover: data.enabled })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveOrdersSheet = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((d: unknown) =>
    z.object({ orders_sheet_url: z.string().url().max(500).nullable().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: existing } = await supabase
      .from("sheets_config")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("sheets_config")
        .update({
          orders_sheet_url: data.orders_sheet_url ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("sheets_config")
        .insert({ orders_sheet_url: data.orders_sheet_url ?? null });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const testOrdersSheet = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: cfg } = await supabase
      .from("sheets_config")
      .select("orders_sheet_url")
      .limit(1)
      .maybeSingle();
    const url = cfg?.orders_sheet_url;
    if (!url) throw new Error("Save an Apps Script URL first");
    const sample = {
      id: "test-" + Date.now(),
      created_at: new Date().toISOString(),
      customer_name: "Test Customer",
      phone: "01700000000",
      address: "Test address, Dhaka",
      items: [{ name: "Sample Product", quantity: 1, price: 100 }],
      total: 100,
      status: "pending",
      notes: "Test row from MetaPilot",
    };
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample),
      });
    } catch (err: unknown) {
      throw new Error("Network error: " + errorMessage(err));
    }
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Apps Script returned ${res.status}: ${text.slice(0, 300)}`);
    }
    return { ok: true, status: res.status, response: text.slice(0, 500) };
  });
