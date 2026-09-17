import { useEffect, useRef, useState } from 'react';
import type { ModulesMap } from '../../types';
import { useUiStore } from '../../store/uiStore';

interface ModuleChipsProps {
  modules: ModulesMap;
}

const chipBase =
  'inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] transition-colors';
const chipOn = 'border-[var(--kb-accent-soft)] bg-[var(--kb-accent-soft)] font-semibold text-[var(--kb-accent)]';
const chipOff = 'border-[var(--kb-border)] bg-[var(--kb-surface)] font-medium text-[var(--kb-text2)]';

/** Horizontally scrolling module filter for phones (the sidebar's module list on desktop). */
export default function ModuleChips({ modules }: ModuleChipsProps) {
  const selectedModules = useUiStore((s) => s.selectedModules);
  const toggleModule = useUiStore((s) => s.toggleModule);
  const allSelected = selectedModules.size === 0;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  function clearModules() {
    for (const key of selectedModules) toggleModule(key);
  }

  // Edge fades are direction-agnostic: RTL scrollLeft conventions differ by
  // browser, but |scrollLeft| always runs from 0 (start) to maxScroll (end)
  // either way, so this doesn't need to special-case RTL.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    function updateFades() {
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const scrolled = Math.abs(el.scrollLeft);
      setCanScrollStart(scrolled > 4);
      setCanScrollEnd(scrolled < maxScroll - 4);
    }
    updateFades();
    el.addEventListener('scroll', updateFades, { passive: true });
    const observer = new ResizeObserver(updateFades);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateFades);
      observer.disconnect();
    };
  }, [modules]);

  return (
    <div className="relative -mx-4 px-4">
      <div
        ref={scrollerRef}
        role="group"
        aria-label="סינון לפי מודול"
        className="flex snap-x snap-proximity gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--kb-bg)] to-transparent transition-opacity duration-150 ${
          canScrollStart ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--kb-bg)] to-transparent transition-opacity duration-150 ${
          canScrollEnd ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
