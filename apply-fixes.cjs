const fs = require('fs');

// Load app paints
const html = fs.readFileSync('/home/node/.openclaw/workspace/paint-mixer/paint-mixer.html', 'utf8');
const paintMatch = html.match(/const ALL_PAINTS = (\[.*?\]);/s);
const ALL_PAINTS = JSON.parse(paintMatch[1]);

// Official hex values from PaintHoarder (slug -> hex)
const phHex = {
  'abyssal-blue': '#00506C',
  'aegis-aqua': '#32B3D5',
  'afterglow': '#E4EA8D',
  'agate-skin': '#D7877B',
  'alien-purple': '#6154A3',
  'alpha-blue': '#667DC0',
  'amber-skin': '#C4A083',
  'amulet-aqua': '#68C5B6',
  'ancient-stone': '#D0C3A3',
  'angel-green': '#173E31',
  'angelic-red': '#D42C39',
  'aqua-alchemy': '#24BBA6',
  'aquamarine': '#56C4CD',
  'arctic-gem': '#1995D4',
  'army-green': '#5D7554',
  'ash-grey': '#84878F',
  'augur-blue': '#ACBCE2',
  'autumn-sage': '#75AD98',
  'barbarian-flesh': '#F69B7F',
  'baron-blue': '#7C95CC',
  'barren-dune': '#DEBB72',
  'basilisk-red': '#6C2539',
  'blood-chalice': '#DB4B50',
  'boney-spikes': '#E6D4C1',
  'bootstrap-brown': '#5D4D4D',
  'brainmatter-beige': '#DEDBD3',
  'brigade-grey': '#D0D0D2',
  'brigadine-brown': '#443A40',
  'bright-gold': '#987B1A',
  'bright-sapphire': '#84CEF0',
  'buffed-hide': '#B3756A',
  'burning-ore': '#F2653E',
  'burnt-turf': '#BE9859',
  'camouflage-green': '#6E8358',
  'carnelian-skin': '#5D3E46',
  'cobalt-metal': '#2E4249',
  'command-khaki': '#B49488',
  'company-grey': '#BCBEC2',
  'crystal-blue': '#0273BC',
  'cultist-purple': '#6962AB',
  'daemonic-yellow': '#FECE2A',
  'dark-emerald': '#3B4A25',
  'death-metal': '#2B2B2B',
  'deep-azure': '#006B79',
  'deep-grey': '#4B5164',
  'deep-ocean-blue': '#1B3044',
  'demigod-flames': '#D17B41',
  'desert-yellow': '#856D45',
  'diabolic-plum': '#562D74',
  'diviner-light': '#D59FC5',
  'doomfire-drab': '#F9D9E6',
  'dorado-skin': '#EEC79E',
  'dragon-red': '#BF283B',
  'dryad-brown': '#613630',
  'dusty-skull': '#8B7C68',
  'elder-flower': '#A8577B',
  'electric-lime': '#BDD532',
  'emerald-forest': '#5BBB4D',
  'enchanted-pink': '#B66CAE',
  'eternal-hunt': '#279A4C',
  'evergreen-fog': '#396360',
  'evil-chrome': '#5B3B2F',
  'ferocious-green': '#75C377',
  'fiendish-yellow': '#EC9A44',
  'figgy-pink': '#E3AFC9',
  'flickering-flame': '#F58B3D',
  'forbidden-fruit': '#CD88A9',
  'forest-faun': '#A1C7AF',
  'frost-blue': '#9ABEDE',
  'fur-brown': '#774544',
  'gargoyle-grey': '#A8A292',
  'gemstone-red': '#821D23',
  'glittering-green': '#2E794A',
  'glowing-inferno': '#F79D42',
  'gothic-blue': '#2E3E79',
  'great-hall-grey': '#BBB4A6',
  'greedy-gold': '#745218',
  'greenskin': '#1F7843',
  'grey-castle': '#929286',
  'grotesque-green': '#B3C29D',
  'guardian-green': '#226248',
  'gun-metal': '#4F5053',
  'hexed-violet': '#8D81BE',
  'hydra-turquoise': '#149398',
  'ice-yellow': '#FFEDAD',
  'imperial-navy': '#063565',
  'impish-rouge': '#D957A0',
  'inner-light': '#FDCB5F',
  'jasper-skin': '#BA7372',
  'kraken-lavender': '#D5CAE5',
  'lava-orange': '#F5792C',
  'leafy-green': '#76C045',
  'leather-brown': '#7C5B54',
  'legendary-red': '#EF4B3E',
  'leopard-stone-skin': '#E7B4B1',
  'magecast-magenta': '#704099',
  'marine-mist': '#94D6D7',
  'matt-black': '#000000',
  'matt-white': '#FFFFFF',
  'medieval-forest': '#437C6D',
  'mithril': '#9E9FA3',
  'mocca-skin': '#81655A',
  'moldy-wine': '#7D3451',
  'molten-lava': '#F05A3E',
  'moonstone-skin': '#C57B74',
  'mossy-green': '#B1DCC0',
  'mulled-berry': '#623348',
  'necrotic-flesh': '#9AA984',
  'neptune-glow': '#75CED4',
  'night-sky': '#304358',
  'oak-brown': '#39262A',
  'obsidian-skin': '#4A4046',
  'olive-drab': '#7A905F',
  'onyx-skin': '#664A4D',
  'opal-skin': '#FFD2C8',
  'pale-sand': '#EFEAD3',
  'paratrooper-tan': '#9A776C',
  'patagon-pine': '#63917F',
  'pearl-skin': '#FFE3D8',
  'phalanx-blue': '#048BAE',
  'pharaoh-guard': '#0C7C61',
  'pink-potion': '#F4B9D4',
  'pixie-pink': '#D96FAE',
  'plate-mail-metal': '#686A6E',
  'prairie-ochre': '#696242',
  'pure-red': '#CD151C',
  'quartz-skin': '#F0D0B4',
  'raging-rose': '#E96663',
  'raging-rouge': '#F68F82',
  'rainforest': '#8BC63E',
  'red-copper': '#4D2C30',
  'regal-blue': '#004F88',
  'resplendent-red': '#96272F',
  'rough-iron': '#352D25',
  'royal-blue': '#0162AF',
  'ruby-skin': '#FBB99D',
  'ruddy-umber': '#985951',
  'runic-cobalt': '#7496B4',
  'sacred-scarlet': '#F1634C',
  'scarab-green': '#193C44',
  'shieldwall-blue': '#08A1CC',
  'shining-silver': '#86888C',
  'skeleton-bone': '#C2B293',
  'space-dust': '#FFE388',
  'spellbound-fuchsia': '#AD4DA0',
  'stratos-blue': '#33658F',
  'tainted-gold': '#575235',
  'talisman-teal': '#1FAE91',
  'temple-gate-teal': '#046154',
  'terrestial-titan': '#303149',
  'thunderous-blue': '#34577B',
  'tidal-blue': '#026B93',
  'tiger-s-eye-skin': '#904D52',
  'tomb-king-tan': '#A29278',
  'topaz-skin': '#B25A53',
  'tourmaline-skin': '#E3988B',
  'tree-ancient': '#513430',
  'triumphant-navy': '#1A2C53',
  'true-brass': '#635D58',
  'true-copper': '#6B4731',
  'tundra-taupe': '#4B4D3E',
  'turquoise-siren': '#29B3B9',
  'ultramarine-blue': '#284D8E',
  'uniform-grey': '#6B707C',
  'urban-buff': '#DBB9AB',
  'violent-vermillion': '#F37964',
  'violet-coven': '#A999C7',
  'vivid-volt': '#CFDC51',
  'warlock-magenta': '#834D9F',
  'warped-yellow': '#FED548',
  'wasteland-clay': '#A38755',
  'weapon-bronze': '#955610',
  'weird-elixir': '#E092BF',
  'wicked-pink': '#CE0886',
  'wild-green': '#46B758',
  'wilted-rose': '#ECC5D7',
  'wolf-grey': '#4F78A3',
  'woodland-camo': '#4B6149',
  'worn-stone': '#C4BFB1',
  'wyvern-fury': '#993243',
};

// Name corrections (typos in our app)
const nameFixes = {
  'Castle Grey': 'Grey Castle',
  'Hydra Turqouise': 'Hydra Turquoise',
  'Turqouise Siren': 'Turquoise Siren',
  'Pharoah Guard': 'Pharaoh Guard',
  'Camoflauge Green': 'Camouflage Green',
  'Basalisk Red': 'Basilisk Red',
  'Weird Elixer': 'Weird Elixir',
  'Spellbound Fuchia': 'Spellbound Fuchsia',
  "Tiger's Eye Skin": "Tiger's Eye Skin",  // keep as-is, just fix hex
  'Plate Metal': 'Plate Metal',  // keep as-is, just fix hex
};

function nameToSlug(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1,3),16),
    parseInt(hex.slice(3,5),16),
    parseInt(hex.slice(5,7),16)
  ];
}

function rgbToHsv(r, g, b) {
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return [Math.round(h*10)/10, Math.round(s*10)/10, Math.round(v*10)/10];
}

// Update ALL_PAINTS
let updated = 0;
let hexChanged = 0;
let nameChanged = 0;

for (const p of ALL_PAINTS) {
  if (p.brand !== 'Army Painter') continue;
  
  // Fix name typos
  const fixedName = nameFixes[p.name];
  if (fixedName && fixedName !== p.name) {
    console.log(`Name fix: ${p.name} -> ${fixedName}`);
    p.name = fixedName;
    nameChanged++;
  }
  
  // Update hex
  const slug = nameToSlug(p.name);
  const newHex = phHex[slug];
  if (newHex && newHex !== p.hex.toUpperCase()) {
    const oldHex = p.hex;
    p.hex = newHex;
    const [r, g, b] = hexToRgb(newHex);
    p.r = r; p.g = g; p.b = b;
    const [h, s, v] = rgbToHsv(r, g, b);
    p.h = h; p.s = s; p.v = v;
    console.log(`Hex fix: ${p.name} ${oldHex} -> ${newHex}`);
    hexChanged++;
  }
  updated++;
}

console.log(`\nUpdated ${updated} Army Painter paints: ${hexChanged} hex changes, ${nameChanged} name fixes`);

// Write the updated ALL_PAINTS back
const oldDataStr = paintMatch[1];
const newDataStr = JSON.stringify(ALL_PAINTS);
const newHtml = html.replace(oldDataStr, newDataStr);
fs.writeFileSync('/home/node/.openclaw/workspace/paint-mixer/paint-mixer.html', newHtml);
console.log('paint-mixer.html updated');
