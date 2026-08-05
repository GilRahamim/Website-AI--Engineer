import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from './Header';

describe('Header', () => {
  it('renders the brand name', () => {
    render(<Header />);
    expect(screen.getByText('מסד ידע')).toBeInTheDocument();
    expect(screen.getByText('AI Engineer')).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    render(<Header />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses the header landmark', () => {
    render(<Header />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
