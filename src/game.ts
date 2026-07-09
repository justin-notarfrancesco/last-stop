// Core Snake state machine. Pure logic — no DOM, no canvas.

import { hashString, mulberry32 } from "./rng.ts";

export const COLS = 21;
export const ROWS = 21;
export const CELLS = COLS * ROWS;

/** Score at which the run goes from Local to Express. */
export const EXPRESS_AT = 12;

export type Dir = 0 | 1 | 2 | 3; // up, right, down, left
export const OPPOSITE: readonly Dir[] = [2, 3, 0, 1];
const DX: readonly number[] = [0, 1, 0, -1];
const DY: readonly number[] = [-1, 0, 1, 0];

export type Mode = "daily" | "free";
export type Status = "idle" | "running" | "dead";

export interface Game {
  mode: Mode;
  status: Status;
  dateStr: string;
  seed: number;
  /** Cell indices (y*COLS+x), head first. */
  snake: number[];
  dir: Dir;
  /** Queued turns, max 2, so fast double-swipes never drop. */
  queue: Dir[];
  /** Cell index of the waiting passenger, -1 if none fits. */
  passenger: number;
  obstacles: Set<number>;
  score: number;
  express: boolean;
  tickMs: number;
  startedAt: number;
  endedAt: number;
  /** Ticks of pickup squash left (render effect). */
  squash: number;
  rand: () => number;
}

export function cellOf(x: number, y: number): number {
  return y * COLS + x;
}
export function xOf(cell: number): number {
  return cell % COLS;
}
export function yOf(cell: number): number {
  return (cell / COLS) | 0;
}

function tickMsFor(score: number): number {
  return Math.max(85, 170 - score * 4);
}

const START_X = 10;
const START_Y = 10;

function placeObstacles(g: Game): void {
  if (g.mode !== "daily") return; // Free Ride: open track, pure practice
  const count = 3 + Math.floor(g.rand() * 4); // 3–6 Track Work zones
  let guard = 0;
  while (g.obstacles.size < count && guard++ < 500) {
    const x = 1 + Math.floor(g.rand() * (COLS - 2));
    const y = 1 + Math.floor(g.rand() * (ROWS - 2));
    // Keep the departure corridor clear: the row the train starts on.
    if (y === START_Y) continue;
    if (Math.abs(x - START_X) <= 2 && Math.abs(y - START_Y) <= 2) continue;
    g.obstacles.add(cellOf(x, y));
  }
}

/**
 * Next passenger spawn. Draws cells from the seeded PRNG stream and skips
 * occupied ones, so the spawn sequence is deterministic for a given play.
 */
function spawnPassenger(g: Game): void {
  const free = CELLS - g.snake.length - g.obstacles.size;
  if (free <= 0) {
    g.passenger = -1;
    return;
  }
  for (;;) {
    const c = Math.floor(g.rand() * CELLS);
    if (g.obstacles.has(c) || g.snake.includes(c)) continue;
    g.passenger = c;
    return;
  }
}

export function newGame(mode: Mode, dateStr: string): Game {
  const seed =
    mode === "daily"
      ? hashString(`last-stop:${dateStr}`)
      : (Math.random() * 0xffffffff) >>> 0;
  const g: Game = {
    mode,
    status: "idle",
    dateStr,
    seed,
    snake: [
      cellOf(START_X, START_Y),
      cellOf(START_X - 1, START_Y),
      cellOf(START_X - 2, START_Y),
    ],
    dir: 1,
    queue: [],
    passenger: -1,
    obstacles: new Set(),
    score: 0,
    express: false,
    tickMs: tickMsFor(0),
    startedAt: 0,
    endedAt: 0,
    squash: 0,
    rand: mulberry32(seed),
  };
  placeObstacles(g);
  spawnPassenger(g);
  return g;
}

/**
 * Queue a turn. Reversals are checked against the *last queued* direction
 * (not just the current one) so up-then-down mid-tick can't kill you.
 */
export function enqueueDir(g: Game, d: Dir): void {
  const base = g.queue.length > 0 ? g.queue[g.queue.length - 1] : g.dir;
  if (d === base || d === OPPOSITE[base]) return;
  if (g.queue.length < 2) g.queue.push(d);
}

export type TickResult = "moved" | "ate" | "died";

export function tick(g: Game): TickResult {
  if (g.status !== "running") return "moved";
  if (g.squash > 0) g.squash--;

  const next = g.queue.shift();
  if (next !== undefined) g.dir = next;

  const head = g.snake[0];
  const nx = xOf(head) + DX[g.dir];
  const ny = yOf(head) + DY[g.dir];

  // Walls — no wrap-around.
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return die(g);

  const nc = cellOf(nx, ny);
  if (g.obstacles.has(nc)) return die(g);

  const eating = nc === g.passenger;
  // Self-collision — but the tail cell vacates this tick unless we're growing.
  const tail = g.snake[g.snake.length - 1];
  const hitsSelf = g.snake.includes(nc) && !(nc === tail && !eating);
  if (hitsSelf) return die(g);

  g.snake.unshift(nc);
  if (eating) {
    g.score++;
    g.squash = 2;
    g.tickMs = tickMsFor(g.score);
    if (g.score >= EXPRESS_AT) g.express = true;
    spawnPassenger(g);
    return "ate";
  }
  g.snake.pop();
  return "moved";
}

function die(g: Game): TickResult {
  g.status = "dead";
  g.endedAt = performance.now();
  return "died";
}

export function start(g: Game, d: Dir): void {
  if (g.status !== "idle") return;
  // Any direction except straight into your own body works for departure.
  if (d !== OPPOSITE[g.dir]) g.dir = d;
  g.status = "running";
  g.startedAt = performance.now();
}
