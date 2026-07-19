import { describe, it, expect } from 'vitest';
import { normalize } from './normalize';

describe('normalize', () => {
  it('lowercases and trims', () => {
    expect(normalize('  HeLLo  ')).toBe('hello');
  });

  it('strips Hebrew niqqud (vowel points)', () => {
    expect(normalize('רְגרֶסיה')).toBe('רגרסיה');
  });

  it('strips geresh/gershayim quote marks', () => {
    expect(normalize(`ה"אלגוריתם" של ק'מינס`)).toBe('האלגוריתם של קמינס');
  });

  it('turns hyphens/dashes/underscores into spaces', () => {
    expect(normalize('K-Means_Clustering')).toBe('k means clustering');
  });

  it('collapses repeated whitespace', () => {
    expect(normalize('a   b\t\nc')).toBe('a b c');
  });
});
