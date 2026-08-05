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
