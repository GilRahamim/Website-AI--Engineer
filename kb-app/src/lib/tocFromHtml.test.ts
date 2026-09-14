import { describe, expect, it } from 'vitest';
import { buildToc } from './tocFromHtml';

const html =
  "<h4 class='sec-h'>הגדרה</h4><p>טקסט</p><h4 class='sec-h'>השוואה</h4><table class='kbtable'></table><h4 class='sec-h'>השוואה</h4>";

describe('buildToc', () => {
  it('lists every .sec-h heading in document order', () => {
    expect(buildToc(html).headings.map((h) => h.text)).toEqual(['הגדרה', 'השוואה', 'השוואה']);
  });

  it('gives each heading a stable, unique id and writes it into the returned html', () => {
    const { headings, html: out } = buildToc(html);
    expect(headings.map((h) => h.id)).toEqual(['sec-1', 'sec-2', 'sec-3']);
    expect(out).toContain('id="sec-1"');
    expect(out).toContain('id="sec-3"');
  });

  it('leaves heading text and body markup unchanged', () => {
    const { html: out } = buildToc(html);
    expect(out).toContain('<p>טקסט</p>');
    expect(out).toContain("<table class='kbtable'></table>");
    expect(out.replace(/ id="sec-\d+"/g, '')).toBe(html);
  });

  it('returns no headings and the same html when there are none', () => {
    expect(buildToc('<p>רק פסקה</p>')).toEqual({ headings: [], html: '<p>רק פסקה</p>' });
  });
});
