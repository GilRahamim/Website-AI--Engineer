import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { useUiStore } from '../../store/uiStore';
import { useUserDataStore } from '../../store/userDataStore';
import type { Topic } from '../../types';

const modules = { 'Intro to Data Science': 'מבוא למדעי הנתונים', 'Topic 3 - Deep Learning': 'Deep Learning' };
const moduleCounts = { 'Intro to Data Science': 8, 'Topic 3 - Deep Learning': 43 };
const moduleMasteredCounts = { 'Intro to Data Science': 2, 'Topic 3 - Deep Learning': 0 };
const categoryLabels = { algorithms: 'אלגוריתמים', concepts: 'מושגים' };
const categoryCounts = { algorithms: 45, concepts: 69 };

function topic(overrides: Partial<Topic>): Topic {
  return {
    id: 'id',
    module: 'Intro to Data Science',
    module_label: 'מבוא',
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: 'slug',
    title: 'Title',
    definition: 'def',
    related_raw: [],
    related_match: [],
    contentPath: '/topic-content/x.html',
    ...overrides,
  };
}

const favTopic = topic({ id: 'fav-1', title: 'Favorite Topic' });
const recentTopic = topic({ id: 'recent-1', title: 'Recent Topic' });
const topicsById = new Map([
  [favTopic.id, favTopic],
  [recentTopic.id, recentTopic],
]);

function reset() {
  useUiStore.setState({ selectedModules: new Set(), selectedCategories: new Set(), sidebarCollapsed: false });
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
}

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar
        modules={modules}
        moduleCounts={moduleCounts}
        moduleMasteredCounts={moduleMasteredCounts}
        categoryLabels={categoryLabels}
        categoryCounts={categoryCounts}
        topicsById={topicsById}
      />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  beforeEach(reset);

  it('lists every module with its label and count', () => {
    renderSidebar();
    expect(screen.getByText('מבוא למדעי הנתונים')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('lists every category with its label and count', () => {
    renderSidebar();
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('toggles a module filter in the store when clicked', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ }));
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(true);
  });

  it('reflects an active module filter via aria-pressed', async () => {
    const user = userEvent.setup();
    renderSidebar();
    const button = screen.getByRole('button', { name: /מבוא למדעי הנתונים/ });
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('has a mobile-drawer toggle button with aria-expanded', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'פתח/סגור תפריט' })).toHaveAttribute('aria-expanded');
  });

  it('shows a per-module progress summary for screen readers', () => {
    renderSidebar();
    expect(screen.getByText('2 מתוך 8 נשלטו')).toBeInTheDocument();
  });

  it('does not render the favorites/recents sections when both are empty', () => {
    renderSidebar();
    expect(screen.queryByRole('navigation', { name: 'מועדפים' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'נצפו לאחרונה' })).not.toBeInTheDocument();
  });

  it('renders the favorites section with resolved topic links', () => {
    useUserDataStore.setState({ favorites: new Set(['fav-1']) });
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Favorite Topic' })).toHaveAttribute('href', '/topic/fav-1');
  });

  it('silently skips a favorite id that no longer resolves to a topic', () => {
    useUserDataStore.setState({ favorites: new Set(['fav-1', 'orphan-id']) });
    expect(() => renderSidebar()).not.toThrow();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders the recently-viewed section with resolved topic links', () => {
    useUserDataStore.setState({ recents: [{ topicId: 'recent-1', viewedAt: 1 }] });
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Recent Topic' })).toHaveAttribute('href', '/topic/recent-1');
  });
});
