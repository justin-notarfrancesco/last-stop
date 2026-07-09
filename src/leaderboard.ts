// Leaderboard seam. Phase 1 ships without a backend — every finished run
// flows through submitScore() so a global daily board can bolt on later.
//
// Phase 2 plan (see README): arcade-style 3-initial entry (A–Z pixel picker,
// no free text, no PII), top-10 per day keyed by {date, seed}, Vercel KV or
// Supabase, basic rate limiting, profanity blocklist for initials.

export interface RunResult {
  /** Local date of the commute, YYYY-MM-DD. */
  date: string;
  /** Passengers picked up. */
  score: number;
  /** PRNG seed the map was generated from — lets the server verify date↔map. */
  seed: number;
  mode: "daily" | "free";
  /** Whether the run reached Express speed. */
  express: boolean;
  durationMs: number;
}

export function submitScore(result: RunResult): void {
  // Phase 2: POST to /api/score. For now the emoji share card is the leaderboard.
  if (import.meta.env.DEV) console.debug("[last-stop] run result", result);
}
