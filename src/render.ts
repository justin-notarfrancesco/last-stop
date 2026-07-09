// Canvas renderer. All pixel art is drawn on a low-res offscreen canvas
// (8 art-pixels per cell) and integer-scaled up with smoothing off, so it
// stays crisp at any devicePixelRatio.

import { COLS, ROWS, xOf, yOf, type Dir, type Game } from "./game.ts";

const ART = 8; // art pixels per cell
const ART_W = COLS * ART;
const ART_H = ROWS * ART;

// --- Palette (matches the portfolio pixel train) ---
const C_BG = "#0b0e13";
const C_GRID = "rgba(244, 244, 242, 0.045)";
const C_BODY = "#b9bdc0";
const C_ROOF_HI = "#d7dbde";
const C_ROOF = "#ccd0d3";
const C_WINDOW = "#16262f";
const C_WINDOW_GLOW = "#f7dd8a";
const C_STRIPE_BLUE = "#0039a6";
const C_STRIPE_YELLOW = "#fccc0a";
const C_UNDER = "#0a0a0a";
const C_TRUCK = "#6f7376";
const C_HEADLIGHT = "#fde68a";
const C_MARKER_ORANGE = "#ff6319";
const C_MARKER_RED = "#ee352e";
const C_STATION = "#f4f4f2";
const C_SKIN = "#e8b48a";
const COAT_COLORS = ["#0039a6", "#ff6319", "#00933c", "#ee352e", "#b933ad", "#996633"];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

export interface Renderer {
  render(g: Game, now: number): void;
  crash(now: number): void;
  resize(): void;
}

export function initRenderer(canvas: HTMLCanvasElement, frame: HTMLElement): Renderer {
  const ctx = canvas.getContext("2d")!;
  const art = document.createElement("canvas");
  art.width = ART_W;
  art.height = ART_H;
  const actx = art.getContext("2d")!;

  // Pre-rendered headlight glow sprite — no gradient allocation per frame.
  const glow = document.createElement("canvas");
  let cellDev = 0; // device px per cell on the main canvas
  let crashedAt = -1;

  function resize(): void {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const availCss = Math.max(120, Math.min(frame.clientWidth, frame.clientHeight));
    const scale = Math.max(1, Math.floor((availCss * dpr) / ART_W));
    const dev = ART_W * scale;
    canvas.width = dev;
    canvas.height = dev;
    canvas.style.width = `${dev / dpr}px`;
    canvas.style.height = `${dev / dpr}px`;
    ctx.imageSmoothingEnabled = false;
    cellDev = ART * scale;

    const r = cellDev * 1.6;
    glow.width = glow.height = Math.max(2, Math.ceil(r * 2));
    const gctx = glow.getContext("2d")!;
    const grad = gctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "rgba(253, 230, 138, 0.28)");
    grad.addColorStop(1, "rgba(253, 230, 138, 0)");
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, glow.width, glow.height);
  }

  // ---- art-canvas helpers ----
  function px(x: number, y: number, color: string): void {
    actx.fillStyle = color;
    actx.fillRect(x, y, 1, 1);
  }

  function drawBackground(): void {
    actx.fillStyle = C_BG;
    actx.fillRect(0, 0, ART_W, ART_H);
    actx.fillStyle = C_GRID;
    for (let i = 1; i < COLS; i++) actx.fillRect(i * ART, 0, 1, ART_H);
    for (let j = 1; j < ROWS; j++) actx.fillRect(0, j * ART, ART_W, 1);
  }

  function drawObstacle(cell: number): void {
    const ox = xOf(cell) * ART;
    const oy = yOf(cell) * ART;
    actx.fillStyle = C_UNDER;
    actx.fillRect(ox + 1, oy + 1, 6, 6);
    actx.fillStyle = C_STRIPE_YELLOW;
    for (let y = 1; y < 7; y++)
      for (let x = 1; x < 7; x++) if ((x + y) % 4 < 2) actx.fillRect(ox + x, oy + y, 1, 1);
  }

  function drawStation(cell: number, now: number): void {
    const ox = xOf(cell) * ART;
    const oy = yOf(cell) * ART;
    // Station marker: white rounded rectangle with a dark ring.
    actx.fillStyle = C_WINDOW;
    actx.fillRect(ox + 1, oy + 3, 6, 5);
    actx.fillStyle = C_BG; // knock out ring corners → "rounded"
    px(ox + 1, oy + 3, C_BG);
    px(ox + 6, oy + 3, C_BG);
    px(ox + 1, oy + 7, C_BG);
    px(ox + 6, oy + 7, C_BG);
    actx.fillStyle = C_STATION;
    actx.fillRect(ox + 2, oy + 4, 4, 3);
    // Waiting passenger, gently bobbing (unless reduced motion).
    const bob = reducedMotion.matches ? 0 : (Math.floor(now / 320) & 1);
    const coat = COAT_COLORS[cell % COAT_COLORS.length];
    px(ox + 3, oy + 0 + bob, C_SKIN);
    px(ox + 3, oy + 1 + bob, coat);
    px(ox + 3, oy + 2 + bob, coat);
    px(ox + 4, oy + 1 + bob, coat);
  }

  /**
   * One train car in an 8×8 cell, rotated by travel direction.
   * (u,v) are car-local: u along travel (7 = front), v across (0 = roof).
   */
  function carPx(cx: number, cy: number, dir: Dir, u: number, v: number, color: string): void {
    let x: number, y: number;
    switch (dir) {
      case 1: x = u; y = v; break;          // right
      case 3: x = 7 - u; y = v; break;      // left
      case 2: x = v; y = u; break;          // down
      default: x = v; y = 7 - u; break;     // up
    }
    px(cx * ART + x, cy * ART + y, color);
  }

  function drawCar(
    cell: number,
    dir: Dir,
    role: "head" | "body" | "tail",
    windowColor: string,
    squash: boolean,
  ): void {
    const cx = xOf(cell);
    const cy = yOf(cell);
    const u0 = 0; // cars butt up to the cell edge behind them…
    const u1 = role === "head" ? 7 : 6; // …leaving a 1px coupling gap in front
    const p = (u: number, v: number, c: string) => carPx(cx, cy, dir, u, v, c);
    // 1-frame squash on pickup: drop the roof-highlight row.
    if (!squash) for (let u = u0; u <= u1; u++) p(u, 0, C_ROOF_HI);
    for (let u = u0; u <= u1; u++) {
      p(u, 1, C_ROOF);
      p(u, 2, C_BODY);
      p(u, 3, C_BODY);
      p(u, 4, C_STRIPE_BLUE);   // MTA blue livery stripe…
      p(u, 5, C_STRIPE_YELLOW); // …over a yellow pinstripe
      p(u, 6, C_UNDER);
    }
    // Windows (two pairs per car).
    p(2, 2, windowColor);
    p(3, 2, windowColor);
    p(5, 2, windowColor);
    p(6, 2, windowColor);
    // Trucks (wheel bogies).
    p(2, 7, C_TRUCK);
    p(5, 7, C_TRUCK);
    if (role === "head") {
      p(7, 2, windowColor); // windshield
      p(7, 3, C_HEADLIGHT); // warm headlight
      p(7, 1, C_MARKER_ORANGE);
    }
    if (role === "tail") {
      p(0, 3, C_MARKER_RED);
    }
  }

  function segmentDir(from: number, to: number): Dir {
    const dx = xOf(to) - xOf(from);
    if (dx === 1) return 1;
    if (dx === -1) return 3;
    return yOf(to) - yOf(from) === 1 ? 2 : 0;
  }

  function windowColorFor(g: Game, now: number): string {
    if (g.status === "idle") return C_WINDOW_GLOW; // stopped train, lit cabin
    if (g.status === "dead") {
      const t = now - crashedAt;
      if (t < 480 && Math.floor(t / 80) % 2 === 0) return C_WINDOW_GLOW; // flicker
    }
    return C_WINDOW;
  }

  function render(g: Game, now: number): void {
    drawBackground();
    for (const o of g.obstacles) drawObstacle(o);
    if (g.passenger >= 0) drawStation(g.passenger, now);

    const win = windowColorFor(g, now);
    const snake = g.snake;
    const n = snake.length;
    for (let i = n - 1; i >= 0; i--) {
      const dir: Dir = i === 0 ? g.dir : segmentDir(snake[i], snake[i - 1]);
      const role = i === 0 ? "head" : i === n - 1 ? "tail" : "body";
      drawCar(snake[i], dir, role, win, i === 0 && g.squash > 0);
    }

    // Blit with screen shake after a crash (skipped under reduced motion).
    let sx = 0;
    let sy = 0;
    if (crashedAt >= 0 && g.status === "dead" && !reducedMotion.matches) {
      const t = now - crashedAt;
      if (t < 380) {
        const amp = ((380 - t) / 380) * cellDev * 0.28;
        sx = (Math.random() * 2 - 1) * amp;
        sy = (Math.random() * 2 - 1) * amp;
      }
    }
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(art, sx, sy, canvas.width, canvas.height);

    // Headlight glow thrown ahead of the cab.
    if (g.status !== "dead") {
      const head = snake[0];
      const hx = (xOf(head) + 0.5) * cellDev + sx;
      const hy = (yOf(head) + 0.5) * cellDev + sy;
      const ahead = cellDev * 1.1;
      const gx = hx + (g.dir === 1 ? ahead : g.dir === 3 ? -ahead : 0);
      const gy = hy + (g.dir === 2 ? ahead : g.dir === 0 ? -ahead : 0);
      ctx.drawImage(glow, gx - glow.width / 2, gy - glow.height / 2);
    }
  }

  resize();
  return {
    render,
    resize,
    crash(now: number) {
      crashedAt = now;
    },
  };
}
