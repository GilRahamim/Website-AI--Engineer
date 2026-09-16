import { Link } from 'react-router-dom';
import type { Topic } from '../../types';

interface RelatedTopicsProps {
  relatedIds: (string | null)[];
  /** Original names from the source content, parallel to relatedIds. Names
   *  whose id is null (no matching topic in the dataset) are still shown so
   *  the reader knows the connection exists, just not as a link. */
  relatedRaw?: string[];
  topicsById: Map<string, Topic>;
}

export default function RelatedTopics({ relatedIds, relatedRaw = [], topicsById }: RelatedTopicsProps) {
  const resolved = relatedIds
    .filter((id): id is string => id !== null)
    .map((id) => topicsById.get(id))
    .filter((topic): topic is Topic => topic !== undefined);
  const unresolved = relatedRaw.filter((_, index) => relatedIds[index] === null);

  if (resolved.length === 0 && unresolved.length === 0) return null;

  return (
    <nav aria-label="נושאים קשורים" className="mt-8 border-t border-[var(--kb-border)] pt-4">
      <h2 className="mb-3 text-base font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]">נושאים קשורים</h2>
      <ul className="flex flex-wrap gap-2">
        {resolved.map((topic) => (
          <li key={topic.id}>
            <Link
              to={`/topic/${encodeURIComponent(topic.id)}`}
              className="inline-flex min-h-10 items-center rounded-full border border-[var(--kb-border)] bg-[var(--kb-surface)] px-3 text-sm font-medium text-[var(--kb-accent)] no-underline hover:bg-[var(--kb-accent-soft)]"
            >
              {topic.title}
            </Link>
          </li>
        ))}
        {unresolved.map((name) => (
          <li key={name}>
            <span
              title="נושא זה מוזכר בתוכן אך אינו חלק ממאגר הנושאים"
              className="inline-flex min-h-10 items-center rounded-full border border-dashed border-[var(--kb-border-strong)] px-3 text-sm text-[var(--kb-muted)]"
            >
              {`${name} (לא במאגר)`}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
