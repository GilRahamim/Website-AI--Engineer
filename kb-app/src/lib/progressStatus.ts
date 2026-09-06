import type { ProgressStatus } from '../types';

export const ALL_STATUSES: ProgressStatus[] = ['new', 'learning', 'mastered'];

export const STATUS_LABELS: Record<ProgressStatus, string> = {
  new: 'חדש',
  learning: 'בלמידה',
  mastered: 'נשלט',
};

export const STATUS_GLYPHS: Record<ProgressStatus, string> = {
  new: '○',
  learning: '◐',
  mastered: '●',
};

export const NEXT_STATUS: Record<ProgressStatus, ProgressStatus> = {
  new: 'learning',
  learning: 'mastered',
  mastered: 'new',
};
