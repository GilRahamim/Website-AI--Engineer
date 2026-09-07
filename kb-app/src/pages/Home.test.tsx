import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { useUiStore } from '../store/uiStore';
import { useUserDataStore } from '../store/userDataStore';
import topicsData from '../data/topics.clean.json';

function reset() {
  const allModuleKeys = [...new Set(topicsData.map((t) => t.module))];
  useUiStore.setState({
    searchQuery: '',
    selectedModules: new Set(),
    selectedCategories: new Set(),
    selectedStatuses: new Set(),
    sortOrder: 'original',
    viewMode: 'grid',
    sidebarCollapsed: false,
    expandedGroups: new Set(allModuleKeys),
    includeNotesInSearch: false,
  });
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
}

describe('Home', () => {
  beforeEach(reset);

  it('renders the hero with the real topic count', () => {
    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const hero = container.querySelector('section') as HTMLElement;
    expect(within(hero).getByText(String(topicsData.length))).toBeInTheDocument();
  });

  it('renders every module as an accordion group, expanded by default', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const totalCards = screen.getAllByRole('link', { name: /./ }).length;
    expect(totalCards).toBeGreaterThan(0);
  });

  it('narrows visible topics when the search store value changes', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const before = screen.getAllByRole('link').length;

    act(() => {
      useUiStore.getState().setSearchQuery('regression');
    });

    const after = screen.getAllByRole('link').length;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it('narrows visible topics when a module filter is toggled from the store', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const before = screen.getAllByRole('link').length;

    act(() => {
      useUiStore.getState().toggleModule(topicsData[0].module);
    });

    const after = screen.getAllByRole('link').length;
    expect(after).toBeLessThan(before);
  });

  it('keeps at least one visible card keyboard-tabbable after a filter drops the originally-focused topic', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    // Filter to the *last* topic's module — this excludes topicsData[0], the
    // topic useGridKeyboardNav focused by default on mount, reproducing the
    // stale-focusedId regression (see useGridKeyboardNav.ts).
    act(() => {
      useUiStore.getState().toggleModule(topicsData[topicsData.length - 1].module);
    });

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    const tabbable = links.filter((link) => link.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
  });

  it('opens the shortcuts help modal on "?"', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('?');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the mastered-count stat reflecting progress store state', () => {
    useUserDataStore.setState({ progress: new Map([[topicsData[0].id, 'mastered']]) });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`מתוך ${topicsData.length} נשלטו`)).toBeInTheDocument();
  });

  it('narrows visible topics when a status filter is toggled from the store', () => {
    useUserDataStore.setState({ progress: new Map([[topicsData[0].id, 'mastered']]) });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    act(() => {
      useUiStore.getState().toggleStatus('mastered');
    });
    expect(within(screen.getByRole('main')).getAllByRole('link')).toHaveLength(1);
  });

  it('toggles includeNotesInSearch when the "include notes" checkbox is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'כלול הערות בחיפוש' });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(useUiStore.getState().includeNotesInSearch).toBe(true);
  });

  it('finds a topic by its note text only when "include notes in search" is toggled on', () => {
    useUserDataStore.setState({ notes: new Map([[topicsData[2].id, 'zzz-unique-note-term']]) });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    act(() => {
      useUiStore.getState().setSearchQuery('zzz-unique-note-term');
    });
    expect(within(screen.getByRole('main')).queryAllByRole('link')).toHaveLength(0);

    act(() => {
      useUiStore.getState().toggleIncludeNotesInSearch();
    });
    expect(within(screen.getByRole('main')).getAllByRole('link')).toHaveLength(1);
  });

  it('renders the Daily Review card with the correct due count and a random-concept link', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`${topicsData.length} ממתינים היום`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'התחל חזרה' })).toHaveAttribute('href', '/flashcards');
    const randomLink = screen.getByRole('link', { name: /מושג אקראי/ });
    const linkedId = decodeURIComponent(randomLink.getAttribute('href')!.replace('/topic/', ''));
    expect(topicsData.some((t) => t.id === linkedId)).toBe(true);
  });

  it('the due count reflects graded cards', () => {
    const now = Date.now();
    useUserDataStore.setState({
      srsCards: new Map([
        [
          topicsData[0].id,
          {
            topicId: topicsData[0].id,
            ease: 2.5,
            intervalDays: 30,
            dueAt: now + 1000 * 60 * 60 * 24 * 30,
            reps: 1,
            lapses: 0,
            updatedAt: now,
          },
        ],
      ]),
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`${topicsData.length - 1} ממתינים היום`)).toBeInTheDocument();
  });
});
