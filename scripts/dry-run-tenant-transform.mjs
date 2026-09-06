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

export function transformCode(code) {
  let changed = false;
  let newCode = code;

  // Pattern: withTenantContext( <arg1> , async ( <arg2> ) => {
  // We can scan sequentially
  let searchIdx = 0;
  while (true) {
    const matchIdx = newCode.indexOf('withTenantContext', searchIdx);
    if (matchIdx === -1) break;

    // Find the opening parenthesis of withTenantContext(
    const openCallParen = newCode.indexOf('(', matchIdx);
    if (openCallParen === -1) {
      searchIdx = matchIdx + 17;
      continue;
    }

    // Find the callback start `async`
    const asyncIdx = newCode.indexOf('async', openCallParen);
    if (asyncIdx === -1 || asyncIdx - matchIdx > 200) {
      searchIdx = matchIdx + 17;
      continue;
    }

    // Find the param parens: `async (` or `async(`
    const openParamParen = newCode.indexOf('(', asyncIdx);
    const closeParamParen = newCode.indexOf(')', openParamParen);
    const arrowIdx = newCode.indexOf('=>', closeParamParen);
    const openBrace = newCode.indexOf('{', arrowIdx);

    if (openParamParen === -1 || closeParamParen === -1 || arrowIdx === -1 || openBrace === -1) {
      searchIdx = matchIdx + 17;
      continue;
    }

    // Check distance to ensure it's part of the same signature
    if (openBrace - asyncIdx > 150) {
      searchIdx = matchIdx + 17;
      continue;
    }

    // Find matching closing brace for openBrace
    let depth = 1;
    let pos = openBrace + 1;
    let inString = false;
    let stringChar = '';
    while (pos < newCode.length && depth > 0) {
      const char = newCode[pos];
      const prevChar = newCode[pos - 1];

      if (!inString) {
        if ((char === '"' || char === '\'' || char === '`') && prevChar !== '\\') {
          inString = true;
          stringChar = char;
        } else if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
        }
      } else {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
        }
      }
      pos++;
    }

    const closeBrace = pos - 1; // position of matching }

    // Now inspect parameters
    const paramRaw = newCode.substring(openParamParen + 1, closeParamParen).trim();
    let paramName = paramRaw;
    let paramReplacementNeeded = false;

    if (!paramRaw) {
      paramName = 'tx';
      paramReplacementNeeded = true;
    } else if (paramRaw.includes(',')) {
      // e.g. tx, ...
      paramName = paramRaw.split(',')[0].trim();
    } else if (paramRaw.includes(':')) {
      // e.g. tx: PrismaClient
      paramName = paramRaw.split(':')[0].trim();
    }

    // Callback body is between openBrace + 1 and closeBrace
    let body = newCode.substring(openBrace + 1, closeBrace);

    // Replace `prisma.` with `${paramName}.` inside body
    // Be careful with word boundaries: \bprisma\.
    const bodyReplaced = body.replace(/\bprisma\./g, `${paramName}.`);
    const bodyChanged = bodyReplaced !== body;

    if (paramReplacementNeeded || bodyChanged) {
      changed = true;
      let newHeader = newCode.substring(asyncIdx, openBrace + 1);
      if (paramReplacementNeeded) {
        newHeader = newHeader.substring(0, openParamParen - asyncIdx + 1) + paramName + newHeader.substring(closeParamParen - asyncIdx);
      }

      newCode = newCode.substring(0, asyncIdx) + newHeader + bodyReplaced + newCode.substring(closeBrace);
      searchIdx = asyncIdx + newHeader.length + bodyReplaced.length + 1;
    } else {
      searchIdx = closeBrace + 1;
    }
  }

  return { changed, newCode };
}

// Dry run across all files
const files = findFiles('src');
let modifiedCount = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const res = transformCode(content);
  if (res.changed) {
    modifiedCount++;
    console.log(`Will modify: ${path.relative(process.cwd(), file)}`);
  }
}

console.log(`\nTotal files to modify: ${modifiedCount}`);
