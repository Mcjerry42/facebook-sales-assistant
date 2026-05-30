const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.METAPILOT_SUPABASE_URL,
    process.env.METAPILOT_SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: convs, error } = await supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Error fetching conversations:", error);
    return;
  }

  // Group by user_id + fb_user_id
  const groups = {};
  for (const c of convs) {
    const key = `${c.user_id}_${c.fb_user_id}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  for (const key of Object.keys(groups)) {
    const group = groups[key];
    if (group.length > 1) {
      console.log(`Found ${group.length} conversations for ${key}`);
      // Keep the first one
      const keep = group[0];
      const deleteIds = group.slice(1).map(c => c.id);

      // Move messages
      const { error: updErr } = await supabase
        .from('messages')
        .update({ conversation_id: keep.id })
        .in('conversation_id', deleteIds);
      
      if (updErr) console.error("Error updating messages:", updErr);

      // Move orders
      const { error: ordErr } = await supabase
        .from('orders')
        .update({ conversation_id: keep.id })
        .in('conversation_id', deleteIds);

      if (ordErr) console.error("Error updating orders:", ordErr);

      // Delete the duplicate conversations
      const { error: delErr } = await supabase
        .from('conversations')
        .delete()
        .in('id', deleteIds);
      
      if (delErr) console.error("Error deleting conversations:", delErr);
      else console.log(`Merged ${deleteIds.length} into ${keep.id}`);

      // Update the keep conversation with the latest last_message_at
      const latest = group[group.length - 1];
      await supabase
        .from('conversations')
        .update({
          last_message: latest.last_message,
          last_message_at: latest.last_message_at,
          unread_count: 0 // Resetting unread count just in case
        })
        .eq('id', keep.id);
    }
  }
}

main();
