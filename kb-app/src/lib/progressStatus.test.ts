import { describe, expect, it } from 'vitest';
import { ALL_STATUSES, NEXT_STATUS, STATUS_GLYPHS, STATUS_LABELS } from './progressStatus';

describe('progressStatus', () => {
  it('lists all three statuses', () => {
    expect(ALL_STATUSES).toEqual(['new', 'learning', 'mastered']);
  });

  it('defines a non-empty label and glyph for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_GLYPHS[status]).toBeTruthy();
    }
  });

  it('cycles new -> learning -> mastered -> new', () => {
    expect(NEXT_STATUS.new).toBe('learning');
    expect(NEXT_STATUS.learning).toBe('mastered');
    expect(NEXT_STATUS.mastered).toBe('new');
  });
});
