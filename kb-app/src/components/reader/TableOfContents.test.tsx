import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TableOfContents from './TableOfContents';

const headings = [
  { id: 'sec-1', text: 'הגדרה' },
  { id: 'sec-2', text: 'השוואה' },
];

describe('TableOfContents', () => {
  it('renders one anchor per heading, marking the active one with aria-current', () => {
    render(<TableOfContents headings={headings} activeId="sec-2" onSelect={() => {}} />);
    expect(screen.getByRole('navigation', { name: 'בעמוד זה' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'הגדרה' })).toHaveAttribute('href', '#sec-1');
    expect(screen.getByRole('link', { name: 'הגדרה' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'השוואה' })).toHaveAttribute('aria-current', 'location');
  });

  it('calls onSelect with the heading id instead of navigating', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TableOfContents headings={headings} activeId={null} onSelect={onSelect} />);
    await user.click(screen.getByRole('link', { name: 'השוואה' }));
    expect(onSelect).toHaveBeenCalledWith('sec-2');
  });

  it('renders nothing when there are no headings', () => {
    render(<TableOfContents headings={[]} activeId={null} onSelect={() => {}} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
