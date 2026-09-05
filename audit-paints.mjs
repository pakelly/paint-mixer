import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

// ── Color conversions ──
function srgbToLinear(c) {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r, g, b) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  // sRGB to XYZ (D65)
  return {
    x: rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    y: rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750,
    z: rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041,
  };
}

function xyzToLab(x, y, z) {
  // D65 reference white
  const xn = 0.95047, yn = 1.00000, zn = 1.08883;
  const fx = x / xn, fy = y / yn, fz = z / zn;
  const eps = 0.008856;
  const kappa = 903.3;
  const fx3 = fx > eps ? Math.cbrt(fx) : (kappa * fx + 16) / 116;
  const fy3 = fy > eps ? Math.cbrt(fy) : (kappa * fy + 16) / 116;
  const fz3 = fz > eps ? Math.cbrt(fz) : (kappa * fz + 16) / 116;
  return {
    L: 116 * fy3 - 16,
    a: 500 * (fx3 - fy3),
    b: 200 * (fy3 - fz3),
  };
}

function rgbToLab(r, g, b) {
  const { x, y, z } = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

// CIEDE2000 color difference
function ciede2000(lab1, lab2) {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;
  
  const kL = 1, kC = 1, kH = 1;
  
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  
  const h1p = Math.atan2(b1, a1p) * 180 / Math.PI;
  const h2p = Math.atan2(b2, a2p) * 180 / Math.PI;
  
  const h1p360 = h1p < 0 ? h1p + 360 : h1p;
  const h2p360 = h2p < 0 ? h2p + 360 : h2p;
  
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  
  let dhp;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    const diff = h2p360 - h1p360;
    if (Math.abs(diff) <= 180) {
      dhp = diff;
    } else if (diff > 180) {
      dhp = diff - 360;
    } else {
      dhp = diff + 360;
    }
  }
  
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);
  
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  
  let hbarp;
  if (C1p * C2p === 0) {
    hbarp = h1p360 + h2p360;
  } else {
    const diff = Math.abs(h1p360 - h2p360);
    if (diff <= 180) {
      hbarp = (h1p360 + h2p360) / 2;
    } else if (h1p360 + h2p360 < 360) {
      hbarp = (h1p360 + h2p360 + 360) / 2;
    } else {
      hbarp = (h1p360 + h2p360 - 360) / 2;
    }
  }
  
  const T = 1 - 0.17 * Math.cos((hbarp - 30) * Math.PI / 180)
            + 0.24 * Math.cos((2 * hbarp) * Math.PI / 180)
            - 0.32 * Math.cos((3 * hbarp + 6) * Math.PI / 180)
            + 0.20 * Math.cos((4 * hbarp - 63) * Math.PI / 180);
  
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  
  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  
  const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC;
  
  const dE = Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
  
  return dE;
}

// ── Load data ──
const paints = JSON.parse(readFileSync('/tmp/ap-paints.json', 'utf8'));
console.log(`Loaded ${paints.length} paints from app data`);

// ── Load image and sample colors ──
const imgBuffer = await sharp('/tmp/APFanaticSwatchSheet-2400.jpg')
  .raw()
  .toBuffer({ resolveWithObject: true });

const { data, info } = imgBuffer;
const { width, height, channels } = info;
console.log(`Image: ${width}x${height}, ${channels} channels`);

// Sample the image on a grid and collect color clusters
// Based on the image analysis: 3 groups of 6 columns = 18 swatches wide
// ~13 rows tall
// We need to find the swatch positions

// Let's sample a coarse grid first to find the swatch locations
// The image is 2400x2311. Let's sample every 10px to build a color map
const sampleStep = 8;
const samples = [];

for (let y = 0; y < height; y += sampleStep) {
  for (let x = 0; x < width; x += sampleStep) {
    const idx = (y * width + x) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    samples.push({ x, y, r, g, b });
  }
}

// Cluster samples by color similarity
// Use a simple approach: quantize to 4-bit per channel and group
function quantize(v) {
  return Math.round(v / 16) * 16;
}

const colorMap = new Map();
for (const s of samples) {
  const key = `${quantize(s.r)},${quantize(s.g)},${quantize(s.b)}`;
  if (!colorMap.has(key)) {
    colorMap.set(key, { r: 0, g: 0, b: 0, count: 0, xs: [], ys: [] });
  }
  const entry = colorMap.get(key);
  entry.r += s.r;
  entry.g += s.g;
  entry.b += s.b;
  entry.count++;
  entry.xs.push(s.x);
  entry.ys.push(s.y);
}

// Convert to clusters with averaged colors
const clusters = [];
for (const [key, entry] of colorMap) {
  if (entry.count < 20) continue; // skip tiny clusters
  const r = Math.round(entry.r / entry.count);
  const g = Math.round(entry.g / entry.count);
  const b = Math.round(entry.b / entry.count);
  
  // Skip near-white (background) and near-black (text/lines)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 245 && min > 235) continue; // white background
  if (max < 20) continue; // black text/lines
  
  // Calculate center
  const cx = entry.xs.reduce((a, b) => a + b, 0) / entry.xs.length;
  const cy = entry.ys.reduce((a, b) => a + b, 0) / entry.ys.length;
  
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  
  clusters.push({
    hex,
    r, g, b,
    center: { x: Math.round(cx), y: Math.round(cy) },
    pixelCount: entry.count,
  });
}

console.log(`Found ${clusters.length} color clusters`);

// ── Match each paint to best cluster ──
// Pre-compute Lab for all clusters
const clusterLabs = clusters.map(c => ({ ...c, lab: rgbToLab(c.r, c.g, c.b) }));

// Pre-compute Lab for all paints
const paintLabs = paints.map(p => ({
  ...p,
  lab: rgbToLab(p.r, p.g, p.b),
}));

// For each paint, find best matching cluster
const results = [];
for (const paint of paintLabs) {
  let bestMatch = null;
  let bestDeltaE = Infinity;
  
  for (const cluster of clusterLabs) {
    const dE = ciede2000(paint.lab, cluster.lab);
    if (dE < bestDeltaE) {
      bestDeltaE = dE;
      bestMatch = cluster;
    }
  }
  
  const status = bestDeltaE < 5 ? 'MATCH' : bestDeltaE < 10 ? 'CLOSE' : 'MISMATCH';
  
  results.push({
    name: paint.name,
    appHex: paint.hex,
    chartHex: bestMatch ? bestMatch.hex : 'NONE',
    deltaE: bestDeltaE,
    status,
    chartCenter: bestMatch ? bestMatch.center : null,
    type: paint.type,
  });
}

// Sort by name for the main listing
results.sort((a, b) => a.name.localeCompare(b.name));

// ── Generate report ──
let report = `# Army Painter Fanatic Paint Hex Color Audit Report\n\n`;
report += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
report += `**Paints in app data:** ${paints.length}\n`;
report += `**Color clusters from chart:** ${clusters.length}\n`;
report += `**Color difference method:** CIEDE2000\n`;
report += `**Chart image:** APFanaticSwatchSheet-2400.jpg (${width}x${height})\n`;
report += `**Source:** danbecker.info hand-painted swatch chart\n\n`;

// Summary stats
const matches = results.filter(r => r.status === 'MATCH');
const closes = results.filter(r => r.status === 'CLOSE');
const mismatches = results.filter(r => r.status === 'MISMATCH');
const noMatch = results.filter(r => r.chartHex === 'NONE');

report += `## Summary\n\n`;
report += `| Status | Count | Percentage |\n`;
report += `|--------|-------|------------|\n`;
report += `| MATCH (ΔE < 5) | ${matches.length} | ${(matches.length / results.length * 100).toFixed(1)}% |\n`;
report += `| CLOSE (5 ≤ ΔE < 10) | ${closes.length} | ${(closes.length / results.length * 100).toFixed(1)}% |\n`;
report += `| MISMATCH (ΔE ≥ 10) | ${mismatches.length} | ${(mismatches.length / results.length * 100).toFixed(1)}% |\n`;
report += `| No swatch found | ${noMatch.length} | ${(noMatch.length / results.length * 100).toFixed(1)}% |\n\n`;

// Average delta E
const avgDeltaE = results.reduce((sum, r) => sum + r.deltaE, 0) / results.length;
const medianDeltaE = [...results].sort((a, b) => a.deltaE - b.deltaE)[Math.floor(results.length / 2)].deltaE;
report += `**Average ΔE:** ${avgDeltaE.toFixed(2)}\n`;
report += `**Median ΔE:** ${medianDeltaE.toFixed(2)}\n\n`;

// Full comparison table
report += `## Full Comparison\n\n`;
report += `| Paint Name | App Hex | Chart Hex | ΔE | Status |\n`;
report += `|------------|---------|-----------|-----|--------|\n`;
for (const r of results) {
  report += `| ${r.name} | ${r.appHex} | ${r.chartHex} | ${r.deltaE.toFixed(2)} | ${r.status} |\n`;
}

// Mismatches sorted by deltaE descending
report += `\n## Mismatches (sorted by ΔE descending)\n\n`;
const sortedMismatches = [...mismatches, ...closes].sort((a, b) => b.deltaE - a.deltaE);
if (sortedMismatches.length === 0) {
  report += `No mismatches found. All paints match the chart within ΔE < 5.\n`;
} else {
  report += `| Paint Name | App Hex | Chart Hex | ΔE | Suggested Fix |\n`;
  report += `|------------|---------|-----------|-----|---------------|\n`;
  for (const r of sortedMismatches) {
    report += `| ${r.name} | ${r.appHex} | ${r.chartHex} | ${r.deltaE.toFixed(2)} | Consider updating to ${r.chartHex} |\n`;
  }
}

// Check for paints with no matching swatch
report += `\n## Paints Without Matching Swatch\n\n`;
if (noMatch.length === 0) {
  report += `All paints found a matching swatch on the chart.\n`;
} else {
  report += `The following paints had no matching swatch detected (might mean the swatch wasn't sampled):\n\n`;
  for (const r of noMatch) {
    report += `- ${r.name} (${r.appHex})\n`;
  }
}

// Also check for chart clusters that don't match any paint (extra swatches)
report += `\n## Chart Clusters Without Matching Paint\n\n`;
// Find clusters not matched by any paint
const matchedClusterHexes = new Set(results.filter(r => r.deltaE < 10).map(r => r.chartHex));
const unmatchedClusters = clusterLabs.filter(c => !matchedClusterHexes.has(c.hex));
if (unmatchedClusters.length === 0) {
  report += `All chart clusters were matched to a paint.\n`;
} else {
  report += `Found ${unmatchedClusters.length} chart clusters with no close paint match (ΔE ≥ 10):\n\n`;
  report += `| Chart Hex | Center (x, y) | Pixel Count | Closest Paint | ΔE |\n`;
  report += `|-----------|---------------|-------------|---------------|-----|\n`;
  // For each unmatched cluster, find closest paint
  for (const cluster of unmatchedClusters.slice(0, 30)) { // limit to 30
    let closestPaint = null;
    let closestDeltaE = Infinity;
    for (const paint of paintLabs) {
      const dE = ciede2000(cluster.lab, paint.lab);
      if (dE < closestDeltaE) {
        closestDeltaE = dE;
        closestPaint = paint;
      }
    }
    report += `| ${cluster.hex} | (${cluster.center.x}, ${cluster.center.y}) | ${cluster.pixelCount} | ${closestPaint ? closestPaint.name : 'NONE'} | ${closestDeltaE.toFixed(2)} |\n`;
  }
  if (unmatchedClusters.length > 30) {
    report += `\n... and ${unmatchedClusters.length - 30} more.\n`;
  }
}

// Notes
report += `\n## Notes\n\n`;
report += `1. **Color difference method:** CIEDE2000 (ISO/CIE 11664-6:2014), the most perceptually accurate color difference formula.\n`;
report += `2. **Lab conversion:** sRGB → linear RGB (gamma correction) → XYZ (D65 illuminant, sRGB matrix) → CIELAB.\n`;
report += `3. **Chart source:** Hand-painted swatch chart from Dan Becker's paint chart review (danbecker.info). Colors are sampled from a photographed chart, so some variation from true paint colors is expected due to lighting, camera, and JPEG compression.\n`;
report += `4. **Cluster sampling:** Image sampled at 8px intervals, colors quantized to 4-bit per channel for clustering. Clusters with < 20 pixels excluded as noise.\n`;
report += `5. **Thresholds:** MATCH = ΔE < 5 (perceptually identical), CLOSE = 5 ≤ ΔE < 10 (minor difference), MISMATCH = ΔE ≥ 10 (significant difference).\n`;
report += `6. **Limitations:** The chart is a photograph of hand-painted swatches, not controlled digital color samples. Lighting conditions, paint application thickness, and camera color reproduction all affect the sampled colors. A ΔE of 5-10 may still be the same paint photographed under different conditions. Treat MISMATCH results with ΔE > 15 as the most likely candidates for hex corrections in the app data.\n`;

writeFileSync('/home/node/.openclaw/workspace/paint-mixer/audit-report.md', report);
console.log(`\nReport written to /home/node/.openclaw/workspace/paint-mixer/audit-report.md`);
console.log(`\nSummary: ${matches.length} MATCH, ${closes.length} CLOSE, ${mismatches.length} MISMATCH, ${noMatch.length} NO_SWATCH`);
console.log(`Average ΔE: ${avgDeltaE.toFixed(2)}, Median ΔE: ${medianDeltaE.toFixed(2)}`);
