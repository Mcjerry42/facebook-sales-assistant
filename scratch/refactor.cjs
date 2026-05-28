const fs = require('fs');
let c = fs.readFileSync('src/routes/api/public/fb-webhook.ts', 'utf8');

c = c.replace(
  '.select("verify_token").limit(1).maybeSingle();',
  '.select("verify_token").not("verify_token", "is", null).limit(1).maybeSingle();'
);

c = c.replace(
  '.select("page_access_token, page_id")\n    .limit(1)',
  '.select("page_access_token, page_id, user_id")\n    .eq("page_id", pageId)\n    .limit(1)'
);

c = c.replace(
  '.select("*")\n    .limit(1)',
  '.select("*")\n    .eq("user_id", cfg.user_id)\n    .limit(1)'
);

c = c.replace(
  '.eq("fb_user_id", senderId)',
  '.eq("user_id", cfg.user_id)\n    .eq("fb_user_id", senderId)'
);

c = c.replace(
  'fb_user_id: senderId,',
  'user_id: cfg.user_id,\n        fb_user_id: senderId,'
);

c = c.replace(
  'conversation_id: conv.id,\n    sender: "user",',
  'user_id: cfg.user_id,\n    conversation_id: conv.id,\n    sender: "user",'
);

c = c.replace(
  'conversation_id: conv.id,\n    sender: "ai",',
  'user_id: cfg.user_id,\n    conversation_id: conv.id,\n    sender: "ai",'
);

c = c.replace(
  '.select("question,answer,category")\n    .limit(200)',
  '.select("question,answer,category")\n    .eq("user_id", cfg.user_id)\n    .limit(200)'
);

// Do it again because knowledge_entries is queried twice
c = c.replace(
  '.select("question,answer,category")\n    .limit(200)',
  '.select("question,answer,category")\n    .eq("user_id", cfg.user_id)\n    .limit(200)'
);

c = c.replace(
  '.select("page_access_token, monitored_post_ids")\n    .limit(1)',
  '.select("page_access_token, monitored_post_ids, user_id")\n    .eq("page_id", pageId)\n    .limit(1)'
);

c = c.replace(
  'comment_id: commentId,\n    post_id: postId,',
  'user_id: cfg.user_id,\n    comment_id: commentId,\n    post_id: postId,'
);

// analytics_events
c = c.replace(
  'event_type: "fb_comment_skipped",',
  'user_id: cfg.user_id,\n      event_type: "fb_comment_skipped",'
);
c = c.replace(
  'event_type: "fb_comment_hidden",',
  'user_id: cfg.user_id,\n          event_type: "fb_comment_hidden",'
);
c = c.replace(
  'event_type: "fb_comment_hide_failed",',
  'user_id: cfg.user_id,\n          event_type: "fb_comment_hide_failed",'
);
c = c.replace(
  'event_type: "fb_comment_reply_failed",',
  'user_id: cfg.user_id,\n        event_type: "fb_comment_reply_failed",'
);
c = c.replace(
  'event_type: "fb_comment_replied",',
  'user_id: cfg.user_id,\n        event_type: "fb_comment_replied",'
);
c = c.replace(
  'event_type: "fb_comment_dm_failed",',
  'user_id: cfg.user_id,\n        event_type: "fb_comment_dm_failed",'
);
c = c.replace(
  'event_type: "fb_comment_dm_sent",',
  'user_id: cfg.user_id,\n        event_type: "fb_comment_dm_sent",'
);

fs.writeFileSync('src/routes/api/public/fb-webhook.ts', c);
console.log('Done refactoring fb-webhook.ts');
