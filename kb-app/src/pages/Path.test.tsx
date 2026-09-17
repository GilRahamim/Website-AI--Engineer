import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Path from './Path';
import { useUserDataStore } from '../store/userDataStore';
import { pathTopics } from '../lib/learningPath';
import { setPathMode } from '../lib/pathMode';
import type { ProgressStatus } from '../types';

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

// Real topic titles/labels can contain regex metacharacters (e.g. "K Nearest
// Neighbors (KNN)") — escape before building a RegExp name matcher.
function nameRegExp(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
  localStorage.clear();
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Path />
    </MemoryRouter>,
  );
}

describe('Path', () => {
  beforeEach(reset);

  it('renders the page heading and overall progress against the real path length', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'נתיב למידה' })).toBeInTheDocument();
    expect(screen.getByText(`0 מתוך ${pathTopics.length} נושאים נשלטו`)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'התקדמות בנתיב הלמידה' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('points "Continue" at the first path topic for a brand-new user and marks it current', () => {
    renderPage();
    const first = pathTopics[0];
    expect(screen.getByRole('link', { name: 'המשך בנתיב' })).toHaveAttribute(
      'href',
      `/topic/${encodeURIComponent(first.id)}`,
    );
    const row = screen.getByRole('link', { name: nameRegExp(first.title) });
    expect(row).toHaveAttribute('aria-current', 'true');
  });

  it('advances "Continue" past a mastered topic to the next one in path order', () => {
    useUserDataStore.setState({ progress: new Map<string, ProgressStatus>([[pathTopics[0].id, 'mastered']]) });
    renderPage();
    const expected = pathTopics[1];
    expect(screen.getByRole('link', { name: 'המשך בנתיב' })).toHaveAttribute(
      'href',
      `/topic/${encodeURIComponent(expected.id)}`,
    );
  });

  it('shows a completion banner and no "Continue" button once every topic is mastered', () => {
    const progress = new Map<string, ProgressStatus>(pathTopics.map((topic) => [topic.id, 'mastered']));
    useUserDataStore.setState({ progress });
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('סיימת את כל נתיב הלמידה');
    expect(screen.queryByRole('link', { name: 'המשך בנתיב' })).not.toBeInTheDocument();
  });

  it('links every topic row to its reader page, grouped under its module', () => {
    renderPage();
    const firstModuleLabel = pathTopics[0].module_label;
    const group = screen.getByRole('button', { name: nameRegExp(firstModuleLabel) }).closest('div');
    expect(group).not.toBeNull();
    const link = screen.getByRole('link', { name: nameRegExp(pathTopics[0].title) });
    expect(link).toHaveAttribute('href', `/topic/${encodeURIComponent(pathTopics[0].id)}`);
  });

  it('marks upcoming topics as "not yet reached" in guided mode (the default)', () => {
    renderPage();
    const upcoming = screen.getByRole('link', { name: nameRegExp(pathTopics[1].title) });
    expect(within(upcoming).getByText('עדיין לא הגעת לכאן')).toBeInTheDocument();
  });

  it('drops the "not yet reached" note in free mode', () => {
    setPathMode('free');
    renderPage();
    const upcoming = screen.getByRole('link', { name: nameRegExp(pathTopics[1].title) });
    expect(within(upcoming).queryByText('עדיין לא הגעת לכאן')).not.toBeInTheDocument();
  });
});
