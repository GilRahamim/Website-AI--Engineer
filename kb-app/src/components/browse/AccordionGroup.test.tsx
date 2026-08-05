import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AccordionGroup from './AccordionGroup';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import type { Topic, TopicGroup } from '../../types';

function topic(id: string): Topic {
  return {
    id,
    module: 'Intro to Data Science',
    module_label: 'מבוא',
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: id,
    title: id,
    definition: 'def',
    related_raw: [],
    related_match: [],
    contentPath: `/topic-content/${id}.html`,
  };
}

const group: TopicGroup = {
  moduleKey: 'Intro to Data Science',
  moduleLabel: 'מבוא למדעי הנתונים',
  topics: [topic('a'), topic('b')],
};

const getItemProps = (): GridItemProps => ({ tabIndex: 0, ref: () => {}, onFocus: () => {}, onKeyDown: () => {} });

function renderGroup(expanded: boolean, onToggle = vi.fn(), viewMode: 'grid' | 'list' = 'grid') {
  return render(
    <MemoryRouter>
      <AccordionGroup
        group={group}
        expanded={expanded}
        onToggle={onToggle}
        viewMode={viewMode}
        highlightTerm=""
        getItemProps={getItemProps}
      />
    </MemoryRouter>,
  );
}

describe('AccordionGroup', () => {
  it('shows the module label and topic count on the trigger', () => {
    renderGroup(true);
    expect(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders topic cards when expanded', () => {
    renderGroup(true);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders no topic cards when collapsed', () => {
    renderGroup(false);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('reflects expanded state via aria-expanded', () => {
    renderGroup(true);
    expect(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('calls onToggle when the trigger is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderGroup(true, onToggle);
    await user.click(screen.getByRole('button', { name: /מבוא למדעי הנתונים/ }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders a list layout when viewMode is list', () => {
    renderGroup(true, vi.fn(), 'list');
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
