import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Twemoji 14.x doesn't bundle SVG files in the npm package (only dist/*.js).
// Instead, fetch the brain emoji (U+1F9E0) from the Twemoji CDN, which serves
// the same graphics as assets/svg/<hex-code>.svg in the Twemoji GitHub repository.
const twemojiSvgUrl = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f9e0.svg';

const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');
mkdirSync(iconsDir, { recursive: true });

const BACKGROUND = '#0f1220';

async function generate() {
  // Fetch the SVG from the CDN
  const response = await fetch(twemojiSvgUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Twemoji SVG: ${response.status} ${response.statusText}`);
  }
  const svgBuffer = await response.arrayBuffer();

  await sharp(Buffer.from(svgBuffer)).resize(192, 192).png().toFile(join(iconsDir, 'icon-192.png'));
  await sharp(Buffer.from(svgBuffer)).resize(512, 512).png().toFile(join(iconsDir, 'icon-512.png'));

  // Maskable icon: the glyph at ~80% scale, centered over a solid
  // background square — the standard "safe zone" so Android's shape mask
  // doesn't crop the brain at the edges.
  const maskableSize = 512;
  const glyphSize = Math.round(maskableSize * 0.8);
  const glyphBuffer = await sharp(Buffer.from(svgBuffer)).resize(glyphSize, glyphSize).png().toBuffer();
  await sharp({
    create: { width: maskableSize, height: maskableSize, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: glyphBuffer, gravity: 'center' }])
    .png()
    .toFile(join(iconsDir, 'maskable-512.png'));

  await sharp(Buffer.from(svgBuffer)).resize(32, 32).png().toFile(join(publicDir, 'favicon.png'));

  console.log('Generated icons in', iconsDir, 'and', join(publicDir, 'favicon.png'));
}

generate().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
