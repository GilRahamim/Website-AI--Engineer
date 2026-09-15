import { ChevronDown } from 'lucide-react';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import type { TopicGroup, ViewMode } from '../../types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  return (
    <Accordion
      type="single"
      collapsible
      value={expanded ? group.moduleKey : ''}
      onValueChange={() => onToggle()}
      className="mb-6"
    >
      <AccordionItem value={group.moduleKey} className="rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface2)]">
        <AccordionTrigger className="min-h-11 px-4 py-2 text-start font-bold text-[var(--kb-text)] hover:no-underline [&>svg]:hidden">
          <span>{group.moduleLabel}</span>
          <span className="ms-auto flex items-center gap-2 text-sm font-normal text-[var(--kb-muted)]">
            {group.topics.length}
            <ChevronDown aria-hidden="true" size={18} className="transition-transform duration-200" />
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-0 pb-0 pt-3">
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
