// color-math.mjs — shared color science for the paint mixer
// Mixing model: subtractive approximation via geometric mean in linear RGB,
// evaluated perceptually in CIE Lab with CIEDE2000.

// ---------- sRGB / linear ----------
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  ];
}

export function rgbToHex(r, g, b) {
  const to = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}

export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function rgbLinear(rgb) {
  return [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
}

// ---------- XYZ (D65) ----------
const M = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041]
];
const MINV = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.9692660, 1.8760108, 0.0415560],
  [0.0556434, -0.2040259, 1.0572252]
];

export function rgbLinearToXyz(r, g, b) {
  return [
    M[0][0] * r + M[0][1] * g + M[0][2] * b,
    M[1][0] * r + M[1][1] * g + M[1][2] * b,
    M[2][0] * r + M[2][1] * g + M[2][2] * b
  ];
}

export function xyzToRgbLinear(x, y, z) {
  return [
    MINV[0][0] * x + MINV[0][1] * y + MINV[0][2] * z,
    MINV[1][0] * x + MINV[1][1] * y + MINV[1][2] * z,
    MINV[2][0] * x + MINV[2][1] * y + MINV[2][2] * z
  ];
}

// ---------- Lab ----------
const REF_X = 0.95047, REF_Y = 1.0, REF_Z = 1.08883;

function labF(t) {
  return t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);
}

function labFInv(t) {
  return t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787;
}

export function xyzToLab(x, y, z) {
  const fx = labF(x / REF_X);
  const fy = labF(y / REF_Y);
  const fz = labF(z / REF_Z);
  return [
    116 * fy - 16,
    500 * (fx - fy),
    200 * (fy - fz)
  ];
}

export function labToXyz(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  return [
    labFInv(fx) * REF_X,
    labFInv(fy) * REF_Y,
    labFInv(fz) * REF_Z
  ];
}

export function rgbToLab(rgb) {
  const [r, g, b] = rgbLinear(rgb);
  const [x, y, z] = rgbLinearToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

export function labToRgb(lab) {
  const [x, y, z] = labToXyz(lab[0], lab[1], lab[2]);
  const [r, g, b] = xyzToRgbLinear(x, y, z);
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

// ---------- CIEDE2000 ----------
export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * 180 / Math.PI;
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * 180 / Math.PI;
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    let diff = h2p - h1p;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    dhp = diff;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp = 0;
  if (C1p * C2p !== 0) {
    hbarp = (h1p + h2p) / 2;
    if (Math.abs(h1p - h2p) > 180) {
      if (h1p + h2p < 360) hbarp += 180;
      else hbarp -= 180;
    }
  }

  const T = 1
    - 0.17 * Math.cos((hbarp - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * hbarp * Math.PI / 180)
    + 0.32 * Math.cos((3 * hbarp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * hbarp - 63) * Math.PI / 180);

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC;
  const SH = 1 + 0.015 * Cbarp * T;

  const dLpSL = dLp / SL;
  const dCpSC = dCp / SC;
  const dHpSH = dHp / SH;

  return Math.sqrt(dLpSL * dLpSL + dCpSC * dCpSC + dHpSH * dHpSH + RT * dCpSC * dHpSH);
}

// ---------- Mixing model ----------
// Subtractive approximation: geometric mean in linear RGB.
// Weighted by pigment fraction. w1 + w2 = 1.
export function mixLinear(rgb1, rgb2, w1, w2) {
  const eps = 1e-6;
  const l1 = rgbLinear(rgb1);
  const l2 = rgbLinear(rgb2);
  return [
    Math.exp(w1 * Math.log(l1[0] + eps) + w2 * Math.log(l2[0] + eps)),
    Math.exp(w1 * Math.log(l1[1] + eps) + w2 * Math.log(l2[1] + eps)),
    Math.exp(w1 * Math.log(l1[2] + eps) + w2 * Math.log(l2[2] + eps))
  ];
}

export function mixRgb(rgb1, rgb2, w1, w2) {
  const [lr, lg, lb] = mixLinear(rgb1, rgb2, w1, w2);
  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}
