// Self-contained unconstrained palette search
// Uses the same math as the paint mixer tool

const fs = require('fs');

// Load paint data
const ap = JSON.parse(fs.readFileSync('/home/node/.openclaw/workspace/army-painter-fanatic-colors.json','utf8')).map(p=>({...p, brand:'Army Painter'}));
const pa = JSON.parse(fs.readFileSync('/home/node/.openclaw/workspace/pro-acryl-colors.json','utf8')).map(p=>({...p, brand:'Pro Acryl'}));
const ALL = [...ap, ...pa];
console.log(`Total paints: ${ALL.length} (${ap.length} AP + ${pa.length} PA)`);

// Color math
function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
}

function rgbToXyz(rgb) {
  const [r,g,b] = [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
  return [
    r*0.4124 + g*0.3576 + b*0.1805,
    r*0.2126 + g*0.7152 + b*0.0722,
    r*0.0193 + g*0.1192 + b*0.9505,
  ];
}

function xyzToLab([X,Y,Z]) {
  const Xn=0.95047, Yn=1.0, Zn=1.08883;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
  const fx=f(X/Xn), fy=f(Y/Yn), fz=f(Z/Zn);
  return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
}

function rgbToLab(rgb) { return xyzToLab(rgbToXyz(rgb)); }

function ciede2000(lab1, lab2) {
  const [L1,a1,b1] = lab1, [L2,a2,b2] = lab2;
  const kL=1,kC=1,kH=1;
  const C1=Math.hypot(a1,b1), C2=Math.hypot(a2,b2);
  const Cbar=(C1+C2)/2;
  const Cbar7=Math.pow(Cbar,7);
  const G=0.5*(1-Math.sqrt(Cbar7/(Cbar7+Math.pow(25,7))));
  const a1p=a1*(1+G), a2p=a2*(1+G);
  const C1p=Math.hypot(a1p,b1), C2p=Math.hypot(a2p,b2);
  const h1p=Math.degrees?0:0; // placeholder
  let h1p_=b1>=0 ? Math.atan2(b1,a1p) : Math.atan2(b1,a1p)+2*Math.PI;
  let h2p_=b2>=0 ? Math.atan2(b2,a2p) : Math.atan2(b2,a2p)+2*Math.PI;
  if (a1p===0 && b1===0) h1p_=0;
  if (a2p===0 && b2===0) h2p_=0;
  h1p_ = h1p_*180/Math.PI;
  h2p_ = h2p_*180/Math.PI;
  
  const dLp=L2-L1;
  const dCp=C2p-C1p;
  let dhp;
  if (C1p*C2p === 0) dhp = 0;
  else {
    let diff = h2p_-h1p_;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff-360;
    else dhp = diff+360;
  }
  const dHp = 2*Math.sqrt(C1p*C2p)*Math.sin(dhp*Math.PI/360);
  
  const Lbarp=(L1+L2)/2;
  const Cbarp=(C1p+C2p)/2;
  let hbarp;
  if (C1p*C2p === 0) hbarp = h1p_+h2p_;
  else {
    let diff = Math.abs(h1p_-h2p_);
    if (diff <= 180) hbarp = (h1p_+h2p_)/2;
    else if (h1p_+h2p_ < 360) hbarp = (h1p_+h2p_+360)/2;
    else hbarp = (h1p_+h2p_-360)/2;
  }
  
  const T = 1 - 0.17*Math.cos((hbarp-30)*Math.PI/180)
            + 0.24*Math.cos((2*hbarp)*Math.PI/180)
            - 0.32*Math.cos((3*hbarp+6)*Math.PI/180)
            + 0.20*Math.cos((4*hbarp-63)*Math.PI/180);
  const dtheta = 30*Math.exp(-Math.pow((hbarp-275)/25,2));
  const RC = 2*Math.sqrt(Math.pow(Cbarp,7)/(Math.pow(Cbarp,7)+Math.pow(25,7)));
  const SL = 1 + (0.015*Math.pow(Lbarp-50,2))/Math.sqrt(20+Math.pow(Lbarp-50,2));
  const SC = 1 + 0.045*Cbarp;
  const SH = 1 + 0.015*Cbarp*T;
  const RT = -Math.sin(2*dtheta*Math.PI/180)*RC;
  
  return Math.sqrt(
    Math.pow(dLp/(kL*SL),2) +
    Math.pow(dCp/(kC*SC),2) +
    Math.pow(dHp/(kH*SH),2) +
    RT*(dCp/(kC*SC))*(dHp/(kH*SH))
  );
}

// Precompute
const paints = ALL.map(p => ({ ...p, rgb: hexToRgb(p.hex), lab: rgbToLab(hexToRgb(p.hex)) }));
const targets = paints;

// 2-paint mix with weighted geometric mean in linear RGB
function mix2rgb(a, b, r) {
  return [
    Math.pow(a.rgb[0], r) * Math.pow(b.rgb[0], 1-r),
    Math.pow(a.rgb[1], r) * Math.pow(b.rgb[1], 1-r),
    Math.pow(a.rgb[2], r) * Math.pow(b.rgb[2], 1-r),
  ];
}

function findMix(collection, targetLab) {
  let best = { dE: 999, paints: [] };
  for (let i = 0; i < collection.length; i++) {
    for (let j = i+1; j < collection.length; j++) {
      for (let r = 0.15; r <= 0.85; r += 0.1) {
        const mixLab = rgbToLab(mix2rgb(collection[i], collection[j], r));
        const dE = ciede2000(mixLab, targetLab);
        if (dE < best.dE) {
          let bestR = r, bestD = dE;
          for (let r2 = Math.max(0.05, r-0.1); r2 <= Math.min(0.95, r+0.1); r2 += 0.02) {
            const m2 = rgbToLab(mix2rgb(collection[i], collection[j], r2));
            const d2 = ciede2000(m2, targetLab);
            if (d2 < bestD) { bestD = d2; bestR = r2; }
          }
          best = { dE: bestD, paints: [{name: collection[i].name, hex: collection[i].hex, brand: collection[i].brand, ratio: bestR},
                                       {name: collection[j].name, hex: collection[j].hex, brand: collection[j].brand, ratio: 1-bestR}] };
        }
      }
    }
  }
  // Value adjustment
  const sorted = [...collection].sort((a,b) => a.lab[0] - b.lab[0]);
  const darkest = sorted[0];
  const lightest = sorted[sorted.length-1];
  const baseNames = new Set(best.paints.map(p=>p.name));
  for (const mod of [darkest, lightest]) {
    if (baseNames.has(mod.name)) continue;
    for (let frac = 0.01; frac <= 0.40; frac += 0.03) {
      const adj = best.paints.map(p => {
        const orig = collection.find(c => c.name === p.name);
        return { ...orig, ratio: p.ratio * (1-frac) };
      });
      adj.push({ ...mod, ratio: frac });
      // Geometric mean mix
      let lr=0,lg=0,lb=0, total=0;
      for (const p of adj) {
        lr += Math.log(p.rgb[0]+0.0001)*p.ratio;
        lg += Math.log(p.rgb[1]+0.0001)*p.ratio;
        lb += Math.log(p.rgb[2]+0.0001)*p.ratio;
        total += p.ratio;
      }
      const mixLab = rgbToLab([Math.exp(lr/total), Math.exp(lg/total), Math.exp(lb/total)]);
      const dE = ciede2000(mixLab, targetLab);
      if (dE < best.dE) {
        best = { dE, paints: adj.map(p=>({name:p.name, hex:p.hex, brand:p.brand, ratio:p.ratio/total})) };
      }
    }
  }
  return best;
}

function evaluate(collection, sampleSize) {
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
const GRID = 25;
console.log(`\nGreedy sequential search (sampling ${Math.min(GRID, targets.length)} targets per round)...`);

const selected = [];
const remaining = [...paints];

for (let round = 0; round < 6; round++) {
  console.log(`\n--- Round ${round+1} ---`);
  let bestPick = null;
  
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

// Final evaluation
console.log('\n=== FINAL EVALUATION (full target set) ===');
const finalResult = evaluate(selected, targets.length);
console.log(`avg ΔE: ${finalResult.avg.toFixed(2)}`);
console.log('\nSelected palette:');
selected.forEach((p,i) => console.log(`  ${i+1}. ${p.name}  ${p.hex}  ${p.brand}`));
console.log('\nWorst 10 targets:');
finalResult.worst.forEach(t => console.log(`  ${t.name.padEnd(28)} ${t.hex}  ΔE ${t.dE.toFixed(1)}`));

// Compare to split-primary
const spNames = ['Legendary Red','Warlock Magenta','Ultramarine Blue','Arctic Gem','Inner Light','Leafy Green'];
const sp = spNames.map(n => paints.find(p => p.name === n)).filter(Boolean);
if (sp.length === 6) {
  const spResult = evaluate(sp, targets.length);
  console.log(`\n=== SPLIT-PRIMARY COMPARISON ===`);
  console.log(`Unconstrained: avg ΔE ${finalResult.avg.toFixed(2)}`);
  console.log(`Split-primary: avg ΔE ${spResult.avg.toFixed(2)}`);
  console.log(`Difference:    ${(spResult.avg - finalResult.avg).toFixed(2)} ΔE in favor of unconstrained`);
  
  // Check overlap
  const spSet = new Set(spNames);
  const overlap = selected.filter(p => spSet.has(p.name));
  console.log(`\nOverlap: ${overlap.map(p=>p.name).join(', ') || 'none'}`);
}
