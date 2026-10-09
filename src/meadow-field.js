import {CONCEPT,hexRGB} from './concept-palette.js';
// A single world-space field drives both the ground texture and plant placement.
// Keep this module browser-independent so the texture can be regenerated offline.
export const MEADOW = {
  width: 19.7, depth: 14.8,
  root: CONCEPT.grass[0], tip: CONCEPT.grass[2],
};

export const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const hash = (x, z) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export function meadowNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const u = smooth(0, 1, x - ix), v = smooth(0, 1, z - iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

function outsideBox(x, z, cx, cz, hx, hz, feather) {
  const dx = Math.abs(x - cx) - hx, dz = Math.abs(z - cz) - hz;
  const distance = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
  return smooth(-.08, feather, distance);
}

export function sampleMeadow(x, z) {
  const broad = meadowNoise(x * .45 + 13, z * .45 + 41);
  const medium = meadowNoise(x * 1.5 - 8, z * 1.5 + 17);
  const fine = meadowNoise(x * 5.6 + 7, z * 5.6 - 12);
  // Worn camp edge is uneven, but the tent, rug and supply area stay clear.
  const warp = (medium - .5) * 1.25 + (broad - .5) * 2.5;
  const warpZ=(meadowNoise(x*.72+52,z*.72-19)-.5)*1.9+(fine-.5)*.24;
  // Independent domain warps and a wide transition soften the camp perimeter.
  let footprint = outsideBox(x + warp, z + warpZ, 0, .35, 5.35, 3.5, 1.65);
  footprint *= outsideBox(x, z, -7.45, 4.7, 1.95, 1.6, .5);
  footprint *= outsideBox(x, z, -5.9, 5.9, 1.2, 1.6, .5);
  footprint *= outsideBox(x, z, 7.1, .5, 1.4, 1.1, .45);
  footprint *= outsideBox(x, z, 8.65, 3.7, .95, .95, .3);
  // Lower plants fade around the existing rain pool instead of growing in it.
  const poolDistance = Math.hypot((x - 5) / 1.6, (z - 5.5) / .95);
  footprint *= smooth(.95, 1.4, poolDistance);
  const rim = smooth(0, .24, Math.min(MEADOW.width / 2 - Math.abs(x), MEADOW.depth / 2 - Math.abs(z)));
  const clusters = smooth(.19, .7, broad * .56 + medium * .34 + fine * .1);
  // Warped, metre-scale clearings break the old continuous grass belt. Both
  // ground colour and blades share this mask, so bare gaps expose concrete.
  const islands=meadowNoise(x*.72+(medium-.5)*1.7+63,z*.72+(broad-.5)*1.7-27);
  const patch=smooth(.24,.61,islands*.78+medium*.22);
  const coverage = footprint * rim * (.42 + .58 * clusters)*(.22+.78*patch);
  return { coverage, density: footprint * rim * (.3 + clusters * .66)*(.35+.65*patch), tone: broad, fine };
}

export function createMeadowPixels(width = 1024, height = 768) {
  const data = new Uint8Array(width * height * 4);
  const base = hexRGB(CONCEPT.grass[0]), light = hexRGB(CONCEPT.grass[1]), soil = [129, 121, 84];
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const x = ((px + .5) / width - .5) * MEADOW.width;
    // PNG top row corresponds to the northern (-Z) edge of the roof.
    const z = ((py + .5) / height - .5) * MEADOW.depth;
    const f = sampleMeadow(x, z);
    const fleck = meadowNoise(x * 25, z * 25);
    const dry = smooth(.66, .88, meadowNoise(x * 2.1 + 32, z * 2.1));
    const offset = (py * width + px) * 4;
    for (let c = 0; c < 3; c++) {
      const green = base[c] + (light[c] - base[c]) * f.tone;
      data[offset + c] = Math.round((green + (soil[c] - green) * dry * .28) * (.96 + fleck * .08));
    }
    data[offset + 3] = Math.round(255 * smooth(0, .92, f.coverage));
  }
  return { data, width, height };
}
