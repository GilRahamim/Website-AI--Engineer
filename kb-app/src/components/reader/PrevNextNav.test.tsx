import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrevNextNav from './PrevNextNav';
import type { Topic } from '../../types';

function t(id: string, title: string): Topic {
  return {
    id,
    module: 'A',
    module_label: 'A',
    category: 'concepts',
    category_label: 'מושגים',
    num: 0,
    slug_name: id,
    title,
    definition: '',
    related_raw: [],
    related_match: [],
    contentPath: '',
  };
}

function renderNav(prev: Topic | null, next: Topic | null) {
  return render(
    <MemoryRouter>
      <PrevNextNav prev={prev} next={next} />
    </MemoryRouter>,
  );
}

describe('PrevNextNav', () => {
  it('links to the previous and next topics by encoded id', () => {
    renderNav(t('a 1', 'קודם'), t('a 2', 'הבא'));
    expect(screen.getByRole('navigation', { name: 'ניווט בין נושאים' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /הקודם.*קודם/ })).toHaveAttribute('href', '/topic/a%201');
    expect(screen.getByRole('link', { name: /הבא.*הבא/ })).toHaveAttribute('href', '/topic/a%202');
  });

  it('omits a side that has no topic', () => {
    renderNav(null, t('a 2', 'הבא'));
    expect(screen.queryByRole('link', { name: /הקודם/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /הבא/ })).toBeInTheDocument();
  });

  it('renders nothing when there is neither', () => {
    renderNav(null, null);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
