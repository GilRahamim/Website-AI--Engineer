import type { Topic } from '../types';

export interface QuizQuestion {
  topicId: string;
  definition: string;
  options: string[];
  correctTitle: string;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildDistractors(topic: Topic, allTopics: Topic[], count: number): Topic[] {
  const sameCategory = allTopics.filter((t) => t.category === topic.category && t.id !== topic.id);
  return shuffle(sameCategory).slice(0, count);
}

export function buildQuestion(topic: Topic, allTopics: Topic[]): QuizQuestion {
  const distractors = buildDistractors(topic, allTopics, 3);
  const options = shuffle([topic.title, ...distractors.map((t) => t.title)]);
  return { topicId: topic.id, definition: topic.definition, options, correctTitle: topic.title };
}

export function buildQuiz(candidates: Topic[], allTopics: Topic[], count: number): QuizQuestion[] {
  const chosen = shuffle(candidates).slice(0, Math.min(count, candidates.length));
  return chosen.map((topic) => buildQuestion(topic, allTopics));
}
