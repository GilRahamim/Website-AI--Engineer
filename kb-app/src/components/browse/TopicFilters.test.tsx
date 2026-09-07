import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicFilters from './TopicFilters';

const modules = { m1: 'מודול אחד', m2: 'מודול שתיים' };
const categoryLabels = { concepts: 'מושגים', metrics: 'מדדים' };

describe('TopicFilters', () => {
  it('renders module and category selects with the right options', () => {
    render(
      <TopicFilters
        modules={modules}
        categoryLabels={categoryLabels}
        selectedModule="all"
        selectedCategory="all"
        onModuleChange={() => {}}
        onCategoryChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('מודול')).toBeInTheDocument();
    expect(screen.getByLabelText('קטגוריה')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מודול אחד' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מושגים' })).toBeInTheDocument();
  });

  it('calls onModuleChange with the new value when the module select changes', async () => {
    const user = userEvent.setup();
    const onModuleChange = vi.fn();
    render(
      <TopicFilters
        modules={modules}
        categoryLabels={categoryLabels}
        selectedModule="all"
        selectedCategory="all"
        onModuleChange={onModuleChange}
        onCategoryChange={() => {}}
      />,
    );
    await user.selectOptions(screen.getByLabelText('מודול'), 'm1');
    expect(onModuleChange).toHaveBeenCalledWith('m1');
  });

  it('calls onCategoryChange with the new value when the category select changes', async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    render(
      <TopicFilters
        modules={modules}
        categoryLabels={categoryLabels}
        selectedModule="all"
        selectedCategory="all"
        onModuleChange={() => {}}
        onCategoryChange={onCategoryChange}
      />,
    );
    await user.selectOptions(screen.getByLabelText('קטגוריה'), 'metrics');
    expect(onCategoryChange).toHaveBeenCalledWith('metrics');
  });

  it('reflects the currently selected values', () => {
    render(
      <TopicFilters
        modules={modules}
        categoryLabels={categoryLabels}
        selectedModule="m2"
        selectedCategory="metrics"
        onModuleChange={() => {}}
        onCategoryChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('מודול')).toHaveValue('m2');
    expect(screen.getByLabelText('קטגוריה')).toHaveValue('metrics');
  });
});
