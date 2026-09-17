import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import type { ProgressStatus, Topic } from '../types';
import { buildQuiz, type QuizQuestion } from '../lib/quiz';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { categoryLabels, modules, topics, topicsById } from '../lib/catalog';
import { useUserDataStore } from '../store/userDataStore';
import { usePageTitle } from '../hooks/usePageTitle';
import Header from '../components/layout/Header';
import TopicFilters from '../components/browse/TopicFilters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const QUESTION_COUNT_OPTIONS = [5, 10, 20] as const;

export default function Quiz() {
  usePageTitle('מבחן');
  const gradeCard = useUserDataStore((s) => s.gradeCard);
  const location = useLocation();

  // The learning-path "module complete" nudge (FinishTopicAction) links
  // here with `state: { module }` to pre-filter the quiz to what was just
  // finished — falls back to "all" for every other, ordinary way in.
  const [selectedModule, setSelectedModule] = useState(() => {
    const presetModule = (location.state as { module?: string } | null)?.module;
    return presetModule && presetModule in modules ? presetModule : 'all';
  });
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
        // A topic with no existing SrsCard is already maximally due
        // (isDue() treats a missing card as due now) — grading it 'again'
        // would set dueAt to tomorrow, which is LATER than "now" and would
        // silently pull a never-reviewed topic OUT of today's due queue
        // instead of flagging it. Only re-grade a topic that's already on
        // a real schedule; a never-reviewed miss still gets listed in the
        // summary below, just without touching the (nonexistent) schedule.
        if (useUserDataStore.getState().srsCards.has(question.topicId)) {
          gradeCard(question.topicId, 'again');
        }
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
      } else if (event.key === 'Enter' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
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
  }, [currentIndex, questions]);

  if (questions === null) {
    const pool = filteredCandidates();
    return (
      <>
        <Header />
        <main className="mx-auto max-w-xl p-4">
          <h1 className="mb-4 text-xl font-bold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">מבחן</h1>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <TopicFilters
              modules={modules}
              categoryLabels={categoryLabels}
              selectedModule={selectedModule}
              selectedCategory={selectedCategory}
              onModuleChange={setSelectedModule}
              onCategoryChange={setSelectedCategory}
            />
            <div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
              <Label htmlFor="quiz-status">מצב למידה</Label>
              <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as ProgressStatus | 'all')}>
                <SelectTrigger id="quiz-status" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכול</SelectItem>
                  {ALL_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
              <Label htmlFor="quiz-question-count">מספר שאלות</Label>
              <Select
                value={String(questionCount)}
                onValueChange={(value) => setQuestionCount(value === 'all' ? 'all' : Number(value))}
              >
                <SelectTrigger id="quiz-question-count" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_COUNT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                  <SelectItem value="all">{`הכול (${pool.length})`}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mb-4 text-sm text-[var(--kb-muted)]">{`${pool.length} נושאים תואמים`}</p>
          <Button type="button" onClick={handleStart} disabled={pool.length === 0} className="min-h-11">
            התחל מבחן
          </Button>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl p-4">
        <h1 className="mb-4 text-xl font-bold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">מבחן</h1>
        {quizDone ? (
          <div
            role="status"
            className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-6 text-center shadow-[var(--kb-shadow-sm)]"
          >
            <p className="mb-4 text-lg font-bold text-[var(--kb-text)]">{`סיימת! ${correctCount} מתוך ${questions.length} נכונות`}</p>
            <Button type="button" onClick={() => setQuestions(null)} className="mb-4 min-h-11">
              מבחן חדש
            </Button>
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
              {answeredIndex !== null && (
                <p className="mb-2 font-bold text-[var(--kb-text)]">
                  {currentQuestion.options[answeredIndex] === currentQuestion.correctTitle
                    ? 'נכון!'
                    : `לא נכון — התשובה הנכונה: ${currentQuestion.correctTitle}`}
                </p>
              )}
              <div className="flex flex-col gap-2">
                {currentQuestion.options.map((option, index) => {
                  const isAnswered = answeredIndex !== null;
                  const isCorrectOption = option === currentQuestion.correctTitle;
                  const isChosen = answeredIndex === index;
                  const stateClass = !isAnswered
                    ? 'hover:bg-[var(--kb-surface2)]'
                    : isCorrectOption
                      ? 'bg-[var(--kb-accent-soft)] border-[var(--kb-accent)] font-semibold'
                      : isChosen
                        ? 'bg-[var(--kb-surface2)] border-[var(--kb-border-strong)] line-through'
                        : 'opacity-60';
                  return (
                    <Button
                      key={option}
                      ref={index === 0 ? firstOptionRef : undefined}
                      type="button"
                      variant="outline"
                      disabled={isAnswered}
                      onClick={() => handleAnswer(index)}
                      aria-pressed={isChosen}
                      className={`flex h-auto min-h-11 items-center justify-between gap-3 whitespace-normal px-4 py-2 text-start disabled:opacity-100 ${stateClass}`}
                    >
                      <span className="min-w-0 flex-1">{option}</span>
                      {isAnswered && isCorrectOption && (
                        <Check aria-hidden="true" size={18} className="shrink-0 text-[var(--kb-accent)]" />
                      )}
                      {isAnswered && isChosen && !isCorrectOption && (
                        <X aria-hidden="true" size={18} className="shrink-0 text-[var(--kb-muted)]" />
                      )}
                    </Button>
                  );
                })}
              </div>
              {answeredIndex !== null && (
                <Button type="button" onClick={handleNext} className="mt-4 min-h-11">
                  הבא
                </Button>
              )}
            </div>
          )
        )}
      </main>
    </>
  );
}
