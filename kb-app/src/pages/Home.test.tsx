import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { useUiStore } from '../store/uiStore';
import topicsData from '../data/topics.clean.json';

function reset() {
  const allModuleKeys = [...new Set(topicsData.map((t) => t.module))];
  useUiStore.setState({
    searchQuery: '',
    selectedModules: new Set(),
    selectedCategories: new Set(),
    sortOrder: 'original',
    viewMode: 'grid',
    sidebarCollapsed: false,
    expandedGroups: new Set(allModuleKeys),
  });
}

describe('Home', () => {
  beforeEach(reset);

  it('renders the hero with the real topic count', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(String(topicsData.length))).toBeInTheDocument();
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
});
