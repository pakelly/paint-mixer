#!/usr/bin/env node
// build-webui.mjs — generates paint-mixer.html with embedded paint + collection data
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const paints = JSON.parse(readFileSync(join(__dirname, '..', 'army-painter-fanatic-colors.json'), 'utf8'));
const collection = JSON.parse(readFileSync(join(__dirname, 'my-collection.json'), 'utf8'));

const template = readFileSync(join(__dirname, 'webui.template.html'), 'utf8');

const html = template
  .replace('/*__PAINTS__*/', JSON.stringify(paints))
  .replace('/*__COLLECTION__*/', JSON.stringify(collection));

writeFileSync(join(__dirname, 'paint-mixer.html'), html);
console.log('Generated paint-mixer.html (' + (html.length / 1024).toFixed(0) + ' KB)');
