import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn via @/* alias', () => {
  it('resolves @/lib/utils import and merges classes', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('resolves Tailwind conflicts via alias import', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});
