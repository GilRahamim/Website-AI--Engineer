import { List } from 'lucide-react';
import type { TocHeading } from '../../lib/tocFromHtml';

interface TableOfContentsProps {
  headings: TocHeading[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** False when a surrounding disclosure already labels the list (phones). */
  showHeading?: boolean;
}

export default function TableOfContents({ headings, activeId, onSelect, showHeading = true }: TableOfContentsProps) {
  if (headings.length === 0) return null;

  return (
    <nav
      aria-label="בעמוד זה"
      className={showHeading ? 'rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-4' : 'p-3'}
    >
      {showHeading && (
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--kb-muted)]">
          <List aria-hidden="true" size={14} />
          בעמוד זה
        </h2>
      )}
      <ul className="flex flex-col">
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={active ? 'location' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(heading.id);
                }}
                className={`flex min-h-11 items-center gap-2 border-e-2 pe-3 text-sm no-underline transition-colors lg:min-h-9 ${
                  active
                    ? 'border-[var(--kb-accent)] font-semibold text-[var(--kb-accent)]'
                    : 'border-[var(--kb-border)] text-[var(--kb-text2)] hover:text-[var(--kb-text)]'
                }`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
