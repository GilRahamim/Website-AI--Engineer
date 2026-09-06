import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import { highlightMatch } from '../../lib/highlightMatch';
import TopicStatusButton from '../topic/TopicStatusButton';
import TopicFavoriteButton from '../topic/TopicFavoriteButton';

interface TopicCardProps {
  topic: Topic;
  highlightTerm: string;
  itemProps: GridItemProps;
}

export default function TopicCard({ topic, highlightTerm, itemProps }: TopicCardProps) {
  const titleSegments = highlightMatch(topic.title, highlightTerm);

  /* eslint-disable react-hooks/refs -- itemProps.ref is a plain callback-ref forwarded from
     useGridKeyboardNav's roving-tabindex GridItemProps, never a ref.current read; the rule's
     name-based heuristic misidentifies the whole itemProps object because it has a property
     literally named "ref". */
  return (
    <div className="kb-topic-card relative flex flex-col gap-2 p-4 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
      <div className="flex items-center justify-between gap-2">
        <span className="kb-category-chip" data-category={topic.category}>
          {topic.category_label}
        </span>
        <div className="flex items-center gap-1">
          <TopicStatusButton topicId={topic.id} tabIndex={itemProps.tabIndex} />
          <TopicFavoriteButton topicId={topic.id} tabIndex={itemProps.tabIndex} />
        </div>
      </div>
      <Link
        to={`/topic/${encodeURIComponent(topic.id)}`}
        ref={itemProps.ref}
        tabIndex={itemProps.tabIndex}
        onFocus={itemProps.onFocus}
        onKeyDown={itemProps.onKeyDown}
        className="kb-stretched-link flex flex-col gap-2"
      >
        <h3 className="text-base font-bold text-[var(--kb-text)]">
          {titleSegments.map((segment, i) =>
            segment.match ? (
              <mark key={i} className="bg-[var(--kb-accent-soft)] text-[var(--kb-text)]">
                {segment.text}
              </mark>
            ) : (
              <span key={i}>{segment.text}</span>
            ),
          )}
        </h3>
        <p className="text-sm text-[var(--kb-muted)] line-clamp-3">{topic.definition}</p>
      </Link>
    </div>
  );
  /* eslint-enable react-hooks/refs */
}
