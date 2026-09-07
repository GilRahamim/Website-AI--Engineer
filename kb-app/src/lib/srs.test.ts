import { describe, expect, it } from 'vitest';
import { gradeCard, getDueTopicIds, isDue } from './srs';
import type { SrsCard, Topic } from '../types';

const NOW = 1_700_000_000_000;
const DAY_MS = 86400000;

function card(overrides: Partial<SrsCard>): SrsCard {
  return { topicId: 'a', ease: 2.5, intervalDays: 0, dueAt: NOW, reps: 0, lapses: 0, updatedAt: NOW, ...overrides };
}

describe('isDue', () => {
  it('treats a missing record as due', () => {
    expect(isDue(undefined, NOW)).toBe(true);
  });

  it('treats a past-due dueAt as due', () => {
    expect(isDue(card({ dueAt: NOW - 1 }), NOW)).toBe(true);
  });

  it('treats dueAt exactly now as due', () => {
    expect(isDue(card({ dueAt: NOW }), NOW)).toBe(true);
  });

  it('treats a future dueAt as not due', () => {
    expect(isDue(card({ dueAt: NOW + 1 }), NOW)).toBe(false);
  });
});

describe('gradeCard', () => {
  it('starts a never-reviewed topic at ease 2.5, interval 0, then applies the rating', () => {
    const result = gradeCard('a', undefined, 'good', NOW);
    expect(result).toMatchObject({ topicId: 'a', ease: 2.5, intervalDays: 1, reps: 1, lapses: 0 });
    expect(result.dueAt).toBe(NOW + 1 * DAY_MS);
    expect(result.updatedAt).toBe(NOW);
  });

  it('again resets interval to 1 day, drops ease by 0.2, increments lapses', () => {
    const current = card({ ease: 2.5, intervalDays: 10, reps: 3, lapses: 0 });
    const result = gradeCard('a', current, 'again', NOW);
    expect(result.intervalDays).toBe(1);
    expect(result.ease).toBeCloseTo(2.3);
    expect(result.lapses).toBe(1);
    expect(result.reps).toBe(4);
    expect(result.dueAt).toBe(NOW + DAY_MS);
  });

  it('again never drops ease below the 1.3 floor', () => {
    const current = card({ ease: 1.35, intervalDays: 5 });
    const result = gradeCard('a', current, 'again', NOW);
    expect(result.ease).toBeCloseTo(1.3);
  });

  it('hard multiplies interval by 1.2 (rounded) and drops ease by 0.15', () => {
    const current = card({ ease: 2.0, intervalDays: 10 });
    const result = gradeCard('a', current, 'hard', NOW);
    expect(result.intervalDays).toBe(12);
    expect(result.ease).toBeCloseTo(1.85);
  });

  it('hard never drops ease below the 1.3 floor', () => {
    const current = card({ ease: 1.4, intervalDays: 5 });
    const result = gradeCard('a', current, 'hard', NOW);
    expect(result.ease).toBeCloseTo(1.3);
  });

  it('good multiplies interval by ease, at least 1 day, and leaves ease unchanged', () => {
    const current = card({ ease: 2.5, intervalDays: 4 });
    const result = gradeCard('a', current, 'good', NOW);
    expect(result.intervalDays).toBe(10);
    expect(result.ease).toBe(2.5);
  });

  it('easy multiplies interval by ease*1.3 and increases ease by 0.15', () => {
    const current = card({ ease: 2.5, intervalDays: 4 });
    const result = gradeCard('a', current, 'easy', NOW);
    expect(result.intervalDays).toBe(13);
    expect(result.ease).toBeCloseTo(2.65);
  });

  it('interval never drops below 1 day even from a 0-interval hard/easy rating', () => {
    expect(gradeCard('a', undefined, 'hard', NOW).intervalDays).toBe(1);
    expect(gradeCard('a', undefined, 'easy', NOW).intervalDays).toBe(1);
  });

  it('preserves the topicId argument regardless of an existing card', () => {
    expect(gradeCard('specific-id', undefined, 'good', NOW).topicId).toBe('specific-id');
  });
});

describe('getDueTopicIds', () => {
  function topic(id: string): Topic {
    return {
      id,
      module: 'm',
      module_label: 'M',
      category: 'concepts',
      category_label: 'C',
      num: 1,
      slug_name: id,
      title: id,
      definition: 'd',
      related_raw: [],
      related_match: [],
      contentPath: '/x.html',
    };
  }

  it('includes never-reviewed and past-due topics, excludes future-due topics', () => {
    const topics = [topic('a'), topic('b'), topic('c')];
    const srsCards = new Map<string, SrsCard>([
      ['b', card({ topicId: 'b', dueAt: NOW - 1 })],
      ['c', card({ topicId: 'c', dueAt: NOW + DAY_MS })],
    ]);
    expect(getDueTopicIds(topics, srsCards, NOW)).toEqual(['a', 'b']);
  });
});
