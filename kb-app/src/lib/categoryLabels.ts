import type { Topic } from '../types';

export function buildCategoryLabels(topics: Topic[]): Record<string, string> {
  return Object.fromEntries(topics.map((t) => [t.category, t.category_label]));
}
