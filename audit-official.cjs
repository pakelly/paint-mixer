const fs = require('fs');

// Load app paints
const html = fs.readFileSync('/home/node/.openclaw/workspace/paint-mixer/paint-mixer.html', 'utf8');
const paintMatch = html.match(/const ALL_PAINTS = (\[.*?\]);/s);
const ALL_PAINTS = JSON.parse(paintMatch[1]);
const apPaints = ALL_PAINTS.filter(p => p.brand === 'Army Painter');

// Load PaintHoarder official hex values
const phLines = fs.readFileSync('/tmp/ph-official-hex.txt', 'utf8').trim().split('\n');
const phHex = {};
for (const line of phLines) {
  const [slug, hex] = line.split('|');
  if (hex && hex !== 'NOTFOUND') {
    phHex[slug] = hex.toUpperCase();
  }
}

// Convert paint name to slug (matching PaintHoarder's URL format)
function nameToSlug(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Lab conversion
function hexToLab(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const lin = c => c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const X = 0.4124*R + 0.3576*G + 0.1805*B;
  const Y = 0.2126*R + 0.7152*G + 0.0722*B;
  const Z = 0.0193*R + 0.1192*G + 0.9505*B;
  const xn=0.95047, yn=1.0, zn=1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787*t + 16/116;
  const fx=f(X/xn), fy=f(Y/yn), fz=f(Z/zn);
  return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
}

function deltaE2000(l1, l2) {
  const [L1,a1,b1]=l1, [L2,a2,b2]=l2;
  const C1=Math.sqrt(a1*a1+b1*b1), C2=Math.sqrt(a2*a2+b2*b2);
  const Cbar=(C1+C2)/2;
  const G=0.5*(1-Math.sqrt(Math.pow(Cbar,7)/(Math.pow(Cbar,7)+Math.pow(25,7))));
  const a1p=(1+G)*a1, a2p=(1+G)*a2;
  const C1p=Math.sqrt(a1p*a1p+b1*b1), C2p=Math.sqrt(a2p*a2p+b2*b2);
  const h1raw = Math.atan2(b1,a1p)*180/Math.PI;
  const h2raw = Math.atan2(b2,a2p)*180/Math.PI;
  const H1 = h1raw<0?h1raw+360:h1raw;
  const H2 = h2raw<0?h2raw+360:h2raw;
  const dLp=L2-L1, dCp=C2p-C1p;
  let dhp;
  if (C1p*C2p===0) dhp=0;
  else { const diff=H2-H1; if(Math.abs(diff)<=180) dhp=diff; else if(diff>180) dhp=diff-360; else dhp=diff+360; }
  const dHp=2*Math.sqrt(C1p*C2p)*Math.sin(dhp*Math.PI/360);
  const Lbar=(L1+L2)/2, Cpbar=(C1p+C2p)/2;
  let hpbar;
  if (C1p*C2p===0) hpbar=H1+H2;
  else { const diff=Math.abs(H1-H2); const sum=H1+H2; if(diff<=180) hpbar=sum/2; else if(sum<360) hpbar=(sum+360)/2; else hpbar=(sum-360)/2; }
  const T=1-0.17*Math.cos((hpbar-30)*Math.PI/180)+0.24*Math.cos(2*hpbar*Math.PI/180)+0.32*Math.cos((3*hpbar+6)*Math.PI/180)-0.20*Math.cos((4*hpbar-63)*Math.PI/180);
  const dTheta=30*Math.exp(-Math.pow((hpbar-275)/25,2));
  const Rc=2*Math.sqrt(Math.pow(Cpbar,7)/(Math.pow(Cpbar,7)+Math.pow(25,7)));
  const Sl=1+0.015*Math.pow(Lbar-50,2)/Math.sqrt(20+Math.pow(Lbar-50,2));
  const Sc=1+0.045*Cpbar;
  const Sh=1+0.015*Cpbar*T;
  const Rt=-Math.sin(2*dTheta*Math.PI/180)*Rc;
  return Math.sqrt(Math.pow(dLp/Sl,2)+Math.pow(dCp/Sc,2)+Math.pow(dHp/Sh,2)+Rt*(dCp/Sc)*(dHp/Sh));
}

// Compare
const results = [];
let notFound = [];
for (const p of apPaints) {
  const slug = nameToSlug(p.name);
  const phHexVal = phHex[slug];
  if (!phHexVal) {
    notFound.push(p.name + ' (slug: ' + slug + ')');
    continue;
  }
  const appLab = hexToLab(p.hex.toUpperCase());
  const phLab = hexToLab(phHexVal);
  const dE = deltaE2000(appLab, phLab);
  let status;
  if (dE < 5) status = 'MATCH';
  else if (dE < 10) status = 'CLOSE';
  else status = 'MISMATCH';
  results.push({ name: p.name, appHex: p.hex.toUpperCase(), phHex: phHexVal, dE: dE, status });
}

// Sort by dE descending
results.sort((a,b) => b.dE - a.dE);

// Print summary
const match = results.filter(r => r.status === 'MATCH').length;
const close = results.filter(r => r.status === 'CLOSE').length;
const mismatch = results.filter(r => r.status === 'MISMATCH').length;
console.log(`\n=== OFFICIAL HEX AUDIT (PaintHoarder) ===`);
console.log(`Total: ${results.length} | MATCH(<5): ${match} | CLOSE(5-10): ${close} | MISMATCH(>=10): ${mismatch}`);
if (notFound.length) console.log(`Not found on PH: ${notFound.length} - ${notFound.join(', ')}`);

console.log(`\n=== ALL PAINTS (sorted by dE desc) ===`);
for (const r of results) {
  const marker = r.status === 'MISMATCH' ? 'X' : r.status === 'CLOSE' ? '!' : 'OK';
  console.log(`[${marker}] ${r.name.padEnd(22)} app:${r.appHex}  PH:${r.phHex}  dE=${r.dE.toFixed(1)}`);
}

// Write full report
let report = `# Army Painter Fanatic — Official Hex Audit\n\n**Source:** PaintHoarder.com (official published hex values)\n**Date:** 2026-09-04\n**Paints compared:** ${results.length}\n**Method:** CIEDE2000\n\n## Summary\n\n| Status | Count |\n|--------|-------|\n| MATCH (dE<5) | ${match} |\n| CLOSE (5<=dE<10) | ${close} |\n| MISMATCH (dE>=10) | ${mismatch} |\n\n## Mismatches & Close Matches (sorted by dE desc)\n\n| Paint | App Hex | Official Hex | dE | Status |\n|-------|---------|-------------|-----|--------|\n`;
for (const r of results.filter(r => r.status !== 'MATCH')) {
  report += `| ${r.name} | ${r.appHex} | ${r.phHex} | ${r.dE.toFixed(1)} | ${r.status} |\n`;
}
report += `\n## Full Results\n\n| Paint | App Hex | Official Hex | dE | Status |\n|-------|---------|-------------|-----|--------|\n`;
for (const r of results) {
  report += `| ${r.name} | ${r.appHex} | ${r.phHex} | ${r.dE.toFixed(1)} | ${r.status} |\n`;
}
fs.writeFileSync('/home/node/.openclaw/workspace/paint-mixer/audit-official.md', report);
console.log('\nReport written to audit-official.md');
