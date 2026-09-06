import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import { highlightMatch } from '../../lib/highlightMatch';
import TopicStatusButton from '../topic/TopicStatusButton';
import TopicFavoriteButton from '../topic/TopicFavoriteButton';

interface TopicListRowProps {
  topic: Topic;
  highlightTerm: string;
  itemProps: GridItemProps;
}

export default function TopicListRow({ topic, highlightTerm, itemProps }: TopicListRowProps) {
  const titleSegments = highlightMatch(topic.title, highlightTerm);

  /* eslint-disable react-hooks/refs -- see TopicCard.tsx for rationale */
  return (
    <div className="kb-topic-list-row relative flex min-h-11 items-center gap-3 px-4 py-2 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
      <span className="kb-category-chip shrink-0" data-category={topic.category}>
        {topic.category_label}
      </span>
      <Link
        to={`/topic/${encodeURIComponent(topic.id)}`}
        ref={itemProps.ref}
        tabIndex={itemProps.tabIndex}
        onFocus={itemProps.onFocus}
        onKeyDown={itemProps.onKeyDown}
        className="kb-stretched-link flex flex-1 items-center gap-3 overflow-hidden"
      >
        <span className="font-semibold text-[var(--kb-text)]">
          {titleSegments.map((segment, i) =>
            segment.match ? (
              <mark key={i} className="bg-[var(--kb-accent-soft)] text-[var(--kb-text)]">
                {segment.text}
              </mark>
            ) : (
              <span key={i}>{segment.text}</span>
            ),
          )}
        </span>
        <span className="truncate text-sm text-[var(--kb-muted)]">{topic.definition}</span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <TopicStatusButton topicId={topic.id} />
        <TopicFavoriteButton topicId={topic.id} />
      </div>
    </div>
  );
  /* eslint-enable react-hooks/refs */
}
