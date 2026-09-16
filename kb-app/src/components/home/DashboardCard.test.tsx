import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardCard from './DashboardCard';
import type { Topic } from '../../types';

function t(id: string, title: string): Topic {
  return {
    id,
    module: 'A',
    module_label: 'מודול א',
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

const base = {
  masteredCount: 42,
  learningCount: 31,
  totalCount: 160,
  dueCount: 8,
  newCount: 87,
  reviewedCount: 73,
  randomTopic: t('r 1', 'נושא אקראי'),
  continueTopic: t('c 1', 'המשך כאן') as Topic | null,
};

function renderCard(props: Partial<typeof base> = {}) {
  return render(
    <MemoryRouter>
      <DashboardCard {...base} {...props} />
    </MemoryRouter>,
  );
}

describe('DashboardCard', () => {
  it('shows mastered progress as a percentage and a fraction', () => {
    renderCard();
    expect(screen.getByText('26%')).toBeInTheDocument();
    expect(screen.getByText('42 מתוך 160 נושאים נשלטו')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'התקדמות כללית' })).toHaveAttribute('aria-valuenow', '42');
  });

  it('links "start review" to /flashcards with the due count, and new topics separately', () => {
    renderCard();
    expect(screen.getByRole('link', { name: /התחל חזרה.*8/ })).toHaveAttribute('href', '/flashcards');
    expect(screen.getByText(/87 נושאים חדשים/)).toBeInTheDocument();
  });

  it('offers the new cards when nothing is scheduled but topics are still unreviewed', () => {
    renderCard({ dueCount: 0 });
    expect(screen.getByText('אין חזרות מתוזמנות להיום')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /למד כרטיסים חדשים.*87/ })).toHaveAttribute('href', '/flashcards');
  });

  it('says everything is up to date only when nothing is due and nothing is new', () => {
    renderCard({ dueCount: 0, newCount: 0 });
    expect(screen.getByText('הכול מעודכן להיום')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'פתח כרטיסיות' })).toHaveAttribute('href', '/flashcards');
  });

  it('links the random topic and the continue-reading topic to their reader pages', () => {
    renderCard();
    expect(screen.getByRole('link', { name: /מושג אקראי/ })).toHaveAttribute('href', '/topic/r%201');
    expect(screen.getByRole('link', { name: /המשך קריאה.*המשך כאן/ })).toHaveAttribute('href', '/topic/c%201');
  });

  it('omits the continue-reading row when there is no recent topic', () => {
    renderCard({ continueTopic: null });
    expect(screen.queryByRole('link', { name: /המשך קריאה/ })).not.toBeInTheDocument();
  });

  it('uses the layered card shadow on the dashboard tiles', () => {
    const { container } = renderCard();
    const tiles = Array.from(container.querySelectorAll('div, a')).filter(
      (el) => el.className.includes('rounded-2xl') && el.className.includes('shadow-[var(--kb-shadow-card)]'),
    );
    expect(tiles).toHaveLength(3);
  });
});
