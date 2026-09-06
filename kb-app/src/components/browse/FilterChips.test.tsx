import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterChips from './FilterChips';
import { useUiStore } from '../../store/uiStore';

const modules = { 'Intro to Data Science': 'מבוא למדעי הנתונים' };
const categoryLabels = { algorithms: 'אלגוריתמים' };

function reset() {
  useUiStore.setState({ selectedModules: new Set(), selectedCategories: new Set(), selectedStatuses: new Set() });
}

describe('FilterChips', () => {
  beforeEach(reset);

  it('renders nothing when no filters are active', () => {
    const { container } = render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a chip per active module and category filter', () => {
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    expect(screen.getByText(/מבוא למדעי הנתונים/)).toBeInTheDocument();
    expect(screen.getByText(/אלגוריתמים/)).toBeInTheDocument();
  });

  it('renders a chip for an active status filter, with its Hebrew label', () => {
    useUiStore.setState({ selectedStatuses: new Set(['mastered']) });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    expect(screen.getByText(/נשלט/)).toBeInTheDocument();
  });

  it('removes a status chip on click without affecting module/category filters', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedStatuses: new Set(['mastered']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    await user.click(screen.getByText(/נשלט/));
    expect(useUiStore.getState().selectedStatuses.size).toBe(0);
    expect(useUiStore.getState().selectedModules.size).toBe(1);
  });

  it('removes a single chip on click without affecting others', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    await user.click(screen.getByText(/מבוא למדעי הנתונים/));
    expect(useUiStore.getState().selectedModules.size).toBe(0);
    expect(useUiStore.getState().selectedCategories.size).toBe(1);
  });

  it('"clear all" removes every filter including statuses', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
      selectedStatuses: new Set(['mastered']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    await user.click(screen.getByRole('button', { name: 'נקה הכול' }));
    expect(useUiStore.getState().selectedModules.size).toBe(0);
    expect(useUiStore.getState().selectedCategories.size).toBe(0);
    expect(useUiStore.getState().selectedStatuses.size).toBe(0);
  });
});
