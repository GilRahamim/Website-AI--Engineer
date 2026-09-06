import { create } from 'zustand';
import modulesData from '../data/modules.json';
import type { ProgressStatus, SortOrder, ViewMode } from '../types';

const allModuleKeys = Object.keys(modulesData as Record<string, string>);

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

interface UiState {
  searchQuery: string;
  selectedModules: Set<string>;
  selectedCategories: Set<string>;
  selectedStatuses: Set<ProgressStatus>;
  sortOrder: SortOrder;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  expandedGroups: Set<string>;

  setSearchQuery: (query: string) => void;
  toggleModule: (moduleKey: string) => void;
  toggleCategory: (category: string) => void;
  toggleStatus: (status: ProgressStatus) => void;
  clearFilters: () => void;
  setSortOrder: (order: SortOrder) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebarCollapsed: () => void;
  toggleGroup: (moduleKey: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  searchQuery: '',
  selectedModules: new Set(),
  selectedCategories: new Set(),
  selectedStatuses: new Set(),
  sortOrder: 'original',
  viewMode: 'grid',
  sidebarCollapsed: false,
  expandedGroups: new Set(allModuleKeys),

  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleModule: (moduleKey) =>
    set((state) => ({ selectedModules: toggleInSet(state.selectedModules, moduleKey) })),
  toggleCategory: (category) =>
    set((state) => ({ selectedCategories: toggleInSet(state.selectedCategories, category) })),
  toggleStatus: (status) =>
    set((state) => ({ selectedStatuses: toggleInSet(state.selectedStatuses, status) })),
  clearFilters: () =>
    set({
      searchQuery: '',
      selectedModules: new Set(),
      selectedCategories: new Set(),
      selectedStatuses: new Set(),
    }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleGroup: (moduleKey) =>
    set((state) => ({ expandedGroups: toggleInSet(state.expandedGroups, moduleKey) })),
  expandAllGroups: () => set({ expandedGroups: new Set(allModuleKeys) }),
  collapseAllGroups: () => set({ expandedGroups: new Set() }),
}));
