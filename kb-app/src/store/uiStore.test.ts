import { beforeEach, describe, expect, it } from 'vitest';
import modulesData from '../data/modules.json';
import { useUiStore } from './uiStore';

const allModuleKeys = Object.keys(modulesData as Record<string, string>);

function reset() {
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

describe('uiStore', () => {
  beforeEach(reset);

  it('starts with all groups expanded and no filters', () => {
    const state = useUiStore.getState();
    expect(state.expandedGroups.size).toBe(allModuleKeys.length);
    expect(state.selectedModules.size).toBe(0);
    expect(state.selectedCategories.size).toBe(0);
    expect(state.searchQuery).toBe('');
  });

  it('setSearchQuery updates the query', () => {
    useUiStore.getState().setSearchQuery('regression');
    expect(useUiStore.getState().searchQuery).toBe('regression');
  });

  it('toggleModule adds then removes a module (OR-within-type set)', () => {
    const { toggleModule } = useUiStore.getState();
    toggleModule('Intro to Data Science');
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(true);
    toggleModule('Intro to Data Science');
    expect(useUiStore.getState().selectedModules.has('Intro to Data Science')).toBe(false);
  });

  it('toggleCategory adds then removes a category', () => {
    const { toggleCategory } = useUiStore.getState();
    toggleCategory('algorithms');
    expect(useUiStore.getState().selectedCategories.has('algorithms')).toBe(true);
    toggleCategory('algorithms');
    expect(useUiStore.getState().selectedCategories.has('algorithms')).toBe(false);
  });

  it('clearFilters resets query, modules and categories but not sort/view', () => {
    const store = useUiStore.getState();
    store.setSearchQuery('x');
    store.toggleModule('Intro to Data Science');
    store.toggleCategory('algorithms');
    store.setSortOrder('alpha');
    store.clearFilters();

    const state = useUiStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.selectedModules.size).toBe(0);
    expect(state.selectedCategories.size).toBe(0);
    expect(state.sortOrder).toBe('alpha'); // untouched
  });

  it('setSortOrder and setViewMode update their fields', () => {
    useUiStore.getState().setSortOrder('category');
    useUiStore.getState().setViewMode('list');
    expect(useUiStore.getState().sortOrder).toBe('category');
    expect(useUiStore.getState().viewMode).toBe('list');
  });

  it('toggleSidebarCollapsed flips the flag', () => {
    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it('toggleGroup, expandAllGroups, collapseAllGroups manage expandedGroups', () => {
    const store = useUiStore.getState();
    const someModule = allModuleKeys[0];

    store.toggleGroup(someModule);
    expect(useUiStore.getState().expandedGroups.has(someModule)).toBe(false);

    store.collapseAllGroups();
    expect(useUiStore.getState().expandedGroups.size).toBe(0);

    store.expandAllGroups();
    expect(useUiStore.getState().expandedGroups.size).toBe(allModuleKeys.length);
  });
});
