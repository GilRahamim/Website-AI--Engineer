import { useEffect, useState } from 'react';

/**
 * Tracks which of the given heading ids is currently in view, for the
 * reader's table of contents. Falls back to the first heading when
 * IntersectionObserver is unavailable (older browsers, some test runners).
 */
export function useActiveHeading(ids: string[]): string | null {
  const key = ids.join('|');
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);

  // Reset to the first heading whenever the heading set changes (a new
  // topic loaded) — React's "adjust state during render" pattern, so the
  // effect below only ever sets state from the observer callback.
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setActiveId(ids[0] ?? null);
  }

  useEffect(() => {
    if (ids.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      // Fire when a heading crosses the top ~third of the viewport, so the
      // section being read is the one highlighted rather than the next one
      // peeking in at the bottom.
      { rootMargin: '0px 0px -65% 0px' },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
    // `key` stands in for `ids` so a fresh-but-equal array does not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return activeId;
}
