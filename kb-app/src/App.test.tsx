import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import topicsData from './data/topics.clean.json';
import { useUserDataStore } from './store/userDataStore';

vi.mock('react-force-graph-2d', () => ({
  default: () => <div />,
}));

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

  it('renders the Flashcards page at "/flashcards"', async () => {
    render(
      <MemoryRouter initialEntries={['/flashcards']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'כרטיסיות' })).toBeInTheDocument();
  });

  it('rebuilds the Flashcards queue once the store finishes loading after mounting pre-hydration', async () => {
    const now = Date.now();
    const farFuture = now + 1000 * 60 * 60 * 24 * 365;
    const originalLoadUserData = useUserDataStore.getState().loadUserData;
    useUserDataStore.setState({
      progress: new Map(),
      favorites: new Set(),
      recents: [],
      notes: new Map(),
      srsCards: new Map(),
      isLoaded: false,
      // App's own useEffect calls the real loadUserData() on mount, which is
      // backed by fake-indexeddb and can resolve (flipping isLoaded to true
      // on its own) while this test is awaiting the lazy Flashcards chunk
      // below — racing ahead of, and defeating, this test's own controlled
      // isLoaded flip further down. Stub it to a promise that never settles
      // for the duration of this test so isLoaded only ever changes via the
      // explicit act() below; restored in `finally` so later tests in this
      // file get the real implementation back.
      loadUserData: () => new Promise(() => {}),
    });

    try {
      render(
        <MemoryRouter initialEntries={['/flashcards']}>
          <App />
        </MemoryRouter>,
      );

      // Wait for the lazy Flashcards chunk to resolve and mount (key="false")
      // before flipping isLoaded — otherwise the store update below could
      // race the initial lazy resolution instead of triggering a clean,
      // separate remount via the key change.
      await screen.findByRole('heading', { name: 'כרטיסיות' });

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
    } finally {
      useUserDataStore.setState({ loadUserData: originalLoadUserData });
    }
  });

  it('renders the Quiz page at "/quiz"', async () => {
    render(
      <MemoryRouter initialEntries={['/quiz']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'מבחן' })).toBeInTheDocument();
  });

  it('renders the Map page at "/map"', async () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'מפת ידע' })).toBeInTheDocument();
  });
});
