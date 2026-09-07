import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import { useUserDataStore } from '../../store/userDataStore';
import topicsData from '../../data/topics.clean.json';

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
}

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  beforeEach(reset);

  it('renders the brand name', () => {
    renderWithRouter();
    expect(screen.getByText('מסד ידע')).toBeInTheDocument();
    expect(screen.getByText('AI Engineer')).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    renderWithRouter();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses the header landmark', () => {
    renderWithRouter();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders a link to the Flashcards page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: /כרטיסיות/ })).toHaveAttribute('href', '/flashcards');
  });

  it('renders a link to the Quiz page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: 'מבחן' })).toHaveAttribute('href', '/quiz');
  });

  it('renders a link to the Map page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: 'מפה' })).toHaveAttribute('href', '/map');
  });

  it('shows a due-count badge when cards are due (every topic starts never-reviewed = due)', () => {
    renderWithRouter();
    expect(screen.getByLabelText(`${topicsData.length} כרטיסים ממתינים לחזרה`)).toBeInTheDocument();
  });

  it('hides the badge when nothing is due', () => {
    const now = Date.now();
    const farFuture = now + 1000 * 60 * 60 * 24 * 365;
    const allNotDue = new Map(
      topicsData.map((t) => [
        t.id,
        { topicId: t.id, ease: 2.5, intervalDays: 365, dueAt: farFuture, reps: 1, lapses: 0, updatedAt: now },
      ]),
    );
    useUserDataStore.setState({ srsCards: allNotDue });
    renderWithRouter();
    expect(screen.queryByText(/כרטיסים ממתינים לחזרה/)).not.toBeInTheDocument();
  });
});
