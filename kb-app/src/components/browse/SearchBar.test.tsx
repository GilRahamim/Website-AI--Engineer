import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from './SearchBar';
import { useUiStore } from '../../store/uiStore';

function reset() {
  useUiStore.setState({ searchQuery: '' });
}

describe('SearchBar', () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('renders an accessible search input', () => {
    render(<SearchBar />);
    expect(screen.getByRole('searchbox', { name: 'חיפוש נושאים' })).toBeInTheDocument();
  });

  it('debounces typed input before updating the store', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SearchBar />);
    const input = screen.getByRole('searchbox');

    await user.type(input, 'regression');
    expect(useUiStore.getState().searchQuery).toBe('');

    vi.advanceTimersByTime(250);
    expect(useUiStore.getState().searchQuery).toBe('regression');
  });

  it('focuses the input when "/" is pressed and it is not already focused', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SearchBar />);
    const input = screen.getByRole('searchbox');
    expect(input).not.toHaveFocus();

    await user.keyboard('/');
    expect(input).toHaveFocus();
  });

  it('clears the query when Escape is pressed while focused', async () => {
    const user = userEvent.setup({ delay: null });
    render(<SearchBar />);
    const input = screen.getByRole('searchbox');

    await user.type(input, 'x');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    vi.advanceTimersByTime(250);
    expect(useUiStore.getState().searchQuery).toBe('');
  });
});
