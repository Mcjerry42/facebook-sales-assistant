const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.METAPILOT_SUPABASE_URL,
    process.env.METAPILOT_SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', 'a56b626d-9d05-43c1-afa6-917f726e9472')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  if (!conv) {
    console.log("No conv");
    return;
  }

  console.log("Triggering order extraction for conversation:", conv.id);

  // Dynamically import the ts-node/register to run the typescript function
  // Actually, we can just run it via node with a dummy call using fetch to our API if we had one.
  // Instead, let's just make a dummy request to our webhook with the same text to re-trigger the webhook logic!
  const ev = {
    object: "page",
    entry: [{
      id: "dummy",
      messaging: [{
        sender: { id: conv.fb_user_id },
        message: { text: "please confirm my order" }
      }]
    }]
  };

  // wait, the webhook needs the pageId. We don't have it easily without config.
  // I will just use fetch to send a message to the deployed webhook on Cloudflare!
  // It's at https://facebook-sales-assistant.eizelpop.workers.dev/api/public/fb-webhook
  
  const { data: cfg } = await supabase.from('fb_config').select('page_id').eq('user_id', conv.user_id).single();

  const webhookUrl = "https://facebook-sales-assistant.eizelpop.workers.dev/api/public/fb-webhook";
  
  const payload = {
    object: "page",
    entry: [{
      id: cfg.page_id,
      messaging: [{
        sender: { id: conv.fb_user_id },
        message: { text: "Yes, please confirm my order now with the details I gave earlier." }
      }]
    }]
  };

  console.log("Sending to webhook...");
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log("Response:", res.status, await res.text());
}

main();
