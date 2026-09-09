import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Flashcards from './Flashcards';
import { useUserDataStore } from '../store/userDataStore';
import { useSyncStore } from '../store/syncStore';
import topicsData from '../data/topics.clean.json';

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
  // Statically importing useSyncStore here (rather than leaving it to
  // userDataStore's own per-call `import('./syncStore')`) pre-warms the
  // module in the graph before a card rating can trigger that dynamic
  // import, and stubs the resulting scheduleDirtyPush call so it doesn't
  // leave a dangling real timer/network call running past this test's
  // lifetime.
  vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Flashcards />
    </MemoryRouter>,
  );
}

describe('Flashcards', () => {
  beforeEach(reset);

  it("shows the first card's title with a reveal control, hiding the definition", () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'לחץ לחשיפה' })).toBeInTheDocument();
    expect(screen.getByText(`1 מתוך ${topicsData.length}`)).toBeInTheDocument();
  });

  it('reveals the definition, full-reader link and rating buttons on click', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'לחץ לחשיפה' }));
    expect(screen.getByRole('button', { name: 'שוב' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'קשה' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'טוב' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'קל' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'פתח את הנושא המלא' })).toBeInTheDocument();
  });

  it('rating a card grades it in the store and advances to the next card', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'לחץ לחשיפה' }));
    await user.click(screen.getByRole('button', { name: 'טוב' }));

    expect(useUserDataStore.getState().srsCards.size).toBe(1);
    expect(screen.getByText(`2 מתוך ${topicsData.length}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'לחץ לחשיפה' })).toBeInTheDocument();
  });

  it('narrows the queue when a module filter is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    const moduleCount = topicsData.filter((t) => t.module === topicsData[0].module).length;

    await user.selectOptions(screen.getByLabelText('מודול'), topicsData[0].module);
    expect(screen.getByText(`1 מתוך ${moduleCount}`)).toBeInTheDocument();
  });

  it('shows an empty-queue message when no topics match the filters', async () => {
    useUserDataStore.setState({ progress: new Map(topicsData.map((t) => [t.id, 'mastered' as const])) });
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('מצב למידה'), 'new');
    expect(screen.getByRole('status')).toHaveTextContent('אין כרטיסים לחזרה');
  });

  it('shows an end-of-session message after rating the only matching card', async () => {
    const progress = new Map<string, 'mastered' | 'new'>(topicsData.map((t) => [t.id, 'mastered']));
    progress.set(topicsData[0].id, 'new');
    useUserDataStore.setState({ progress });
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('מצב למידה'), 'new');
    expect(screen.getByText('1 מתוך 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'לחץ לחשיפה' }));
    await user.click(screen.getByRole('button', { name: 'טוב' }));
    expect(screen.getByRole('status')).toHaveTextContent('סיימת! 1 כרטיסים נסקרו.');
  });

  it.each([
    ['שוב', { lapses: 1, ease: 2.3 }],
    ['קשה', { lapses: 0, ease: 2.35 }],
    ['טוב', { lapses: 0, ease: 2.5 }],
    ['קל', { lapses: 0, ease: 2.65 }],
  ] as const)('rating "%s" grades the card with the matching SrsRating', async (label, expected) => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'לחץ לחשיפה' }));
    await user.click(screen.getByRole('button', { name: label }));

    const [gradedCard] = [...useUserDataStore.getState().srsCards.values()];
    expect(gradedCard).toBeDefined();
    expect(gradedCard.lapses).toBe(expected.lapses);
    expect(gradedCard.ease).toBeCloseTo(expected.ease);
  });

  it('does not reinsert an "Again"-rated card later in the same session', async () => {
    const progress = new Map<string, 'mastered' | 'new'>(topicsData.map((t) => [t.id, 'mastered']));
    progress.set(topicsData[0].id, 'new');
    progress.set(topicsData[1].id, 'new');
    useUserDataStore.setState({ progress });
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('מצב למידה'), 'new');
    expect(screen.getByText('1 מתוך 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'לחץ לחשיפה' }));
    await user.click(screen.getByRole('button', { name: 'שוב' }));
    expect(screen.getByText('2 מתוך 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'לחץ לחשיפה' }));
    await user.click(screen.getByRole('button', { name: 'טוב' }));
    expect(screen.getByRole('status')).toHaveTextContent('סיימת! 2 כרטיסים נסקרו.');
  });

  it('reveals via Space and rates via number keys 1-4', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'שוב' })).toBeInTheDocument();
    await user.keyboard('3');
    expect(useUserDataStore.getState().srsCards.size).toBe(1);
    expect(screen.getByText(`2 מתוך ${topicsData.length}`)).toBeInTheDocument();
  });
});
