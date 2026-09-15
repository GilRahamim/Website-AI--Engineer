import { useState } from 'react';
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

const otherGroup: TopicGroup = {
  moduleKey: 'Topic 1 - Unsupervised Learning',
  moduleLabel: 'מודול אחר',
  topics: [topic('c'), topic('d')],
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

// Two sibling AccordionGroup instances, each with its own independent local
// `expanded` state — mirrors how Home.tsx drives each group from its own
// slice of the `expandedGroups` Set. This is the structural setup needed to
// catch a regression that renderGroup() (a single instance) cannot: if
// AccordionGroup were ever refactored to share one `Accordion` across every
// module group (instead of one `Accordion` per group), toggling one group
// would forcibly close the other.
function renderTwoGroups() {
  function TwoGroups() {
    const [expandedA, setExpandedA] = useState(true);
    const [expandedB, setExpandedB] = useState(true);
    return (
      <>
        <AccordionGroup
          group={group}
          expanded={expandedA}
          onToggle={() => setExpandedA((v) => !v)}
          viewMode="grid"
          highlightTerm=""
          getItemProps={getItemProps}
        />
        <AccordionGroup
          group={otherGroup}
          expanded={expandedB}
          onToggle={() => setExpandedB((v) => !v)}
          viewMode="grid"
          highlightTerm=""
          getItemProps={getItemProps}
        />
      </>
    );
  }
  return render(
    <MemoryRouter>
      <TwoGroups />
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

  it('keeps two sibling groups independently expandable — toggling one does not collapse the other', async () => {
    const user = userEvent.setup();
    renderTwoGroups();

    // Both start expanded: proves multiple groups can be open at once.
    expect(screen.getAllByRole('link')).toHaveLength(4);
    const triggerA = screen.getByRole('button', { name: /מבוא למדעי הנתונים/ });
    const triggerB = screen.getByRole('button', { name: /מודול אחר/ });
    expect(triggerA).toHaveAttribute('aria-expanded', 'true');
    expect(triggerB).toHaveAttribute('aria-expanded', 'true');

    await user.click(triggerA);

    // Collapsing group A must leave group B untouched. A single shared
    // `Accordion type="single"` across both groups would fail this — closing
    // one item would be the only "state" the shared instance has, and it
    // would not be able to represent both groups being open independently.
    expect(triggerA).toHaveAttribute('aria-expanded', 'false');
    expect(triggerB).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});
