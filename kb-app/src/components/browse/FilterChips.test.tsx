import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterChips from './FilterChips';
import { useUiStore } from '../../store/uiStore';

const modules = { 'Intro to Data Science': 'מבוא למדעי הנתונים' };
const categoryLabels = { algorithms: 'אלגוריתמים' };

function reset() {
  useUiStore.setState({ selectedModules: new Set(), selectedCategories: new Set() });
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

  it('"clear all" removes every filter', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      selectedModules: new Set(['Intro to Data Science']),
      selectedCategories: new Set(['algorithms']),
    });
    render(<FilterChips modules={modules} categoryLabels={categoryLabels} />);
    await user.click(screen.getByRole('button', { name: 'נקה הכול' }));
    expect(useUiStore.getState().selectedModules.size).toBe(0);
    expect(useUiStore.getState().selectedCategories.size).toBe(0);
  });
});
