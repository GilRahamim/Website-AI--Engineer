import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Circle, CircleCheck, CircleDot, PartyPopper } from 'lucide-react';
import { getFirstUnmasteredTopic, getModulePathProgress, pathTopics } from '../lib/learningPath';
import { getPathMode } from '../lib/pathMode';
import { useUserDataStore } from '../store/userDataStore';
import { usePageTitle } from '../hooks/usePageTitle';
import Header from '../components/layout/Header';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

type RowState = 'done' | 'current' | 'upcoming';

const ROW_STATE_LABEL: Record<RowState, string> = {
  done: 'נלמד',
  current: 'הנושא הנוכחי בנתיב',
  upcoming: 'טרם נלמד',
};

function RowMarker({ state }: { state: RowState }) {
  if (state === 'done') {
    return <CircleCheck aria-hidden="true" size={18} className="shrink-0 text-[var(--kb-accent)]" />;
  }
  if (state === 'current') {
    return <CircleDot aria-hidden="true" size={18} className="shrink-0 text-[var(--kb-accent)]" />;
  }
  return <Circle aria-hidden="true" size={18} className="shrink-0 text-[var(--kb-muted)]" />;
}

/**
 * The whole course in teaching order, grouped by module: "✓ learned · ●
 * current · ○ not yet" per topic, overall progress, and a jump back to
 * wherever the user left off. See site-build-docs/06-LEARNING-PATH.md.
 */
export default function Path() {
  usePageTitle('נתיב למידה');
  const progress = useUserDataStore((s) => s.progress);
  const currentRowRef = useRef<HTMLLIElement>(null);
  const pathMode = getPathMode();

  const moduleGroups = getModulePathProgress(progress);
  const current = getFirstUnmasteredTopic(progress);
  const currentIndex = current ? pathTopics.findIndex((t) => t.id === current.id) : -1;
  const masteredCount = pathTopics.filter((t) => (progress.get(t.id) ?? 'new') === 'mastered').length;
  const percent = pathTopics.length > 0 ? Math.round((masteredCount / pathTopics.length) * 100) : 0;

  // Auto-scroll to wherever the user left off, once, on mount.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    currentRowRef.current?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'center' });
  }, []);

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 p-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">נתיב למידה</h1>
          {current && (
            <Button asChild className="min-h-11">
              <Link to={`/topic/${encodeURIComponent(current.id)}`}>המשך בנתיב</Link>
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 shadow-[var(--kb-shadow-sm)]">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--kb-text)]">{`${masteredCount} מתוך ${pathTopics.length} נושאים נשלטו`}</span>
            <span className="text-[var(--kb-muted)]">{`${percent}%`}</span>
          </div>
          <div
            role="progressbar"
            aria-label="התקדמות בנתיב הלמידה"
            aria-valuemin={0}
            aria-valuemax={pathTopics.length}
            aria-valuenow={masteredCount}
            className="h-2 w-full overflow-hidden rounded-full bg-[var(--kb-border)]"
          >
            <div className="h-full rounded-full bg-[var(--kb-accent)]" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {!current && (
          <div
            role="status"
            className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--kb-accent-soft)] bg-[var(--kb-accent-soft)] p-5 text-center"
          >
            <PartyPopper aria-hidden="true" size={22} className="text-[var(--kb-accent)]" />
            <p className="font-bold text-[var(--kb-text)]">סיימת את כל נתיב הלמידה!</p>
          </div>
        )}

        <Accordion type="multiple" defaultValue={moduleGroups.map((group) => group.moduleKey)} className="flex flex-col gap-3">
          {moduleGroups.map((group) => (
            <AccordionItem
              key={group.moduleKey}
              value={group.moduleKey}
              className="rounded-lg border border-b-0 border-[var(--kb-border)] bg-[var(--kb-surface2)]"
            >
              <AccordionTrigger className="min-h-11 px-4 py-2 text-start font-bold text-[var(--kb-text)] hover:no-underline">
                <span>{group.moduleLabel}</span>
                <span className="ms-auto text-sm font-normal text-[var(--kb-muted)]">{`${group.masteredCount}/${group.topics.length}`}</span>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2 pt-0">
                <ul role="list" className="flex flex-col gap-0.5">
                  {group.topics.map((topic) => {
                    const status = progress.get(topic.id) ?? 'new';
                    const isCurrent = current?.id === topic.id;
                    const state: RowState = status === 'mastered' ? 'done' : isCurrent ? 'current' : 'upcoming';
                    const topicIndex = pathTopics.findIndex((t) => t.id === topic.id);
                    const notYetReached =
                      pathMode === 'guided' && state === 'upcoming' && currentIndex !== -1 && topicIndex > currentIndex;
                    return (
                      <li key={topic.id} ref={isCurrent ? currentRowRef : undefined}>
                        <Link
                          to={`/topic/${encodeURIComponent(topic.id)}`}
                          aria-current={isCurrent ? 'true' : undefined}
                          className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm no-underline hover:bg-[var(--kb-surface)] ${
                            isCurrent ? 'bg-[var(--kb-accent-soft)] font-semibold text-[var(--kb-accent)]' : 'text-[var(--kb-text)]'
                          }`}
                        >
                          <RowMarker state={state} />
                          <span className="min-w-0 flex-1 truncate">{topic.title}</span>
                          <span className="sr-only">{ROW_STATE_LABEL[state]}</span>
                          {notYetReached && (
                            <span className="shrink-0 text-xs text-[var(--kb-muted)]">עדיין לא הגעת לכאן</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </>
  );
}
