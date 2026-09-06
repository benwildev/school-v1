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

  let searchIdx = 0;
  while (true) {
    const matchIdx = newCode.indexOf('withTenantContext', searchIdx);
    if (matchIdx === -1) break;

    const openCallParen = newCode.indexOf('(', matchIdx);
    if (openCallParen === -1) {
      searchIdx = matchIdx + 17;
      continue;
    }

    const asyncIdx = newCode.indexOf('async', openCallParen);
    if (asyncIdx === -1 || asyncIdx - matchIdx > 200) {
      searchIdx = matchIdx + 17;
      continue;
    }

    const openParamParen = newCode.indexOf('(', asyncIdx);
    const closeParamParen = newCode.indexOf(')', openParamParen);
    const arrowIdx = newCode.indexOf('=>', closeParamParen);
    const openBrace = newCode.indexOf('{', arrowIdx);

    if (openParamParen === -1 || closeParamParen === -1 || arrowIdx === -1 || openBrace === -1) {
      searchIdx = matchIdx + 17;
      continue;
    }

    if (openBrace - asyncIdx > 150) {
      searchIdx = matchIdx + 17;
      continue;
    }

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

    const closeBrace = pos - 1;

    const paramRaw = newCode.substring(openParamParen + 1, closeParamParen).trim();
    let paramName = paramRaw;
    let paramReplacementNeeded = false;

    if (!paramRaw) {
      paramName = 'tx';
      paramReplacementNeeded = true;
    } else if (paramRaw.includes(',')) {
      paramName = paramRaw.split(',')[0].trim();
    } else if (paramRaw.includes(':')) {
      paramName = paramRaw.split(':')[0].trim();
    }

    let body = newCode.substring(openBrace + 1, closeBrace);
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

// Execute refactor across all files
const files = findFiles('src');
let modifiedCount = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const res = transformCode(content);
  if (res.changed) {
    modifiedCount++;
    fs.writeFileSync(file, res.newCode, 'utf8');
    console.log(`Transformed: ${path.relative(process.cwd(), file)}`);
  }
}

console.log(`\nSuccessfully refactored ${modifiedCount} files.`);
