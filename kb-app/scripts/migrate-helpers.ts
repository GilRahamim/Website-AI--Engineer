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

export interface RawTopic {
  id: string;
  module: string;
  module_label: string;
  category: string;
  category_icon: string;
  category_label: string;
  num: number;
  filename: string;
  slug_name: string;
  title: string;
  definition: string;
  content_html: string;
  related_raw: string[];
  related_match: (string | null)[];
  link: string;
  _search: string;
}

export interface CleanTopicMeta {
  id: string;
  module: string;
  module_label: string;
  category: string;
  category_label: string;
  num: number;
  slug_name: string;
  title: string;
  definition: string;
  related_raw: string[];
  related_match: (string | null)[];
  contentPath: string;
}

export function buildCleanTopicMeta(raw: RawTopic, contentPath: string): CleanTopicMeta {
  return {
    id: raw.id,
    module: raw.module,
    module_label: raw.module_label,
    category: raw.category,
    category_label: raw.category_label,
    num: raw.num,
    slug_name: raw.slug_name,
    title: raw.title,
    definition: raw.definition,
    related_raw: raw.related_raw,
    related_match: raw.related_match,
    contentPath,
  };
}
