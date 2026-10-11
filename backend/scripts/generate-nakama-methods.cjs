// Offline generator: node scripts/generate-nakama-methods.cjs path/to/index.d.ts
// Input must be the official nakama-common version used by the server pin.
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const input = process.argv[2];
if (!input) throw new Error('Pass the official nakama-common index.d.ts path');
const source = ts.createSourceFile(input, fs.readFileSync(input, 'utf8'), ts.ScriptTarget.Latest, true);
let names;
function visit(node) {
  if (ts.isInterfaceDeclaration(node) && node.name.text === 'Nakama') {
    if (names) throw new Error('Expected exactly one Nakama interface');
    names = [...new Set(node.members.map(member => member.name.getText(source)))].sort();
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!names || !names.length) throw new Error('Official Nakama interface not found');
const output = path.join(__dirname, '../src/types/nakama-api-methods.ts');
const current = fs.readFileSync(output, 'utf8');
const union = 'export type OfficialNakamaMethod =\n' + names.map(name => `  | '${name}'`).join('\n') + ';';
fs.writeFileSync(output, current.replace(/export type OfficialNakamaMethod =[\s\S]*?;/, union));
console.log(`Generated ${names.length} official method names`);
