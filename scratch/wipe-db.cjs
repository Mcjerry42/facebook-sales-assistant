const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.METAPILOT_SUPABASE_URL,
    process.env.METAPILOT_SUPABASE_SERVICE_ROLE_KEY
  );

  const tables = [
    'messages',
    'orders',
    'comments',
    'conversations',
    'analytics_events',
    'knowledge_entries',
    'fb_config',
    'ai_settings',
    'sheets_config',
    'profiles',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`Error deleting from ${table}:`, error);
    } else {
      console.log(`Cleared table ${table}`);
    }
  }

  console.log("Fetching all users...");
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  console.log(`Found ${users.length} users. Deleting...`);
  for (const user of users) {
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error(`Failed to delete ${user.id}:`, delErr);
    } else {
      console.log(`Deleted user ${user.id} (${user.email})`);
    }
  }

  console.log("Database reset complete!");
}

main();
