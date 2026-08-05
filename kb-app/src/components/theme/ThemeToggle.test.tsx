import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.clear();
  });

  it('renders a button with an accessible label', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveAccessibleName();
  });

  it('flips data-theme on <html> and localStorage when clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('kb-theme')).toBe('dark');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
