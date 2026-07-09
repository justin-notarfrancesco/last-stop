// Input: swipe anywhere (registers on move, not touchend), keyboard fallback.

import type { Dir } from "./game.ts";

const SWIPE_THRESHOLD = 24; // px

export interface InputHandlers {
  /** A directional intent — swipe or arrow/WASD. */
  onDir(d: Dir): void;
  /** Space/Enter/tap — used to (re)start. */
  onAction(): void;
}

export function initInput(h: InputHandlers): void {
  // --- Touch / pointer swipes, anywhere on screen ---
  let anchorX = 0;
  let anchorY = 0;
  let tracking = false;

  const isInteractive = (t: EventTarget | null): boolean =>
    t instanceof Element && t.closest("button, a") !== null;

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (isInteractive(e.target)) return;
      tracking = true;
      anchorX = e.clientX;
      anchorY = e.clientY;
    },
    { passive: true },
  );

  window.addEventListener(
    "pointermove",
    (e) => {
      if (!tracking) return;
      const dx = e.clientX - anchorX;
      const dy = e.clientY - anchorY;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
      const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      h.onDir(d);
      // Re-anchor so one continuous drag can register the next turn instantly.
      anchorX = e.clientX;
      anchorY = e.clientY;
    },
    { passive: true },
  );

  const stop = () => {
    tracking = false;
  };
  window.addEventListener("pointerup", stop, { passive: true });
  window.addEventListener("pointercancel", stop, { passive: true });

  // Belt and suspenders vs. pull-to-refresh / scroll bounce on iOS
  // (touch-action: none in CSS does the declarative half).
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!isInteractive(e.target)) e.preventDefault();
    },
    { passive: false },
  );

  // --- Keyboard (desktop fallback) ---
  const KEYS: Record<string, Dir> = {
    ArrowUp: 0,
    KeyW: 0,
    ArrowRight: 1,
    KeyD: 1,
    ArrowDown: 2,
    KeyS: 2,
    ArrowLeft: 3,
    KeyA: 3,
  };
  window.addEventListener("keydown", (e) => {
    const d = KEYS[e.code];
    if (d !== undefined) {
      e.preventDefault();
      h.onDir(d);
    } else if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      h.onAction();
    }
  });
}

export function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
