import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class lists and drops falsy values', () => {
    const isDisabled = false;
    expect(cn('a', isDisabled && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets a later Tailwind class win over an earlier conflicting one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});
