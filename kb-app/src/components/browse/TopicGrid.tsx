import type { Topic } from '../../types';
import type { GridItemProps } from '../../hooks/useGridKeyboardNav';
import TopicCard from './TopicCard';

interface TopicGridProps {
  topics: Topic[];
  highlightTerm: string;
  getItemProps: (id: string) => GridItemProps;
}

export default function TopicGrid({ topics, highlightTerm, getItemProps }: TopicGridProps) {
  return (
    <div className="kb-topic-grid">
      {topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} highlightTerm={highlightTerm} itemProps={getItemProps(topic.id)} />
      ))}
    </div>
  );
}
