import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RelatedTopics from './RelatedTopics';
import type { Topic } from '../../types';

function topic(id: string, title: string): Topic {
  return {
    id,
    module: 'Intro to Data Science',
    module_label: 'מבוא',
    category: 'algorithms',
    category_label: 'אלגוריתמים',
    num: 1,
    slug_name: id,
    title,
    definition: 'def',
    related_raw: [],
    related_match: [],
    contentPath: `/topic-content/${id}.html`,
  };
}

const topicsById = new Map<string, Topic>([
  ['a', topic('a', 'Logistic Regression')],
  ['b', topic('b', 'Bias-Variance Tradeoff')],
]);

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RelatedTopics', () => {
  it('renders a link for each resolved related id', () => {
    renderWithRouter(<RelatedTopics relatedIds={['a', 'b']} topicsById={topicsById} />);
    expect(screen.getByText('Logistic Regression')).toBeInTheDocument();
    expect(screen.getByText('Bias-Variance Tradeoff')).toBeInTheDocument();
  });

  it('skips null entries', () => {
    renderWithRouter(<RelatedTopics relatedIds={['a', null, null]} topicsById={topicsById} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('skips ids that cannot be resolved in topicsById', () => {
    renderWithRouter(<RelatedTopics relatedIds={['a', 'nonexistent']} topicsById={topicsById} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders nothing when there are no resolvable related topics', () => {
    const { container } = renderWithRouter(<RelatedTopics relatedIds={[null, null]} topicsById={topicsById} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links to the encoded topic route', () => {
    renderWithRouter(<RelatedTopics relatedIds={['a']} topicsById={topicsById} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', `/topic/${encodeURIComponent('a')}`);
  });

  it('shows unresolved raw names as non-link chips marked as missing from the dataset', () => {
    renderWithRouter(<RelatedTopics relatedIds={['a', null]} relatedRaw={['Logistic Regression', 'R²']} topicsById={topicsById} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    const missing = screen.getByText(/R²/);
    expect(missing).toHaveTextContent('R² (לא במאגר)');
    expect(missing.closest('a')).toBeNull();
  });

  it('renders the section when only unresolved names exist', () => {
    renderWithRouter(<RelatedTopics relatedIds={[null]} relatedRaw={['R²']} topicsById={topicsById} />);
    expect(screen.getByRole('navigation', { name: 'נושאים קשורים' })).toBeInTheDocument();
  });
});
