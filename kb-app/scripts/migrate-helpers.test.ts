// kb-app/scripts/migrate-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { hashId, extractBase64Images } from './migrate-helpers.ts';

describe('hashId', () => {
  it('is stable for the same input', () => {
    expect(hashId('abc')).toBe(hashId('abc'));
  });

  it('produces a 12-char lowercase hex string', () => {
    expect(hashId('abc')).toMatch(/^[a-f0-9]{12}$/);
  });

  it('differs for different input', () => {
    expect(hashId('abc')).not.toBe(hashId('abd'));
  });
});

describe('extractBase64Images', () => {
  it('leaves plain HTML untouched and returns no images', () => {
    const html = '<p>hello</p>';
    const result = extractBase64Images(html);
    expect(result.html).toBe(html);
    expect(result.images).toHaveLength(0);
  });

  it('replaces a base64 image src with a /topic-assets/<hash>.<ext> path', () => {
    const tinyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const html = `<img src="data:image/png;base64,${tinyPngBase64}">`;
    const result = extractBase64Images(html);
    expect(result.images).toHaveLength(1);
    const [img] = result.images;
    expect(img.ext).toBe('png');
    expect(result.html).toBe(`<img src="/topic-assets/${img.hash}.png" loading="lazy">`);
  });

  it('produces the same hash for identical image data (idempotent)', () => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const html = `<img src="data:image/png;base64,${b64}"><img src="data:image/png;base64,${b64}">`;
    const result = extractBase64Images(html);
    expect(result.images).toHaveLength(2);
    expect(result.images[0].hash).toBe(result.images[1].hash);
  });

  it('maps image/jpeg mime type to .jpg extension', () => {
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const html = `<img src="data:image/jpeg;base64,${b64}">`;
    const result = extractBase64Images(html);
    expect(result.images).toHaveLength(1);
    expect(result.images[0].ext).toBe('jpg');
  });

  it('decodes the buffer to the exact original image bytes', () => {
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const html = `<img src="data:image/png;base64,${b64}">`;
    const result = extractBase64Images(html);
    expect(result.images[0].buffer).toEqual(Buffer.from(b64, 'base64'));
    expect(result.images[0].buffer.length).toBeGreaterThan(0);
  });
});

import { stripEmbeddedMarkup } from './migrate-helpers.ts';

describe('stripEmbeddedMarkup', () => {
  it('leaves plain text with no tags untouched', () => {
    expect(stripEmbeddedMarkup('שיטת למידה מונחית לחיזוי ערך רציף.')).toBe(
      'שיטת למידה מונחית לחיזוי ערך רציף.',
    );
  });

  it('removes a self-closing <img> tag (including an embedded base64 data URI) entirely', () => {
    const text =
      'מחלק קבוצת נתונים ל-<img class="inline-formula-img" src="data:image/png;base64,iVBORw0KGgo=" alt="formula"> אשכולות.';
    expect(stripEmbeddedMarkup(text)).toBe('מחלק קבוצת נתונים ל- אשכולות.');
  });

  it('strips <em>/<strong> tag markers but keeps the text between them', () => {
    expect(stripEmbeddedMarkup('פונקציית המיפוי <em>f</em>(text) → vector')).toBe(
      'פונקציית המיפוי f(text) → vector',
    );
  });

  it('collapses double spaces left behind by tag removal', () => {
    expect(stripEmbeddedMarkup('a <img src="x"> b')).toBe('a b');
  });

  it('removes empty parens left behind when a tag was the entire parenthetical', () => {
    expect(stripEmbeddedMarkup('מדאטה מתויג (<img src="x">) שבה המודל')).toBe(
      'מדאטה מתויג שבה המודל',
    );
  });

  it('trims leading/trailing whitespace', () => {
    expect(stripEmbeddedMarkup('  <em>x</em>  ')).toBe('x');
  });
});

import { buildCleanTopicMeta, type RawTopic } from './migrate-helpers.ts';

describe('buildCleanTopicMeta', () => {
  const raw: RawTopic = {
    id: 'Intro to Data Science::algorithms::02_Linear_Regression.docx',
    module: 'Intro to Data Science',
    module_label: 'מבוא למדעי הנתונים',
    category: 'algorithms',
    category_icon: '⚙️',
    category_label: 'אלגוריתמים',
    num: 2,
    filename: '02_Linear_Regression.docx',
    slug_name: 'Linear Regression',
    title: 'Linear Regression — רגרסיה לינארית',
    definition: 'שיטת למידה מונחית לחיזוי ערך רציף.',
    content_html: '<p>should not appear in clean metadata</p>',
    related_raw: ['Foo'],
    related_match: [null],
    link: 'ignored-in-clean-output',
    _search: 'ignored-in-clean-output',
  };

  it('keeps only the documented clean fields, no content_html', () => {
    const clean = buildCleanTopicMeta(raw, '/topic-content/abc123.html');
    expect(clean).toEqual({
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
      contentPath: '/topic-content/abc123.html',
    });
  });

  it('never alters id, title, or definition text (when definition has no embedded markup)', () => {
    const clean = buildCleanTopicMeta(raw, '/topic-content/abc123.html');
    expect(clean.id).toBe(raw.id);
    expect(clean.title).toBe(raw.title);
    expect(clean.definition).toBe(raw.definition);
  });

  it('strips embedded HTML markup that leaked into the raw definition field', () => {
    const rawWithMarkup: RawTopic = {
      ...raw,
      definition: 'מחלק ל-<img class="inline-formula-img" src="data:image/png;base64,abc="> אשכולות.',
    };
    const clean = buildCleanTopicMeta(rawWithMarkup, '/topic-content/abc123.html');
    expect(clean.definition).toBe('מחלק ל- אשכולות.');
  });
});
