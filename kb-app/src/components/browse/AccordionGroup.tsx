import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import type { TopicGroup, ViewMode } from '../../types';
import TopicGrid from './TopicGrid';
import TopicListRow from './TopicListRow';

interface AccordionGroupProps {
  group: TopicGroup;
  expanded: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
  highlightTerm: string;
  getItemProps: (id: string) => GridItemProps;
}

export default function AccordionGroup({
  group,
  expanded,
  onToggle,
  viewMode,
  highlightTerm,
  getItemProps,
}: AccordionGroupProps) {
  const headingId = `group-heading-${group.moduleKey}`;
  const panelId = `group-panel-${group.moduleKey}`;

  return (
    <section className="mb-6">
      <h2>
        <button
          type="button"
          id={headingId}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full min-h-11 items-center justify-between rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface2)] px-4 py-2 text-start font-bold text-[var(--kb-text)]"
        >
          <span>{group.moduleLabel}</span>
          <span className="flex items-center gap-2 text-sm text-[var(--kb-muted)]">
            {group.topics.length}
            <span aria-hidden="true">{expanded ? '▾' : '◂'}</span>
          </span>
        </button>
      </h2>
      {expanded && (
        <div id={panelId} role="region" aria-labelledby={headingId} className="mt-3">
          {viewMode === 'grid' ? (
            <TopicGrid topics={group.topics} highlightTerm={highlightTerm} getItemProps={getItemProps} />
          ) : (
            <ul role="list" className="flex flex-col gap-2">
              {group.topics.map((topic) => (
                <li key={topic.id}>
                  <TopicListRow topic={topic} highlightTerm={highlightTerm} itemProps={getItemProps(topic.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
