import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, PartyPopper } from 'lucide-react';
import type { Topic } from '../../types';
import { isModuleComplete } from '../../lib/learningPath';
import { useUserDataStore } from '../../store/userDataStore';
import { Button } from '@/components/ui/button';

interface FinishTopicActionProps {
  topic: Topic;
  next: Topic | null;
}

/**
 * The path's "Finish a topic" action (site-build-docs/06-LEARNING-PATH.md):
 * marks the topic mastered and moves on. If that was the last unmastered
 * topic in its module, the move-on is held back a beat to offer a
 * module-scoped quiz instead of silently jumping into the next module.
 */
export default function FinishTopicAction({ topic, next }: FinishTopicActionProps) {
  const status = useUserDataStore((s) => s.progress.get(topic.id) ?? 'new');
  const navigate = useNavigate();
  const [moduleJustCompleted, setModuleJustCompleted] = useState(false);

  function handleFinish() {
    useUserDataStore.getState().setStatus(topic.id, 'mastered');
    if (isModuleComplete(topic, useUserDataStore.getState().progress)) {
      setModuleJustCompleted(true);
      return;
    }
    if (next) navigate(`/topic/${encodeURIComponent(next.id)}`);
  }

  if (moduleJustCompleted) {
    return (
      <div
        role="status"
        className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-[var(--kb-accent-soft)] bg-[var(--kb-accent-soft)] p-5 text-center"
      >
        <PartyPopper aria-hidden="true" size={22} className="text-[var(--kb-accent)]" />
        <p className="font-bold text-[var(--kb-text)]">{`סיימת את המודול "${topic.module_label}"!`}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild className="min-h-11">
            <Link to="/quiz" state={{ module: topic.module }}>
              בוחן קצר על המודול
            </Link>
          </Button>
          {next && (
            <Button type="button" variant="outline" asChild className="min-h-11">
              <Link to={`/topic/${encodeURIComponent(next.id)}`}>המשך לנושא הבא</Link>
            </Button>
          )}
        </div>
        {!next && <p className="text-sm text-[var(--kb-muted)]">סיימת את כל הנושאים בנתיב הלמידה!</p>}
      </div>
    );
  }

  if (status === 'mastered') return null;

  return (
    <Button type="button" onClick={handleFinish} className="mt-8 min-h-11 w-full gap-2 sm:w-auto">
      <CheckCircle2 aria-hidden="true" size={18} />
      סמן כנלמד והמשך
    </Button>
  );
}
