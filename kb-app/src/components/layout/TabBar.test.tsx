import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TabBar from './TabBar';

function renderAt(path: string, dueCount = 0) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar dueCount={dueCount} />
    </MemoryRouter>,
  );
}

describe('TabBar', () => {
  it('renders the primary destinations as links', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'ניווט תחתון' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'בית' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'נתיב' })).toHaveAttribute('href', '/path');
    expect(screen.getByRole('link', { name: /כרטיסיות/ })).toHaveAttribute('href', '/flashcards');
    expect(screen.getByRole('link', { name: 'מבחן' })).toHaveAttribute('href', '/quiz');
    expect(screen.getByRole('link', { name: 'מפה' })).toHaveAttribute('href', '/map');
  });

  it('marks the current destination with aria-current', () => {
    renderAt('/quiz');
    expect(screen.getByRole('link', { name: 'מבחן' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'בית' })).not.toHaveAttribute('aria-current');
  });

  it('shows the due badge on flashcards only when something is due', () => {
    renderAt('/', 8);
    expect(screen.getByLabelText('8 כרטיסים ממתינים לחזרה')).toBeInTheDocument();
  });

  it('hides the badge at zero', () => {
    renderAt('/', 0);
    expect(screen.queryByLabelText(/כרטיסים ממתינים לחזרה/)).not.toBeInTheDocument();
  });
});
