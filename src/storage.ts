// localStorage persistence: best score, daily streak. All keys prefixed.

import { yesterdayOf } from "./daily.ts";

const KEY_BEST = "laststop.best";
const KEY_STREAK = "laststop.streak";
const KEY_LAST_PLAYED = "laststop.lastPlayed";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode etc. — game still works, just no persistence */
  }
}

export function getBest(): number {
  return Number(read(KEY_BEST)) || 0;
}

/** Returns true if this run set a new best. */
export function recordBest(score: number): boolean {
  if (score > getBest()) {
    write(KEY_BEST, String(score));
    return true;
  }
  return false;
}

export interface StreakInfo {
  streak: number;
  /** If today's play broke a streak, its old length (0 otherwise). */
  lost: number;
}

/** Call once per finished daily run. Idempotent within a day. */
export function recordDailyPlay(dateStr: string): StreakInfo {
  const last = read(KEY_LAST_PLAYED);
  let streak = Number(read(KEY_STREAK)) || 0;
  let lost = 0;
  if (last === dateStr) {
    return { streak: Math.max(streak, 1), lost: 0 };
  }
  if (last === yesterdayOf(dateStr)) {
    streak += 1;
  } else {
    if (streak > 1) lost = streak;
    streak = 1;
  }
  write(KEY_STREAK, String(streak));
  write(KEY_LAST_PLAYED, dateStr);
  return { streak, lost };
}

export function getStreak(dateStr: string): number {
  const last = read(KEY_LAST_PLAYED);
  const streak = Number(read(KEY_STREAK)) || 0;
  // A streak is only alive if you played today or yesterday.
  if (last === dateStr || last === yesterdayOf(dateStr)) return streak;
  return 0;
}
