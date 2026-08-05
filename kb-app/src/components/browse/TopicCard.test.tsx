import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopicCard from './TopicCard';
import TopicListRow from './TopicListRow';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import type { Topic } from '../../types';

const topic: Topic = {
  id: 'Intro to Data Science::algorithms::02_Linear_Regression.docx',
  module: 'Intro to Data Science',
  module_label: 'מבוא',
  category: 'algorithms',
  category_label: 'אלגוריתמים',
  num: 2,
  slug_name: 'Linear Regression',
  title: 'Linear Regression — רגרסיה לינארית',
  definition: 'שיטת למידה מונחית לחיזוי ערך רציף.',
  related_raw: [],
  related_match: [],
  contentPath: '/topic-content/x.html',
};

const itemProps: GridItemProps = {
  tabIndex: 0,
  ref: () => {},
  onFocus: () => {},
  onKeyDown: () => {},
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('TopicCard', () => {
  it('links to the topic reader route with an encoded id', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/topic/${encodeURIComponent(topic.id)}`);
  });

  it('renders the category label and definition', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByText(topic.definition)).toBeInTheDocument();
  });

  it('highlights the search term in the title', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="Linear" itemProps={itemProps} />);
    expect(screen.getByText('Linear')).toBeInTheDocument();
  });

  it('applies keyboard-nav props from the item', () => {
    const onKeyDown = vi.fn();
    renderWithRouter(
      <TopicCard topic={topic} highlightTerm="" itemProps={{ ...itemProps, tabIndex: -1, onKeyDown }} />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('tabindex', '-1');
  });
});

describe('TopicListRow', () => {
  it('links to the topic reader route and shows the title', () => {
    renderWithRouter(<TopicListRow topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/topic/${encodeURIComponent(topic.id)}`);
    expect(link).toHaveTextContent('Linear Regression');
  });
});
