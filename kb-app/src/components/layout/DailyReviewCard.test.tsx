import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DailyReviewCard from './DailyReviewCard';
import type { Topic } from '../../types';

const randomTopic: Topic = {
  id: 'topic-x',
  module: 'm',
  module_label: 'M',
  category: 'concepts',
  category_label: 'C',
  num: 1,
  slug_name: 'x',
  title: 'Random Topic Title',
  definition: 'd',
  related_raw: [],
  related_match: [],
  contentPath: '/x.html',
};

function renderCard(dueCount: number) {
  return render(
    <MemoryRouter>
      <DailyReviewCard dueCount={dueCount} randomTopic={randomTopic} />
    </MemoryRouter>,
  );
}

describe('DailyReviewCard', () => {
  it('shows the due count', () => {
    renderCard(7);
    expect(screen.getByText('7 ממתינים היום')).toBeInTheDocument();
  });

  it('links "start review" to /flashcards', () => {
    renderCard(7);
    expect(screen.getByRole('link', { name: 'התחל חזרה' })).toHaveAttribute('href', '/flashcards');
  });

  it('links the random concept to its topic reader page', () => {
    renderCard(7);
    expect(screen.getByRole('link', { name: /Random Topic Title/ })).toHaveAttribute('href', '/topic/topic-x');
  });
});
