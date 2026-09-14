import { ALL_STATUSES, STATUS_LABELS } from '../../lib/progressStatus';
import { useUserDataStore } from '../../store/userDataStore';

interface StatusSegmentedProps {
  topicId: string;
}

export default function StatusSegmented({ topicId }: StatusSegmentedProps) {
  const status = useUserDataStore((s) => s.progress.get(topicId) ?? 'new');
  const setStatus = useUserDataStore((s) => s.setStatus);

  return (
    <div
      role="radiogroup"
      aria-label="מצב למידה"
      className="flex w-full rounded-[10px] bg-[var(--kb-surface2)] p-[3px]"
    >
      {ALL_STATUSES.map((option) => {
        const checked = option === status;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setStatus(topicId, option)}
            className={`min-h-9 flex-1 rounded-lg px-2 text-sm transition-colors ${
              checked
                ? 'bg-[var(--kb-surface)] font-semibold text-[var(--kb-accent)] shadow-[var(--kb-shadow-sm)]'
                : 'font-medium text-[var(--kb-text2)] hover:text-[var(--kb-text)]'
            }`}
          >
            {STATUS_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
