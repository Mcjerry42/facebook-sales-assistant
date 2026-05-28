const fs = require('fs');
let c = fs.readFileSync('src/routes/api/public/fb-webhook.ts', 'utf8');

// Replace verify_token select
c = c.replace(
  /\.select\("verify_token"\)\.limit\(1\)\.maybeSingle\(\)/,
  '.select("verify_token").not("verify_token", "is", null).limit(1).maybeSingle()'
);

// handleMessagingEvent: fb_config select
c = c.replace(
  /\.select\("page_access_token,\s*page_id"\)\s*\.limit\(1\)/,
  '.select("page_access_token, page_id, user_id")\n    .eq("page_id", pageId)\n    .limit(1)'
);

// ai_settings select
c = c.replace(
  /\.from\("ai_settings"\)\s*\.select\("\*"\)\s*\.limit\(1\)/g,
  '.from("ai_settings")\n    .select("*")\n    .eq("user_id", cfg.user_id)\n    .limit(1)'
);

// conversations find
c = c.replace(
  /\.eq\("fb_user_id",\s*senderId\)/g,
  '.eq("user_id", cfg.user_id)\n    .eq("fb_user_id", senderId)'
);

// conversations insert
c = c.replace(
  /fb_user_id:\s*senderId,/g,
  'user_id: cfg.user_id,\n        fb_user_id: senderId,'
);

// messages insert (sender user)
c = c.replace(
  /conversation_id:\s*conv\.id,\s*sender:\s*"user",/g,
  'user_id: cfg.user_id,\n    conversation_id: conv.id,\n    sender: "user",'
);

// messages insert (sender ai)
c = c.replace(
  /conversation_id:\s*conv\.id,\s*sender:\s*"ai",/g,
  'user_id: cfg.user_id,\n    conversation_id: conv.id,\n    sender: "ai",'
);

// knowledge_entries select
c = c.replace(
  /\.select\("question,answer,category"\)\s*\.limit\(200\)/g,
  '.select("question,answer,category")\n    .eq("user_id", cfg.user_id)\n    .limit(200)'
);

// handleFeedChange: fb_config select
c = c.replace(
  /\.select\("page_access_token,\s*monitored_post_ids"\)\s*\.limit\(1\)/,
  '.select("page_access_token, monitored_post_ids, user_id")\n    .eq("page_id", pageId)\n    .limit(1)'
);

// comments insert (received)
c = c.replace(
  /comment_id:\s*commentId,\s*post_id:\s*postId,/g,
  'user_id: cfg.user_id,\n    comment_id: commentId,\n    post_id: postId,'
);

// analytics_events
const events = [
  "fb_comment_skipped",
  "fb_comment_hidden",
  "fb_comment_hide_failed",
  "fb_comment_reply_failed",
  "fb_comment_replied",
  "fb_comment_dm_failed",
  "fb_comment_dm_sent"
];

for (const ev of events) {
  c = c.replace(
    new RegExp(`event_type:\\s*"${ev}",`, 'g'),
    `user_id: cfg.user_id,\n      event_type: "${ev}",`
  );
}

fs.writeFileSync('src/routes/api/public/fb-webhook.ts', c);
console.log('Webhook fix applied!');
