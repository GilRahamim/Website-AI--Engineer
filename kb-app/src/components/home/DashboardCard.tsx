import { Link } from 'react-router-dom';
import { BookOpen, ChevronLeft, Shuffle } from 'lucide-react';
import type { Topic } from '../../types';

interface DashboardCardProps {
  masteredCount: number;
  learningCount: number;
  totalCount: number;
  dueCount: number;
  newCount: number;
  reviewedCount: number;
  randomTopic: Topic;
  continueTopic: Topic | null;
  /** Kicker above the continue tile, e.g. "המשך קריאה" or "התחל כאן". */
  continueLabel?: string;
}

const RING_SIZE = 64;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ value, max }: { value: number; max: number }) {
  const fraction = max > 0 ? value / max : 0;
  const percent = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label="התקדמות כללית"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="relative grid size-16 shrink-0 place-items-center"
    >
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--kb-accent-soft)"
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--kb-accent)"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </svg>
      <span className="absolute text-[13px] font-bold text-[var(--kb-text)]">{`${percent}%`}</span>
    </div>
  );
}

const tileClass =
  'flex flex-col gap-3 rounded-2xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 shadow-[var(--kb-shadow-sm)]';

/**
 * The learning dashboard at the top of Home — replaces the hero stats and the
 * daily-review card: overall progress, what's due, and where to pick up.
 */
export default function DashboardCard({
  masteredCount,
  learningCount,
  totalCount,
  dueCount,
  newCount,
  reviewedCount,
  randomTopic,
  continueTopic,
  continueLabel = 'המשך קריאה',
}: DashboardCardProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3 md:gap-4">
      <div className={tileClass}>
        <div className="flex items-center gap-4">
          <ProgressRing value={masteredCount} max={totalCount} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium text-[var(--kb-muted)]">ההתקדמות שלי</span>
            <span className="text-base font-bold text-[var(--kb-text)]">{`${masteredCount} מתוך ${totalCount} נושאים נשלטו`}</span>
            <span className="text-xs text-[var(--kb-muted)]">{`${learningCount} בלמידה · ${newCount} נושאים חדשים`}</span>
          </div>
        </div>
      </div>

      <div className={tileClass}>
        <span className="text-xs font-medium text-[var(--kb-muted)]">חזרה מרווחת</span>
        <span className="text-base font-bold text-[var(--kb-text)]">
          {dueCount > 0 ? `${dueCount} כרטיסים לחזרה היום` : 'הכול מעודכן להיום'}
        </span>
        <span className="text-xs text-[var(--kb-muted)]">{`נסקרו עד כה ${reviewedCount} כרטיסים`}</span>
        <div className="mt-auto flex flex-wrap gap-2">
          <Link
            to="/flashcards"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] bg-[var(--kb-accent)] px-4 text-sm font-semibold text-white no-underline hover:opacity-90"
          >
            {dueCount > 0 ? `התחל חזרה · ${dueCount} ממתינים` : 'אין כרטיסים לחזרה היום · פתח כרטיסיות'}
          </Link>
          <Link
            to={`/topic/${encodeURIComponent(randomTopic.id)}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-[var(--kb-border)] bg-[var(--kb-surface)] px-4 text-sm font-semibold text-[var(--kb-text)] no-underline hover:bg-[var(--kb-surface2)]"
          >
            <Shuffle aria-hidden="true" size={16} />
            {`מושג אקראי: ${randomTopic.title}`}
          </Link>
        </div>
      </div>

      {continueTopic && (
        <Link
          to={`/topic/${encodeURIComponent(continueTopic.id)}`}
          className={`${tileClass} justify-between no-underline hover:border-[var(--kb-border-strong)] hover:bg-[var(--kb-surface2)]`}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--kb-accent-soft)] text-[var(--kb-accent)]">
              <BookOpen aria-hidden="true" size={18} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-medium text-[var(--kb-muted)]">{continueLabel}</span>
              <span className="truncate text-base font-bold text-[var(--kb-text)]">{continueTopic.title}</span>
            </div>
            <ChevronLeft aria-hidden="true" size={18} className="ms-auto shrink-0 text-[var(--kb-muted)]" />
          </div>
          <span className="text-xs text-[var(--kb-muted)]">{continueTopic.module_label}</span>
        </Link>
      )}
    </div>
  );
}
