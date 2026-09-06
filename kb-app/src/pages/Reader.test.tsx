import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Reader from './Reader';
import topicsData from '../data/topics.clean.json';
import { useUserDataStore } from '../store/userDataStore';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<p>content</p>') }) as unknown as typeof fetch;
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/topic/:id" element={<Reader />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Reader', () => {
  it('renders the topic matching the encoded id in the route', () => {
    const knownTopic = topicsData[0];
    renderAt(`/topic/${encodeURIComponent(knownTopic.id)}`);
    expect(screen.getByRole('heading', { name: knownTopic.title })).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown id', () => {
    renderAt(`/topic/${encodeURIComponent('does-not-exist')}`);
    expect(screen.getByRole('alert')).toHaveTextContent('הנושא לא נמצא');
  });

  it('always renders the Header', () => {
    const knownTopic = topicsData[0];
    renderAt(`/topic/${encodeURIComponent(knownTopic.id)}`);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('records a view for a known topic on mount', () => {
    const knownTopic = topicsData[0];
    renderAt(`/topic/${encodeURIComponent(knownTopic.id)}`);
    expect(useUserDataStore.getState().recents.map((r) => r.topicId)).toContain(knownTopic.id);
  });

  it('does not record a view for an unknown id', () => {
    renderAt(`/topic/${encodeURIComponent('does-not-exist')}`);
    expect(useUserDataStore.getState().recents).toEqual([]);
  });
});
