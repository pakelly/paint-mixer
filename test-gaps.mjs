// test-gaps.mjs — standalone test of the gap analysis logic
import { readFileSync } from 'fs';

const html = readFileSync('paint-mixer/paint-mixer.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Extract data
const ALL_PAINTS = JSON.parse(script.match(/const ALL_PAINTS = (\[.*?\]);/s)[1]);
const MY_COLLECTION = JSON.parse(script.match(/const MY_COLLECTION = (\[.*?\]);/s)[1]);

// Import the functions by evaling the core (everything between data and events)
const funcStart = script.indexOf('const COLLECTION_NAMES');
const funcEnd = script.indexOf('// ================= EVENTS');
const core = script.substring(funcStart, funcEnd);

// eval in this scope
eval(core);

const mine = getPaints(true);
const ownedSet = new Set(mine.map(p => p.name));

// Baseline
const results = [];
for (const target of ALL_PAINTS) {
  const tLab = rgbToLab(hexToRgb(target.hex));
  const best = findMix(mine, tLab, 2, 9);
  results.push({ target: target.name, dE: best.dE });
}
const baseTotal = results.reduce((s, r) => s + r.dE, 0);
console.log('Baseline: avg ΔE =', (baseTotal / 180).toFixed(2), 'total =', baseTotal.toFixed(1));
results.sort((a, b) => b.dE - a.dE);
console.log('Worst 5:', results.slice(0, 5).map(r => r.target + ' (' + r.dE.toFixed(1) + ')').join(', '));

// Top paints to add
const unowned = ALL_PAINTS.filter(p => !ownedSet.has(p.name));
console.log('\nTesting', unowned.length, 'candidates...');
const improvements = [];
for (const candidate of unowned) {
  const augPaints = mine.concat([{ ...candidate, rgb: hexToRgb(candidate.hex), lab: rgbToLab(hexToRgb(candidate.hex)) }]);
  let augTotal = 0;
  for (const target of ALL_PAINTS) {
    const tLab = rgbToLab(hexToRgb(target.hex));
    const best = findMix(augPaints, tLab, 2, 9);
    augTotal += best.dE;
  }
  improvements.push({ name: candidate.name, hex: candidate.hex, improvement: baseTotal - augTotal, newAvg: augTotal / 180 });
}
improvements.sort((a, b) => b.improvement - a.improvement);
console.log('\nTop 5 paints to add:');
for (const r of improvements.slice(0, 5)) {
  const pct = ((r.improvement / baseTotal) * 100).toFixed(1);
  console.log('  ' + r.name.padEnd(25) + ' +' + r.improvement.toFixed(1) + ' ΔE (' + pct + '%)  new avg: ' + r.newAvg.toFixed(2) + '  ' + r.hex);
}
