import { describe, expect, it } from 'vitest';
import { highlightMatch } from './highlightMatch';

describe('highlightMatch', () => {
  it('returns the full text as one non-match segment for an empty query', () => {
    expect(highlightMatch('Linear Regression', '')).toEqual([{ text: 'Linear Regression', match: false }]);
  });

  it('returns the full text as one non-match segment when there is no match', () => {
    expect(highlightMatch('Linear Regression', 'xyz')).toEqual([
      { text: 'Linear Regression', match: false },
    ]);
  });

  it('splits out a case-insensitive match in the middle of the text', () => {
    expect(highlightMatch('Linear Regression', 'regr')).toEqual([
      { text: 'Linear ', match: false },
      { text: 'Regr', match: true },
      { text: 'ession', match: false },
    ]);
  });

  it('matches at the start of the text', () => {
    expect(highlightMatch('Linear Regression', 'linear')).toEqual([
      { text: 'Linear', match: true },
      { text: ' Regression', match: false },
    ]);
  });

  it('matches at the end of the text', () => {
    expect(highlightMatch('K-Means', 'means')).toEqual([
      { text: 'K-', match: false },
      { text: 'Means', match: true },
    ]);
  });
});
