const fs = require('fs');
const html = fs.readFileSync('paint-mixer.html', 'utf8');

// Check for any remaining inline onclick
const onclickMatches = html.match(/onclick="[^"]*'/g);
if (onclickMatches) {
  console.log('Suspicious inline onclick with single quotes:');
  onclickMatches.forEach(m => console.log('  ', m.substring(0, 100)));
} else {
  console.log('No inline onclick with single quotes found');
}

// Check for any onclick at all
const allOnclick = html.match(/onclick="[^"]*"/g);
if (allOnclick) {
  console.log('\nAll remaining onclick handlers:');
  allOnclick.forEach(m => console.log('  ', m.substring(0, 100)));
} else {
  console.log('\nNo inline onclick handlers at all');
}

// Check for backtick template literals inside the worker code strings
// that might cause issues
const workerSection = html.match(/workerCode = \[[\s\S]*?\];/);
if (workerSection) {
  const code = workerSection[0];
  // Look for any unescaped backticks inside single-quoted strings
  const btIssue = code.match(/'[^']*`[^']*'/);
  if (btIssue) {
    console.log('\nBacktick inside single-quoted string in worker code:');
    console.log('  ', btIssue[0].substring(0, 100));
  }
}

// Check the gapActions function output for issues
console.log('\n--- Checking gapActions output ---');
// Simulate gapActions for Payne's Grey
const name = "Payne's Grey";
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const escapedName = esc(name);
console.log('data-paint value:', escapedName);
console.log('Looks valid:', !escapedName.includes("'") || escapedName.includes('&#39;') || escapedName.includes('&quot;'));
