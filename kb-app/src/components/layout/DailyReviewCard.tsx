import { Link } from 'react-router-dom';
import type { Topic } from '../../types';

interface DailyReviewCardProps {
  dueCount: number;
  randomTopic: Topic;
}

export default function DailyReviewCard({ dueCount, randomTopic }: DailyReviewCardProps) {
  return (
    <div className="mx-4 mb-6 rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 shadow-[var(--kb-shadow-sm)] md:mx-auto md:max-w-2xl">
      <h2 className="mb-2 text-sm font-bold text-[var(--kb-muted)]">היום ללמידה</h2>
      <p className="mb-3 text-[var(--kb-text)]">{`${dueCount} ממתינים היום`}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/flashcards"
          className="min-h-11 rounded-md border border-[var(--kb-border)] px-3 py-2 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
        >
          התחל חזרה
        </Link>
        <Link
          to={`/topic/${encodeURIComponent(randomTopic.id)}`}
          className="flex min-h-11 items-center px-3 py-2 text-sm text-[var(--kb-accent)] underline"
        >
          {`מושג אקראי: ${randomTopic.title}`}
        </Link>
      </div>
    </div>
  );
}
