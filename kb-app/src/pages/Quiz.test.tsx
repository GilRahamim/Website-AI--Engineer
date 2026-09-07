import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Quiz from './Quiz';
import { useUserDataStore } from '../store/userDataStore';
import topicsData from '../data/topics.clean.json';
import type { ProgressStatus } from '../types';

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    srsCards: new Map(),
    isLoaded: true,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Quiz />
    </MemoryRouter>,
  );
}

/** Narrows the pool to exactly one real topic via the status filter, so
 *  the resulting single-question quiz is about a known, predictable
 *  topic — the correct answer's exact text is then knowable from the
 *  real dataset even though distractors are still randomly chosen. */
function isolateOneTopic(target: (typeof topicsData)[number]) {
  const progress = new Map<string, ProgressStatus>(topicsData.map((t) => [t.id, 'mastered']));
  progress.set(target.id, 'new');
  useUserDataStore.setState({ progress });
}

describe('Quiz', () => {
  beforeEach(reset);

  it('renders the setup screen with filters, a question-count selector and a start button', () => {
    renderPage();
    expect(screen.getByLabelText('מודול')).toBeInTheDocument();
    expect(screen.getByLabelText('קטגוריה')).toBeInTheDocument();
    expect(screen.getByLabelText('מצב למידה')).toBeInTheDocument();
    expect(screen.getByLabelText('מספר שאלות')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחל מבחן' })).toBeInTheDocument();
  });

  it('starts a session showing a definition and 4 options', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    const main = screen.getByRole('main');
    expect(within(main).getByText('1 מתוך 10')).toBeInTheDocument();
    expect(within(main).getAllByRole('button')).toHaveLength(4);
  });

  it('selecting the correct option does not call gradeCard and reveals "הבא"', async () => {
    const target = topicsData[0];
    isolateOneTopic(target);
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('מצב למידה'), 'new');
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    await user.click(within(screen.getByRole('main')).getByRole('button', { name: target.title }));

    expect(useUserDataStore.getState().srsCards.size).toBe(0);
    expect(within(screen.getByRole('main')).getByRole('button', { name: 'הבא' })).toBeInTheDocument();
  });

  it('selecting a wrong option grades the topic "again" and lists it in the summary', async () => {
    const target = topicsData[0];
    isolateOneTopic(target);
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('מצב למידה'), 'new');
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    const main = screen.getByRole('main');
    const wrongOption = within(main)
      .getAllByRole('button')
      .find((btn) => btn.textContent !== target.title)!;
    await user.click(wrongOption);

    const graded = useUserDataStore.getState().srsCards.get(target.id);
    expect(graded).toBeDefined();
    expect(graded?.lapses).toBe(1);

    await user.click(within(main).getByRole('button', { name: 'הבא' }));
    expect(within(main).getByRole('status')).toHaveTextContent('0 מתוך 1 נכונות');
    expect(within(main).getByRole('link', { name: target.title })).toBeInTheDocument();
  });

  it('reflects hydrated progress data even if the store was still loading when the page mounted', async () => {
    const target = topicsData[0];
    useUserDataStore.setState({
      progress: new Map(),
      favorites: new Set(),
      recents: [],
      notes: new Map(),
      srsCards: new Map(),
      isLoaded: false,
    });
    const user = userEvent.setup();
    renderPage();

    act(() => {
      isolateOneTopic(target);
      useUserDataStore.setState({ isLoaded: true });
    });

    await user.selectOptions(screen.getByLabelText('מצב למידה'), 'new');
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    expect(within(screen.getByRole('main')).getByText('1 מתוך 1')).toBeInTheDocument();
  });

  it('selects via number keys 1-4 and advances via Enter', async () => {
    const target = topicsData[0];
    isolateOneTopic(target);
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('מצב למידה'), 'new');
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    await user.keyboard('1');
    // Whichever option key "1" selected — correct or one of the shuffled
    // wrong ones — an answer was locked in, so "הבא" must appear either way.
    expect(within(screen.getByRole('main')).getByRole('button', { name: 'הבא' })).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(within(screen.getByRole('main')).getByRole('status')).toBeInTheDocument();
  });
});
