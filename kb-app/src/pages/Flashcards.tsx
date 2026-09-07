import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { ModulesMap, ProgressStatus, SrsRating, Topic } from '../types';
import { isDue } from '../lib/srs';
import { ALL_STATUSES, STATUS_LABELS } from '../lib/progressStatus';
import { buildCategoryLabels } from '../lib/categoryLabels';
import { useUserDataStore } from '../store/userDataStore';
import Header from '../components/layout/Header';
import TopicFilters from '../components/browse/TopicFilters';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const topicsById = new Map(topics.map((t) => [t.id, t]));
const categoryLabels = buildCategoryLabels(topics);

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Builds one session queue snapshot for a given filter combination.
// progress/srsCards are read imperatively via getState() (a plain function
// call, not a reactive hook value) rather than passed in as reactive state,
// so a card graded mid-session never causes a rebuild — a queue is only
// ever (re)built by calling this function, and that only happens at mount
// (the queue's lazy initializer) and from a filter's onChange handler.
// Both call sites are ones where react-hooks/purity allows non-deterministic
// calls (Date.now/Math.random, here via shuffle); a plain useEffect keyed on
// the filters would additionally trip react-hooks/set-state-in-effect for
// the setState calls that must follow the rebuild.
function buildQueue(
  selectedModule: string,
  selectedCategory: string,
  selectedStatus: ProgressStatus | 'all',
  dueOnly: boolean,
): string[] {
  const now = Date.now();
  let candidates = topics;
  if (selectedModule !== 'all') candidates = candidates.filter((t) => t.module === selectedModule);
  if (selectedCategory !== 'all') candidates = candidates.filter((t) => t.category === selectedCategory);
  if (selectedStatus !== 'all') {
    const liveProgress = useUserDataStore.getState().progress;
    candidates = candidates.filter((t) => (liveProgress.get(t.id) ?? 'new') === selectedStatus);
  }
  if (dueOnly) {
    const liveSrsCards = useUserDataStore.getState().srsCards;
    candidates = candidates.filter((t) => isDue(liveSrsCards.get(t.id), now));
  }
  return shuffle(candidates.map((t) => t.id));
}

export default function Flashcards() {
  const gradeCard = useUserDataStore((s) => s.gradeCard);

  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<ProgressStatus | 'all'>('all');
  const [dueOnly, setDueOnly] = useState(true);

  const [queue, setQueue] = useState<string[]>(() => buildQueue('all', 'all', 'all', true));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  function resetSession(nextQueue: string[]) {
    setQueue(nextQueue);
    setCurrentIndex(0);
    setRevealed(false);
    setReviewedCount(0);
  }

  function handleModuleChange(value: string) {
    setSelectedModule(value);
    resetSession(buildQueue(value, selectedCategory, selectedStatus, dueOnly));
  }
  function handleCategoryChange(value: string) {
    setSelectedCategory(value);
    resetSession(buildQueue(selectedModule, value, selectedStatus, dueOnly));
  }
  function handleStatusChange(value: ProgressStatus | 'all') {
    setSelectedStatus(value);
    resetSession(buildQueue(selectedModule, selectedCategory, value, dueOnly));
  }
  function handleDueOnlyChange(value: boolean) {
    setDueOnly(value);
    resetSession(buildQueue(selectedModule, selectedCategory, selectedStatus, value));
  }

  const currentTopicId = queue[currentIndex];
  const currentTopic = currentTopicId ? topicsById.get(currentTopicId) : undefined;
  const queueEmpty = queue.length === 0;
  const sessionDone = !queueEmpty && currentIndex >= queue.length;

  // useCallback (rather than a plain function redefined each render) gives
  // this a stable identity across renders when its own dependencies
  // (currentTopicId, gradeCard) haven't changed, so it can be listed
  // truthfully in the keydown effect's dependency array below instead of
  // that effect having to omit it (react-hooks/exhaustive-deps).
  const handleRate = useCallback(
    (rating: SrsRating) => {
      if (!currentTopicId) return;
      gradeCard(currentTopicId, rating);
      setReviewedCount((n) => n + 1);
      setCurrentIndex((i) => i + 1);
      setRevealed(false);
    },
    [currentTopicId, gradeCard],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isTyping =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement;
      if (isTyping || !currentTopic) return;

      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const ratingByKey: Record<string, SrsRating> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
        const rating = ratingByKey[event.key];
        if (rating) {
          event.preventDefault();
          handleRate(rating);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [revealed, currentTopic, currentTopicId, handleRate]);

  const revealButtonRef = useRef<HTMLButtonElement>(null);

  // Moves focus to the new card's reveal control whenever the current card
  // changes (after grading advances the queue, or a filter change resets
  // the session) — otherwise focus silently falls to document.body and a
  // keyboard/screen-reader user has no landing point on the new card.
  useEffect(() => {
    revealButtonRef.current?.focus();
  }, [currentTopicId]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl p-4">
        <h1 className="mb-4 text-xl font-bold text-[var(--kb-text)]">כרטיסיות</h1>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <TopicFilters
            modules={modules}
            categoryLabels={categoryLabels}
            selectedModule={selectedModule}
            selectedCategory={selectedCategory}
            onModuleChange={handleModuleChange}
            onCategoryChange={handleCategoryChange}
          />
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            מצב למידה
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value as ProgressStatus | 'all')}
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
          <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--kb-text)]">
            <input type="checkbox" checked={dueOnly} onChange={(e) => handleDueOnlyChange(e.target.checked)} />
            רק כרטיסים לחזרה היום
          </label>
        </div>

        {queueEmpty && (
          <p role="status" className="text-[var(--kb-muted)]">
            אין כרטיסים לחזרה.
          </p>
        )}

        {!queueEmpty && sessionDone && (
          <p role="status" className="text-[var(--kb-text)]">{`סיימת! ${reviewedCount} כרטיסים נסקרו.`}</p>
        )}

        {currentTopic && (
          <div
            aria-live="polite"
            className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-6 text-center shadow-[var(--kb-shadow-sm)]"
          >
            <p className="mb-1 text-sm text-[var(--kb-muted)]">{`${currentIndex + 1} מתוך ${queue.length}`}</p>
            <h2 className="mb-4 text-xl font-bold text-[var(--kb-text)]">{currentTopic.title}</h2>
            {!revealed ? (
              <button
                ref={revealButtonRef}
                type="button"
                onClick={() => setRevealed(true)}
                className="min-h-11 rounded-md border border-[var(--kb-border)] px-4 text-[var(--kb-text)]"
              >
                לחץ לחשיפה
              </button>
            ) : (
              <>
                <p className="mb-4 text-[var(--kb-text2)]">{currentTopic.definition}</p>
                <Link
                  to={`/topic/${encodeURIComponent(currentTopic.id)}`}
                  className="mb-4 inline-block text-sm text-[var(--kb-accent)] underline"
                >
                  פתח את הנושא המלא
                </Link>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRate('again')}
                    className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    שוב
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('hard')}
                    className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    קשה
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('good')}
                    className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    טוב
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('easy')}
                    className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
                  >
                    קל
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
