import { useMemo } from 'react';
import { modules, topics } from '../lib/catalog';
import { useUserDataStore } from '../store/userDataStore';

export interface MasteryCounts {
  /** Mastered topics per module key. */
  moduleMasteredCounts: Record<string, number>;
  masteredCount: number;
  learningCount: number;
}

/** Progress-derived mastery totals, recomputed only when progress changes. */
export function useModuleMasteredCounts(): MasteryCounts {
  const progress = useUserDataStore((s) => s.progress);
  return useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(Object.keys(modules).map((key) => [key, 0]));
    let mastered = 0;
    let learning = 0;
    for (const t of topics) {
      const status = progress.get(t.id);
      if (status === 'learning') learning += 1;
      if (status !== 'mastered') continue;
      counts[t.module] = (counts[t.module] ?? 0) + 1;
      mastered += 1;
    }
    return { moduleMasteredCounts: counts, masteredCount: mastered, learningCount: learning };
  }, [progress]);
}
