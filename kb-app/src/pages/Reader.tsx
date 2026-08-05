import { useParams } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import type { Topic } from '../types';
import Header from '../components/layout/Header';
import TopicReader from '../components/reader/TopicReader';

const topics = topicsRaw as Topic[];
const topicsById = new Map(topics.map((topic) => [topic.id, topic]));

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const topic = id ? topicsById.get(decodeURIComponent(id)) : undefined;

  return (
    <>
      <Header />
      <main className="p-4">
        {topic ? <TopicReader topic={topic} topicsById={topicsById} /> : <p role="alert">הנושא לא נמצא.</p>}
      </main>
    </>
  );
}
