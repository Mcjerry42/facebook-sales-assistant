const fs = require('fs');
let c = fs.readFileSync('src/routes/api/public/fb-webhook.ts', 'utf8');

c = c.replace(
  /await tryExtractAndSaveOrder\(\{\s*conversationId: conv\.id,\s*model: settings\?\.model \?\? "google\/gemini-3-flash-preview",\s*\}\);/,
  `await tryExtractAndSaveOrder({\n      conversationId: conv.id,\n      model: settings?.model ?? "google/gemini-3-flash-preview",\n      userId: cfg.user_id,\n    });`
);

fs.writeFileSync('src/routes/api/public/fb-webhook.ts', c);
console.log('Webhook order extractor fix applied!');
