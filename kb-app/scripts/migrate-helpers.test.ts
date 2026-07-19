// kb-app/scripts/migrate-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { hashId, extractBase64Images } from './migrate-helpers';

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
});
