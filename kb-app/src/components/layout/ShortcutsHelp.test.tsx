import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShortcutsHelp from './ShortcutsHelp';

describe('ShortcutsHelp', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ShortcutsHelp open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a modal dialog listing the shortcuts when open', () => {
    render(<ShortcutsHelp open onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsHelp open onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'סגור' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsHelp open onClose={onClose} />);
    await user.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves focus into the dialog when it opens', () => {
    render(<ShortcutsHelp open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'סגור' })).toHaveFocus();
  });

  it('keeps focus on the close button when Tab is pressed', async () => {
    const user = userEvent.setup();
    render(<ShortcutsHelp open onClose={() => {}} />);
    const closeButton = screen.getByRole('button', { name: 'סגור' });
    expect(closeButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
  });

  it('restores focus to the previously focused element when closed', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'פתח קיצורים';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { rerender } = render(<ShortcutsHelp open={false} onClose={() => {}} />);
    trigger.focus();
    rerender(<ShortcutsHelp open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'סגור' })).toHaveFocus();

    rerender(<ShortcutsHelp open={false} onClose={() => {}} />);
    expect(trigger).toHaveFocus();

    trigger.remove();
  });
});
