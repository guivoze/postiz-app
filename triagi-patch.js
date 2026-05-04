#!/usr/bin/env node
// Triagi patch — debug LinkedIn token exchange response.
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
    changed = true;
  }

  const promptRe = /&prompt=none/g;
  if (promptRe.test(src)) {
    src = src.replace(promptRe, '');
    changed = true;
  }

  // Replace the entire token-exchange-and-destructure block with a debug version
  // that logs the raw token response BEFORE destructuring.
  const tokenRe = /const\s*\{\s*access_token:\s*accessToken,\s*expires_in:\s*expiresIn,\s*refresh_token:\s*refreshToken,\s*scope,\s*\}\s*=\s*await\s*\(await\s*fetch\('https:\/\/www\.linkedin\.com\/oauth\/v2\/accessToken',\s*\{[\s\S]*?\}\)\)\.json\(\);/m;
  if (tokenRe.test(src)) {
    src = src.replace(
      tokenRe,
      `const __triagiTokenResp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        const __triagiTokenStatus = __triagiTokenResp.status;
        const __triagiTokenJson = await __triagiTokenResp.json();
        console.log("[TRIAGI-DEBUG] linkedin token exchange status=", __triagiTokenStatus, "json=", JSON.stringify(__triagiTokenJson));
        const { access_token: accessToken, expires_in: expiresIn, refresh_token: refreshToken, scope } = __triagiTokenJson;`
    );
    console.log('PATCHED token-exchange logger:', file);
    changed = true;
  } else {
    console.log('NO TOKEN MATCH (fallback to log only):', file);
    const checkRe = /this\.checkScopes\(this\.scopes, scope\);/g;
    if (checkRe.test(src)) {
      src = src.replace(
        checkRe,
        'console.log("[TRIAGI-DEBUG] linkedin oauth response scope=", JSON.stringify(scope), "expected=", JSON.stringify(this.scopes)); this.checkScopes(this.scopes, scope);'
      );
      changed = true;
    }
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
