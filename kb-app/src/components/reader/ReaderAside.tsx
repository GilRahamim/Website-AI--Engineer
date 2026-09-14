import { useState } from 'react';
import { ChevronDown, Keyboard, List } from 'lucide-react';
import type { Topic } from '../../types';
import type { TocHeading } from '../../lib/tocFromHtml';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useUserDataStore } from '../../store/userDataStore';
import TableOfContents from './TableOfContents';
import StatusSegmented from './StatusSegmented';
import TopicFavoriteButton from '../topic/TopicFavoriteButton';

interface ReaderAsideProps {
  topic: Topic;
  headings: TocHeading[];
  activeHeadingId: string | null;
  onSelectHeading: (id: string) => void;
}

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'J / K', label: 'נושא הבא / קודם' },
  { keys: 'F', label: 'מועדף' },
  { keys: 'S', label: 'שנה מצב למידה' },
  { keys: 'N', label: 'קפוץ להערות' },
];

const DAY_MS = 86400000;

function describeReview(dueAt: number | undefined, now: number): string {
  if (dueAt === undefined) return 'טרם נסקר בכרטיסיות';
  const days = Math.ceil((dueAt - now) / DAY_MS);
  if (days <= 0) return 'ממתין לחזרה היום';
  if (days === 1) return 'חזרה הבאה מחר';
  return `חזרה הבאה בעוד ${days} ימים`;
}

export default function ReaderAside({ topic, headings, activeHeadingId, onSelectHeading }: ReaderAsideProps) {
  const card = useUserDataStore((s) => s.srsCards.get(topic.id));
  const isFavorite = useUserDataStore((s) => s.favorites.has(topic.id));
  const [now] = useState(() => Date.now());
  const reviewText = describeReview(card?.dueAt, now);
  // The table of contents is rendered exactly once: as a sticky list from lg
  // up, and as a collapsible disclosure above the article on phones (where
  // a long topic would otherwise have no in-page navigation at all). One
  // instance keeps the "בעמוד זה" landmark unique in the accessibility tree.
  const isWide = useMediaQuery('(min-width: 1024px)');

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
      {isWide ? (
        <TableOfContents headings={headings} activeId={activeHeadingId} onSelect={onSelectHeading} />
      ) : (
        headings.length > 0 && (
          <details className="kb-toc-disclosure rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)]">
            <summary>
              <List aria-hidden="true" size={16} className="text-[var(--kb-muted)]" />
              {`בעמוד זה · ${headings.length} סעיפים`}
              <ChevronDown aria-hidden="true" size={16} className="kb-toc-chevron text-[var(--kb-muted)]" />
            </summary>
            <div className="border-t border-[var(--kb-border)]">
              <TableOfContents
                headings={headings}
                activeId={activeHeadingId}
                onSelect={onSelectHeading}
                showHeading={false}
              />
            </div>
          </details>
        )
      )}

      <section
        aria-labelledby="reader-progress-heading"
        className="flex flex-col gap-3 rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-4"
      >
        <h2 id="reader-progress-heading" className="text-xs font-semibold text-[var(--kb-muted)]">
          ההתקדמות שלי
        </h2>
        <StatusSegmented topicId={topic.id} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-[var(--kb-text2)]">{isFavorite ? 'במועדפים' : 'הוסף למועדפים'}</span>
          <TopicFavoriteButton topicId={topic.id} />
        </div>
        <p className="text-xs text-[var(--kb-muted)]">
          {card ? `נסקר ${card.reps} פעמים · ${reviewText}` : reviewText}
        </p>
      </section>

      <section aria-label="קיצורי מקלדת" className="hidden flex-col gap-2 px-1 lg:flex">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-[var(--kb-muted)]">
          <Keyboard aria-hidden="true" size={14} />
          קיצורי מקלדת
        </h2>
        <dl className="flex flex-col gap-1.5">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between gap-3 text-xs text-[var(--kb-text2)]">
              <dt>{shortcut.label}</dt>
              <dd>
                <kbd className="rounded border border-[var(--kb-border-strong)] bg-[var(--kb-surface)] px-1.5 py-0.5 font-mono text-[11px]">
                  {shortcut.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}
