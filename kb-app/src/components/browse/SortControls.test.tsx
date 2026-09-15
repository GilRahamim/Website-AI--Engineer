import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SortMenu from './SortMenu';
import { useUiStore } from '../../store/uiStore';

// jsdom doesn't implement pointer capture or scrollIntoView, and Radix
// Select's trigger/item pointer handlers call both. Stub them so
// userEvent's pointer-event simulation doesn't throw.
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

function reset() {
  useUiStore.setState({ sortOrder: 'original', viewMode: 'grid' });
}

describe('SortMenu', () => {
  beforeEach(reset);

  it('reflects the current sort order', () => {
    render(<SortMenu />);
    expect(screen.getByRole('combobox', { name: 'מיין נושאים לפי' })).toHaveTextContent('מקורי');
  });

  it('updates the store when a new option is chosen', async () => {
    const user = userEvent.setup();
    render(<SortMenu />);
    await user.click(screen.getByRole('combobox', { name: 'מיין נושאים לפי' }));
    await user.click(await screen.findByRole('option', { name: 'א־ת' }));
    expect(useUiStore.getState().sortOrder).toBe('alpha');
  });
});
