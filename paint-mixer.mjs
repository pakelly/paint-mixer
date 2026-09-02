#!/usr/bin/env node
// paint-mixer.mjs — find 2-3 paint mixes toward a target color
// Usage:
//   node paint-mixer.mjs <hex> [--collection my-paints.json] [--count N]
//   node paint-mixer.mjs coverage [--collection my-paints.json]
//   node paint-mixer.mjs gaps [--collection my-paints.json] [--top N]

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  hexToRgb, rgbToHex, rgbToLab, labToRgb, deltaE2000, mixRgb
} from './color-math.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FULL_LINE = join(__dirname, '..', 'army-painter-fanatic-colors.json');

function loadPaints(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return raw.map(p => ({
    ...p,
    rgb: hexToRgb(p.hex),
    lab: rgbToLab(hexToRgb(p.hex))
  }));
}

const FULL = loadPaints(existsSync(FULL_LINE) ? FULL_LINE : join(__dirname, 'army-painter-fanatic-colors.json'));

// Simulate a mix of paints with given ratios (sum=1), return Lab
function simulateMix(paints, ratios) {
  // Convert each paint rgb to linear via mixRgb chain — do pairwise sequential
  // geometric-mean blending which is associative for equal total weight.
  let acc = null;
  let total = 0;
  // Blend sequentially: add each paint weighted by its ratio
  // (geometric mean with weights normalized to cumulative)
  const eps = 1e-6;
  const lin = paints.map(p => p.rgb.map(c => {
    // srgb -> linear
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }));
  let logSum = [0, 0, 0];
  for (let i = 0; i < paints.length; i++) {
    const r = ratios[i];
    if (r <= 0) continue;
    logSum[0] += r * Math.log(lin[i][0] + eps);
    logSum[1] += r * Math.log(lin[i][1] + eps);
    logSum[2] += r * Math.log(lin[i][2] + eps);
  }
  const outLin = [Math.exp(logSum[0]), Math.exp(logSum[1]), Math.exp(logSum[2])];
  const outSrgb = outLin.map(c => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  return rgbToLab(outSrgb);
}

// Search mixes: exhaustive 2-paint grid, then smart 3-paint refinement
// using a shortlist of paints nearest the target in Lab space.
function findMix(paints, targetLab, maxPaints = 3, grid = 15) {
  const n = paints.length;
  let best = { dE: Infinity };

  // Shortlist: paints nearest target in Lab (best third-paint candidates)
  const withDist = paints.map(p => ({
    ...p,
    d: deltaE2000(p.lab, targetLab)
  }));
  withDist.sort((a, b) => a.d - b.d);
  const shortlist = withDist.slice(0, 25);

  // Stage 1: exhaustive 2-paint mixes (full paint set)
  const bestPairs = [];
  const MAX_PAIRS = 12;
  const pushPair = (p) => {
    if (bestPairs.length < MAX_PAIRS) {
      bestPairs.push(p);
      bestPairs.sort((a, b) => a.dE - b.dE);
    } else if (p.dE < bestPairs[MAX_PAIRS - 1].dE) {
      bestPairs[MAX_PAIRS - 1] = p;
      bestPairs.sort((a, b) => a.dE - b.dE);
    }
  };
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      for (let k = 0; k <= grid; k++) {
        const w1 = k / grid, w2 = 1 - w1;
        if (w1 === 0 && i !== j) continue;
        if (w2 === 0 && i !== j) continue;
        const mixLab = simulateMix([paints[i], paints[j]], [w1, w2]);
        const dE = deltaE2000(mixLab, targetLab);
        if (dE < best.dE) {
          const outRgb = labToRgb(mixLab);
          best = {
            dE,
            paints: [{ name: paints[i].name, hex: paints[i].hex, ratio: Math.round(w1 * 100) },
                     { name: paints[j].name, hex: paints[j].hex, ratio: Math.round(w2 * 100) }],
            resultHex: rgbToHex(outRgb[0], outRgb[1], outRgb[2])
          };
        }
        pushPair({ i, j, w1, w2, dE });
      }
    }
  }

  // Stage 2: 3-paint refinement from top pairs + shortlist thirds
  if (maxPaints >= 3) {
    const topPairs = bestPairs;
    const thirdGrid = [0.15, 0.25, 0.35, 0.45];
    const nameHexToIdx = new Map(paints.map((p, idx) => [p.name + '|' + p.hex, idx]));
    for (const pair of topPairs) {
      const { i, j, w1, w2 } = pair;
      for (const k of shortlist) {
        const ki = nameHexToIdx.get(k.name + '|' + k.hex);
        if (ki === i || ki === j) continue;
        for (const tw of thirdGrid) {
          const a = w1 * (1 - tw), b = w2 * (1 - tw), c = tw;
          const mixLab = simulateMix([paints[i], paints[j], paints[ki]], [a, b, c]);
          const dE = deltaE2000(mixLab, targetLab);
          if (dE < best.dE) {
            const outRgb = labToRgb(mixLab);
            best = {
              dE,
              paints: [
                { name: paints[i].name, hex: paints[i].hex, ratio: Math.round(a * 100) },
                { name: paints[j].name, hex: paints[j].hex, ratio: Math.round(b * 100) },
                { name: paints[ki].name, hex: paints[ki].hex, ratio: Math.round(c * 100) }
              ].filter(p => p.ratio > 0),
              resultHex: rgbToHex(outRgb[0], outRgb[1], outRgb[2])
            };
          }
        }
      }
    }
  }

  return best;
}

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'coverage') {
    // Show which regions of color space the collection covers vs full line
    const collectionPath = args.find((a, i) => args[i - 1] === '--collection');
    const paints = collectionPath ? loadPaints(collectionPath) : FULL;
    console.log(`Coverage analysis for ${paints.length} paints:`);
    console.log('');

    // Bucket by hue sector (skip near-greys S < 8%)
    const sectors = {};
    for (const p of paints) {
      const [r, g, b] = p.rgb;
      const [h, s, v] = rgbToHsv(r, g, b);
      p.hsv = [h, s * 100, v * 100];
      if (s * 100 < 8) {
        sectors['neutral'] = sectors['neutral'] || [];
        sectors['neutral'].push(p);
      } else {
        const key = Math.floor(h / 30);
        sectors[key] = sectors[key] || [];
        sectors[key].push(p);
      }
    }
    const names = ['Red','Orange','Yellow','Yellow-Grn','Green','Grn-Cyan','Cyan','Blue','Blue-Purple','Purple','Magenta','Pink-Red'];
    console.log('Hue sectors:');
    for (let i = 0; i < 12; i++) {
      const list = sectors[i] || [];
      console.log(`  ${names[i].padEnd(12)} (${String(i * 30).padStart(3)}-${String(i * 30 + 29).padStart(3)}°): ${list.length} paints`);
    }
    console.log(`  ${'Neutral'.padEnd(12)} (S<8%): ${(sectors['neutral'] || []).length} paints`);
    return;
  }

  if (cmd === 'gaps') {
    // Identify colors hardest to mix toward with current collection
    const collectionPath = args.find((a, i) => args[i - 1] === '--collection');
    const paints = collectionPath ? loadPaints(collectionPath) : FULL;
    const topN = parseInt(args.find((a, i) => args[i - 1] === '--top')) || 10;

    // Sample the full line's paints as target colors, find worst mixes
    const results = [];
    for (const target of FULL) {
      const best = findMix(paints, target.lab, 2, 9);
      results.push({ target: target.name, targetHex: target.hex, dE: best.dE, ...best });
    }
    results.sort((a, b) => b.dE - a.dE);
    console.log(`Hardest colors to mix toward (${paints.length} paints in collection):`);
    console.log('');
    for (const r of results.slice(0, topN)) {
      console.log(`  ${r.target} (${r.targetHex}) — best mix dE=${r.dE.toFixed(1)}`);
      if (r.paints) {
        console.log(`    ${r.paints.map(p => `${p.name} ${p.ratio}%`).join(' + ')} → ${r.resultHex}`);
      }
    }
    return;
  }

  // Default: find mix toward a hex target
  const hexArg = args.find(a => /^#?[0-9a-fA-F]{6}$/.test(a));
  if (!hexArg) {
    console.log('Usage:');
    console.log('  node paint-mixer.mjs <hex> [--collection file.json]');
    console.log('  node paint-mixer.mjs coverage [--collection file.json]');
    console.log('  node paint-mixer.mjs gaps [--collection file.json] [--top N]');
    process.exit(1);
  }
  const targetHex = hexArg.startsWith('#') ? hexArg : '#' + hexArg;
  const collectionPath = args.find((a, i) => args[i - 1] === '--collection');
  const paints = collectionPath ? loadPaints(collectionPath) : FULL;

  const targetRgb = hexToRgb(targetHex);
  const targetLab = rgbToLab(targetRgb);
  const best2 = findMix(paints, targetLab, 2, 15);
  const best3 = findMix(paints, targetLab, 3, 7);

  const [tr, tg, tb] = targetRgb;
  const [th, ts, tv] = rgbToHsv(tr, tg, tb);

  console.log(`Target: ${targetHex}  (H=${th.toFixed(0)}° S=${(ts*100).toFixed(0)}% V=${(tv*100).toFixed(0)}%)`);
  console.log(`Using ${paints.length} paints\n`);

  console.log('Best 2-paint mix:');
  if (best2.paints) {
    console.log(`  ${best2.paints.map(p => `${p.name} (${p.hex}) ${p.ratio}%`).join(' + ')}`);
    console.log(`  Predicted: ${best2.resultHex}  (ΔE=${best2.dE.toFixed(1)})`);
  } else {
    console.log('  none found');
  }

  console.log('\nBest 3-paint mix:');
  if (best3.paints && best3.paints.length > 2) {
    console.log(`  ${best3.paints.map(p => `${p.name} (${p.hex}) ${p.ratio}%`).join(' + ')}`);
    console.log(`  Predicted: ${best3.resultHex}  (ΔE=${best3.dE.toFixed(1)})`);
  } else {
    console.log(`  (2-paint was sufficient: ${best2.paints.map(p => `${p.name} ${p.ratio}%`).join(' + ')})`);
  }
}

main();
