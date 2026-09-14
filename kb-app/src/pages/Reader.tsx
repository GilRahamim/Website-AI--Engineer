import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import topicsRaw from '../data/topics.clean.json';
import type { Topic } from '../types';
import Header from '../components/layout/Header';
import TopicReader from '../components/reader/TopicReader';
import { useUserDataStore } from '../store/userDataStore';
import { usePageTitle } from '../hooks/usePageTitle';

const topics = topicsRaw as Topic[];
const topicsById = new Map(topics.map((topic) => [topic.id, topic]));

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const topic = id ? topicsById.get(id) : undefined;
  usePageTitle(topic ? topic.title : 'הנושא לא נמצא');

  useEffect(() => {
    if (topic) {
      useUserDataStore.getState().recordView(topic.id);
    }
  }, [topic]);

  return (
    <>
      <Header />
      <main>
        {topic ? (
          <TopicReader topic={topic} topics={topics} topicsById={topicsById} />
        ) : (
          <p role="alert" className="p-8 text-center text-[var(--kb-text)]">
            הנושא לא נמצא.
          </p>
        )}
      </main>
    </>
  );
}
