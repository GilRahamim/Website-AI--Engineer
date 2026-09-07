import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Twemoji brain emoji (U+1F9E0) vendored locally to avoid network fetches
// during build. The SVG is sourced from the official Twemoji repository
// (https://github.com/twitter/twemoji) and committed to the repo.
const twemojiSvgPath = join(__dirname, 'assets', '1f9e0.svg');

const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');
mkdirSync(iconsDir, { recursive: true });

const BACKGROUND = '#0f1220';

async function generate() {
  await sharp(twemojiSvgPath).resize(192, 192).png().toFile(join(iconsDir, 'icon-192.png'));
  await sharp(twemojiSvgPath).resize(512, 512).png().toFile(join(iconsDir, 'icon-512.png'));

  // Maskable icon: the glyph at ~80% scale, centered over a solid
  // background square — the standard "safe zone" so Android's shape mask
  // doesn't crop the brain at the edges.
  const maskableSize = 512;
  const glyphSize = Math.round(maskableSize * 0.8);
  const glyphBuffer = await sharp(twemojiSvgPath).resize(glyphSize, glyphSize).png().toBuffer();
  await sharp({
    create: { width: maskableSize, height: maskableSize, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: glyphBuffer, gravity: 'center' }])
    .png()
    .toFile(join(iconsDir, 'maskable-512.png'));

  await sharp(twemojiSvgPath).resize(32, 32).png().toFile(join(publicDir, 'favicon.png'));

  console.log('Generated icons in', iconsDir, 'and', join(publicDir, 'favicon.png'));
}

generate().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
