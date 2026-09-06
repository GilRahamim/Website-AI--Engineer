import { useUserDataStore } from '../../store/userDataStore';
import { NEXT_STATUS, STATUS_GLYPHS, STATUS_LABELS } from '../../lib/progressStatus';

interface TopicStatusButtonProps {
  topicId: string;
  size?: 'sm' | 'lg';
  tabIndex?: number;
}

export default function TopicStatusButton({ topicId, size = 'sm', tabIndex = 0 }: TopicStatusButtonProps) {
  const status = useUserDataStore((s) => s.progress.get(topicId) ?? 'new');
  const cycleStatus = useUserDataStore((s) => s.cycleStatus);

  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={(event) => {
        // Defensive — TopicCard/TopicListRow (Task 4) render this as a
        // sibling of the topic link, not a descendant, so there is normally
        // nothing above it to stop; kept in case a future layout nests it.
        event.preventDefault();
        event.stopPropagation();
        cycleStatus(topicId);
      }}
      aria-label={`מצב למידה: ${STATUS_LABELS[status]}. לחץ למעבר ל'${STATUS_LABELS[NEXT_STATUS[status]]}'`}
      data-status={status}
      className={`kb-status-pill grid place-items-center rounded-full border border-[var(--kb-border)] bg-[var(--kb-surface)] ${
        size === 'lg' ? 'size-12 text-2xl' : 'size-11 text-base'
      }`}
    >
      <span aria-hidden="true">{STATUS_GLYPHS[status]}</span>
    </button>
  );
}
