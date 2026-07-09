// Everything date-related: the shared daily commute, puzzle numbering,
// and the countdown to the next one. Supports ?date=YYYY-MM-DD for testing.

/** First daily commute. #1 = launch day. */
const EPOCH_UTC = Date.UTC(2026, 6, 9); // 2026-07-09

const params = new URLSearchParams(location.search);

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local date as YYYY-MM-DD (commutes reset at local midnight, like Wordle). */
export function todayStr(): string {
  const fake = params.get("date");
  if (fake && /^\d{4}-\d{2}-\d{2}$/.test(fake)) return fake;
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isDateFaked(): boolean {
  return params.has("date");
}

/** Puzzle number for a YYYY-MM-DD string. Launch day is #1. */
export function puzzleNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86400000) + 1;
}

/** The date one day before a YYYY-MM-DD string. */
export function yesterdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** "07:12:33" until local midnight. */
export function timeToNextCommute(): string {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let s = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
