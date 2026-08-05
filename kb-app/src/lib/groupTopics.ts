import type { ModulesMap, Topic, TopicGroup } from '../types';

export function groupTopicsByModule(topics: Topic[], modules: ModulesMap): TopicGroup[] {
  return Object.entries(modules)
    .map(([moduleKey, moduleLabel]) => ({
      moduleKey,
      moduleLabel,
      topics: topics.filter((topic) => topic.module === moduleKey),
    }))
    .filter((group) => group.topics.length > 0);
}
