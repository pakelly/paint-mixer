const fs = require('fs');
const html = fs.readFileSync('paint-mixer.html', 'utf8');

// The worker code uses template literals (backticks). Inside those,
// ${...} would be interpreted as interpolation. Let's check for that.
const gapsStart = html.indexOf('// ================= GAPS TAB');
const covStart = html.indexOf('// ================= COVERAGE TAB');
const gapsSection = html.substring(gapsStart, covStart);
const covSection = html.substring(covStart);

function checkForInterpolation(section, label) {
  // Find template literals
  let inTemplate = false;
  let templateStart = -1;
  let inSingle = false, inDouble = false;
  
  for (let i = 0; i < section.length; i++) {
    const c = section[i];
    
    if (inSingle) {
      if (c === '\\') { i++; continue; }
      if (c === "'") { inSingle = false; }
      continue;
    }
    if (inDouble) {
      if (c === '\\') { i++; continue; }
      if (c === '"') { inDouble = false; }
      continue;
    }
    if (inTemplate) {
      if (c === '\\') { i++; continue; }
      if (c === '$' && section[i+1] === '{') {
        // Found interpolation!
        const lineNum = section.substring(0, i).split('\n').length;
        const context = section.substring(Math.max(0, i-40), i+40);
        console.log(`[${label}] Template interpolation at char ${i} (line ~${lineNum}):`);
        console.log(`  ...${context}...`);
      }
      if (c === '`') { inTemplate = false; }
      continue;
    }
    if (c === "'") { inSingle = true; }
    else if (c === '"') { inDouble = true; }
    else if (c === '`') { inTemplate = true; templateStart = i; }
  }
}

checkForInterpolation(gapsSection, 'GAPS');
checkForInterpolation(covSection, 'COVERAGE');

// Also check: does the worker code contain ${} from the paint data?
// JSON.stringify of ALL_PAINTS shouldn't have ${} but let's verify
console.log('\nChecking ALL_PAINTS for ${}:');
const paintDataMatch = html.match(/const ALL_PAINTS = (\[.*?\]);/s);
if (paintDataMatch) {
  const hasInterp = paintDataMatch[1].includes('${');
  console.log('  Contains ${}:', hasInterp);
}

// Check for any other potential issues
console.log('\nChecking for stray backticks in string literals:');
const strLitRegex = /'[^']*`[^']*'/g;
let m;
while ((m = strLitRegex.exec(html)) !== null) {
  // This could be a false positive, but let's check
  if (m[0].length < 100) {
    console.log('  ' + m[0].substring(0, 80));
  }
}
