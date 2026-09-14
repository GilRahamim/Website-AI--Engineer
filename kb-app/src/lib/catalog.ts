import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import searchIndexRaw from '../data/search-index.json';
import type { ModulesMap, SearchEntry, Topic } from '../types';
import { decodeEntities } from './decodeEntities';

/**
 * The static course catalog, derived once from the bundled JSON. Home, the
 * global drawer, and the reader all need the same lookups, so they live
 * here instead of being recomputed per page module.
 *
 * Title/definition are plain-text fields shown through React (never as
 * HTML), so the few HTML entities the migration left in them are decoded
 * here once — otherwise "&quot;" would be printed literally on cards and
 * flashcards.
 */
export const topics: Topic[] = (topicsRaw as Topic[]).map((topic) => ({
  ...topic,
  title: decodeEntities(topic.title),
  definition: decodeEntities(topic.definition),
}));
export const modules = modulesRaw as ModulesMap;
export const searchIndex = searchIndexRaw as SearchEntry[];
export const topicsById = new Map(topics.map((topic) => [topic.id, topic]));

export const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((topic) => [topic.category, topic.category_label]),
);
export const moduleCounts: Record<string, number> = Object.fromEntries(
  Object.keys(modules).map((key) => [key, topics.filter((topic) => topic.module === key).length]),
);
export const categoryCounts: Record<string, number> = Object.fromEntries(
  Object.keys(categoryLabels).map((key) => [key, topics.filter((topic) => topic.category === key).length]),
);
