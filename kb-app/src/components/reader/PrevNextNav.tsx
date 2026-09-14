import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Topic } from '../../types';

interface PrevNextNavProps {
  prev: Topic | null;
  next: Topic | null;
}

const cardClass =
  'flex min-h-16 flex-1 items-center gap-3 rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] px-4 py-3 text-[var(--kb-text)] no-underline hover:border-[var(--kb-border-strong)] hover:bg-[var(--kb-surface2)]';

export default function PrevNextNav({ prev, next }: PrevNextNavProps) {
  if (!prev && !next) return null;

  return (
    <nav aria-label="ניווט בין נושאים" className="mt-10 flex flex-col gap-3 sm:flex-row">
      {prev ? (
        <Link to={`/topic/${encodeURIComponent(prev.id)}`} className={cardClass}>
          <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-[var(--kb-accent)]" />
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-medium text-[var(--kb-muted)]">הקודם</span>
            <span className="truncate text-sm font-semibold">{prev.title}</span>
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <Link to={`/topic/${encodeURIComponent(next.id)}`} className={`${cardClass} justify-end text-end`}>
          <span className="flex min-w-0 flex-col items-end">
            <span className="text-xs font-medium text-[var(--kb-muted)]">הבא</span>
            <span className="truncate text-sm font-semibold">{next.title}</span>
          </span>
          <ChevronLeft aria-hidden="true" size={18} className="shrink-0 text-[var(--kb-accent)]" />
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden flex-1 sm:block" />
      )}
    </nav>
  );
}
