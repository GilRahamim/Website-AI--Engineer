import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import topicsData from './data/topics.clean.json';
import { useUserDataStore } from './store/userDataStore';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<p>content</p>') }) as unknown as typeof fetch;
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], notes: new Map(), isLoaded: true });
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
});
