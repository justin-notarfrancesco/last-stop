// The emoji share card — the real leaderboard.

import { EXPRESS_AT } from "./game.ts";
import { puzzleNumber } from "./daily.ts";

const SITE = "laststop.game";
/** Stops per emoji square in the summary row. */
const STOPS_PER_SQUARE = 6;
const MAX_SQUARES = 6;

/**
 * Compact run summary row: blue = local stops, yellow = express stretch,
 * black = the crash. Length scales with the run so scores compare at a glance.
 */
export function emojiRow(score: number, express: boolean): string {
  if (score === 0) return "⬛";
  const localStops = Math.min(score, EXPRESS_AT);
  let blue = Math.ceil(localStops / STOPS_PER_SQUARE);
  let yellow = express ? Math.max(1, Math.ceil((score - EXPRESS_AT) / STOPS_PER_SQUARE)) : 0;
  while (blue + yellow > MAX_SQUARES) yellow > blue ? yellow-- : blue--;
  return "🟦".repeat(blue) + "🟨".repeat(yellow) + "⬛";
}

export function buildShareText(opts: {
  mode: "daily" | "free";
  dateStr: string;
  score: number;
  express: boolean;
}): string {
  const title =
    opts.mode === "daily"
      ? `LAST STOP #${puzzleNumber(opts.dateStr)} 🚇`
      : "LAST STOP · Free Ride 🚇";
  const service = opts.express ? "Express reached" : "Local service";
  const stops = `${opts.score} ${opts.score === 1 ? "stop" : "stops"}`;
  return `${title}\n${stops} · ${service}\n${emojiRow(opts.score, opts.express)}\n${SITE}`;
}

/** Copy to clipboard, then offer the native share sheet on mobile. */
export async function shareResult(text: string): Promise<"shared" | "copied" | "failed"> {
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    copied = legacyCopy(text);
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      /* user dismissed the sheet — clipboard already has it */
    }
  }
  return copied ? "copied" : "failed";
}

function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
