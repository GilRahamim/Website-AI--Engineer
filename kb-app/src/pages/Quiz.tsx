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
