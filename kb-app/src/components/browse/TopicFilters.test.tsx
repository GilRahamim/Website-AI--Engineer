import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicFilters from './TopicFilters';

// jsdom doesn't implement pointer capture or scrollIntoView, and Radix
// Select's trigger/item pointer handlers call both. Stub them so
// userEvent's pointer-event simulation doesn't throw.
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

const modules = { m1: 'מודול אחד', m2: 'מודול שתיים' };
const categoryLabels = { concepts: 'מושגים', metrics: 'מדדים' };

describe('TopicFilters', () => {
  it('renders module and category selects with the right options', async () => {
    const user = userEvent.setup();
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
    expect(screen.getByRole('combobox', { name: 'מודול' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'קטגוריה' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'מודול' }));
    expect(await screen.findByRole('option', { name: 'מודול אחד' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'מודול אחד' }));

    await user.click(screen.getByRole('combobox', { name: 'קטגוריה' }));
    expect(await screen.findByRole('option', { name: 'מושגים' })).toBeInTheDocument();
  });

  it('calls onModuleChange with the new value when a module option is chosen', async () => {
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
    await user.click(screen.getByRole('combobox', { name: 'מודול' }));
    await user.click(await screen.findByRole('option', { name: 'מודול אחד' }));
    expect(onModuleChange).toHaveBeenCalledWith('m1');
  });

  it('calls onCategoryChange with the new value when a category option is chosen', async () => {
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
    await user.click(screen.getByRole('combobox', { name: 'קטגוריה' }));
    await user.click(await screen.findByRole('option', { name: 'מדדים' }));
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
    expect(screen.getByRole('combobox', { name: 'מודול' })).toHaveTextContent('מודול שתיים');
    expect(screen.getByRole('combobox', { name: 'קטגוריה' })).toHaveTextContent('מדדים');
  });
});
