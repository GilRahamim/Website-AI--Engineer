// kb-app/scripts/measure-formulas.mjs
//
// Measures every formula raster in public/topic-assets and writes
// src/data/formula-sizes.json, which TopicReader uses to display each
// formula at a size that matches the surrounding text.
//
// Why: the migration exported formulas as PNGs at wildly different
// resolutions (a one-line fraction can be 640px or 1900px wide) with no
// width/height attributes, so the browser paints them at full pixel size.
// A single CSS scale factor can't fix that. Instead, each image is scanned
// for the median height of its ink blobs — roughly the x-height of its
// glyphs — and the reader scales the image so that lands at text x-height.
//
// Output shape: { "<asset basename>": [naturalWidth, naturalHeight, glyphHeight] }
// where glyphHeight is 0 for figures (diagrams) that must keep their size.
//
// Run: node scripts/measure-formulas.mjs   (needs devDependency pngjs)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'public/topic-assets');
const outPath = join(root, 'src/data/formula-sizes.json');

// Anything this tall, or this square, is a diagram rather than a formula.
const FIGURE_MIN_HEIGHT = 700;
const FIGURE_MAX_ASPECT = 1.8;
const FIGURE_SQUARE_MIN_HEIGHT = 300;
// Blobs shorter than this are dots, fraction bars or antialiasing noise.
const MIN_BLOB_HEIGHT = 5;
// Wider-than-tall by this much means a rule (fraction bar, overline).
const MAX_BLOB_ASPECT = 10;
// Upper bound of x-height relative to a single-line raster's full height.
const MAX_XHEIGHT_FRACTION = 0.4;
// Fallback x-height for rasters the decoder cannot read (see below).
const UNDECODABLE_XHEIGHT_FRACTION = 0.16;

function isInk(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];
  if (a < 96) return false;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 170;
}

/**
 * Median height of the connected ink blobs in a formula raster. Most
 * glyphs in a formula sit at x-height (letters like e, n, a) with caps,
 * digits and ascenders a bit taller, so the median lands near the x-height
 * whatever the raster resolution — the one number the reader needs to put
 * the formula on the same visual scale as the surrounding text. Returns 0
 * for diagrams and blank images (kept at natural size).
 */
function measureGlyphHeight(png) {
  const { width, height, data } = png;
  // A single glyph ("k", "λ") is squarer than any line of text but is
  // tiny; only a squarish image that is also big is a diagram.
  if (height >= FIGURE_MIN_HEIGHT || (width / height < FIGURE_MAX_ASPECT && height >= FIGURE_SQUARE_MIN_HEIGHT)) return 0;
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) ink[i] = isInk(data, i * 4) ? 1 : 0;
  const seen = new Uint8Array(width * height);
  const stack = [];
  const blobHeights = [];
  for (let start = 0; start < width * height; start++) {
    if (!ink[start] || seen[start]) continue;
    let minY = height;
    let maxY = -1;
    let minX = width;
    let maxX = -1;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const index = stack.pop();
      const x = index % width;
      const y = (index - x) / width;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      const neighbours = [index - 1, index + 1, index - width, index + width];
      if (x === 0) neighbours[0] = -1;
      if (x === width - 1) neighbours[1] = -1;
      for (const next of neighbours) {
        if (next < 0 || next >= width * height || !ink[next] || seen[next]) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    const blobH = maxY - minY + 1;
    const blobW = maxX - minX + 1;
    if (blobH < MIN_BLOB_HEIGHT || blobW / blobH > MAX_BLOB_ASPECT) continue;
    blobHeights.push(blobH);
  }
  if (blobHeights.length === 0) return 0;
  blobHeights.sort((a, b) => a - b);
  const median = blobHeights[Math.floor(blobHeights.length / 2)];
  // A formula with only a few glyphs ("O(m)", "z-score") has no x-height
  // majority, and touching glyphs merge into one tall blob, so the median
  // can be the full line height. Text never has an x-height above ~40% of
  // a tightly cropped single line, so cap the estimate there.
  return Math.min(median, Math.round(height * MAX_XHEIGHT_FRACTION));
}

const sizes = {};
const files = readdirSync(assetsDir).filter((name) => name.endsWith('.png')).sort();
let unreadable = 0;
for (const name of files) {
  const bytes = readFileSync(join(assetsDir, name));
  const key = name.replace(/\.png$/, '');
  try {
    const png = PNG.sync.read(bytes);
    sizes[key] = [png.width, png.height, measureGlyphHeight(png)];
  } catch {
    // Two rasters have a truncated IDAT stream the decoder rejects (the
    // browser still paints them). Their size is in the IHDR header; the
    // x-height is a rough guess from the height, which across the decodable
    // set sits at roughly 16% of a formula raster's height.
    unreadable += 1;
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const isFigure = height >= FIGURE_MIN_HEIGHT || (width / height < FIGURE_MAX_ASPECT && height >= FIGURE_SQUARE_MIN_HEIGHT);
    sizes[key] = [width, height, isFigure ? 0 : Math.round(height * UNDECODABLE_XHEIGHT_FRACTION)];
  }
}
writeFileSync(outPath, JSON.stringify(sizes));
const figures = Object.values(sizes).filter(([, , line]) => line === 0).length;
console.log(`measured ${files.length} images (${figures} figures, ${unreadable} undecodable) -> ${outPath}`);
