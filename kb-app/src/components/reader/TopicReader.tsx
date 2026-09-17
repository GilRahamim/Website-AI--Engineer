import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUiStore } from '../../store/uiStore';
import type { Topic } from '../../types';
import { buildToc } from '../../lib/tocFromHtml';
import { estimateReadingMinutes, getModulePosition } from '../../lib/topicNav';
import { getPathPrevNext } from '../../lib/learningPath';
import { useActiveHeading } from '../../hooks/useActiveHeading';
import { useReaderShortcuts } from '../../hooks/useReaderShortcuts';
import RelatedTopics from './RelatedTopics';
import PrevNextNav from './PrevNextNav';
import FinishTopicAction from './FinishTopicAction';
import ReaderAside from './ReaderAside';
import TopicNotes from '../topic/TopicNotes';
import { sizeFormulaImage } from '../../lib/formulaSizing';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TopicReaderProps {
  topic: Topic;
  topics: Topic[];
  topicsById: Map<string, Topic>;
}

type ContentState =
  | { path: string; status: 'loaded'; html: string }
  | { path: string; status: 'error'; offline: boolean };

const EMPTY_TOC = { headings: [], html: '' };

function readingTimeLabel(minutes: number): string {
  return minutes === 1 ? 'דקת קריאה אחת' : `≈ ${minutes} דקות קריאה`;
}

export default function TopicReader({ topic, topics, topicsById }: TopicReaderProps) {
  const [content, setContent] = useState<ContentState | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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
        if (!cancelled)
          setContent({ path: topic.contentPath, status: 'error', offline: !navigator.onLine });
      });
    return () => {
      cancelled = true;
    };
  }, [topic.contentPath]);

  const isCurrent = content?.path === topic.contentPath;
  const rawHtml = isCurrent && content.status === 'loaded' ? content.html : null;
  const error = isCurrent && content.status === 'error' ? content : null;

  const toc = useMemo(() => (rawHtml === null ? EMPTY_TOC : buildToc(rawHtml)), [rawHtml]);

  // Formula images were rasterised at wildly different resolutions and
  // carry no width/height attributes, so left alone they paint at full
  // pixel size (a one-line fraction came out ~650px wide on desktop).
  // scripts/measure-formulas.mjs measured each raster's glyph x-height;
  // here every formula is scaled so that x-height matches the surrounding
  // text, and gets an aspect-ratio so its space is reserved before load.
  // Diagrams (x-height 0) are left at natural size, capped by max-width.
  useEffect(() => {
    const root = contentRef.current;
    if (!root || toc.html === '') return;
    const images = root.querySelectorAll<HTMLImageElement>(
      'img.block-formula-img, img.cell-formula-img, img.inline-formula-img',
    );
    for (const img of images) sizeFormulaImage(img);
  }, [toc.html]);

  // React 19 re-assigns innerHTML whenever the dangerouslySetInnerHTML prop
  // is a new object, even with identical markup. A fresh `{ __html }` literal
  // on every render therefore rebuilt the whole article on each re-render
  // (store hydration, the table of contents highlight changing on scroll),
  // which detached the headings the IntersectionObserver was watching and
  // threw away the formula sizing above. One object per html string.
  const articleHtml = useMemo(() => ({ __html: toc.html }), [toc.html]);
  const headingIds = useMemo(() => toc.headings.map((h) => h.id), [toc]);
  const activeHeadingId = useActiveHeading(headingIds);
  const readingMinutes = rawHtml === null ? null : estimateReadingMinutes(rawHtml);

  const { prev, next } = getPathPrevNext(topic, topics);
  const position = getModulePosition(topic, topics);

  useReaderShortcuts({ topicId: topic.id, prev, next, notesRef });

  function scrollToHeading(id: string) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
  }

  // One grid for every viewport: on phones the aside (status control) sits
  // between the title block and the content; from lg up it moves to a
  // sticky first column (the leading/right edge in this RTL layout)
  // spanning both rows. A single aside instance keeps the radiogroup and
  // table of contents unique in the accessibility tree.
  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-6 lg:px-8">
      <article className="contents">
        <div className="min-w-0 max-w-[85ch] lg:col-start-2">
          <nav
            aria-label="breadcrumb"
            className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--kb-muted)]"
          >
            <Link to="/" className="no-underline hover:underline">
              בית
            </Link>
            <span aria-hidden="true">›</span>
            <Link
              to="/"
              onClick={() => useUiStore.getState().selectOnlyModule(topic.module)}
              className="no-underline hover:underline"
            >
              {topic.module_label}
            </Link>
          </nav>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="kb-category-chip" data-category={topic.category}>
                {topic.category_label}
              </span>
              <span className="text-xs text-[var(--kb-muted)]">{`נושא ${position.index} מתוך ${position.total} במודול`}</span>
            </div>
          </div>

          <h1 className="mb-3 text-3xl font-extrabold leading-tight text-[var(--kb-text)]">
            {topic.title}
          </h1>
          <p className="mb-3 text-lg leading-relaxed text-[var(--kb-text2)]">{topic.definition}</p>
          {readingMinutes !== null && (
            <p className="text-xs text-[var(--kb-muted)]">
              {readingTimeLabel(readingMinutes)}
              {topic.related_raw.length > 0 && ` · ${topic.related_raw.length} נושאים קשורים`}
            </p>
          )}
        </div>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <ReaderAside
            topic={topic}
            headings={toc.headings}
            activeHeadingId={activeHeadingId}
            onSelectHeading={scrollToHeading}
          />
        </div>

        <div className="min-w-0 max-w-[85ch] lg:col-start-2">
          <div className="border-t border-[var(--kb-border)] pt-6">
            {rawHtml === null ? (
              error ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>
                    {error.offline
                      ? 'אין חיבור לאינטרנט — ניתן לצפות רק בנושאים שנצפו כבר.'
                      : 'שגיאה בטעינת התוכן.'}
                  </AlertDescription>
                </Alert>
              ) : (
                <div role="status" aria-busy="true" className="flex min-h-96 flex-col gap-[0.85rem]">
                  <span className="sr-only">טוען תוכן…</span>
                  <Skeleton className="mb-2 h-5 w-[36%]" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[92%]" />
                  <Skeleton className="h-4 w-[85%]" />
                  <Skeleton className="h-4 w-[60%]" />
                  <Skeleton className="mt-5 h-5 w-[40%]" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[88%]" />
                  <Skeleton className="h-4 w-[70%]" />
                </div>
              )
            ) : (
              <div ref={contentRef} className="kb-topic-content" dangerouslySetInnerHTML={articleHtml} />
            )}
          </div>

          <FinishTopicAction topic={topic} next={next} />
          <PrevNextNav prev={prev} next={next} />
          <TopicNotes topicId={topic.id} inputRef={notesRef} />
          <RelatedTopics
            relatedIds={topic.related_match}
            relatedRaw={topic.related_raw}
            topicsById={topicsById}
          />
        </div>
      </article>
    </div>
  );
}
