import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Topic } from '../../types';
import RelatedTopics from './RelatedTopics';

interface TopicReaderProps {
  topic: Topic;
  topicsById: Map<string, Topic>;
}

export default function TopicReader({ topic, topicsById }: TopicReaderProps) {
  const [content, setContent] = useState<{ path: string; html: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(topic.contentPath)
      .then((response) => response.text())
      .then((text) => {
        if (!cancelled) setContent({ path: topic.contentPath, html: text });
      });
    return () => {
      cancelled = true;
    };
  }, [topic.contentPath]);

  const html = content?.path === topic.contentPath ? content.html : null;

  return (
    <article className="mx-auto max-w-3xl p-4">
      <nav aria-label="breadcrumb" className="mb-2 flex items-center gap-2 text-sm text-[var(--kb-muted)]">
        <Link to="/" className="hover:underline">
          מסד ידע
        </Link>
        <span aria-hidden="true">›</span>
        <span>{topic.module_label}</span>
      </nav>
      <span className="kb-category-chip mb-2 w-fit" data-category={topic.category}>
        {topic.category_label}
      </span>
      <h1 className="mb-2 text-2xl font-extrabold text-[var(--kb-text)]">{topic.title}</h1>
      <p className="mb-6 text-[var(--kb-text2)]">{topic.definition}</p>
      {html === null ? (
        <p role="status">טוען תוכן…</p>
      ) : (
        <div className="kb-topic-content" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <RelatedTopics relatedIds={topic.related_match} topicsById={topicsById} />
    </article>
  );
}
