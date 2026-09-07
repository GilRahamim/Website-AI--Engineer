import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import topicsData from './data/topics.clean.json';
import { useUserDataStore } from './store/userDataStore';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<p>content</p>') }) as unknown as typeof fetch;
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
});

describe('App', () => {
  it('renders Home at "/"', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: /מסד ידע/ })).toBeInTheDocument();
  });

  it('renders the Reader at "/topic/:id" for a real topic id', () => {
    const knownTopic = topicsData[0];
    render(
      <MemoryRouter initialEntries={[`/topic/${encodeURIComponent(knownTopic.id)}`]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: knownTopic.title })).toBeInTheDocument();
  });

  it('renders the Flashcards page at "/flashcards"', () => {
    render(
      <MemoryRouter initialEntries={['/flashcards']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'כרטיסיות' })).toBeInTheDocument();
  });

  it('rebuilds the Flashcards queue once the store finishes loading after mounting pre-hydration', () => {
    const now = Date.now();
    const farFuture = now + 1000 * 60 * 60 * 24 * 365;
    useUserDataStore.setState({
      progress: new Map(),
      favorites: new Set(),
      recents: [],
      notes: new Map(),
      srsCards: new Map(),
      isLoaded: false,
    });

    render(
      <MemoryRouter initialEntries={['/flashcards']}>
        <App />
      </MemoryRouter>,
    );

    act(() => {
      const allNotDue = new Map(
        topicsData.map((t) => [
          t.id,
          { topicId: t.id, ease: 2.5, intervalDays: 365, dueAt: farFuture, reps: 1, lapses: 0, updatedAt: now },
        ]),
      );
      useUserDataStore.setState({ srsCards: allNotDue, isLoaded: true });
    });

    expect(screen.getByRole('status')).toHaveTextContent('אין כרטיסים לחזרה');
  });
});
