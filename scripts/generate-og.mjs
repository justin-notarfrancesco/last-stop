// Generates public/og.png (1200×630) with zero dependencies — a hand-rolled
// PNG encoder (zlib deflate + CRC32) drawing the pixel train and wordmark.
// Runs automatically before `vite build`.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 1200;
const H = 630;
const px = Buffer.alloc(W * H * 4);

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

const BG = hex("#0b0e13");
const GRID = [244, 244, 242];
const BODY = hex("#b9bdc0");
const ROOF_HI = hex("#d7dbde");
const ROOF = hex("#ccd0d3");
const WINDOW = hex("#16262f");
const BLUE = hex("#0039a6");
const YELLOW = hex("#fccc0a");
const UNDER = hex("#0a0a0a");
const TRUCK = hex("#6f7376");
const HEADLIGHT = hex("#fde68a");
const ORANGE = hex("#ff6319");
const RED = hex("#ee352e");
const PAPER = hex("#f4f4f2");
const SKIN = hex("#e8b48a");

function set(x, y, [r, g, b], a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  const na = a / 255;
  px[i] = Math.round(r * na + px[i] * (1 - na));
  px[i + 1] = Math.round(g * na + px[i + 1] * (1 - na));
  px[i + 2] = Math.round(b * na + px[i + 2] * (1 - na));
  px[i + 3] = 255;
}

function rect(x, y, w, h, c, a = 255) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c, a);
}

// Background + faint route-map grid
rect(0, 0, W, H, BG);
for (let x = 0; x < W; x += 50) rect(x, 0, 2, H, GRID, 12);
for (let y = 0; y < H; y += 50) rect(0, y, W, 2, GRID, 12);

// --- "LAST STOP" wordmark, 5×7 pixel font ---
const GLYPHS = {
  L: ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"],
  A: [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
  T: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
  O: [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  P: ["XXXX.", "X...X", "X...X", "XXXX.", "X....", "X....", "X...."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

function text(str, x0, y0, s, color) {
  let cx = x0;
  for (const ch of str) {
    const glyph = GLYPHS[ch];
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++)
        if (glyph[gy][gx] === "X") rect(cx + gx * s, y0 + gy * s, s, s, color);
    cx += 6 * s;
  }
}

const TS = 12; // wordmark pixel size
const word = "LAST STOP";
const wordW = (word.length * 6 - 1) * TS;
text(word, Math.round((W - wordW) / 2), 96, TS, PAPER);
// Blue drop shadow line under the wordmark
rect(Math.round((W - wordW) / 2), 96 + 7 * TS + 8, wordW, 6, BLUE);

// --- The train: 5 coupled cars heading right, drawn at car scale CS ---
const CS = 15; // art-pixel size
const carArt = 8;
const cars = 5;
const trainW = cars * carArt * CS;
const tx0 = Math.round((W - trainW) / 2) - 60;
const ty0 = 360;

function carPixel(carX, u, v, c) {
  rect(tx0 + (carX * carArt + u) * CS, ty0 + v * CS, CS, CS, c);
}

for (let car = 0; car < cars; car++) {
  const isHead = car === cars - 1; // rightmost = lead cab
  const isTail = car === 0;
  const u0 = 0;
  const u1 = isHead ? 7 : 6;
  for (let u = u0; u <= u1; u++) {
    carPixel(car, u, 0, ROOF_HI);
    carPixel(car, u, 1, ROOF);
    carPixel(car, u, 2, BODY);
    carPixel(car, u, 3, BODY);
    carPixel(car, u, 4, BLUE);
    carPixel(car, u, 5, YELLOW);
    carPixel(car, u, 6, UNDER);
  }
  for (const u of [2, 3, 5, 6]) carPixel(car, u, 2, WINDOW);
  for (const u of [2, 5]) carPixel(car, u, 7, TRUCK);
  if (isHead) {
    carPixel(car, 7, 2, WINDOW);
    carPixel(car, 7, 3, HEADLIGHT);
    carPixel(car, 7, 1, ORANGE);
  }
  if (isTail) carPixel(car, 0, 3, RED);
}

// Headlight glow ahead of the cab
const gx = tx0 + cars * carArt * CS + CS * 2;
const gy = ty0 + 3.5 * CS;
for (let y = -70; y <= 70; y++)
  for (let x = -70; x <= 70; x++) {
    const d = Math.sqrt(x * x + y * y) / 70;
    if (d < 1) set(Math.round(gx + x), Math.round(gy + y), HEADLIGHT, Math.round(60 * (1 - d)));
  }

// A waiting passenger on a station marker, ahead of the train
const sx = gx + 130;
const sy = ty0;
rect(sx, sy + 3 * CS, 6 * CS, 5 * CS, WINDOW);
rect(sx + CS, sy + 4 * CS, 4 * CS, 3 * CS, PAPER);
rect(sx + 2 * CS, sy + 0, CS, CS, SKIN);
rect(sx + 2 * CS, sy + CS, CS, 2 * CS, ORANGE);

// --- PNG encoding ---
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA

const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter: none
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "og.png");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
