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
    await user.click(screen.getByRole('button', { name: 'פתח' }));
    const dialog = screen.getByRole('dialog', { name: 'סינון וניווט' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('תוכן המגירה');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on the close button, on Escape, and on backdrop click, restoring focus', async () => {
    const user = userEvent.setup();
    renderDrawer();
    const opener = screen.getByRole('button', { name: 'פתח' });

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'סגור' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(opener);
    await user.click(screen.getByTestId('drawer-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
