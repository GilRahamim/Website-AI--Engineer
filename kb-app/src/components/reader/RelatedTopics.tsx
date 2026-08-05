import { Link } from 'react-router-dom';
import type { Topic } from '../../types';

interface RelatedTopicsProps {
  relatedIds: (string | null)[];
  topicsById: Map<string, Topic>;
}

export default function RelatedTopics({ relatedIds, topicsById }: RelatedTopicsProps) {
  const resolved = relatedIds
    .filter((id): id is string => id !== null)
    .map((id) => topicsById.get(id))
    .filter((topic): topic is Topic => topic !== undefined);

  if (resolved.length === 0) return null;

  return (
    <nav aria-label="נושאים קשורים" className="mt-8 border-t border-[var(--kb-border)] pt-4">
      <h2 className="mb-2 text-lg font-bold text-[var(--kb-text)]">נושאים קשורים</h2>
      <ul className="flex flex-wrap gap-2">
        {resolved.map((topic) => (
          <li key={topic.id}>
            <Link
              to={`/topic/${encodeURIComponent(topic.id)}`}
              className="inline-block min-h-11 rounded-full border border-[var(--kb-border)] px-3 py-1 text-sm text-[var(--kb-accent)] hover:bg-[var(--kb-accent-soft)]"
            >
              {topic.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
