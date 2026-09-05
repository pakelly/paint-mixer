#!/usr/bin/env node
// build-webui.mjs — generates paint-mixer.html with embedded paint + collection data
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load Army Painter Fanatic paints
const apPaints = JSON.parse(readFileSync(join(__dirname, '..', 'army-painter-fanatic-colors.json'), 'utf8'))
  .map(p => ({ ...p, brand: 'Army Painter' }));

// Load Pro Acryl paints (if available)
let paPaints = [];
try {
  paPaints = JSON.parse(readFileSync(join(__dirname, '..', 'pro-acryl-colors.json'), 'utf8'))
    .map(p => ({ ...p, brand: 'Pro Acryl' }));
} catch (e) {
  console.log('Note: pro-acryl-colors.json not found, building with Army Painter only');
}

const paints = [...apPaints, ...paPaints];
const collection = JSON.parse(readFileSync(join(__dirname, 'my-collection.json'), 'utf8'));

// Load precomputed gamut (achievable color space)
let gamutData = [];
try {
  gamutData = JSON.parse(readFileSync(join(__dirname, 'gamut-data.json'), 'utf8'));
} catch (e) {
  console.log('Warning: gamut-data.json not found, coverage tab will have empty gamut');
}

const template = readFileSync(join(__dirname, 'webui.template.html'), 'utf8');

const html = template
  .replace('/*__PAINTS__*/', JSON.stringify(paints))
  .replace('/*__COLLECTION__*/', JSON.stringify(collection))
  .replace('/*__GAMUT__*/', JSON.stringify(gamutData));

writeFileSync(join(__dirname, 'paint-mixer.html'), html);
console.log(`Generated paint-mixer.html (${(html.length / 1024).toFixed(0)} KB) — ${paints.length} paints (${apPaints.length} Army Painter, ${paPaints.length} Pro Acryl), ${gamutData.length} gamut points`);
