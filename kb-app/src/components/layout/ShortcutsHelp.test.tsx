import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShortcutsHelp from './ShortcutsHelp';

describe('ShortcutsHelp', () => {
  it('renders nothing when closed', () => {
    render(<ShortcutsHelp open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a labelled modal dialog listing the shortcuts, focused on the close button', () => {
    render(<ShortcutsHelp open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'קיצורי מקלדת' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
    // Radix's default onMountAutoFocus focuses the first tabbable element in
    // the content, which is the "סגור" button (it comes before the
    // shadcn-provided X close button in DOM order).
    expect(screen.getByRole('button', { name: 'סגור' })).toHaveFocus();
  });

  it('calls onClose when the "סגור" button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsHelp open onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'סגור' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the corner close button (shadcn default, sr-only "Close") is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsHelp open onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsHelp open onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('restores focus to the previously focused element when closed', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'פתח קיצורים';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { rerender } = render(<ShortcutsHelp open={false} onClose={() => {}} />);
    trigger.focus();
    rerender(<ShortcutsHelp open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'סגור' })).toHaveFocus();

    // Radix's FocusScope dispatches its unmount-autofocus event (which our
    // onCloseAutoFocus handler uses to restore focus) from a setTimeout(0)
    // scheduled in the effect cleanup, so the restore lands a tick after
    // this synchronous rerender — waitFor lets that macrotask flush.
    rerender(<ShortcutsHelp open={false} onClose={() => {}} />);
    await waitFor(() => expect(trigger).toHaveFocus());

    trigger.remove();
  });
});
