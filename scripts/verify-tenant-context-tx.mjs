import fs from 'fs';
import path from 'path';

console.log('--- 11.9-C: Verifying withTenantContext Transaction Client Usage ---');

function findFiles(dir, ext = ['.ts', '.tsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(findFiles(filePath, ext));
    } else if (ext.some(e => file.endsWith(e))) {
      results.push(filePath);
    }
  }
  return results;
}

const files = findFiles('src');
let totalCalls = 0;
let violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('withTenantContext')) continue;

  const regex = /withTenantContext\s*\(\s*([^,]+),\s*async\s*\(([^)]*)\)\s*=>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    totalCalls++;
    const param = match[2].trim();
    const index = match.index;

    const openBrace = content.indexOf('{', index);
    if (openBrace === -1) continue;

    let depth = 1;
    let pos = openBrace + 1;
    while (pos < content.length && depth > 0) {
      if (content[pos] === '{') depth++;
      else if (content[pos] === '}') depth--;
      pos++;
    }

    const callbackBody = content.substring(openBrace, pos);

    if (!param) {
      violations.push({
        file,
        issue: 'Empty parameter list in callback: async () =>',
        snippet: content.substring(index, index + 60).replace(/\n/g, ' ')
      });
    }

    if (callbackBody.includes('prisma.')) {
      violations.push({
        file,
        issue: 'Calls global prisma inside withTenantContext callback',
        snippet: content.substring(index, index + 60).replace(/\n/g, ' ')
      });
    }
  }
}

console.log(`Scanned ${files.length} files. Total withTenantContext calls: ${totalCalls}`);

if (violations.length > 0) {
  console.error(`FAIL: Found ${violations.length} violations of tenant context transaction usage:`);
  for (const v of violations) {
    console.error(`- ${path.relative(process.cwd(), v.file)}: ${v.issue} (${v.snippet})`);
  }
  process.exit(1);
} else {
  console.log('PASS: 100% of withTenantContext calls properly use transaction client tx.');
  console.log('--- 11.9-C Verification COMPLETE: ALL TESTS PASSED ---\n');
}
