const fs = require('fs');
let c = fs.readFileSync('src/routes/api/public/fb-webhook.ts', 'utf8');

// Combine ai_settings and knowledge_entries
c = c.replace(
  `  const { data: settings } = await metapilotSupabaseAdmin
    .from("ai_settings")
    .select("*")
    .eq("user_id", cfg.user_id)
    .limit(1)
    .maybeSingle();`,
  `  const [settingsRes, kbRes] = await Promise.all([
    metapilotSupabaseAdmin.from("ai_settings").select("*").eq("user_id", cfg.user_id).limit(1).maybeSingle(),
    metapilotSupabaseAdmin.from("knowledge_entries").select("question,answer,category").eq("user_id", cfg.user_id).limit(200)
  ]);
  const settings = settingsRes.data;
  const kb = kbRes.data;`
);

// Remove the old knowledge_entries fetch
c = c.replace(
  `  const { data: kb } = await metapilotSupabaseAdmin
    .from("knowledge_entries")
    .select("question,answer,category")
    .eq("user_id", cfg.user_id)
    .limit(200);`,
  ``
);

// Combine history load and message insert
c = c.replace(
  `  // Save inbound message
  await metapilotSupabaseAdmin.from("messages").insert({
    user_id: cfg.user_id,
    conversation_id: conv.id,
    sender: "user",
    text,
    is_ai: false,
  });

  // Stop here if human takeover or auto-reply disabled
  if (conv.human_takeover) return;
  if (settings && settings.auto_reply_messages === false) return;`,
  `  // Stop here if human takeover or auto-reply disabled
  if (conv.human_takeover) return;
  if (settings && settings.auto_reply_messages === false) return;`
);

c = c.replace(
  `  const { data: history } = await metapilotSupabaseAdmin
    .from("messages")
    .select("sender,text,is_ai,created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(10);`,
  `  const [historyRes] = await Promise.all([
    metapilotSupabaseAdmin.from("messages").select("sender,text,is_ai,created_at").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(10),
    metapilotSupabaseAdmin.from("messages").insert({ user_id: cfg.user_id, conversation_id: conv.id, sender: "user", text, is_ai: false })
  ]);
  const history = historyRes.data;`
);

// Replace model strings
c = c.replace(/"google\/gemini-3-flash-preview"/g, '"google/gemini-1.5-flash"');

fs.writeFileSync('src/routes/api/public/fb-webhook.ts', c);

// Also replace in dashboard.ai.tsx
let ai = fs.readFileSync('src/routes/dashboard.ai.tsx', 'utf8');
ai = ai.replace(/"google\/gemini-3-flash-preview"/g, '"google/gemini-1.5-flash"');
fs.writeFileSync('src/routes/dashboard.ai.tsx', ai);

console.log('Webhook optimization applied!');
