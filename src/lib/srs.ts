/**
 * Spaced-repetition scheduling using the SM-2 algorithm.
 *
 * Each item stores: interval (days), ease (easiness factor), repetitions
 * (consecutive correct), and dueAt. `rate` is the student's self/auto grade
 * on a 0-5 scale (0-2 = lapse, 3+ = correct).
 */

export interface SrsState {
  dueAt: Date;
  interval: number;
  ease: number;
  repetitions: number;
}

export function nextSrs(
  prev: { interval?: number; ease?: number; repetitions?: number },
  rating: number,
  now: Date = new Date()
): SrsState {
  let { ease = 2.5, repetitions = 0 } = prev;
  let interval = prev.interval ?? 0;

  if (rating < 3) {
    // Lapse: reset repetitions, show again soon.
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * ease);
    ease = Math.max(1.3, ease + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));
  }

  const dueAt = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  return { dueAt, interval, ease, repetitions };
}

export function dueItemsCount(dueAt: Date, now: Date = new Date()): number {
  return dueAt.getTime() <= now.getTime() ? 1 : 0;
}
