import "./style.css";
import { inject } from "@vercel/analytics";
import {
  enqueueDir,
  newGame,
  start,
  tick,
  EXPRESS_AT,
  type Dir,
  type Game,
  type Mode,
} from "./game.ts";
import { initRenderer } from "./render.ts";
import { initInput, vibrate } from "./input.ts";
import { todayStr, puzzleNumber, timeToNextCommute, isDateFaked } from "./daily.ts";
import { buildShareText, emojiRow, shareResult } from "./share.ts";
import { getBest, recordBest, recordDailyPlay } from "./storage.ts";
import { submitScore } from "./leaderboard.ts";

inject();

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const params = new URLSearchParams(location.search);
const mode: Mode = params.get("mode") === "free" ? "free" : "daily";
const dateStr = todayStr();

// --- DOM ---
const canvas = $<HTMLCanvasElement>("board");
const frame = $("board-frame");
const hudLine = $("hud-line");
const hudScore = $("hud-score");
const hudExp = $("hud-exp");
const hudBest = $("hud-best");
const startOverlay = $("start-overlay");
const startSub = $("start-sub");
const deathCard = $("death-card");
const deathScore = $("death-score");
const deathStopsWord = $("death-stops-word");
const deathNote = $("death-note");
const deathRow = $("death-row");
const statBest = $("stat-best");
const statStreak = $("stat-streak");
const statStreakCol = $("stat-streak-col");
const metrocard = $("metrocard");
const mcPunches = $("mc-punches");
const streakLost = $("streak-lost");
const shareBtn = $<HTMLButtonElement>("share-btn");
const countdown = $("countdown");
const countdownBlock = $("countdown-block");
const rowInfo = $<HTMLButtonElement>("row-info");
const rowLegend = $("row-legend");
const modeLink = $<HTMLAnchorElement>("mode-link");

// --- Static chrome per mode ---
const puzzleNo = puzzleNumber(dateStr);
if (mode === "daily") {
  hudLine.textContent = `DAILY COMMUTE #${puzzleNo}`;
  startSub.textContent = `Daily Commute #${puzzleNo}${isDateFaked() ? " (test date)" : ""}`;
  modeLink.textContent = "Free Ride →";
  modeLink.href = withParams({ mode: "free" });
} else {
  hudLine.textContent = "FREE RIDE";
  startSub.textContent = "Free Ride · practice, no track work";
  modeLink.textContent = "← Daily Commute";
  modeLink.href = withParams({ mode: null });
}
hudBest.textContent = `BEST ${getBest()}`;

function withParams(changes: Record<string, string | null>): string {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(changes)) v === null ? p.delete(k) : p.set(k, v);
  const q = p.toString();
  return q ? `?${q}` : location.pathname;
}

// --- Game + renderer ---
let game: Game = newGame(mode, dateStr);
const renderer = initRenderer(canvas, frame);
window.addEventListener("resize", () => renderer.resize());

let countdownTimer = 0;
let cardShownAt = 0;

function onDeath(now: number): void {
  renderer.crash(now);
  vibrate(120);

  const { score, express, seed, startedAt } = game;
  submitScore({
    date: dateStr,
    score,
    seed,
    mode,
    express,
    durationMs: Math.round(now - startedAt),
  });

  const newBest = recordBest(score);
  hudBest.textContent = `BEST ${getBest()}`;

  deathScore.textContent = String(score);
  deathStopsWord.textContent = score === 1 ? "stop" : "stops";
  statBest.textContent = String(getBest());
  const notes: string[] = [];
  if (express) notes.push("◆ Express reached");
  if (newBest && score > 0) notes.push("New best!");
  deathNote.textContent = notes.join(" · ");
  deathRow.textContent = emojiRow(score, express);
  rowLegend.classList.add("hidden");
  rowInfo.setAttribute("aria-expanded", "false");

  if (mode === "daily") {
    const streak = recordDailyPlay(dateStr);
    statStreak.textContent = String(streak.streak);
    statStreakCol.classList.remove("hidden");
    metrocard.querySelector(".mc-count")!.innerHTML =
      `<b>${streak.streak}</b> day${streak.streak === 1 ? "" : "s"} riding`;
    mcPunches.textContent = "●".repeat(Math.min(streak.streak, 12));
    metrocard.classList.remove("hidden");
    if (streak.lost > 0) {
      streakLost.textContent = `streak lost — was ${streak.lost} days 💔`;
      streakLost.classList.remove("hidden");
    } else {
      streakLost.classList.add("hidden");
    }
    countdownBlock.classList.remove("hidden");
    const tickCountdown = () => {
      countdown.textContent = timeToNextCommute();
    };
    tickCountdown();
    countdownTimer = window.setInterval(tickCountdown, 1000);
  } else {
    statStreakCol.classList.add("hidden");
    metrocard.classList.add("hidden");
    streakLost.classList.add("hidden");
    countdownBlock.classList.add("hidden");
  }

  shareBtn.textContent = "Share";
  // Let the crash shake read for a beat, then the card. Still under a second.
  window.setTimeout(() => {
    deathCard.classList.remove("hidden");
    cardShownAt = performance.now();
  }, 520);
}

function restart(): void {
  window.clearInterval(countdownTimer);
  deathCard.classList.add("hidden");
  hudExp.classList.add("hidden");
  hudScore.textContent = "0";
  startOverlay.classList.remove("hidden");
  game = newGame(mode, dateStr);
}

rowInfo.addEventListener("click", () => {
  const nowHidden = rowLegend.classList.toggle("hidden");
  rowInfo.setAttribute("aria-expanded", String(!nowHidden));
});

shareBtn.addEventListener("click", async () => {
  const text = buildShareText({ mode, dateStr, score: game.score, express: game.express });
  const outcome = await shareResult(text);
  shareBtn.textContent =
    outcome === "copied" ? "Copied!" : outcome === "shared" ? "Shared 🚇" : "Copy failed";
});

// --- Input ---
initInput({
  onDir(d: Dir) {
    if (game.status === "idle") {
      startOverlay.classList.add("hidden");
      start(game, d);
    } else if (game.status === "running") {
      enqueueDir(game, d);
    } else if (d === 0) {
      // Swipe up to re-board — but not from the same gesture that crashed you.
      if (cardShownAt > 0 && performance.now() - cardShownAt > 250) restart();
    }
  },
  onAction() {
    if (game.status === "idle") {
      startOverlay.classList.add("hidden");
      start(game, game.dir);
    } else if (game.status === "dead" && performance.now() - cardShownAt > 250) {
      restart();
    }
  },
});

// --- Fixed-timestep loop ---
let last = performance.now();
let acc = 0;
let shownScore = 0;

function frameLoop(now: number): void {
  requestAnimationFrame(frameLoop);
  const dt = Math.min(now - last, 250); // clamp: background tab shouldn't fast-forward
  last = now;

  if (game.status === "running") {
    acc += dt;
    while (acc >= game.tickMs && game.status === "running") {
      acc -= game.tickMs;
      const result = tick(game);
      if (result === "ate") {
        vibrate(10);
        if (game.express && game.score === EXPRESS_AT) hudExp.classList.remove("hidden");
      } else if (result === "died") {
        onDeath(now);
      }
    }
  } else {
    acc = 0;
  }

  if (shownScore !== game.score) {
    shownScore = game.score;
    hudScore.textContent = String(shownScore);
  }
  renderer.render(game, now);
}
requestAnimationFrame(frameLoop);

// Dev-only hook so automated tests can inspect state.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__laststop = {
    get game() {
      return game;
    },
    get shareText() {
      return buildShareText({ mode, dateStr, score: game.score, express: game.express });
    },
  };
}

// --- Offline (production only): tiny runtime-caching service worker ---
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
