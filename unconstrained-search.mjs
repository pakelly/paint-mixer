import { readFileSync } from 'fs';
import { hexToRgb, rgbToLab, labDeltaE } from './color-math.mjs';

// Load all paints (both brands)
const apPath = '../army-painter-fanatic-colors.json';
const paPath = '../pro-acryl-colors.json';
const ap = JSON.parse(readFileSync(apPath,'utf8')).map(p=>({...p, brand:'Army Painter'}));
const pa = JSON.parse(readFileSync(paPath,'utf8')).map(p=>({...p, brand:'Pro Acryl'}));
const ALL = [...ap, ...pa];

// Precompute labs
const paints = ALL.map(p => ({ ...p, rgb: hexToRgb(p.hex), lab: rgbToLab(hexToRgb(p.hex)) }));
console.log(`Total paints: ${paints.length} (${ap.length} AP + ${pa.length} PA)`);

// Targets = all paints (we test mixing coverage against the full line)
const targets = paints;

// Simple 2-paint mix: weighted geometric mean in linear RGB
function mix2(a, b, ratio) {
  const r = ratio;
  const rgb = [
    Math.pow(a.rgb[0], r) * Math.pow(b.rgb[0], 1-r),
    Math.pow(a.rgb[1], r) * Math.pow(b.rgb[1], 1-r),
    Math.pow(a.rgb[2], r) * Math.pow(b.rgb[2], 1-r),
  ];
  return rgbToLab(rgb);
}

// Find best 2-paint mix (with optional value adjust) for a target
function findMix(collection, targetLab) {
  let best = { dE: 999, paints: [] };
  for (let i = 0; i < collection.length; i++) {
    for (let j = i+1; j < collection.length; j++) {
      // Coarse sweep
      for (let r = 0.15; r <= 0.85; r += 0.1) {
        const mix = mix2(collection[i], collection[j], r);
        const dE = labDeltaE(mix, targetLab);
        if (dE < best.dE) {
          // Fine sweep around best
          let bestR = r, bestD = dE;
          for (let r2 = Math.max(0.05, r-0.1); r2 <= Math.min(0.95, r+0.1); r2 += 0.02) {
            const m2 = mix2(collection[i], collection[j], r2);
            const d2 = labDeltaE(m2, targetLab);
            if (d2 < bestD) { bestD = d2; bestR = r2; }
          }
          best = { dE: bestD, paints: [{name: collection[i].name, hex: collection[i].hex, brand: collection[i].brand, ratio: bestR},
                                       {name: collection[j].name, hex: collection[j].hex, brand: collection[j].brand, ratio: 1-bestR}] };
        }
      }
    }
  }
  // Value adjustment: try adding darkest/lightest
  const sorted = [...collection].sort((a,b) => a.lab[0] - b.lab[0]);
  const darkest = sorted[0];
  const lightest = sorted[sorted.length-1];
  const baseNames = new Set(best.paints.map(p=>p.name));
  for (const mod of [darkest, lightest]) {
    if (baseNames.has(mod.name)) continue;
    for (let frac = 0.01; frac <= 0.40; frac += 0.03) {
      // Blend modifier into each paint proportionally
      const adj = best.paints.map(p => {
        const orig = collection.find(c => c.name === p.name);
        const newRatio = p.ratio * (1-frac);
        return { ...orig, ratio: newRatio };
      });
      adj.push({ ...mod, ratio: frac });
      // Compute mixed color
      let rgb = [0,0,0];
      for (const p of adj) {
        rgb[0] += Math.log(p.rgb[0]+0.0001) * p.ratio;
        rgb[1] += Math.log(p.rgb[1]+0.0001) * p.ratio;
        rgb[2] += Math.log(p.rgb[2]+0.0001) * p.ratio;
      }
      const total = adj.reduce((s,p)=>s+p.ratio,0);
      rgb = [Math.exp(rgb[0]/total), Math.exp(rgb[1]/total), Math.exp(rgb[2]/total)];
      const mixLab = rgbToLab(rgb);
      const dE = labDeltaE(mixLab, targetLab);
      if (dE < best.dE) {
        best = { dE, paints: adj.map(p=>({name:p.name, hex:p.hex, brand:p.brand, ratio:p.ratio/total, valueAdjust: p.name===mod.name})) };
      }
    }
  }
  return best;
}

// Evaluate a collection's coverage
function evaluate(collection, sampleSize) {
  // Sample targets for speed
  const step = Math.max(1, Math.floor(targets.length / sampleSize));
  const sampled = [];
  for (let i = 0; i < targets.length; i += step) sampled.push(targets[i]);
  
  let total = 0;
  const worst = [];
  for (const t of sampled) {
    const best = findMix(collection, t.lab);
    total += best.dE;
    worst.push({ name: t.name, hex: t.hex, dE: best.dE });
  }
  worst.sort((a,b) => b.dE - a.dE);
  return { avg: total / sampled.length, worst: worst.slice(0, 10) };
}

// Greedy sequential search
const GRID = 25; // sample 25 targets for speed
console.log(`\nGreedy sequential search (sampling ${Math.min(GRID, targets.length)} targets per round)...`);

const selected = [];
const remaining = [...paints];

for (let round = 0; round < 6; round++) {
  console.log(`\n--- Round ${round+1} ---`);
  let bestPick = null;
  
  // For each candidate, evaluate collection + candidate
  for (let i = 0; i < remaining.length; i++) {
    const testCol = [...selected, remaining[i]];
    const result = evaluate(testCol, GRID);
    if (!bestPick || result.avg < bestPick.avg) {
      bestPick = { paint: remaining[i], avg: result.avg };
    }
    if (i % 50 === 0) process.stdout.write(`  ${i}/${remaining.length}...`);
  }
  console.log(`\n  Best: ${bestPick.paint.name} (${bestPick.paint.hex}, ${bestPick.paint.brand}) → avg ΔE ${bestPick.avg.toFixed(2)}`);
  selected.push(bestPick.paint);
  remaining.splice(remaining.findIndex(p => p.name === bestPick.paint.name), 1);
}

// Final evaluation with full target set
console.log('\n=== FINAL EVALUATION (full target set) ===');
const finalResult = evaluate(selected, targets.length);
console.log(`avg ΔE: ${finalResult.avg.toFixed(2)}`);
console.log('\nSelected palette:');
selected.forEach((p,i) => console.log(`  ${i+1}. ${p.name}  ${p.hex}  ${p.brand}`));
console.log('\nWorst 10 targets:');
finalResult.worst.forEach(t => console.log(`  ${t.name.padEnd(28)} ${t.hex}  ΔE ${t.dE.toFixed(1)}`));

// Compare to split-primary recommendation
const splitPrimary = ['Legendary Red','Warlock Magenta','Ultramarine Blue','Arctic Gem','Inner Light','Leafy Green']
  .map(name => paints.find(p => p.name === name))
  .filter(Boolean);
if (splitPrimary.length === 6) {
  const spResult = evaluate(splitPrimary, targets.length);
  console.log(`\n=== SPLIT-PRIMARY COMPARISON ===`);
  console.log(`Unconstrained: avg ΔE ${finalResult.avg.toFixed(2)}`);
  console.log(`Split-primary: avg ΔE ${spResult.avg.toFixed(2)}`);
}
