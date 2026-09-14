import type { ModulesMap } from '../../types';
import { useUiStore } from '../../store/uiStore';

interface ModuleChipsProps {
  modules: ModulesMap;
}

const chipBase = 'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] transition-colors';
const chipOn = 'border-[var(--kb-accent-soft)] bg-[var(--kb-accent-soft)] font-semibold text-[var(--kb-accent)]';
const chipOff = 'border-[var(--kb-border)] bg-[var(--kb-surface)] font-medium text-[var(--kb-text2)]';

/** Horizontally scrolling module filter for phones (the sidebar's module list on desktop). */
export default function ModuleChips({ modules }: ModuleChipsProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const allSelected = selectedModules.size === 0;

  function clearModules() {
    for (const key of selectedModules) toggleModule(key);
  }

  return (
    <div
      role="group"
      aria-label="סינון לפי מודול"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        aria-pressed={allSelected}
        onClick={clearModules}
        className={`${chipBase} ${allSelected ? chipOn : chipOff}`}
      >
        הכול
      </button>
      {Object.entries(modules).map(([key, label]) => {
        const pressed = selectedModules.has(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            onClick={() => toggleModule(key)}
            className={`${chipBase} ${pressed ? chipOn : chipOff}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
