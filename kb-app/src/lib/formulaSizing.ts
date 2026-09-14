import formulaSizesRaw from '../data/formula-sizes.json';

/** [naturalWidth, naturalHeight, glyphXHeight] per asset basename; x-height 0 = figure. */
const formulaSizes = formulaSizesRaw as unknown as Record<string, [number, number, number]>;

/** Displayed x-height as a fraction of the surrounding font size. Heebo's own
 *  x-height is ~0.53em; formulas read best a touch larger than body text. */
const XHEIGHT_EM: Record<'block' | 'inline', number> = { block: 0.6, inline: 0.55 };

/** Sanity bounds on the displayed height, in em of the surrounding text, so a
 *  mis-measured raster can never collapse into a speck or blow up the page. */
const HEIGHT_BOUNDS_EM: Record<'block' | 'inline', [number, number]> = {
  block: [1.3, 12],
  inline: [0.85, 2.8],
};

function assetKey(src: string): string | null {
  const match = /\/topic-assets\/([^/]+)\.png(?:[?#].*)?$/.exec(src);
  return match ? match[1] : null;
}

/**
 * Sizes one formula raster so its glyphs match the text around it. The
 * width is set in px and an aspect-ratio is declared, so the box is right
 * before the (lazy) image loads; the stylesheet's max-width:100% still
 * wins on narrow screens. Diagrams and unknown images are left alone.
 */
export function sizeFormulaImage(img: HTMLImageElement): void {
  const key = assetKey(img.getAttribute('src') ?? '');
  const entry = key ? formulaSizes[key] : undefined;
  if (!entry) return;
  const [naturalWidth, naturalHeight, xHeight] = entry;
  if (naturalWidth <= 0 || naturalHeight <= 0) return;
  img.style.aspectRatio = `${naturalWidth} / ${naturalHeight}`;
  if (xHeight <= 0) return;

  const kind = img.classList.contains('block-formula-img') ? 'block' : 'inline';
  const fontSize = parseFloat(getComputedStyle(img.parentElement ?? img).fontSize) || 16;
  const targetXHeight = fontSize * XHEIGHT_EM[kind];
  const [minEm, maxEm] = HEIGHT_BOUNDS_EM[kind];
  const scale = targetXHeight / xHeight;
  const height = Math.min(maxEm * fontSize, Math.max(minEm * fontSize, naturalHeight * scale));
  const width = (height / naturalHeight) * naturalWidth;
  img.style.width = `${Math.round(width)}px`;
}
