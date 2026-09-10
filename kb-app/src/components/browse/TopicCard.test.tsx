import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TopicCard from './TopicCard';
import TopicListRow from './TopicListRow';
import { useUserDataStore } from '../../store/userDataStore';
import { useSyncStore } from '../../store/syncStore';
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

function reset() {
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
  // Statically importing useSyncStore here (rather than leaving it to
  // userDataStore's own per-call `import('./syncStore')`) pre-warms the
  // module in the graph before a status/favorite click can trigger that
  // dynamic import, and stubs the resulting scheduleDirtyPush call so it
  // doesn't leave a dangling real timer/network call running past this
  // test's lifetime.
  vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('TopicCard', () => {
  beforeEach(reset);

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

  it('applies keyboard-nav props from the item to the link', () => {
    const onKeyDown = vi.fn();
    renderWithRouter(
      <TopicCard topic={topic} highlightTerm="" itemProps={{ ...itemProps, tabIndex: -1, onKeyDown }} />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('tabindex', '-1');
  });

  it('renders the status and favorite buttons as siblings of the link, not nested inside it', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    const statusButton = screen.getByRole('button', { name: /מצב למידה/ });
    const favoriteButton = screen.getByRole('button', { name: /מועדפים/ });
    expect(link.contains(statusButton)).toBe(false);
    expect(link.contains(favoriteButton)).toBe(false);
  });

  it('clicking the status button does not navigate to the topic route', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />} />
          <Route path="/topic/:id" element={<p>Reader page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /מצב למידה/ }));
    expect(screen.queryByText('Reader page')).not.toBeInTheDocument();
  });

  it('clicking the favorite button does not navigate to the topic route', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<TopicCard topic={topic} highlightTerm="" itemProps={itemProps} />} />
          <Route path="/topic/:id" element={<p>Reader page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /מועדפים/ }));
    expect(screen.queryByText('Reader page')).not.toBeInTheDocument();
  });

  it('renders the status and favorite buttons with the same tabindex as the card link', () => {
    renderWithRouter(
      <TopicCard topic={topic} highlightTerm="" itemProps={{ ...itemProps, tabIndex: -1 }} />,
    );
    expect(screen.getByRole('button', { name: /מצב למידה/ })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: /מועדפים/ })).toHaveAttribute('tabindex', '-1');
  });

  it('renders the status and favorite buttons as tabbable when the card link is', () => {
    renderWithRouter(<TopicCard topic={topic} highlightTerm="" itemProps={{ ...itemProps, tabIndex: 0 }} />);
    expect(screen.getByRole('button', { name: /מצב למידה/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: /מועדפים/ })).toHaveAttribute('tabindex', '0');
  });
});

describe('TopicListRow', () => {
  beforeEach(reset);

  it('links to the topic reader route and shows the title', () => {
    renderWithRouter(<TopicListRow topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/topic/${encodeURIComponent(topic.id)}`);
    expect(link).toHaveTextContent('Linear Regression');
  });

  it('renders the status and favorite buttons as siblings of the link, not nested inside it', () => {
    renderWithRouter(<TopicListRow topic={topic} highlightTerm="" itemProps={itemProps} />);
    const link = screen.getByRole('link');
    const statusButton = screen.getByRole('button', { name: /מצב למידה/ });
    expect(link.contains(statusButton)).toBe(false);
  });

  it('clicking the status button does not navigate to the topic route', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<TopicListRow topic={topic} highlightTerm="" itemProps={itemProps} />} />
          <Route path="/topic/:id" element={<p>Reader page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /מצב למידה/ }));
    expect(screen.queryByText('Reader page')).not.toBeInTheDocument();
  });
});
