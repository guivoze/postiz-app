#!/usr/bin/env node
// Triagi patch: rewrite LinkedIn provider scopes to bare minimum that user has.
// Avoids the upstream r_basicprofile dead scope AND the org scopes that
// require Marketing Developer Platform (which Triagi does not have).
const fs = require('fs');

const files = {
  '/app/apps/backend/dist/libraries/nestjs-libraries/src/integrations/social/linkedin.provider.js':
    '["openid","profile","w_member_social"]',
  '/app/apps/backend/dist/libraries/nestjs-libraries/src/integrations/social/linkedin.page.provider.js':
    '["openid","profile","w_member_social"]',
};

let any = false;
for (const [file, replacement] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    console.log('SKIP missing:', file);
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  const re = /this\.scopes\s*=\s*\[[\s\S]*?\];?/m;
  if (!re.test(src)) {
    console.log('NO MATCH in:', file);
    continue;
  }
  src = src.replace(re, `this.scopes = ${replacement};`);
  fs.writeFileSync(file, src);
  console.log('PATCHED', file, '->', replacement);
  any = true;
}

if (!any) {
  console.error('triagi-patch: no files patched');
  process.exit(1);
}
