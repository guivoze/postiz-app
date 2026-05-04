#!/usr/bin/env node
// Triagi patch — fixes Postiz LinkedIn OAuth for self-hosted apps that don't
// have Marketing Developer Platform / Community Management API approved.
//
// Root causes (confirmed by upstream issue gitroomhq/postiz-app#1197 comment
// from Minifab on 2026-02-22):
//   1. r_basicprofile is deprecated by LinkedIn (legacy "Sign In with LinkedIn" product gone).
//   2. prompt=none in the OAuth URL breaks first-time auth (no prior consent session).
//   3. The org scopes (rw_organization_admin, w_organization_social, r_organization_social)
//      require Community Management API, which can't coexist with Sign In + Share on
//      LinkedIn on the same LinkedIn app — LinkedIn blocks the OAuth entirely.
//
// Fix:
//   - Rewrite scopes to the minimum that Triagi LinkedIn app actually has approved
//     (Sign In OpenID + Share on LinkedIn): openid + profile + w_member_social.
//   - Strip prompt=none from the OAuth URL.
const fs = require('fs');

const targets = [
  '/app/apps/backend/dist/libraries/nestjs-libraries/src/integrations/social/linkedin.provider.js',
  '/app/apps/backend/dist/libraries/nestjs-libraries/src/integrations/social/linkedin.page.provider.js',
];

const minimalScopes = '["openid","profile","w_member_social"]';

let any = false;
for (const file of targets) {
  if (!fs.existsSync(file)) {
    console.log('SKIP missing:', file);
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  let changed = false;

  const scopesRe = /this\.scopes\s*=\s*\[[\s\S]*?\];?/m;
  if (scopesRe.test(src)) {
    src = src.replace(scopesRe, `this.scopes = ${minimalScopes};`);
    console.log('PATCHED scopes:', file);
    changed = true;
  } else {
    console.log('NO SCOPES MATCH:', file);
  }

  const promptRe = /&prompt=none/g;
  if (promptRe.test(src)) {
    src = src.replace(promptRe, '');
    console.log('PATCHED prompt=none removed:', file);
    changed = true;
  } else {
    console.log('NO prompt=none found in:', file);
  }

  if (changed) {
    fs.writeFileSync(file, src);
    any = true;
  }
}

if (!any) {
  console.error('triagi-patch: no files patched');
  process.exit(1);
}
