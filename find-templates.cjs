const fs = require('fs');
const html = fs.readFileSync('paint-mixer.html', 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
const code = m[1];

let inString = false, stringChar = null;
let inTemplate = false;
let templateStartLine = 0;
let line = 1;

for (let i = 0; i < code.length; i++) {
  const c = code[i];
  if (c === '\n') line++;
  
  if (inString) {
    if (c === '\\') { i++; continue; }
    if (c === stringChar) { inString = false; }
    continue;
  }
  if (inTemplate) {
    if (c === '\\') { i++; continue; }
    if (c === '`') { inTemplate = false; }
    continue;
  }
  if (c === '"' || c === "'") { inString = true; stringChar = c; }
  else if (c === '`') { inTemplate = true; templateStartLine = line; }
}

// Now find all template literal starts and ends
const templateStarts = [];
let inS = false, sC = null, inT = false, l = 1;
for (let i = 0; i < code.length; i++) {
  const c = code[i];
  if (c === '\n') l++;
  if (inS) {
    if (c === '\\') { i++; continue; }
    if (c === sC) { inS = false; }
    continue;
  }
  if (inT) {
    if (c === '\\') { i++; continue; }
    if (c === '`') { inT = false; templateStarts[templateStarts.length-1].end = l; }
    continue;
  }
  if (c === '"' || c === "'") { inS = true; sC = c; }
  else if (c === '`') { inT = true; templateStarts.push({start: l}); }
}

console.log('Template literals found:');
templateStarts.forEach((t, i) => {
  console.log(`  ${i}: starts at line ${t.start}${t.end ? ', ends at line ' + t.end : ' — UNCLOSED'}`);
});
