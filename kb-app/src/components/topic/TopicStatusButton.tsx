import { Circle, CircleCheck, CircleDot } from 'lucide-react';
import { useUserDataStore } from '../../store/userDataStore';
import { NEXT_STATUS, STATUS_LABELS } from '../../lib/progressStatus';
import type { ProgressStatus } from '../../types';
import { Button } from '@/components/ui/button';

interface TopicStatusButtonProps {
  topicId: string;
  size?: 'xs' | 'sm' | 'lg';
  tabIndex?: number;
}

const SIZE_CLASS: Record<'xs' | 'sm' | 'lg', string> = {
  xs: 'size-9',
  sm: 'size-11',
  lg: 'size-12',
};

const ICON_SIZE: Record<'xs' | 'sm' | 'lg', number> = {
  xs: 15,
  sm: 18,
  lg: 22,
};

const STATUS_ICONS: Record<ProgressStatus, typeof Circle> = {
  new: Circle,
  learning: CircleDot,
  mastered: CircleCheck,
};

export default function TopicStatusButton({ topicId, size = 'sm', tabIndex = 0 }: TopicStatusButtonProps) {
  const status = useUserDataStore((s) => s.progress.get(topicId) ?? 'new');
  const cycleStatus = useUserDataStore((s) => s.cycleStatus);
  const Icon = STATUS_ICONS[status];

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
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
      className={`kb-status-pill rounded-full ${SIZE_CLASS[size]}`}
    >
      <Icon aria-hidden="true" size={ICON_SIZE[size]} />
    </Button>
  );
}
