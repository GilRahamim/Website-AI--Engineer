import type { SrsCard, SrsRating, Topic } from '../types';

const DAY_MS = 86400000;
const MIN_EASE = 1.3;
const STARTING_EASE = 2.5;

export function isDue(card: SrsCard | undefined, now: number): boolean {
  return card === undefined || card.dueAt <= now;
}

export function gradeCard(topicId: string, card: SrsCard | undefined, rating: SrsRating, now: number): SrsCard {
  let { ease, intervalDays, reps, lapses } = card ?? {
    ease: STARTING_EASE,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
  };
  reps += 1;

  switch (rating) {
    case 'again':
      intervalDays = 1;
      ease = Math.max(MIN_EASE, ease - 0.2);
      lapses += 1;
      break;
    case 'hard':
      intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
      ease = Math.max(MIN_EASE, ease - 0.15);
      break;
    case 'good':
      intervalDays = Math.max(1, Math.round(intervalDays * ease));
      break;
    case 'easy':
      intervalDays = Math.max(1, Math.round(intervalDays * ease * 1.3));
      ease = ease + 0.15;
      break;
  }

  return { topicId, ease, intervalDays, reps, lapses, dueAt: now + intervalDays * DAY_MS, updatedAt: now };
}

export function getDueTopicIds(topics: Topic[], srsCards: Map<string, SrsCard>, now: number): string[] {
  return topics.filter((topic) => isDue(srsCards.get(topic.id), now)).map((topic) => topic.id);
}

export interface DueStats {
  /** Scheduled cards whose review date has arrived. */
  dueCount: number;
  /** Topics that have never been reviewed (no card yet). */
  newCount: number;
  /** Cards reviewed at least once. */
  reviewedCount: number;
}

/**
 * Splits the "due" notion used by the flashcard queue (where a never-reviewed
 * topic counts as due so it can be introduced) into what the dashboard and
 * badges should show: only cards on a real schedule count as due, so a fresh
 * user sees zero waiting rather than the whole course.
 */
export function getDueStats(topics: Topic[], srsCards: Map<string, SrsCard>, now: number): DueStats {
  let dueCount = 0;
  let newCount = 0;
  let reviewedCount = 0;
  for (const topic of topics) {
    const card = srsCards.get(topic.id);
    if (!card) {
      newCount += 1;
      continue;
    }
    if (card.reps > 0) reviewedCount += 1;
    if (card.dueAt <= now) dueCount += 1;
  }
  return { dueCount, newCount, reviewedCount };
}
