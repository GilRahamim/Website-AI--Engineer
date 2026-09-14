import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { usePageTitle } from './usePageTitle';

function Harness({ title }: { title?: string }) {
  usePageTitle(title);
  return null;
}

describe('usePageTitle', () => {
  it('sets the document title as "<page> · AI Engineer"', () => {
    render(<Harness title="הגדרות" />);
    expect(document.title).toBe('הגדרות · AI Engineer');
  });

  it('uses the bare site name when no page title is given', () => {
    render(<Harness />);
    expect(document.title).toBe('AI Engineer');
  });

  it('updates when the title prop changes', () => {
    const { rerender } = render(<Harness title="א" />);
    rerender(<Harness title="ב" />);
    expect(document.title).toBe('ב · AI Engineer');
  });
});
