import fs from 'fs';
import path from 'path';

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
console.log(`Total files scanned: ${files.length}`);

let totalWithTenant = 0;
let filesWithMisuse = new Set();
let misuseDetails = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('withTenantContext')) continue;

  // Let's find withTenantContext calls
  // Match withTenantContext(..., async (...) => { ... })
  // We can track with regex or block scanning
  const regex = /withTenantContext\s*\(\s*([^,]+),\s*async\s*\(([^)]*)\)\s*=>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    totalWithTenant++;
    const param = match[2].trim();
    const index = match.index;

    // Find the end of this callback block by matching braces
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

    // Check if callback calls prisma.
    if (callbackBody.includes('prisma.')) {
      filesWithMisuse.add(file);
      misuseDetails.push({
        file,
        param,
        callsPrisma: true,
        snippet: content.substring(index, index + 60).replace(/\n/g, ' ')
      });
    } else if (!param) {
      // Empty param () =>
      filesWithMisuse.add(file);
      misuseDetails.push({
        file,
        param: '(empty)',
        callsPrisma: false,
        snippet: content.substring(index, index + 60).replace(/\n/g, ' ')
      });
    }
  }
}

console.log(`Total withTenantContext calls: ${totalWithTenant}`);
console.log(`Files with misuse: ${filesWithMisuse.size}`);
console.log(`Misuse occurrences: ${misuseDetails.length}`);

for (const detail of misuseDetails.slice(0, 15)) {
  console.log(`- ${path.relative(process.cwd(), detail.file)} [${detail.param}]: ${detail.snippet}`);
}
