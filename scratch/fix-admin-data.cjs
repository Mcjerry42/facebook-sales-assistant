
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.METAPILOT_SUPABASE_URL,
    process.env.METAPILOT_SUPABASE_SERVICE_ROLE_KEY
  );

  // Find admin user
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) {
    console.error("Failed to list users", uErr);
    return;
  }

  const admin = users.users.find(u => u.email === "nanjerry42@gmail.com");
  if (!admin) {
    console.error("Admin user not found!");
    return;
  }

  const adminId = admin.id;
  console.log("Found admin ID:", adminId);

  const tables = [
    'fb_config',
    'ai_settings',
    'sheets_config',
    'knowledge_entries',
    'conversations',
    'messages',
    'comments',
    'orders',
    'analytics_events'
  ];

  for (const table of tables) {
    console.log(`Updating ${table}...`);
    const { data, error } = await supabase
      .from(table)
      .update({ user_id: adminId })
      .is('user_id', null)
      .select('id');
    
    if (error) {
      console.error(`Error updating ${table}:`, error);
    } else {
      console.log(`Updated ${data?.length || 0} rows in ${table}`);
    }
  }

  console.log("Done fixing admin data!");
}

main();
