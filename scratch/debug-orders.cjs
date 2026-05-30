const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.METAPILOT_SUPABASE_URL,
    process.env.METAPILOT_SUPABASE_SERVICE_ROLE_KEY
  );

  // Check latest analytics events related to orders
  console.log("=== Recent order-related analytics ===");
  const { data: events } = await supabase
    .from('analytics_events')
    .select('*')
    .in('event_type', ['order_extraction_attempt', 'order_extraction_failed', 'fb_webhook_error', 'fb_send_failed'])
    .order('created_at', { ascending: false })
    .limit(5);
  console.log(JSON.stringify(events, null, 2));

  // Check latest orders
  console.log("\n=== Recent orders ===");
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  console.log(JSON.stringify(orders, null, 2));

  // Check latest conversations to find the one used
  console.log("\n=== Recent conversations ===");
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, fb_user_name, last_message, last_message_at, user_id')
    .order('last_message_at', { ascending: false })
    .limit(5);
  console.log(JSON.stringify(convs, null, 2));

  // Check latest messages from the most recent conversation
  if (convs && convs.length > 0) {
    console.log("\n=== Latest messages from most recent conv ===");
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender, text, is_ai, created_at')
      .eq('conversation_id', convs[0].id)
      .order('created_at', { ascending: false })
      .limit(10);
    console.log(JSON.stringify(msgs, null, 2));
  }

  // Check all webhook events in the last 10 minutes
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  console.log("\n=== All analytics events in last 10 mins ===");
  const { data: recentAll } = await supabase
    .from('analytics_events')
    .select('event_type, created_at, meta')
    .gte('created_at', tenMinsAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(JSON.stringify(recentAll?.map(e => ({ type: e.event_type, at: e.created_at, meta_keys: Object.keys(e.meta || {}) })), null, 2));
}

main();
