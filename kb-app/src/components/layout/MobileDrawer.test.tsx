import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileDrawer from './MobileDrawer';
import { useUiStore } from '../../store/uiStore';

function renderDrawer() {
  return render(
    <>
      <button type="button" onClick={() => useUiStore.getState().setDrawerOpen(true)}>
        פתח
      </button>
      <MobileDrawer title="סינון וניווט">
        <p>תוכן המגירה</p>
      </MobileDrawer>
    </>,
  );
}

beforeEach(() => {
  useUiStore.setState({ drawerOpen: false });
});

describe('MobileDrawer', () => {
  it('renders nothing while closed', () => {
    renderDrawer();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a labelled modal dialog with its content and moves focus inside', async () => {
    const user = userEvent.setup();
    renderDrawer();
    const opener = screen.getByRole('button', { name: 'פתח' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'סינון וניווט' });
    // This installed Radix version hides background content instead of
    // setting aria-modal="true" (see react-dialog's DialogContentModal,
    // which calls `hideOthers` on the content and notes this is "a better
    // supported equivalent to setting aria-modal") — assert that mechanism
    // instead of an attribute Radix no longer sets.
    expect(opener.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(dialog).toHaveTextContent('תוכן המגירה');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on the close button and on Escape, restoring focus to the opener each time', async () => {
    const user = userEvent.setup();
    renderDrawer();
    const opener = screen.getByRole('button', { name: 'פתח' });

    // shadcn's SheetContent renders its own close button with an sr-only
    // "סגור" label (ui/sheet.tsx), matching the old hand-written button's
    // aria-label.
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'סגור' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    // Radix's Dialog also closes on backdrop click internally (the same
    // dismissable-layer mechanism as Escape); Escape is exercised directly
    // here since the backdrop is no longer a distinct testable element
    // (no more data-testid="drawer-backdrop") once Sheet/Radix owns the DOM.
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
