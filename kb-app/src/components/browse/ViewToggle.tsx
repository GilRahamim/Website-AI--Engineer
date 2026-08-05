import { useUiStore } from '../../store/uiStore';

export default function ViewToggle() {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);

  return (
    <div role="group" aria-label="תצוגה" className="flex gap-1">
      <button
        type="button"
        aria-pressed={viewMode === 'grid'}
        aria-label="תצוגת רשת"
        onClick={() => setViewMode('grid')}
        className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[var(--kb-border)] aria-pressed:bg-[var(--kb-accent-soft)]"
      >
        <span aria-hidden="true">▦</span>
      </button>
      <button
        type="button"
        aria-pressed={viewMode === 'list'}
        aria-label="תצוגת רשימה"
        onClick={() => setViewMode('list')}
        className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[var(--kb-border)] aria-pressed:bg-[var(--kb-accent-soft)]"
      >
        <span aria-hidden="true">☰</span>
      </button>
    </div>
  );
}
