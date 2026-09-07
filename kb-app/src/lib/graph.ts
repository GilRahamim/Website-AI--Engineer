import type { Category, Topic } from '../types';

export interface GraphNode {
  id: string;
  title: string;
  category: Category;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function buildGraphData(
  topics: Topic[],
  selectedModule: string | 'all',
  selectedCategory: string | 'all',
): GraphData {
  let filtered = topics;
  if (selectedModule !== 'all') filtered = filtered.filter((t) => t.module === selectedModule);
  if (selectedCategory !== 'all') filtered = filtered.filter((t) => t.category === selectedCategory);

  const visibleIds = new Set(filtered.map((t) => t.id));
  const nodes: GraphNode[] = filtered.map((t) => ({ id: t.id, title: t.title, category: t.category }));

  const seenPairs = new Set<string>();
  const links: GraphLink[] = [];
  for (const t of filtered) {
    for (const relatedId of t.related_match) {
      if (!relatedId || relatedId === t.id || !visibleIds.has(relatedId)) continue;
      const pairKey = [t.id, relatedId].sort().join('|');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      links.push({ source: t.id, target: relatedId });
    }
  }

  return { nodes, links };
}
