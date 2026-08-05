import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import { highlightMatch } from '../../lib/highlightMatch';

interface TopicListRowProps {
  topic: Topic;
  highlightTerm: string;
  itemProps: GridItemProps;
}

export default function TopicListRow({ topic, highlightTerm, itemProps }: TopicListRowProps) {
  const titleSegments = highlightMatch(topic.title, highlightTerm);

  /* eslint-disable react-hooks/refs -- itemProps.ref is a plain callback-ref forwarded from
     useGridKeyboardNav's roving-tabindex GridItemProps, never a ref.current read; the rule's
     name-based heuristic misidentifies the whole itemProps object because it has a property
     literally named "ref". */
  return (
    <Link
      to={`/topic/${encodeURIComponent(topic.id)}`}
      ref={itemProps.ref}
      tabIndex={itemProps.tabIndex}
      onFocus={itemProps.onFocus}
      onKeyDown={itemProps.onKeyDown}
      className="kb-topic-list-row flex min-h-11 items-center gap-3 px-4 py-2 transition-[transform,box-shadow] duration-150 ease-[var(--kb-ease)]"
    >
      <span className="kb-category-chip shrink-0" data-category={topic.category}>
        {topic.category_label}
      </span>
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
  );
  /* eslint-enable react-hooks/refs */
}
