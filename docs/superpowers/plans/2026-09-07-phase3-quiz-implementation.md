# Phase 3, Sub-project #4 — Quiz Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user take a filterable, auto-generated multiple-choice quiz — "which concept does this definition belong to?" — with same-category distractors, immediate feedback, a score summary, and wrong answers automatically marked for spaced-repetition review.

**Architecture:** A pure `src/lib/quiz.ts` generates questions from existing `Topic` data (no new storage, no new state — wrong answers write through the existing `gradeCard` action from sub-project #3); a new `Quiz` page with setup/session/summary phases, deliberately structured so its session is only ever built inside a button-click handler, never a mount-time snapshot; `Header` gains a second nav link.

**Tech Stack:** React 19, TypeScript, Zustand (existing `userDataStore`), Vitest + Testing Library, `react-router-dom`.

**Spec:** `docs/superpowers/specs/2026-09-07-phase3-quiz-design.md`

## Global Constraints

- `src/lib/quiz.ts` is pure: no store or IndexedDB import.
- Distractors are drawn from **all 160 topics**, never just the user's filtered question pool — every category has at least 8 topics (verified: formulas 8, metrics 13, architectures 25, algorithms 45, concepts 69), so this always yields enough same-category distractors.
- A wrong answer calls the existing `useUserDataStore.getState().gradeCard(topicId, 'again')` — reusing sub-project #3's SM-2 machinery exactly. A correct answer calls nothing; a topic's SRS schedule is untouched on a correct answer.
- **Hydration safety (binding on `Quiz.tsx`):** nothing may read `userDataStore` into local component state via a `useState` lazy initializer, `useMemo`, or on mount. The quiz session is built only inside the "התחל מבחן" button's `onClick` handler. This is what makes sub-projects #2/#3's async-hydration hazard class structurally unreachable here — do not introduce a lazy-initializer-built session under any circumstance.
- No due-only filter for quiz (out of scope — quiz tests broad knowledge, not spaced review).
- RTL, both themes, keyboard operability, `focus-visible`, `--kb-*` tokens only apply to every new UI element.

---

## Task 1: `src/lib/quiz.ts` — pure question generation

**Files:**
- Create: `kb-app/src/lib/quiz.ts`
- Test: `kb-app/src/lib/quiz.test.ts`

**Interfaces:**
- Produces: `QuizQuestion { topicId: string; definition: string; options: string[]; correctTitle: string }`, `buildDistractors(topic: Topic, allTopics: Topic[], count: number): Topic[]`, `buildQuestion(topic: Topic, allTopics: Topic[]): QuizQuestion`, `buildQuiz(candidates: Topic[], allTopics: Topic[], count: number): QuizQuestion[]`.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/lib/quiz.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildDistractors, buildQuestion, buildQuiz } from './quiz';
import type { Topic } from '../types';

function topic(overrides: Partial<Topic>): Topic {
  return {
    id: 'id',
    module: 'm',
    module_label: 'M',
    category: 'concepts',
    category_label: 'C',
    num: 1,
    slug_name: 'slug',
    title: 'Title',
    definition: 'Definition',
    related_raw: [],
    related_match: [],
    contentPath: '/x.html',
    ...overrides,
  };
}

const allTopics: Topic[] = [
  topic({ id: 'a', category: 'concepts', title: 'A' }),
  topic({ id: 'b', category: 'concepts', title: 'B' }),
  topic({ id: 'c', category: 'concepts', title: 'C' }),
  topic({ id: 'd', category: 'concepts', title: 'D' }),
  topic({ id: 'e', category: 'algorithms', title: 'E' }),
];

describe('buildDistractors', () => {
  it('picks the requested count from the same category, excluding the topic itself', () => {
    const target = allTopics[0]; // 'a', concepts
    const distractors = buildDistractors(target, allTopics, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors.every((t) => t.category === 'concepts')).toBe(true);
    expect(distractors.some((t) => t.id === 'a')).toBe(false);
  });

  it('never includes duplicate topics', () => {
    const target = allTopics[0];
    const distractors = buildDistractors(target, allTopics, 3);
    const ids = distractors.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns fewer than requested if the category does not have enough other topics', () => {
    const target = allTopics[4]; // 'e', algorithms — the only topic in that category here
    const distractors = buildDistractors(target, allTopics, 3);
    expect(distractors).toHaveLength(0);
  });
});

describe('buildQuestion', () => {
  it('includes the correct title exactly once among 4 options', () => {
    const target = allTopics[0];
    const question = buildQuestion(target, allTopics);
    expect(question.topicId).toBe('a');
    expect(question.definition).toBe(target.definition);
    expect(question.correctTitle).toBe('A');
    expect(question.options).toHaveLength(4);
    expect(question.options.filter((o) => o === 'A')).toHaveLength(1);
    expect(new Set(question.options).size).toBe(4);
  });
});

describe('buildQuiz', () => {
  it('builds one question per candidate, up to the requested count', () => {
    const questions = buildQuiz(allTopics, allTopics, 3);
    expect(questions).toHaveLength(3);
    const ids = questions.map((q) => q.topicId);
    expect(new Set(ids).size).toBe(3);
  });

  it('clamps to the candidate pool size when count exceeds it', () => {
    const questions = buildQuiz(allTopics, allTopics, 100);
    expect(questions).toHaveLength(allTopics.length);
  });

  it('returns an empty array for an empty candidate pool', () => {
    expect(buildQuiz([], allTopics, 5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- quiz.test.ts`
Expected: FAIL — `./quiz` does not exist.

- [ ] **Step 3: Implement `quiz.ts`**

Create `kb-app/src/lib/quiz.ts`:

```ts
import type { Topic } from '../types';

export interface QuizQuestion {
  topicId: string;
  definition: string;
  options: string[];
  correctTitle: string;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildDistractors(topic: Topic, allTopics: Topic[], count: number): Topic[] {
  const sameCategory = allTopics.filter((t) => t.category === topic.category && t.id !== topic.id);
  return shuffle(sameCategory).slice(0, count);
}

export function buildQuestion(topic: Topic, allTopics: Topic[]): QuizQuestion {
  const distractors = buildDistractors(topic, allTopics, 3);
  const options = shuffle([topic.title, ...distractors.map((t) => t.title)]);
  return { topicId: topic.id, definition: topic.definition, options, correctTitle: topic.title };
}

export function buildQuiz(candidates: Topic[], allTopics: Topic[], count: number): QuizQuestion[] {
  const chosen = shuffle(candidates).slice(0, Math.min(count, candidates.length));
  return chosen.map((topic) => buildQuestion(topic, allTopics));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- quiz.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/lib/quiz.ts src/lib/quiz.test.ts
git commit -m "feat: add pure quiz question generation (distractors, questions, quiz builder)"
```

---

## Task 2: `Header` — Quiz nav link

**Files:**
- Modify: `kb-app/src/components/layout/Header.tsx`
- Modify: `kb-app/src/components/layout/Header.test.tsx`

**Interfaces:**
- Produces: a persistent `<Link to="/quiz">` in `Header`, no due-count-style badge.

- [ ] **Step 1: Write the failing test**

In `kb-app/src/components/layout/Header.test.tsx`, add a new test (anywhere after the existing "renders a link to the Flashcards page" test):

```tsx
  it('renders a link to the Quiz page', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: 'מבחן' })).toHaveAttribute('href', '/quiz');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kb-app && npm run test -- Header.test.tsx`
Expected: FAIL — no link named "מבחן".

- [ ] **Step 3: Add the nav link**

In `kb-app/src/components/layout/Header.tsx`, add a second `<Link>` right after the existing `/flashcards` one (still inside the same `<div className="flex items-center gap-3">`, before `<ThemeToggle />`):

```tsx
        <Link
          to="/quiz"
          className="flex min-h-11 items-center rounded-md px-3 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
        >
          מבחן
        </Link>
```

No other change to the file — the existing `/flashcards` `<Link>` (including its due-count badge) and everything else stays exactly as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd kb-app && npm run test -- Header.test.tsx`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Typecheck and lint**

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd kb-app
git add src/components/layout/Header.tsx src/components/layout/Header.test.tsx
git commit -m "feat: add Quiz nav link to Header"
```

---

## Task 3: `Quiz` page + routing

**Files:**
- Create: `kb-app/src/pages/Quiz.tsx`
- Create: `kb-app/src/pages/Quiz.test.tsx`
- Modify: `kb-app/src/App.tsx`
- Modify: `kb-app/src/App.test.tsx`

**Interfaces:**
- Consumes: `buildQuiz`, `QuizQuestion` from `../lib/quiz` (Task 1); `userDataStore.gradeCard(topicId, rating)`, `userDataStore.progress` (existing); `ALL_STATUSES`, `STATUS_LABELS` from `../lib/progressStatus` (existing).
- Produces: `Quiz` default export, mounted at route `/quiz`.

This is the final task — Step 8 below is the full-suite verification gate.

- [ ] **Step 1: Write the failing tests**

Create `kb-app/src/pages/Quiz.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Quiz from './Quiz';
import { useUserDataStore } from '../store/userDataStore';
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
  const progress = new Map(topicsData.map((t) => [t.id, 'mastered' as const]));
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kb-app && npm run test -- Quiz.test.tsx`
Expected: FAIL — `./Quiz` does not exist.

- [ ] **Step 3: Implement `Quiz.tsx`**

Create `kb-app/src/pages/Quiz.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { ModulesMap, ProgressStatus, Topic } from '../types';
import { buildQuiz, type QuizQuestion } from '../lib/quiz';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const topicsById = new Map(topics.map((t) => [t.id, t]));
const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((t) => [t.category, t.category_label]),
);

const QUESTION_COUNT_OPTIONS = [5, 10, 20] as const;

export default function Quiz() {
  const gradeCard = useUserDataStore((s) => s.gradeCard);

  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<ProgressStatus | 'all'>('all');
  const [questionCount, setQuestionCount] = useState<number | 'all'>(10);

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missedTopicIds, setMissedTopicIds] = useState<string[]>([]);

  // Pure — no Date.now()/Math.random() inside, only a plain getState() read
  // and filtering a static array — so it's safe to call directly during
  // render (e.g. for the live pool-size display on the setup screen).
  function filteredCandidates(): Topic[] {
    let candidates = topics;
    if (selectedModule !== 'all') candidates = candidates.filter((t) => t.module === selectedModule);
    if (selectedCategory !== 'all') candidates = candidates.filter((t) => t.category === selectedCategory);
    if (selectedStatus !== 'all') {
      const progress = useUserDataStore.getState().progress;
      candidates = candidates.filter((t) => (progress.get(t.id) ?? 'new') === selectedStatus);
    }
    return candidates;
  }

  // Reads userDataStore ONLY here, inside a real click handler — never in a
  // useState lazy initializer, useMemo, or on mount. loadUserData()'s
  // IndexedDB read always resolves in milliseconds, long before a human
  // reads the setup screen and clicks start, so this is structurally
  // immune to the async-hydration hazard that hit sub-projects #2 and #3
  // (a snapshot frozen into state before the store finished loading).
  function handleStart() {
    const candidates = filteredCandidates();
    const count = questionCount === 'all' ? candidates.length : Math.min(questionCount, candidates.length);
    setQuestions(buildQuiz(candidates, topics, count));
    setCurrentIndex(0);
    setAnsweredIndex(null);
    setCorrectCount(0);
    setMissedTopicIds([]);
  }

  const handleAnswer = useCallback(
    (index: number) => {
      if (answeredIndex !== null || !questions) return;
      const question = questions[currentIndex];
      setAnsweredIndex(index);
      if (question.options[index] === question.correctTitle) {
        setCorrectCount((n) => n + 1);
      } else {
        gradeCard(question.topicId, 'again');
        setMissedTopicIds((ids) => [...ids, question.topicId]);
      }
    },
    [answeredIndex, questions, currentIndex, gradeCard],
  );

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => i + 1);
    setAnsweredIndex(null);
  }, []);

  const currentQuestion = questions ? questions[currentIndex] : null;
  const quizDone = questions !== null && currentIndex >= questions.length;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isTyping =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement;
      if (isTyping || !currentQuestion || quizDone) return;

      if (answeredIndex === null) {
        const index = ['1', '2', '3', '4'].indexOf(event.key);
        if (index !== -1 && index < currentQuestion.options.length) {
          event.preventDefault();
          handleAnswer(index);
        }
      } else if (event.key === 'Enter' || event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, quizDone, answeredIndex, handleAnswer, handleNext]);

  const firstOptionRef = useRef<HTMLButtonElement>(null);

  // Moves focus to the first option whenever a new question appears — same
  // rationale as Flashcards.tsx's focus-follow effect: without it, focus
  // silently falls to document.body after each "הבא" click.
  useEffect(() => {
    firstOptionRef.current?.focus();
  }, [currentIndex]);

  if (questions === null) {
    const pool = filteredCandidates();
    return (
      <>
        <Header />
        <main className="mx-auto max-w-xl p-4">
          <h1 className="mb-4 text-xl font-bold text-[var(--kb-text)]">מבחן</h1>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label className="flex flex-col text-sm text-[var(--kb-text)]">
              מודול
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
              >
                <option value="all">הכול</option>
                {Object.entries(modules).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm text-[var(--kb-text)]">
              קטגוריה
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
              >
                <option value="all">הכול</option>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm text-[var(--kb-text)]">
              מצב למידה
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as ProgressStatus | 'all')}
                className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
              >
                <option value="all">הכול</option>
                {ALL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm text-[var(--kb-text)]">
              מספר שאלות
              <select
                value={String(questionCount)}
                onChange={(e) => setQuestionCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
              >
                {QUESTION_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="all">{`הכול (${pool.length})`}</option>
              </select>
            </label>
          </div>
          <p className="mb-4 text-sm text-[var(--kb-muted)]">{`${pool.length} נושאים תואמים`}</p>
          <button
            type="button"
            onClick={handleStart}
            disabled={pool.length === 0}
            className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-4 text-[var(--kb-text)] disabled:opacity-50"
          >
            התחל מבחן
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl p-4">
        <h1 className="mb-4 text-xl font-bold text-[var(--kb-text)]">מבחן</h1>
        {quizDone ? (
          <div
            role="status"
            className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-6 text-center shadow-[var(--kb-shadow-sm)]"
          >
            <p className="mb-4 text-lg font-bold text-[var(--kb-text)]">{`סיימת! ${correctCount} מתוך ${questions.length} נכונות`}</p>
            {missedTopicIds.length > 0 && (
              <div className="text-start">
                <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">נושאים שכדאי לחזור עליהם:</h2>
                <ul className="flex flex-col gap-1">
                  {missedTopicIds.map((id) => {
                    const missedTopic = topicsById.get(id);
                    if (!missedTopic) return null;
                    return (
                      <li key={id}>
                        <Link to={`/topic/${encodeURIComponent(id)}`} className="text-[var(--kb-accent)] underline">
                          {missedTopic.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : (
          currentQuestion && (
            <div
              aria-live="polite"
              className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-6 text-center shadow-[var(--kb-shadow-sm)]"
            >
              <p className="mb-1 text-sm text-[var(--kb-muted)]">{`${currentIndex + 1} מתוך ${questions.length}`}</p>
              <p className="mb-4 text-[var(--kb-text)]">{currentQuestion.definition}</p>
              <div className="flex flex-col gap-2">
                {currentQuestion.options.map((option, index) => {
                  const isAnswered = answeredIndex !== null;
                  const isCorrectOption = option === currentQuestion.correctTitle;
                  const isChosen = answeredIndex === index;
                  const stateClass = !isAnswered
                    ? 'hover:bg-[var(--kb-surface2)]'
                    : isCorrectOption
                      ? 'bg-[var(--kb-accent-soft)] border-[var(--kb-accent)]'
                      : isChosen
                        ? 'bg-[var(--kb-surface2)] border-[var(--kb-border-strong)]'
                        : '';
                  return (
                    <button
                      key={option}
                      ref={index === 0 ? firstOptionRef : undefined}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handleAnswer(index)}
                      aria-pressed={isChosen}
                      className={`min-h-11 rounded-md border border-[var(--kb-border)] px-4 py-2 text-[var(--kb-text)] ${stateClass}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {answeredIndex !== null && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="mt-4 min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-4 text-[var(--kb-text)]"
                >
                  הבא
                </button>
              )}
            </div>
          )
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 4: Wire the route in `App.tsx`**

In `kb-app/src/App.tsx`, add the import and route (the file currently ends with the `/flashcards` route and its explanatory comment — leave that untouched, only add the new import line and the new `<Route>`):

```tsx
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import Flashcards from './pages/Flashcards';
import Quiz from './pages/Quiz';
import { useUserDataStore } from './store/userDataStore';

export default function App() {
  const isLoaded = useUserDataStore((s) => s.isLoaded);

  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/topic/:id" element={<Reader />} />
      {/* Flashcards' initial session queue is built once via a useState lazy
          initializer that reads userDataStore synchronously at first render
          — before loadUserData() has necessarily resolved. Keying on
          isLoaded forces a remount the moment hydration completes, so the
          lazy initializer re-runs against the now-correct data instead of
          silently keeping a queue built from an empty pre-hydration
          snapshot. When isLoaded is already true at mount (the common case
          — navigating here after the app already loaded), the key never
          changes, so no extra remount happens. */}
      <Route path="/flashcards" element={<Flashcards key={String(isLoaded)} />} />
      {/* Quiz never reads userDataStore into local state until the user
          clicks "התחל מבחן" — by which point loadUserData() has always
          resolved (an IndexedDB read finishes in milliseconds, long before
          a human reads the setup screen and clicks). Unlike Flashcards, no
          key/remount trick is needed here. */}
      <Route path="/quiz" element={<Quiz />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Add the routing test**

In `kb-app/src/App.test.tsx`, add a new test at the end of `describe('App', ...)`:

```tsx
  it('renders the Quiz page at "/quiz"', () => {
    render(
      <MemoryRouter initialEntries={['/quiz']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'מבחן' })).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd kb-app && npm run test -- Quiz.test.tsx App.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 7: Run the full test suite and typecheck/lint**

Run: `cd kb-app && npm run test`
Expected: PASS, every test file in the project (no regressions to Phase 2 or Phase 3 sub-projects #1-#3).

Run: `cd kb-app && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 8: Full-suite verification gate**

```bash
cd kb-app
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: everything green.

- [ ] **Step 9: Commit**

```bash
cd kb-app
git add src/pages/Quiz.tsx src/pages/Quiz.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add Quiz page with setup/session/summary flow and routing"
```

---

## Critical files
- `kb-app/src/lib/quiz.ts`
- `kb-app/src/pages/Quiz.tsx`
- `kb-app/src/components/layout/Header.tsx`
- `kb-app/src/App.tsx`

## Verification (end-to-end, after Task 3)
1. `npm run typecheck && npm run lint && npm run test && npm run build` all green.
2. `npm run dev` — manually confirm: setting filters narrows the "X נושאים תואמים" count and the resulting quiz; starting a quiz shows one definition-based question at a time with 4 same-category-plausible options; a wrong answer highlights both the chosen (wrong) and correct options, and the topic reappears sooner in Flashcards/Daily Review afterward; a correct answer leaves that topic's SRS schedule untouched; the summary shows the right score and links to every missed topic; the count selector's "all" option reflects the live filtered pool size.
3. Repeat in dark theme and RTL (already default) — full keyboard-only session: Tab through filters, click/Enter start, 1-4 to answer, Enter/→ to advance, through to the summary.
4. No regressions to sub-projects #1-#3 (progress/favorites/recents/notes/flashcards/SRS/daily-review).

## Repo convention note
This repo tracks implementation via `.superpowers/sdd/<plan-name>/progress.md` (one task = one commit, reviewed before moving on) and task briefs under the same directory. Once this plan is approved, follow that existing convention for execution.
