import { describe, expect, it } from 'vitest';
import { decodeEntities } from './decodeEntities';

describe('decodeEntities', () => {
  it('returns text without entities unchanged', () => {
    expect(decodeEntities('Linear Regression - רגרסיה לינארית')).toBe('Linear Regression - רגרסיה לינארית');
  });

  it('decodes the named entities the migration left in plain text', () => {
    expect(decodeEntities('מוסיפה ל-SGD &quot;זיכרון&quot; של &amp; &lt;x&gt; &apos;y&apos;')).toBe(
      'מוסיפה ל-SGD "זיכרון" של & <x> \'y\'',
    );
  });

  it('decodes decimal and hexadecimal numeric references', () => {
    expect(decodeEntities('&#8220;quoted&#8221; &#x2014; dash')).toBe('“quoted” — dash');
  });

  it('leaves unknown or malformed references alone', () => {
    expect(decodeEntities('AT&T &unknown; &#; &')).toBe('AT&T &unknown; &#; &');
  });
});
