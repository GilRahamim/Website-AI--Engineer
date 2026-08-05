import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopicReader from './TopicReader';
import type { Topic } from '../../types';

const topic: Topic = {
  id: 'Intro to Data Science::algorithms::02_Linear_Regression.docx',
  module: 'Intro to Data Science',
  module_label: 'מבוא למדעי הנתונים',
  category: 'algorithms',
  category_label: 'אלגוריתמים',
  num: 2,
  slug_name: 'Linear Regression',
  title: 'Linear Regression — רגרסיה לינארית',
  definition: 'שיטת למידה מונחית לחיזוי ערך רציף.',
  related_raw: [],
  related_match: ['related-id'],
  contentPath: '/topic-content/x.html',
};

const relatedTopic: Topic = { ...topic, id: 'related-id', title: 'Related Topic' };
const topicsById = new Map([[relatedTopic.id, relatedTopic]]);

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    text: () => Promise.resolve('<p>תוכן הנושא המלא</p>'),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <TopicReader topic={topic} topicsById={topicsById} />
    </MemoryRouter>,
  );
}

describe('TopicReader', () => {
  it('renders the breadcrumb, category badge, title and definition', () => {
    renderWithRouter();
    expect(screen.getByText('מבוא למדעי הנתונים')).toBeInTheDocument();
    expect(screen.getByText('אלגוריתמים')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: topic.title })).toBeInTheDocument();
    expect(screen.getByText(topic.definition)).toBeInTheDocument();
  });

  it('fetches and renders the full content from contentPath', async () => {
    renderWithRouter();
    expect(fetch).toHaveBeenCalledWith('/topic-content/x.html');
    await waitFor(() => expect(screen.getByText('תוכן הנושא המלא')).toBeInTheDocument());
  });

  it('renders resolved related topics', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('Related Topic')).toBeInTheDocument());
  });
});
