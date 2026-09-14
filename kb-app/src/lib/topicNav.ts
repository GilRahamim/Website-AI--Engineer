import type { Topic } from '../types';

const WORDS_PER_MINUTE = 200;

function moduleSiblings(topic: Topic, topics: Topic[]): Topic[] {
  return topics.filter((t) => t.module === topic.module);
}

export function getPrevNext(topic: Topic, topics: Topic[]): { prev: Topic | null; next: Topic | null } {
  const siblings = moduleSiblings(topic, topics);
  const index = siblings.findIndex((t) => t.id === topic.id);
  return {
    prev: index > 0 ? siblings[index - 1] : null,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}

export function getModulePosition(topic: Topic, topics: Topic[]): { index: number; total: number } {
  const siblings = moduleSiblings(topic, topics);
  return { index: siblings.findIndex((t) => t.id === topic.id) + 1, total: siblings.length };
}

export function estimateReadingMinutes(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
