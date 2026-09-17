import type { ProgressStatus, Topic } from '../types';
import { topics } from './catalog';

/**
 * The course's own teaching order — the path's spine. `related_match` is
 * enrichment only and never affects this order. See
 * site-build-docs/06-LEARNING-PATH.md.
 */
const MODULE_ORDER = [
  'Intro to Data Science',
  'Topic 1 - Unsupervised Learning',
  'Topic 2 - Natural Language Processing',
  'Topic 3 - Deep Learning',
  'RAG, Agents, MCP',
];

function moduleRank(moduleKey: string): number {
  const rank = MODULE_ORDER.indexOf(moduleKey);
  return rank === -1 ? MODULE_ORDER.length : rank;
}

/** Fully linear: module order, then ascending `num` within a module, then title as a stable tie-breaker. An unknown module sorts to the end (and warns) rather than breaking the build. */
export function buildLearningPath(source: Topic[]): Topic[] {
  for (const topic of source) {
    if (!MODULE_ORDER.includes(topic.module)) {
      console.warn(`buildLearningPath: unknown module "${topic.module}" on topic "${topic.id}" — pushed to the end.`);
    }
  }
  return [...source].sort((a, b) => {
    const byModule = moduleRank(a.module) - moduleRank(b.module);
    if (byModule !== 0) return byModule;
    const byNum = a.num - b.num;
    if (byNum !== 0) return byNum;
    return a.title.localeCompare(b.title);
  });
}

// The precomputed path over the real catalog — what Home, Settings and the
// /path page want. Functions below still take an explicit `path` so they
// stay testable against a small fixture, the same way topicNav.ts's
// getPrevNext takes an explicit `topics` rather than importing the catalog.
export const pathTopics: Topic[] = buildLearningPath(topics);

/** Prev/next across the whole course, crossing module boundaries — unlike topicNav.ts's getPrevNext, which stops at the edge of a module. `source` doesn't need to be pre-sorted. */
export function getPathPrevNext(topic: Topic, source: Topic[]): { prev: Topic | null; next: Topic | null } {
  const path = buildLearningPath(source);
  const index = path.findIndex((t) => t.id === topic.id);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? path[index - 1] : null,
    next: index < path.length - 1 ? path[index + 1] : null,
  };
}

/** "Continue where you left off": the first topic in path order that isn't mastered. Null only once every topic is mastered. */
export function getFirstUnmasteredTopic(progress: Map<string, ProgressStatus>, path: Topic[] = pathTopics): Topic | null {
  return path.find((topic) => (progress.get(topic.id) ?? 'new') !== 'mastered') ?? null;
}

export interface ModulePathProgress {
  moduleKey: string;
  moduleLabel: string;
  topics: Topic[];
  masteredCount: number;
}

/** Path topics grouped by module, in path order, with a per-module mastered count — backs the /path page's accordion and progress bars. */
export function getModulePathProgress(progress: Map<string, ProgressStatus>, path: Topic[] = pathTopics): ModulePathProgress[] {
  const byModule = new Map<string, Topic[]>();
  for (const topic of path) {
    const list = byModule.get(topic.module);
    if (list) {
      list.push(topic);
    } else {
      byModule.set(topic.module, [topic]);
    }
  }
  return [...byModule.entries()].map(([moduleKey, moduleTopics]) => ({
    moduleKey,
    moduleLabel: moduleTopics[0].module_label,
    topics: moduleTopics,
    masteredCount: moduleTopics.filter((t) => (progress.get(t.id) ?? 'new') === 'mastered').length,
  }));
}

/** True once every topic in `topic`'s module is mastered under `progress` — used right after "mark as learned" to offer a module-scoped quiz. */
export function isModuleComplete(topic: Topic, progress: Map<string, ProgressStatus>, path: Topic[] = pathTopics): boolean {
  return path.filter((t) => t.module === topic.module).every((t) => (progress.get(t.id) ?? 'new') === 'mastered');
}
