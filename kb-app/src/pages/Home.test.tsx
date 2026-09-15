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
    drawerOpen: false,
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

  it('renders the dashboard with the real topic count and zero mastered by default', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`0 מתוך ${topicsData.length} נושאים נשלטו`)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'התקדמות כללית' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders the mobile module chips and the desktop sidebar (tab bar and drawer live in App)', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('group', { name: 'סינון לפי מודול' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'ניווט מודולים' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'ניווט תחתון' })).not.toBeInTheDocument();
  });

  it('offers a clear-filters action in the empty state when a search matches nothing', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    act(() => {
      useUiStore.getState().setSearchQuery('zzz-no-such-topic-anywhere');
    });
    expect(screen.getByRole('status')).toHaveTextContent('לא נמצאו נושאים');
    await user.click(screen.getByRole('button', { name: 'נקה סינון והצג הכול' }));
    expect(useUiStore.getState().searchQuery).toBe('');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('points a brand-new user at the first topic under "start here"', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /התחל כאן/ })).toHaveAttribute(
      'href',
      `/topic/${encodeURIComponent(topicsData[0].id)}`,
    );
  });

  it('shows the most recently viewed topic as "continue reading"', () => {
    const recent = topicsData[3];
    useUserDataStore.setState({ recents: [{ topicId: recent.id, viewedAt: Date.now() }] });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: new RegExp(`המשך קריאה.*${recent.title.slice(0, 10)}`) })).toHaveAttribute(
      'href',
      `/topic/${encodeURIComponent(recent.id)}`,
    );
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

  it('lets two different module groups be expanded simultaneously, leaving other groups collapsed', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    // Start fully collapsed so each click below can only be explained by
    // that specific group's own state, not the shared default-expanded state.
    act(() => {
      useUiStore.getState().collapseAllGroups();
    });
    const main = screen.getByRole('main');
    expect(within(main).queryAllByRole('link')).toHaveLength(0);

    // `expanded` scopes to elements that actually expose aria-expanded (the
    // accordion triggers), excluding the module filter chips above them that
    // share the same label text but only expose aria-pressed.
    const triggerA = within(main).getByRole('button', { name: /מבוא למדעי הנתונים/, expanded: false });
    const triggerB = within(main).getByRole('button', { name: /נושא 1 - Unsupervised Learning/, expanded: false });
    const triggerC = within(main).getByRole('button', { name: /נושא 2 - NLP/, expanded: false });
    const countA = topicsData.filter((t) => t.module === 'Intro to Data Science').length;
    const countC = topicsData.filter((t) => t.module === 'Topic 2 - Natural Language Processing').length;

    await user.click(triggerA);
    expect(triggerA).toHaveAttribute('aria-expanded', 'true');
    expect(triggerB).toHaveAttribute('aria-expanded', 'false');
    expect(triggerC).toHaveAttribute('aria-expanded', 'false');
    expect(within(main).getAllByRole('link')).toHaveLength(countA);

    // Expanding a *different* group must not collapse group A — this is the
    // concrete regression this test guards against: a single shared
    // `Accordion type="single"` wrapping every module group (instead of one
    // independent Accordion instance per group) would only allow one group
    // open at a time and would fail this assertion.
    await user.click(triggerC);
    expect(triggerA).toHaveAttribute('aria-expanded', 'true');
    expect(triggerB).toHaveAttribute('aria-expanded', 'false');
    expect(triggerC).toHaveAttribute('aria-expanded', 'true');
    expect(within(main).getAllByRole('link')).toHaveLength(countA + countC);
  });

  it('"הרחב הכול" / "כווץ הכול" expand and collapse every module group at once', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'כווץ הכול' }));
    expect(within(screen.getByRole('main')).queryAllByRole('link')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'הרחב הכול' }));
    expect(within(screen.getByRole('main')).getAllByRole('link')).toHaveLength(topicsData.length);
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
    expect(screen.getByText(`1 מתוך ${topicsData.length} נושאים נשלטו`)).toBeInTheDocument();
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

  it('reports nothing due for a fresh user (never-reviewed topics are new, not due) and links a random concept', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`0 בלמידה · ${topicsData.length} נושאים חדשים`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /למד כרטיסים חדשים/ })).toHaveAttribute('href', '/flashcards');
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
            intervalDays: 1,
            dueAt: now - 1000,
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
    expect(screen.getByRole('link', { name: /התחל חזרה · 1 ממתינים/ })).toHaveAttribute('href', '/flashcards');
  });
});
