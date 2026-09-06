import fs from 'fs';
import path from 'path';

// Restore from clean backup
const bakPath = path.resolve('prisma/schema.prisma.bak');
const schemaPath = path.resolve('prisma/schema.prisma');
const content = fs.readFileSync(bakPath, 'utf8');

// Collect all model names
const modelRegex = /model\s+(\w+)\s*\{/g;
const modelNames = new Set();
let match;
while ((match = modelRegex.exec(content)) !== null) {
  modelNames.add(match[1]);
}

function toSnakeCase(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

const lines = content.split('\n');
let insideModel = false;
let modifiedCount = 0;

const newLines = lines.map((line) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('model ') && trimmed.endsWith('{')) {
    insideModel = true;
    return line;
  }
  if (insideModel && trimmed === '}') {
    insideModel = false;
    return line;
  }
  if (!insideModel) {
    return line;
  }

  // Skip comments, empty lines, model attributes
  if (trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed === '') {
    return line;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return line;

  const fieldName = parts[0];
  const rawType = parts[1];
  const cleanType = rawType.replace(/[?\[\]]/g, '');

  // If it's a relation to another model, skip
  if (modelNames.has(cleanType)) {
    return line;
  }

  // If line has @relation, skip
  if (line.includes('@relation(')) {
    return line;
  }

  // If fieldName does not have camelCase, skip
  if (!/[a-z0-9][A-Z]/.test(fieldName)) {
    return line;
  }

  // If @map is already present, skip
  if (line.includes('@map(')) {
    return line;
  }

  const snakeName = toSnakeCase(fieldName);
  modifiedCount++;

  // Replace fieldName + whitespace + rawType with fieldName + whitespace + rawType + ' @map("' + snakeName + '")'
  const idx = line.indexOf(fieldName);
  const afterField = line.substring(idx + fieldName.length);
  const typeMatch = afterField.match(/^(\s+)(\S+)/);
  if (typeMatch) {
    const spaceBeforeType = typeMatch[1];
    const typeStr = typeMatch[2];
    const restOfLine = afterField.substring(spaceBeforeType.length + typeStr.length);
    return `${line.substring(0, idx)}${fieldName}${spaceBeforeType}${typeStr} @map("${snakeName}")${restOfLine}`;
  }

  return line;
});

console.log(`Successfully mapped ${modifiedCount} camelCase scalar columns to snake_case.`);
fs.writeFileSync(schemaPath, newLines.join('\n'), 'utf8');
