// kb-app/scripts/migrate-helpers.ts
import { createHash } from 'node:crypto';

export function hashId(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}

export interface ExtractedImage {
  hash: string;
  ext: string;
  buffer: Buffer;
}

export interface ExtractResult {
  html: string;
  images: ExtractedImage[];
}

const DATA_URI_RE = /src="data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)"/g;

export function extractBase64Images(html: string): ExtractResult {
  const images: ExtractedImage[] = [];

  const outHtml = html.replace(DATA_URI_RE, (_match, mime: string, b64: string) => {
    const ext = mime === 'jpeg' ? 'jpg' : mime;
    const buffer = Buffer.from(b64, 'base64');
    const hash = hashId(b64);
    images.push({ hash, ext, buffer });
    return `src="/topic-assets/${hash}.${ext}" loading="lazy"`;
  });

  return { html: outHtml, images };
}
