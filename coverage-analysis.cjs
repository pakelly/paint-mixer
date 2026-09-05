// Continuous color space coverage analysis v2
// Optimized: hue-prefiltered candidate selection + sampled greedy step
// Threshold: ΔE < 3

const fs = require('fs');

// Load paint data
const ap = JSON.parse(fs.readFileSync('/home/node/.openclaw/workspace/army-painter-fanatic-colors.json','utf8')).map(p=>({...p, brand:'Army Painter'}));
const pa = JSON.parse(fs.readFileSync('/home/node/.openclaw/workspace/pro-acryl-colors.json','utf8')).map(p=>({...p, brand:'Pro Acryl'}));
const ALL = [...ap, ...pa];
const collNames = new Set(JSON.parse(fs.readFileSync('/home/node/.openclaw/workspace/paint-mixer/my-collection.json','utf8')));
const collection = ALL.filter(p => collNames.has(p.name));
console.log(`Full line: ${ALL.length} paints (${ap.length} AP + ${pa.length} PA)`);
console.log(`Collection: ${collection.length} paints`);

// === COLOR MATH ===
function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
}
function srgbToLinear(c) { return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
function rgbToXyz(rgb) {
  const [r,g,b] = [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
  return [r*0.4124+g*0.3576+b*0.1805, r*0.2126+g*0.7152+b*0.0722, r*0.0193+g*0.1192+b*0.9505];
}
function xyzToLab([X,Y,Z]) {
  const Xn=0.95047,Yn=1.0,Zn=1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787*t+16/116);
  const fx=f(X/Xn),fy=f(Y/Yn),fz=f(Z/Zn);
  return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
}
function rgbToLab(rgb) { return xyzToLab(rgbToXyz(rgb)); }
function rgbToHsv([r,g,b]) {
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  if(d!==0){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}
  if(h<0)h+=360;
  return [h, max===0?0:d/max, max];
}

function ciede2000(lab1, lab2) {
  const [L1,a1,b1]=lab1,[L2,a2,b2]=lab2;
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2);
  const Cbar=(C1+C2)/2, Cbar7=Math.pow(Cbar,7);
  const G=0.5*(1-Math.sqrt(Cbar7/(Cbar7+Math.pow(25,7))));
  const a1p=a1*(1+G),a2p=a2*(1+G);
  const C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2);
  let h1p=b1>=0?Math.atan2(b1,a1p):Math.atan2(b1,a1p)+2*Math.PI;
  let h2p=b2>=0?Math.atan2(b2,a2p):Math.atan2(b2,a2p)+2*Math.PI;
  if(a1p===0&&b1===0)h1p=0;
  if(a2p===0&&b2===0)h2p=0;
  h1p*=180/Math.PI; h2p*=180/Math.PI;
  const dLp=L2-L1, dCp=C2p-C1p;
  let dhp;
  if(C1p*C2p===0)dhp=0;
  else{let diff=h2p-h1p; if(Math.abs(diff)<=180)dhp=diff; else if(diff>180)dhp=diff-360; else dhp=diff+360;}
  const dHp=2*Math.sqrt(C1p*C2p)*Math.sin(dhp*Math.PI/360);
  const Lbarp=(L1+L2)/2, Cbarp=(C1p+C2p)/2;
  let hbarp;
  if(C1p*C2p===0)hbarp=h1p+h2p;
  else{let diff=Math.abs(h1p-h2p); if(diff<=180)hbarp=(h1p+h2p)/2; else if(h1p+h2p<360)hbarp=(h1p+h2p+360)/2; else hbarp=(h1p+h2p-360)/2;}
  const T=1-0.17*Math.cos((hbarp-30)*Math.PI/180)+0.24*Math.cos(2*hbarp*Math.PI/180)-0.32*Math.cos((3*hbarp+6)*Math.PI/180)+0.20*Math.cos((4*hbarp-63)*Math.PI/180);
  const dtheta=30*Math.exp(-Math.pow((hbarp-275)/25,2));
  const RC=2*Math.sqrt(Math.pow(Cbarp,7)/(Math.pow(Cbarp,7)+Math.pow(25,7)));
  const SL=1+(0.015*Math.pow(Lbarp-50,2))/Math.sqrt(20+Math.pow(Lbarp-50,2));
  const SC=1+0.045*Cbarp;
  const SH=1+0.015*Cbarp*T;
  const RT=-Math.sin(2*dtheta*Math.PI/180)*RC;
  return Math.sqrt(Math.pow(dLp/SL,2)+Math.pow(dCp/SC,2)+Math.pow(dHp/SH,2)+RT*(dCp/SC)*(dHp/SH));
}

function hsvToRgb(h, s, v) {
  h = h / 360;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return [r, g, b];
}

// Precompute paints with HSV
const allPaints = ALL.map(p => {
  const rgb = hexToRgb(p.hex);
  const hsv = rgbToHsv(rgb);
  return { ...p, rgb, lab: rgbToLab(rgb), hsv };
});
const collPaints = collection.map(p => {
  const rgb = hexToRgb(p.hex);
  const hsv = rgbToHsv(rgb);
  return { ...p, rgb, lab: rgbToLab(rgb), hsv };
});

// 2-paint mix
function mix2rgb(a, b, r) {
  return [
    Math.pow(a.rgb[0], r) * Math.pow(b.rgb[0], 1-r),
    Math.pow(a.rgb[1], r) * Math.pow(b.rgb[1], 1-r),
    Math.pow(a.rgb[2], r) * Math.pow(b.rgb[2], 1-r),
  ];
}

// Optimized findMix: prefilter by hue proximity
function findMix(paintSet, targetLab, targetHue) {
  // Sort by hue distance to target, keep top 40 candidates
  const candidates = paintSet
    .map(p => ({ p, hueDist: Math.min(Math.abs(p.hsv[0]-targetHue), 360-Math.abs(p.hsv[0]-targetHue)) }))
    .sort((a,b) => a.hueDist - b.hueDist)
    .slice(0, Math.min(40, paintSet.length))
    .map(x => x.p);
  
  let best = { dE: 999, paints: [] };
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i+1; j < candidates.length; j++) {
      for (let r = 0.15; r <= 0.85; r += 0.1) {
        const mixLab = rgbToLab(mix2rgb(candidates[i], candidates[j], r));
        const dE = ciede2000(mixLab, targetLab);
        if (dE < best.dE) {
          let bR = r, bD = dE;
          for (let r2 = Math.max(0.05, r-0.08); r2 <= Math.min(0.95, r+0.08); r2 += 0.02) {
            const m2 = rgbToLab(mix2rgb(candidates[i], candidates[j], r2));
            const d2 = ciede2000(m2, targetLab);
            if (d2 < bD) { bD = d2; bR = r2; }
          }
          best = { dE: bD, paints: [candidates[i], candidates[j]] };
        }
      }
    }
  }
  // Value adjustment: try darkest/lightest
  const sorted = [...paintSet].sort((a,b) => a.lab[0] - b.lab[0]);
  const darkest = sorted[0], lightest = sorted[sorted.length-1];
  const baseNames = new Set(best.paints.map(p=>p.name));
  for (const mod of [darkest, lightest]) {
    if (baseNames.has(mod.name)) continue;
    for (let frac = 0.02; frac <= 0.35; frac += 0.03) {
      const [a, b] = best.paints;
      for (let ra = 0.15; ra <= 0.85; ra += 0.15) {
        const rb = (1 - frac - ra*0.5);
        if (rb <= 0 || rb > 1) continue;
        const rgb = [
          Math.pow(a.rgb[0], ra) * Math.pow(b.rgb[0], rb) * Math.pow(mod.rgb[0], frac),
          Math.pow(a.rgb[1], ra) * Math.pow(b.rgb[1], rb) * Math.pow(mod.rgb[1], frac),
          Math.pow(a.rgb[2], ra) * Math.pow(b.rgb[2], rb) * Math.pow(mod.rgb[2], frac),
        ];
        const mixLab = rgbToLab(rgb);
        const dE = ciede2000(mixLab, targetLab);
        if (dE < best.dE) {
          best = { dE, paints: [a, b, mod] };
        }
      }
    }
  }
  return best;
}

// === STEP 1: Build HSV sample grid ===
const HUE_STEPS = 24, SAT_STEPS = 10, VAL_STEPS = 10;
const TOTAL_GRID = HUE_STEPS * SAT_STEPS * VAL_STEPS;
console.log(`\nHSV grid: ${HUE_STEPS} hues × ${SAT_STEPS} sats × ${VAL_STEPS} vals = ${TOTAL_GRID} points`);

const gridPoints = [];
for (let h = 0; h < HUE_STEPS; h++) {
  for (let s = 0; s < SAT_STEPS; s++) {
    for (let v = 0; v < VAL_STEPS; v++) {
      const hue = (h / HUE_STEPS) * 360;
      const sat = (s + 1) / SAT_STEPS;
      const val = (v + 1) / VAL_STEPS;
      const rgb = hsvToRgb(hue, sat, val);
      const lab = rgbToLab(rgb);
      gridPoints.push({ hue, sat, val, rgb, lab });
    }
  }
}

// === STEP 2: Define achievable gamut ===
console.log('\nDefining achievable gamut (full line, ΔE < 3)...');
const t0 = Date.now();
let achievable = 0;
const achievablePoints = [];

for (let i = 0; i < gridPoints.length; i++) {
  const gp = gridPoints[i];
  const best = findMix(allPaints, gp.lab, gp.hue);
  if (best.dE < 3) {
    achievable++;
    achievablePoints.push(gp);
  }
  if (i % 200 === 0) process.stdout.write(`  ${i}/${gridPoints.length}...`);
}
const gamutTime = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nGamut defined in ${gamutTime}s`);
console.log(`Achievable: ${achievable}/${gridPoints.length} (${(achievable/gridPoints.length*100).toFixed(1)}%)`);

// === STEP 3: Measure collection coverage ===
console.log(`\nMeasuring collection coverage (ΔE < 3)...`);
const t1 = Date.now();
let covered = 0;
const uncoveredPoints = [];
const coverageByHue = {};

for (let i = 0; i < achievablePoints.length; i++) {
  const gp = achievablePoints[i];
  const best = findMix(collPaints, gp.lab, gp.hue);
  const isCovered = best.dE < 3;
  if (isCovered) covered++;
  else uncoveredPoints.push({ ...gp, dE: best.dE });
  const hueBin = Math.floor(gp.hue / 30) * 30;
  if (!coverageByHue[hueBin]) coverageByHue[hueBin] = { total: 0, covered: 0 };
  coverageByHue[hueBin].total++;
  if (isCovered) coverageByHue[hueBin].covered++;
  if (i % 200 === 0) process.stdout.write(`  ${i}/${achievablePoints.length}...`);
}
const collTime = ((Date.now() - t1) / 1000).toFixed(1);
console.log(`\nCollection evaluated in ${collTime}s`);

const coveragePct = (covered / achievable * 100).toFixed(1);
console.log(`\n=== COVERAGE RESULTS ===`);
console.log(`Achievable gamut: ${achievable} colors`);
console.log(`Collection covers: ${covered} (${coveragePct}%)`);
console.log(`Gaps: ${uncoveredPoints.length} (${(100-coveragePct).toFixed(1)}%)`);

console.log(`\nCoverage by hue sector:`);
Object.keys(coverageByHue).sort((a,b)=>+a-+b).forEach(h => {
  const d = coverageByHue[h];
  const pct = (d.covered / d.total * 100).toFixed(0);
  const bar = '█'.repeat(Math.round(pct/5)) + '░'.repeat(20-Math.round(pct/5));
  console.log(`  ${(+h).toFixed(0).padStart(3)}°-${(+h+30).toFixed(0).padStart(3)}°  ${bar} ${pct}% (${d.covered}/${d.total})`);
});

uncoveredPoints.sort((a,b) => b.dE - a.dE);
console.log(`\nWorst 15 uncovered colors:`);
uncoveredPoints.slice(0, 15).forEach(p => {
  const rgbHex = '#' + p.rgb.map(c => Math.round(c*255).toString(16).padStart(2,'0')).join('');
  console.log(`  H=${p.hue.toFixed(0).padStart(3)}° S=${(p.sat*100).toFixed(0).padStart(2)}% V=${(p.val*100).toFixed(0).padStart(3)}%  ${rgbHex}  ΔE ${p.dE.toFixed(1)}`);
});

// === STEP 4: Greedy "which paint to buy next" (sampled) ===
console.log(`\n=== GREEDY: Which paint should you add? ===`);
const GREEDY_SAMPLE = Math.min(60, uncoveredPoints.length);
console.log(`Testing candidates against ${GREEDY_SAMPLE} sampled uncovered points...`);
const sampleUncovered = uncoveredPoints
  .sort(() => Math.random() - 0.5) // shuffle
  .slice(0, GREEDY_SAMPLE);

const unowned = allPaints.filter(p => !collNames.has(p.name));
let bestAdd = null;
const topPicks = [];

for (let i = 0; i < unowned.length; i++) {
  const testCol = [...collPaints, unowned[i]];
  let newlyCovered = 0;
  for (const gp of sampleUncovered) {
    const best = findMix(testCol, gp.lab, gp.hue);
    if (best.dE < 3) newlyCovered++;
  }
  const pct = (newlyCovered / GREEDY_SAMPLE * 100).toFixed(1);
  topPicks.push({ paint: unowned[i], count: newlyCovered, pct });
  if (!bestAdd || newlyCovered > bestAdd.count) {
    bestAdd = { paint: unowned[i], count: newlyCovered, pct };
  }
  if (i % 30 === 0) process.stdout.write(`  ${i}/${unowned.length}...`);
}
console.log();
topPicks.sort((a,b) => b.count - a.count);
console.log(`\nTop 10 recommended additions:`);
topPicks.slice(0, 10).forEach((pick, i) => {
  console.log(`  ${i+1}. ${pick.paint.name.padEnd(28)} ${pick.paint.hex}  ${pick.paint.brand.padEnd(12)} recovers ${pick.count}/${GREEDY_SAMPLE} (${pick.pct}%)`);
});

// Project full recovery
const projectPct = (bestAdd.count / GREEDY_SAMPLE * uncoveredPoints.length);
console.log(`\n  → Best: ${bestAdd.paint.name} (${bestAdd.paint.hex})`);
console.log(`  → Projected recovery: ~${Math.round(projectPct)} of ${uncoveredPoints.length} uncovered points`);
console.log(`  → New coverage would be: ~${((covered + projectPct) / achievable * 100).toFixed(1)}%`);

// Save results for UI integration
const results = {
  totalPaints: ALL.length,
  collectionSize: collection.length,
  threshold: 3,
  gridPoints: TOTAL_GRID,
  achievableGamut: achievable,
  achievablePct: (achievable/gridPoints.length*100).toFixed(1),
  covered,
  coveragePct: parseFloat(coveragePct),
  gaps: uncoveredPoints.length,
  gapPct: (100-coveragePct).toFixed(1),
  coverageByHue: Object.fromEntries(
    Object.entries(coverageByHue).map(([k,v]) => [k, { ...v, pct: parseFloat((v.covered/v.total*100).toFixed(1)) }])
  ),
  topPicks: topPicks.slice(0, 10).map(p => ({ name: p.paint.name, hex: p.paint.hex, brand: p.paint.brand, recovery: p.count, recoveryPct: parseFloat(p.pct) })),
  timestamp: new Date().toISOString()
};
fs.writeFileSync('/home/node/.openclaw/workspace/paint-mixer/coverage-results.json', JSON.stringify(results, null, 2));
console.log('\nResults saved to paint-mixer/coverage-results.json');
