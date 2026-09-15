import { ALL_STATUSES, STATUS_LABELS } from '../../lib/progressStatus';
import { useUserDataStore } from '../../store/userDataStore';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface StatusSegmentedProps {
  topicId: string;
}

export default function StatusSegmented({ topicId }: StatusSegmentedProps) {
  const status = useUserDataStore((s) => s.progress.get(topicId) ?? 'new');
  const setStatus = useUserDataStore((s) => s.setStatus);

  return (
    <ToggleGroup
      type="single"
      value={status}
      onValueChange={(value) => value && setStatus(topicId, value as typeof status)}
      aria-label="מצב למידה"
      className="w-full rounded-[10px] bg-[var(--kb-surface2)] p-[3px]"
    >
      {ALL_STATUSES.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="min-h-11 flex-1 rounded-lg px-2 text-sm data-[state=on]:bg-[var(--kb-surface)] data-[state=on]:font-semibold data-[state=on]:text-[var(--kb-accent)] data-[state=on]:shadow-[var(--kb-shadow-sm)] lg:min-h-9"
        >
          {STATUS_LABELS[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
