import { useState } from 'react';
import { Link } from 'react-router-dom';
import topicsRaw from '../../data/topics.clean.json';
import type { Topic } from '../../types';
import { getDueTopicIds } from '../../lib/srs';
import { useUserDataStore } from '../../store/userDataStore';
import ThemeToggle from '../theme/ThemeToggle';

const topics = topicsRaw as Topic[];

export default function Header() {
  const srsCards = useUserDataStore((s) => s.srsCards);
  const [now] = useState(() => Date.now());
  const dueCount = getDueTopicIds(topics, srsCards, now).length;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--kb-border)] bg-[var(--kb-surface)] px-4 py-3 shadow-[var(--kb-shadow-sm)]">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">🧠</span>
        <div className="flex flex-col leading-tight">
          <strong className="text-[var(--kb-text)]">מסד ידע</strong>
          <span className="text-xs text-[var(--kb-muted)]">AI Engineer</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/flashcards"
          className="flex min-h-11 items-center rounded-md px-3 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
        >
          כרטיסיות
          {dueCount > 0 && (
            <span
              className="ms-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--kb-accent-soft)] px-1.5 text-xs font-bold text-[var(--kb-accent)]"
              aria-label={`${dueCount} כרטיסים ממתינים לחזרה`}
            >
              {dueCount}
            </span>
          )}
        </Link>
        <Link
          to="/quiz"
          className="flex min-h-11 items-center rounded-md px-3 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
        >
          מבחן
        </Link>
        <Link
          to="/map"
          className="flex min-h-11 items-center rounded-md px-3 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
        >
          מפה
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
