import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useRef } from 'react';
import { useReaderShortcuts } from './useReaderShortcuts';
import { useUserDataStore } from '../store/userDataStore';
import type { Topic } from '../types';

function t(id: string): Topic {
  return {
    id,
    module: 'A',
    module_label: 'A',
    category: 'concepts',
    category_label: 'מושגים',
    num: 0,
    slug_name: id,
    title: id,
    definition: '',
    related_raw: [],
    related_match: [],
    contentPath: '',
  };
}

function Harness({ prev, next }: { prev: Topic | null; next: Topic | null }) {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();
  useReaderShortcuts({ topicId: 'cur', prev, next, notesRef });
  return (
    <>
      <p data-testid="path">{location.pathname}</p>
      <input aria-label="search" />
      <textarea ref={notesRef} aria-label="notes" />
    </>
  );
}

function renderHarness(prev: Topic | null = t('p 1'), next: Topic | null = t('n 1')) {
  return render(
    <MemoryRouter initialEntries={['/topic/cur']}>
      <Routes>
        <Route path="*" element={<Harness prev={prev} next={next} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), isLoaded: true });
});

describe('useReaderShortcuts', () => {
  it('J navigates to the next topic and K to the previous one', () => {
    renderHarness();
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('path')).toHaveTextContent('/topic/n%201');
    fireEvent.keyDown(window, { key: 'k' });
    expect(screen.getByTestId('path')).toHaveTextContent('/topic/p%201');
  });

  it('does nothing when the target side has no topic', () => {
    renderHarness(null, null);
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('path')).toHaveTextContent('/topic/cur');
  });

  it('F toggles the favorite and S cycles the learning status', () => {
    renderHarness();
    fireEvent.keyDown(window, { key: 'f' });
    expect(useUserDataStore.getState().favorites.has('cur')).toBe(true);
    fireEvent.keyDown(window, { key: 's' });
    expect(useUserDataStore.getState().progress.get('cur')).toBe('learning');
  });

  it('N focuses the notes field', () => {
    renderHarness();
    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.getByLabelText('notes')).toHaveFocus();
  });

  it('ignores keys typed inside inputs and with modifiers', () => {
    renderHarness();
    const input = screen.getByLabelText('search');
    input.focus();
    fireEvent.keyDown(input, { key: 'j' });
    expect(screen.getByTestId('path')).toHaveTextContent('/topic/cur');
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
    expect(screen.getByTestId('path')).toHaveTextContent('/topic/cur');
  });
});
