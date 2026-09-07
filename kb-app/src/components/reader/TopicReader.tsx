import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import RelatedTopics from './RelatedTopics';
import TopicStatusButton from '../topic/TopicStatusButton';
import TopicFavoriteButton from '../topic/TopicFavoriteButton';
import TopicNotes from '../topic/TopicNotes';

interface TopicReaderProps {
  topic: Topic;
  topicsById: Map<string, Topic>;
}

type ContentState =
  | { path: string; status: 'loaded'; html: string }
  | { path: string; status: 'error'; offline: boolean };

export default function TopicReader({ topic, topicsById }: TopicReaderProps) {
  const [content, setContent] = useState<ContentState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(topic.contentPath)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load content: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setContent({ path: topic.contentPath, status: 'loaded', html: text });
      })
      .catch(() => {
        // navigator.onLine is a coarse signal — `true` doesn't guarantee
        // real connectivity, but `false` reliably means no network, which
        // is exactly the asymmetry needed here: distinguish "definitely
        // offline" from any other fetch failure, not detect flaky
        // connections precisely.
        if (!cancelled) setContent({ path: topic.contentPath, status: 'error', offline: !navigator.onLine });
      });
    return () => {
      cancelled = true;
    };
  }, [topic.contentPath]);

  const isCurrent = content?.path === topic.contentPath;
  const html = isCurrent && content.status === 'loaded' ? content.html : null;
  const error = isCurrent && content.status === 'error' ? content : null;

  return (
    <article className="mx-auto max-w-3xl p-4">
      <nav aria-label="breadcrumb" className="mb-2 flex items-center gap-2 text-sm text-[var(--kb-muted)]">
        <Link to="/" className="hover:underline">
          מסד ידע
        </Link>
        <span aria-hidden="true">›</span>
        <span>{topic.module_label}</span>
      </nav>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="kb-category-chip w-fit" data-category={topic.category}>
          {topic.category_label}
        </span>
        <div className="flex items-center gap-2">
          <TopicStatusButton topicId={topic.id} size="lg" />
          <TopicFavoriteButton topicId={topic.id} size="lg" />
        </div>
      </div>
      <h1 className="mb-2 text-2xl font-extrabold text-[var(--kb-text)]">{topic.title}</h1>
      <p className="mb-6 text-[var(--kb-text2)]">{topic.definition}</p>
      {html === null ? (
        error ? (
          <p role="alert">
            {error.offline ? 'אין חיבור לאינטרנט — ניתן לצפות רק בנושאים שנצפו כבר.' : 'שגיאה בטעינת התוכן.'}
          </p>
        ) : (
          <p role="status">טוען תוכן…</p>
        )
      ) : (
        <div className="kb-topic-content" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <TopicNotes topicId={topic.id} />
      <RelatedTopics relatedIds={topic.related_match} topicsById={topicsById} />
    </article>
  );
}
