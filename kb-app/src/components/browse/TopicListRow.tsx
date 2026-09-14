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

/**
 * Compact row used for the list view and for every phone-width listing:
 * category dot, title (up to two lines) over a one-line definition, and the
 * status/favorite controls. The chip's text label is dropped here — the dot
 * carries the category and the label is announced for screen readers.
 */
export default function TopicListRow({ topic, highlightTerm, itemProps }: TopicListRowProps) {
  const titleSegments = highlightMatch(topic.title, highlightTerm);

  /* eslint-disable react-hooks/refs -- see TopicCard.tsx for rationale */
  return (
    <div className="kb-topic-list-row relative flex min-h-16 items-center gap-3 px-3 py-2.5 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]">
      <span className="kb-category-dot shrink-0" data-category={topic.category}>
        <span className="sr-only">{topic.category_label}</span>
      </span>
      <Link
        to={`/topic/${encodeURIComponent(topic.id)}`}
        ref={itemProps.ref}
        tabIndex={itemProps.tabIndex}
        onFocus={itemProps.onFocus}
        onKeyDown={itemProps.onKeyDown}
        className="kb-stretched-link flex min-w-0 flex-1 flex-col gap-0.5"
      >
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--kb-text)]">
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
        <span className="truncate text-xs text-[var(--kb-muted)]">{topic.definition}</span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <TopicStatusButton topicId={topic.id} tabIndex={itemProps.tabIndex} />
        <TopicFavoriteButton topicId={topic.id} tabIndex={itemProps.tabIndex} />
      </div>
    </div>
  );
  /* eslint-enable react-hooks/refs */
}
