import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Quiz from './Quiz';
import { useUserDataStore } from '../store/userDataStore';
import { useSyncStore } from '../store/syncStore';
import { STATUS_LABELS } from '../lib/progressStatus';
import topicsData from '../data/topics.clean.json';
import type { ProgressStatus } from '../types';

// jsdom doesn't implement pointer capture or scrollIntoView, and Radix
// Select's trigger/item pointer handlers call both. Stub them so
// userEvent's pointer-event simulation doesn't throw.
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

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
  // module in the graph before a wrong-answer grade can trigger that
  // dynamic import, and stubs the resulting scheduleDirtyPush call so it
  // doesn't leave a dangling real timer/network call running past this
  // test's lifetime.
  vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Quiz />
    </MemoryRouter>,
  );
}

function renderPageWithModulePreset(module: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/quiz', state: { module } }]}>
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

// Radix Select's trigger is a button, not a native <select>, so choosing an
// option means clicking the trigger and then clicking the option by its
// visible label — the same pattern Task 9 used for SortMenu.
async function selectComboboxOption(user: ReturnType<typeof userEvent.setup>, comboboxName: string, optionName: string) {
  await user.click(screen.getByRole('combobox', { name: comboboxName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}

describe('Quiz', () => {
  beforeEach(reset);

  it('renders the setup screen with filters, a question-count selector and a start button', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: 'מודול' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'קטגוריה' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'מצב למידה' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'מספר שאלות' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחל מבחן' })).toBeInTheDocument();
  });

  it('pre-selects the module filter when arriving with a module-complete nudge state', () => {
    renderPageWithModulePreset('Intro to Data Science');
    expect(screen.getByRole('combobox', { name: 'מודול' })).toHaveTextContent('מבוא למדעי הנתונים');
  });

  it('ignores an unrecognized preset module and falls back to "all"', () => {
    renderPageWithModulePreset('not-a-real-module');
    expect(screen.getByRole('combobox', { name: 'מודול' })).toHaveTextContent('הכול');
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
    await selectComboboxOption(user, 'מצב למידה', STATUS_LABELS.new);
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    await user.click(within(screen.getByRole('main')).getByRole('button', { name: target.title }));

    expect(useUserDataStore.getState().srsCards.size).toBe(0);
    expect(within(screen.getByRole('main')).getByRole('button', { name: 'הבא' })).toBeInTheDocument();
  });

  it('selecting a wrong option on an already-scheduled topic re-grades it "again"', async () => {
    const target = topicsData[0];
    isolateOneTopic(target);
    const now = Date.now();
    useUserDataStore.setState({
      srsCards: new Map([
        [target.id, { topicId: target.id, ease: 2.5, intervalDays: 10, dueAt: now, reps: 1, lapses: 0, updatedAt: now }],
      ]),
    });
    const user = userEvent.setup();
    renderPage();
    await selectComboboxOption(user, 'מצב למידה', STATUS_LABELS.new);
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    const main = screen.getByRole('main');
    const wrongOption = within(main)
      .getAllByRole('button')
      .find((btn) => btn.textContent !== target.title)!;
    await user.click(wrongOption);

    const graded = useUserDataStore.getState().srsCards.get(target.id);
    expect(graded?.lapses).toBe(1);
    expect(graded?.intervalDays).toBe(1);

    await user.click(within(main).getByRole('button', { name: 'הבא' }));
    expect(within(main).getByRole('status')).toHaveTextContent('0 מתוך 1 נכונות');
    expect(within(main).getByRole('link', { name: target.title })).toBeInTheDocument();
  });

  it('selecting a wrong option on a never-reviewed topic does not create an SRS card (it is already maximally due)', async () => {
    const target = topicsData[0];
    isolateOneTopic(target);
    const user = userEvent.setup();
    renderPage();
    await selectComboboxOption(user, 'מצב למידה', STATUS_LABELS.new);
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    const main = screen.getByRole('main');
    const wrongOption = within(main)
      .getAllByRole('button')
      .find((btn) => btn.textContent !== target.title)!;
    await user.click(wrongOption);

    expect(useUserDataStore.getState().srsCards.has(target.id)).toBe(false);

    await user.click(within(main).getByRole('button', { name: 'הבא' }));
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

    await selectComboboxOption(user, 'מצב למידה', STATUS_LABELS.new);
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    expect(within(screen.getByRole('main')).getByText('1 מתוך 1')).toBeInTheDocument();
  });

  it('selects via number keys 1-4 and advances via Enter', async () => {
    const target = topicsData[0];
    isolateOneTopic(target);
    const user = userEvent.setup();
    renderPage();
    await selectComboboxOption(user, 'מצב למידה', STATUS_LABELS.new);
    await user.click(screen.getByRole('button', { name: 'התחל מבחן' }));

    await user.keyboard('1');
    // Whichever option key "1" selected — correct or one of the shuffled
    // wrong ones — an answer was locked in, so "הבא" must appear either way.
    expect(within(screen.getByRole('main')).getByRole('button', { name: 'הבא' })).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(within(screen.getByRole('main')).getByRole('status')).toBeInTheDocument();
  });
});
