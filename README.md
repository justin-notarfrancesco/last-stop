# LAST STOP 🚇

**Snake, but you're driving the NYC subway.** Swipe to steer a 16-bit pixel-art
train around a route-map grid, pick up waiting passengers (each one couples
another car onto your train), and don't crash. When you do, you get a
service-alert card — *"Service Suspended — this train made 28 stops"* — and a
Wordle-style emoji result to send to your group chat.

![gameplay GIF placeholder](docs/gameplay.gif)

```
LAST STOP #142 🚇
28 stops · Express reached
🟦🟦🟨🟨🟨⬛
laststop.game
```

## Why it spreads

- **Daily Commute (default).** One shared, date-seeded map per day — same
  🚧 Track Work obstacles, same passenger spawn sequence for everyone, from a
  deterministic PRNG (`mulberry32` seeded by the date). Everyone compares the
  same commute. A countdown to the next one keeps you coming back.
- **Emoji share card.** One tap copies (and opens the native share sheet on
  mobile). Blue = local stops, yellow = the express stretch, black = the crash.
  Under 5 lines; looks great in iMessage.
- **Streaks.** A MetroCard that earns a punch per day. Miss a day and it stings.
- **Instant restart.** Crash → card → swipe up to re-board. No menus, ever.
- **Free Ride** endless practice mode, tucked behind a footer link.

## Play

- **Mobile:** swipe anywhere, any time. That's the whole tutorial.
- **Desktop:** arrows / WASD. Space or Enter to (re)start.
- The run goes **Local → Express** as your train grows — the ticker speeds up
  and a ◆ EXP badge appears at 12 passengers.

## Develop

```sh
npm install
npm run dev        # local dev server
npm run build      # regenerates public/og.png, type-checks, bundles to dist/
npm run preview    # serve the production build
```

Vanilla TypeScript + `<canvas>`, no framework. Pixel art is drawn on a low-res
offscreen canvas and integer-scaled with smoothing off so it's crisp at any
devicePixelRatio. Deploys statically anywhere (Vercel, GitHub Pages, Netlify).

### Test the daily seed

The commute is seeded from the local date. Fake it with a query param:

```
http://localhost:5173/?date=2026-08-01
```

Same date → same obstacles and spawn sequence, everywhere. `?mode=free` for
Free Ride.

## Phase 2: global daily leaderboard

The seam already exists — every finished run flows through `submitScore()` in
[`src/leaderboard.ts`](src/leaderboard.ts) with `{date, score, seed, mode,
express, durationMs}`. The plan:

- **Arcade-style 3-initial entry**: an A–Z pixel picker, no free text, no PII.
- Top-10 per day, keyed by date (the seed lets the server sanity-check that a
  submitted run matches that day's map).
- Vercel KV or Supabase; basic per-IP rate limiting; a profanity blocklist for
  initials.
- The daily emoji share stays the *real* leaderboard — the table is a
  retention bonus.

## Name

Shipping as **LAST STOP**. Considered: **RUSH HOUR** (great, but a famous
board game owns it), **STRAPHANGER** (too long for a wordmark), **OFF THE
RAILS** (reads as failure-first). LAST STOP keeps the double meaning — every
run ends at your last stop.
