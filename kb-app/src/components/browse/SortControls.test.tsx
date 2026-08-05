import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SortMenu from './SortMenu';
import ViewToggle from './ViewToggle';
import { useUiStore } from '../../store/uiStore';

function reset() {
  useUiStore.setState({ sortOrder: 'original', viewMode: 'grid' });
}

describe('SortMenu', () => {
  beforeEach(reset);

  it('reflects the current sort order', () => {
    render(<SortMenu />);
    expect(screen.getByLabelText('מיין נושאים לפי')).toHaveValue('original');
  });

  it('updates the store when a new option is chosen', async () => {
    const user = userEvent.setup();
    render(<SortMenu />);
    await user.selectOptions(screen.getByLabelText('מיין נושאים לפי'), 'alpha');
    expect(useUiStore.getState().sortOrder).toBe('alpha');
  });
});

describe('ViewToggle', () => {
  beforeEach(reset);

  it('marks the active view via aria-pressed', () => {
    render(<ViewToggle />);
    expect(screen.getByRole('button', { name: 'תצוגת רשת' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'תצוגת רשימה' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches viewMode in the store when clicked', async () => {
    const user = userEvent.setup();
    render(<ViewToggle />);
    await user.click(screen.getByRole('button', { name: 'תצוגת רשימה' }));
    expect(useUiStore.getState().viewMode).toBe('list');
  });
});
