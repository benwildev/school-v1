import { SignJWT, jwtVerify } from 'jose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env
dotenv.config();

console.log('--- 11.9-A: Hardcoded Fallback Secrets Verification ---');

// 1. Check for old fallback strings in src/
const OLD_FALLBACKS = [
  'edusmart-bd-dev-secret-key-at-least-32-chars-long!',
  'edusmart-bd-production-device-encryption-key-salt-2026',
  'edusmart-webhook-secret-salt-2026',
];

let fallbackFound = false;
function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(ts|tsx|js|mjs)$/.test(file)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const fallback of OLD_FALLBACKS) {
        if (content.includes(fallback)) {
          console.error(`FAIL: Hardcoded fallback secret '${fallback}' found in ${fullPath}`);
          fallbackFound = true;
        }
      }
    }
  }
}

scanDir('src');
if (fallbackFound) {
  console.error('FAILED: Hardcoded fallback secrets detected in source files.');
  process.exit(1);
} else {
  console.log('PASS: Zero hardcoded fallback secrets found in src/.');
}

// 2. Verify forged JWT signed with old fallback secret is REJECTED
async function testForgedJwtRejection() {
  const forgedKey = new TextEncoder().encode('edusmart-bd-dev-secret-key-at-least-32-chars-long!');
  const realKey = new TextEncoder().encode(process.env.AUTH_SECRET);

  const forgedToken = await new SignJWT({
    userId: 'attacker-123',
    sessionId: 'session-attacker',
    isSuperAdmin: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(forgedKey);

  try {
    await jwtVerify(forgedToken, realKey, { algorithms: ['HS256'] });
    console.error('FAIL: Forged JWT was accepted by real secret!');
    process.exit(1);
  } catch (err) {
    console.log('PASS: Forged JWT signed with old fallback secret was rejected:', err.code || err.message);
  }

  // Verify valid token with real secret works
  const validToken = await new SignJWT({
    userId: 'valid-user',
    sessionId: 'session-valid',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(realKey);

  const { payload } = await jwtVerify(validToken, realKey, { algorithms: ['HS256'] });
  if (payload.userId === 'valid-user') {
    console.log('PASS: Valid JWT signed with AUTH_SECRET verified successfully.');
  } else {
    console.error('FAIL: Valid JWT verification failed.');
    process.exit(1);
  }
}

testForgedJwtRejection().then(() => {
  console.log('--- 11.9-A Verification COMPLETE: ALL TESTS PASSED ---\n');
});
