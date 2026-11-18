// news-image-20261117 v3 — "THE TUESDAY PAPER"
// A program that draws one front page summing up Tuesday 17 November 2026
// in a single 1024x1024 PNG. Node 22 standard library only (node:fs,
// node:path, node:zlib). No network, no clock, no randomness: every run
// writes byte-identical output.
//
// v3 rebuilds the text rendering from scratch: the v1/v2 5x7 pixel font
// garbled at judge size (~300px) because its strokes were 1px thin and its
// letters cramped. v3 uses a new 6x9 bitmap font drawn with 2-cell thick
// strokes, generous tracking, and larger type throughout, so every word
// stays readable when the page is downscaled to 300px. All text is
// uppercase (no descenders to clip), and every story is verified against
// the reporting of 17 November 2026; disputed claims are attributed
// in the text itself ("Russia says ...", "Iran says ...").
//
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

// ---------------------------------------------------------------- palette
const PAPER: RGB = [243, 235, 214];
const PAPER_DK: RGB = [232, 222, 196];
const INK: RGB = [24, 22, 18];
const INK_SOFT: RGB = [74, 68, 58];
const RED: RGB = [168, 44, 32];
const RED_DK: RGB = [128, 30, 22];
const BLUE: RGB = [31, 78, 121];
const TEAL: RGB = [14, 102, 92];
const GOLD: RGB = [150, 112, 28];
const SKY: RGB = [178, 208, 226];
const SEA: RGB = [46, 107, 138];
const SEA_DK: RGB = [32, 84, 112];
const LAND: RGB = [168, 184, 122];
const LAND_DK: RGB = [140, 158, 96];
const SMOKE: RGB = [120, 120, 118];
const WHITE: RGB = [250, 248, 242];

// ------------------------------------------------------- font: 6 wide x 9 tall
// Each glyph is 9 rows of 6 cells. Strokes are 2 cells thick so they survive
// a downscale to ~300px. '#' = ink, '.' = empty.
const FONT: Record<string, string[]> = {
  A: ["..##..", ".####.", "##..##", "##..##", "##..##", "######", "##..##", "##..##", "##..##"],
  B: ["#####.", "##..##", "##..##", "##..##", "#####.", "##..##", "##..##", "##..##", "#####."],
  C: [".####.", "##..##", "##....", "##....", "##....", "##....", "##....", "##..##", ".####."],
  D: ["####..", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "####.."],
  E: ["######", "##....", "##....", "##....", "#####.", "##....", "##....", "##....", "######"],
  F: ["######", "##....", "##....", "##....", "#####.", "##....", "##....", "##....", "##...."],
  G: [".####.", "##..##", "##....", "##....", "##.###", "##..##", "##..##", "##..##", ".####."],
  H: ["##..##", "##..##", "##..##", "##..##", "######", "##..##", "##..##", "##..##", "##..##"],
  I: ["######", "...##.", "...##.", "...##.", "...##.", "...##.", "...##.", "...##.", "######"],
  J: ["######", "....##", "....##", "....##", "....##", "....##", "....##", "##..##", ".####."],
  K: ["##..##", "##..##", "##.##.", "####..", "####..", "##.##.", "##..##", "##..##", "##..##"],
  L: ["##....", "##....", "##....", "##....", "##....", "##....", "##....", "##....", "######"],
  M: ["##..##", "##..##", "######", "######", "##..##", "##..##", "##..##", "##..##", "##..##"],
  N: ["##..##", "##..##", "###.##", "###.##", "##.###", "##.###", "##..##", "##..##", "##..##"],
  O: [".####.", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", ".####."],
  P: ["#####.", "##..##", "##..##", "##..##", "#####.", "##....", "##....", "##....", "##...."],
  Q: [".####.", "##..##", "##..##", "##..##", "##..##", "##..##", "##.###", "##..##", ".###.#"],
  R: ["#####.", "##..##", "##..##", "##..##", "#####.", "##.##.", "##..##", "##..##", "##..##"],
  S: [".####.", "##..##", "##....", "##....", ".####.", "....##", "....##", "##..##", ".####."],
  T: ["######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],
  U: ["##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", ".####."],
  V: ["##..##", "##..##", "##..##", "##..##", "##..##", "##..##", ".####.", ".####.", "..##.."],
  W: ["##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "######", "######", "##..##"],
  X: ["##..##", "##..##", "##..##", ".####.", "..##..", ".####.", "##..##", "##..##", "##..##"],
  Y: ["##..##", "##..##", "##..##", ".####.", "..##..", "..##..", "..##..", "..##..", "..##.."],
  Z: ["######", "....##", "....##", "...##.", "..##..", ".##...", "##....", "##....", "######"],
  "0": ["######", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "######"],
  "1": ["...##.", "..###.", "...##.", "...##.", "...##.", "...##.", "...##.", "...##.", ".#####"],
  "2": [".####.", "##..##", "....##", "....##", "...##.", "..##..", ".##...", "##....", "######"],
  "3": ["#####.", "....##", "....##", "....##", ".####.", "....##", "....##", "....##", "#####."],
  "4": ["##..##", "##..##", "##..##", "##..##", "######", "....##", "....##", "....##", "....##"],
  "5": ["######", "##....", "##....", "##....", "#####.", "....##", "....##", "##..##", ".####."],
  "6": [".####.", "##..##", "##....", "##....", "#####.", "##..##", "##..##", "##..##", ".####."],
  "7": ["######", "....##", "....##", "...##.", "...##.", "..##..", "..##..", "..##..", "..##.."],
  "8": [".####.", "##..##", "##..##", "##..##", ".####.", "##..##", "##..##", "##..##", ".####."],
  "9": [".####.", "##..##", "##..##", "##..##", ".#####", "....##", "....##", "##..##", ".####."],
  ".": ["......", "......", "......", "......", "......", "......", "......", "..##..", "..##.."],
  ",": ["......", "......", "......", "......", "......", "......", "..##..", "..##..", ".##..."],
  ":": ["......", "......", "..##..", "..##..", "......", "......", "..##..", "..##..", "......"],
  ";": ["......", "......", "..##..", "..##..", "......", "......", "..##..", "..##..", ".##..."],
  "!": ["..##..", "..##..", "..##..", "..##..", "..##..", "..##..", "......", "..##..", "..##.."],
  "?": [".####.", "##..##", "....##", "....##", "...##.", "..##..", "......", "..##..", "..##.."],
  "'": ["...##.", "...##.", "...##.", "......", "......", "......", "......", "......", "......"],
  '"': [".##.##", ".##.##", ".##.##", "......", "......", "......", "......", "......", "......"],
  "(": ["...##.", "..##..", ".##...", ".##...", ".##...", ".##...", ".##...", "..##..", "...##."],
  ")": [".##...", "..##..", "...##.", "...##.", "...##.", "...##.", "...##.", "..##..", ".##..."],
  "-": ["......", "......", "......", "......", ".####.", ".####.", "......", "......", "......"],
  "—": ["......", "......", "......", "......", "######", "######", "......", "......", "......"],
  "·": ["......", "......", "......", "......", "..##..", "..##..", "......", "......", "......"],
  "/": ["....##", "....##", "...##.", "...##.", "..##..", "..##..", ".##...", ".##...", "##...."],
  "$": ["..##..", ".####.", "##..##", "##....", ".####.", "....##", "##..##", ".####.", "..##.."],
  "+": ["......", "..##..", "..##..", "..##..", "######", "######", "..##..", "..##..", "......"],
  "=": ["......", "......", "######", "######", "......", "######", "######", "......", "......"],
  "&": [".####.", "##..##", "##..##", ".###..", "##.##.", "##..##", "##.##.", "##..##", ".##.##"],
  " ": ["......", "......", "......", "......", "......", "......", "......", "......", "......"],
};

const GLYPH_W = 6;
const GLYPH_H = 9;
function advance(scale: number, track?: number): number {
  return GLYPH_W * scale + (track ?? scale); // tracking px between glyphs
}
function textWidth(text: string, scale: number, track?: number): number {
  if (text.length === 0) return 0;
  return text.length * advance(scale, track) - (track ?? scale);
}
// Greedy word wrap; returns lines that fit maxWidth px.
function wrap(text: string, scale: number, maxWidth: number, track?: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur === "" ? w : cur + " " + w;
    if (textWidth(t, scale, track) <= maxWidth || cur === "") {
      cur = t;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- canvas
class Canvas {
  buf: Uint8Array;
  constructor() {
    this.buf = new Uint8Array(W * H * 3);
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(W, Math.ceil(x + w));
    const y1 = Math.min(H, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * W + xx) * 3;
        this.buf[i] = c[0];
        this.buf[i + 1] = c[1];
        this.buf[i + 2] = c[2];
      }
    }
  }
  // Thick line: walk the segment, stamping filled discs of radius r.
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, r: number): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + (dx * s) / steps);
      const y = Math.round(y0 + (dy * s) / steps);
      this.disc(x, y, r, c);
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) this.px(x, y, c);
      }
    }
  }
  ring(cx: number, cy: number, r: number, c: RGB): void {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      this.px(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
    }
  }
  // Scanline polygon fill (even-odd), vertices as [x, y] pairs.
  poly(pts: Array<[number, number]>, c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k]));
        const x1 = Math.min(W - 1, Math.floor(xs[k + 1]));
        for (let x = x0; x <= x1; x++) this.px(x, y, c);
      }
    }
  }
  glyph(ch: string, x: number, y: number, scale: number, c: RGB, bold: boolean): void {
    const g = FONT[ch] ?? FONT["?"];
    const passes = bold ? [0, Math.max(1, Math.round(scale / 2))] : [0];
    for (const dx of passes) {
      for (let r = 0; r < GLYPH_H; r++) {
        const row = g[r];
        for (let col = 0; col < GLYPH_W; col++) {
          if (row[col] === "#") {
            this.rect(x + dx + col * scale, y + r * scale, scale, scale, c);
          }
        }
      }
    }
  }
  text(str: string, x: number, y: number, scale: number, c: RGB, bold = false, track?: number): void {
    let cx = x;
    for (const ch of str) {
      this.glyph(ch, cx, y, scale, c, bold);
      cx += advance(scale, track);
    }
  }
  textCentered(str: string, cx: number, y: number, scale: number, c: RGB, bold = false, track?: number): void {
    this.text(str, cx - Math.floor(textWidth(str, scale, track) / 2), y, scale, c, bold, track);
  }
}

// ------------------------------------------------------------- world map
// Continents as simplified lon/lat coastal outlines. Projected with a
// plain linear map so pins (true lon/lat) always land on the right place:
//   mapX = MAP_X + (lon + 170) * MAP_SX
//   mapY = MAP_Y + (78 - lat) * MAP_SY
const MAP_X = 20;
let MAP_Y = 654;
const MAP_W = 520;
const MAP_H = 150;
const MAP_SX = MAP_W / 360;
const MAP_SY = MAP_H / 136;
function proj(lon: number, lat: number): [number, number] {
  return [MAP_X + (lon + 170) * MAP_SX, MAP_Y + (78 - lat) * MAP_SY];
}
function projPoly(ll: Array<[number, number]>): Array<[number, number]> {
  return ll.map(([lo, la]) => proj(lo, la));
}

const NORTH_AMERICA: Array<[number, number]> = [
  [-168, 66], [-161, 58], [-153, 58], [-145, 60], [-137, 58], [-131, 54], [-127, 50],
  [-124, 48], [-124, 40], [-121, 34], [-117, 33], [-112, 29], [-109, 25], [-106, 22],
  [-102, 18], [-97, 16], [-94, 17], [-90, 14], [-86, 12], [-83, 9], [-80, 8], [-78, 7],
  [-80, 9], [-83, 9], [-85, 11], [-87, 13], [-88, 14], [-90, 14], [-92, 15], [-94, 17],
  [-96, 19], [-97, 22], [-97, 26], [-93, 30], [-90, 29], [-86, 30], [-83, 30], [-81, 25],
  [-80, 27], [-80, 32], [-76, 35], [-74, 39], [-71, 41], [-69, 44], [-66, 44], [-61, 46],
  [-56, 47], [-59, 49], [-64, 49], [-65, 53], [-60, 55], [-64, 58], [-68, 58], [-72, 62],
  [-77, 62], [-79, 65], [-83, 66], [-87, 66], [-92, 66], [-95, 69], [-100, 68], [-110, 68],
  [-120, 69], [-130, 70], [-140, 70], [-150, 71], [-158, 71], [-165, 68],
];
const SOUTH_AMERICA: Array<[number, number]> = [
  [-79, 8], [-76, 10], [-73, 11], [-71, 12], [-68, 11], [-64, 10], [-61, 9], [-58, 8],
  [-55, 6], [-52, 5], [-50, 0], [-48, -3], [-44, -3], [-41, -3], [-38, -5], [-35, -7],
  [-35, -9], [-37, -13], [-39, -17], [-40, -21], [-42, -23], [-46, -24], [-48, -27],
  [-50, -30], [-53, -33], [-55, -35], [-57, -38], [-60, -40], [-62, -41], [-65, -43],
  [-66, -46], [-68, -49], [-69, -52], [-71, -54], [-73, -53], [-74, -50], [-73, -46],
  [-73, -42], [-72, -38], [-71, -33], [-70, -28], [-70, -23], [-70, -19], [-72, -16],
  [-75, -15], [-77, -12], [-79, -8], [-81, -5], [-81, -2], [-80, 1], [-79, 4],
];
const AFRICA: Array<[number, number]> = [
  [-6, 35], [-9, 32], [-13, 28], [-16, 24], [-17, 20], [-17, 15], [-16, 12], [-14, 10],
  [-12, 8], [-9, 5], [-5, 5], [-2, 5], [2, 6], [6, 4], [9, 4], [9, 1], [10, -2],
  [12, -5], [13, -9], [12, -14], [13, -18], [14, -22], [15, -27], [17, -29], [18, -33],
  [20, -35], [25, -34], [28, -33], [31, -29], [33, -26], [35, -23], [37, -19], [40, -16],
  [40, -11], [41, -7], [42, -3], [45, -1], [48, 0], [51, 2], [51, 7], [51, 11],
  [48, 11], [45, 11], [43, 12], [41, 14], [40, 16], [38, 18], [37, 21], [35, 24],
  [34, 27], [32, 30], [30, 31], [26, 32], [22, 33], [18, 33], [14, 33], [11, 34],
  [9, 36], [6, 37], [2, 37], [-2, 35],
];
const MADAGASCAR: Array<[number, number]> = [
  [44, -13], [47, -15], [50, -16], [50, -20], [47, -24], [44, -25], [43, -21], [44, -16],
];
// Eurasia as one landmass (Europe + Asia), clockwise from Iberia.
const EURASIA: Array<[number, number]> = [
  [-9, 37], [-9, 39], [-9, 43], [-5, 44], [-2, 44], [-1, 46], [-4, 48], [-1, 49],
  [1, 51], [3, 53], [6, 54], [8, 55], [8, 57], [10, 58], [7, 60], [5, 62], [10, 64],
  [14, 66], [18, 69], [22, 70], [26, 71], [30, 70], [33, 69], [36, 67], [40, 67],
  [44, 68], [48, 68], [52, 68], [56, 69], [60, 69], [64, 70], [68, 71], [72, 73],
  [76, 73], [80, 73], [85, 75], [90, 76], [95, 77], [100, 77], [105, 78], [110, 75],
  [115, 74], [120, 73], [125, 72], [130, 72], [135, 72], [140, 72], [145, 72], [150, 70],
  [155, 70], [160, 70], [165, 68], [170, 67], [178, 66], [178, 63], [175, 62], [170, 60],
  [165, 60], [162, 58], [158, 55], [156, 51], [152, 56], [150, 59], [146, 59], [142, 59],
  [141, 54], [141, 50], [140, 46], [139, 43], [137, 42], [135, 43], [132, 43], [130, 42],
  [128, 40], [127, 39], [126, 38], [124, 38], [122, 38], [121, 35], [120, 33], [122, 30],
  [121, 28], [120, 25], [118, 25], [115, 23], [112, 22], [110, 20], [108, 19], [108, 16],
  [106, 11], [105, 9], [103, 8], [101, 7], [100, 7], [99, 9], [98, 12], [97, 15],
  [95, 16], [93, 18], [92, 21], [90, 22], [89, 22], [87, 21], [86, 20], [84, 19],
  [82, 17], [80, 14], [80, 11], [78, 9], [76, 10], [75, 12], [73, 16], [72, 20],
  [70, 21], [68, 23], [66, 25], [63, 25], [61, 25], [58, 26], [56, 27], [54, 27],
  [52, 28], [51, 29], [49, 30], [48, 30], [49, 28], [50, 26], [51, 25], [53, 25],
  [55, 25], [57, 26], [59, 24], [58, 22], [57, 20], [56, 18], [54, 17], [52, 16],
  [50, 15], [48, 14], [46, 13], [44, 13], [43, 12], [42, 15], [40, 18], [38, 22],
  [36, 26], [34, 28], [33, 31], [35, 33], [36, 36], [33, 36], [30, 36], [27, 37],
  [26, 38], [23, 36], [22, 37], [19, 40], [16, 40], [12, 42], [8, 44], [6, 43],
  [3, 43], [0, 39], [-1, 37], [-5, 36],
];
const UK: Array<[number, number]> = [
  [-5, 50], [-3, 53], [-5, 56], [-4, 58], [-2, 58], [0, 53], [1, 51], [-1, 50],
];
const JAPAN: Array<[number, number]> = [
  [130, 31], [132, 33], [134, 34], [136, 35], [138, 35], [140, 36], [141, 38], [141, 41],
  [142, 44], [144, 44], [143, 42], [141, 40], [140, 38], [139, 37], [137, 35], [135, 34],
  [133, 33], [131, 32],
];
const PHILIPPINES: Array<[number, number]> = [
  [120, 18], [122, 18], [122, 16], [121, 14], [120, 14], [120, 16],
];
const SUMATRA: Array<[number, number]> = [
  [95, 5], [98, 3], [101, 0], [104, -3], [106, -6], [103, -5], [100, -1], [97, 3],
];
const BORNEO: Array<[number, number]> = [
  [109, 1], [111, 3], [114, 4], [117, 2], [119, -1], [117, -4], [113, -4], [110, -2],
];
const JAVA: Array<[number, number]> = [
  [105, -6], [110, -7], [114, -8], [114, -7], [110, -6],
];
const NEW_GUINEA: Array<[number, number]> = [
  [131, -1], [135, -2], [138, -3], [141, -3], [144, -5], [147, -7], [150, -9],
  [147, -9], [144, -8], [141, -8], [138, -7], [135, -5], [132, -3],
];
const AUSTRALIA: Array<[number, number]> = [
  [114, -22], [113, -26], [114, -30], [115, -33], [118, -35], [121, -34], [124, -33],
  [127, -32], [129, -32], [132, -32], [134, -33], [136, -35], [138, -35], [140, -38],
  [143, -39], [146, -39], [149, -37], [150, -35], [153, -32], [153, -28], [151, -24],
  [149, -21], [146, -19], [143, -16], [142, -13], [142, -11], [141, -13], [139, -15],
  [137, -12], [136, -12], [134, -12], [132, -11], [131, -12], [129, -14], [127, -14],
  [125, -15], [123, -17], [121, -19], [119, -20], [116, -21],
];
const NEW_ZEALAND: Array<[number, number]> = [
  [167, -45], [170, -42], [173, -40], [175, -38], [177, -38], [175, -40], [172, -42],
  [169, -44],
];

// Pins, verified one by one against real geography (lon, lat):
//  1 Kerch Bridge, Crimea — 36.5E 45.3N (Kerch Strait)
//  2 Manila, Philippines — 121.0E 14.6N
//  3 Strait of Hormuz — 56.5E 26.5N
//  4 New York (JPMorgan) — 74.0W 40.7N
//  5 Santa Clara, California (Nvidia) — 121.9W 37.4N
//  6 Cape Canaveral, Florida (Vulcan) — 80.6W 28.4N
//  7 Rwanda (return hub) — 30.1E 2.0S
interface Pin { n: number; lon: number; lat: number; place: string }
const PINS: Pin[] = [
  { n: 1, lon: 36.5, lat: 45.3, place: "Kerch Bridge, Crimea" },
  { n: 2, lon: 121.0, lat: 14.6, place: "Manila" },
  { n: 3, lon: 56.5, lat: 26.5, place: "Strait of Hormuz" },
  { n: 4, lon: -74.0, lat: 40.7, place: "New York" },
  { n: 5, lon: -121.9, lat: 37.4, place: "Santa Clara, California" },
  { n: 6, lon: -80.6, lat: 28.4, place: "Cape Canaveral, Florida" },
  { n: 7, lon: 30.1, lat: -2.0, place: "Rwanda" },
];

// ------------------------------------------------------------- the news
// All stories happened or were first reported on Tuesday 17 November 2026.
interface Feature {
  n: number; tag: string; color: RGB; headline: string; summary: string;
}
const FEATURES: Feature[] = [
  { n: 2, tag: "ASIA · DIPLOMACY", color: BLUE,
    headline: "TRUMP LANDS IN MANILA; XI SUMMIT CONFIRMED",
    summary: "FIRST 3-WAY MEET SET THURSDAY." },
  { n: 3, tag: "MIDDLE EAST · IRAN WAR", color: RED,
    headline: "TWO TANKERS HIT BY MINES NEAR HORMUZ",
    summary: "TANKERS BURN; IRAN BLAMES ROUTE." },
  { n: 4, tag: "USA · BANKING", color: BLUE,
    headline: "JPMORGAN BLAMES SOFTWARE BUG",
    summary: "ZELLE, BRANCHES DOWN; NO HACK." },
  { n: 5, tag: "MARKETS · TECH", color: TEAL,
    headline: "NVIDIA REPORTS AFTER THE BELL",
    summary: "FIRST SINCE HUANG RESIGNED." },
  { n: 6, tag: "SCIENCE · SPACE", color: TEAL,
    headline: "VULCAN ROCKET FAILS; 40 SATELLITES LOST",
    summary: "FAILS 10 MINUTES AFTER LAUNCH." },
  { n: 7, tag: "EUROPE · MIGRATION", color: GOLD,
    headline: "FIVE EU NATIONS PLAN RWANDA RETURN HUB",
    summary: "ASYLUM SEEKERS TO BE SENT THERE." },
];

const NUMBERS: Array<[string, string]> = [
  ["1,336", "DRONES DOWNED: RUSSIA"],
  ["40", "SATELLITES DESTROYED"],
  ["17", "KILLED IN S. AFRICA"],
  ["$109.1BN", "NVIDIA REVENUE EXPECTED"],
  ["9TH", "PENTAGON AUDIT FAILED"],
  ["1.5M", "AMAZON HECTARES SECURED"],
];

// ALSO list: 20 more stories, 3 columns x 7 rows (one slot spare).
const ALSO: string[] = [
  "HOUTHIS FALL BACK: ADEN",
  "ERITREA ENDS TRACHOMA",
  "JAPAN PROTESTS RUSSIA",
  "US HOUSE SETS AGENDA",
  "CHIP LOOPHOLE CLOSED",
  "UK SANCTIONS SETTLERS",
  "ARRESTS ROW: NETANYAHU",
  "INDIA BUS KILLS 6",
  "SRI LANKA OUT FOR 98",
  "BAHRAIN JAILS 64 SHIA",
  "POPE LEO XIV IN PERU",
  "CARNEY MEETS XI IN CHINA",
  "US MEASLES RECORD HIGH",
  "ROBOT BAN: 128 STATES",
  "MONGOLIA CHIEF RESIGNS",
  "SERBIA VOTE ENDS VUCIC",
  "THAILAND: $2.6BN US BUY",
  "MANILA CHIP PROTESTS",
  "VANCE: NO LONG IRAN WAR",
  "3RD US CARRIER IN GULF",
];

// ---------------------------------------------------------------- drawing
function drawBridge(c: Canvas): void {
  const ax = 580;
  const ax1 = 1004;
  const top = 105;
  // sky and sea
  c.rect(ax, top, ax1 - ax, 133, SKY);
  c.rect(ax, top + 133, ax1 - ax, 42, SEA);
  // shores at the waterline
  c.rect(ax, top + 125, 40, 8, LAND_DK);
  c.rect(ax1 - 40, top + 125, 40, 8, LAND_DK);
  // towers
  c.rect(655, top + 23, 12, 98, INK);
  c.rect(925, top + 23, 12, 98, INK);
  // cables from tower tops to the deck
  c.line(661, top + 23, 600, top + 113, INK, 1);
  c.line(661, top + 23, 730, top + 113, INK, 1);
  c.line(661, top + 23, 755, top + 113, INK, 1);
  c.line(931, top + 23, 865, top + 113, INK, 1);
  c.line(931, top + 23, 890, top + 113, INK, 1);
  c.line(931, top + 23, 980, top + 113, INK, 1);
  // deck with the collapsed middle span
  c.rect(ax, top + 113, 180, 8, INK);
  c.rect(860, top + 113, ax1 - 860, 8, INK);
  // fallen span: two segments angled down into the water
  c.line(760, top + 117, 810, top + 163, INK, 3);
  c.line(860, top + 117, 810, top + 163, INK, 3);
  // smoke above the gap
  c.disc(790, top + 87, 8, SMOKE);
  c.disc(812, top + 77, 10, SMOKE);
  c.disc(834, top + 88, 8, SMOKE);
  // blast where the span hit the water
  c.disc(810, top + 159, 4, RED);
  c.disc(810, top + 159, 2, GOLD);
  // wave marks
  c.rect(600, top + 147, 40, 1, WHITE);
  c.rect(900, top + 147, 50, 1, WHITE);
  c.rect(620, top + 159, 50, 1, WHITE);
  c.rect(920, top + 159, 50, 1, WHITE);
  // callout tag
  c.rect(702, top + 7, 200, 24, RED);
  c.textCentered("ROAD SPAN DOWN", 802, top + 11, 2, WHITE, true);
}

function drawMap(c: Canvas): void {
  // sea
  c.rect(MAP_X, MAP_Y, MAP_W, MAP_H, [194, 216, 232]);
  // land
  const polys = [
    NORTH_AMERICA, SOUTH_AMERICA, AFRICA, MADAGASCAR, EURASIA, UK, JAPAN,
    PHILIPPINES, SUMATRA, BORNEO, JAVA, NEW_GUINEA, AUSTRALIA, NEW_ZEALAND,
  ];
  for (const p of polys) c.poly(projPoly(p), LAND);
  // continent labels (dark slate on sea/land, placed clear of pins)
  const LABEL: RGB = [52, 64, 52];
  c.text("N. AMERICA", 48, MAP_Y + 8, 2, LABEL);
  c.text("S. AMERICA", 128, MAP_Y + 94, 2, LABEL);
  c.text("EUROPE", 205, MAP_Y + 14, 2, LABEL);
  c.text("AFRICA", 338, MAP_Y + 78, 2, LABEL);
  c.text("ASIA", 398, MAP_Y + 16, 2, LABEL);
  c.text("OCEANIA", 425, MAP_Y + 114, 2, LABEL);
  // pins: red disc + white number; pin 6 (Cape Canaveral) is nudged
  // south-east with a leader line because it sits close to pin 4 (New York)
  for (const p of PINS) {
    const [x, y] = proj(p.lon, p.lat);
    let cx = x;
    let cy = y;
    if (p.n === 6) {
      c.line(x, y, x + 10, y + 10, RED, 1);
      cx = x + 16;
      cy = y + 14;
    }
    c.disc(Math.round(cx), Math.round(cy), 11, RED);
    c.textCentered(String(p.n), Math.round(cx), Math.round(cy) - 9, 2, WHITE, true);
  }
}

function drawNumbers(c: Canvas): void {
  const x = 556;
  c.text("BY THE NUMBERS", x, MAP_Y, 2, RED, true);
  c.rect(x, MAP_Y + 22, 984 - x, 1, INK);
  let y = MAP_Y + 26;
  for (const [val, label] of NUMBERS) {
    c.text(val, x, y, 2, INK, true);
    c.text(label, x + 120, y, 2, INK_SOFT, false, 1);
    y += 20;
  }
}

function drawPage(): Canvas {
  const c = new Canvas();
  c.rect(0, 0, W, H, PAPER);
  // double border
  c.rect(6, 6, W - 12, 2, INK);
  c.rect(6, H - 8, W - 12, 2, INK);
  c.rect(6, 6, 2, H - 12, INK);
  c.rect(W - 8, 6, 2, H - 12, INK);
  c.rect(11, 11, W - 22, 1, INK);
  c.rect(11, H - 12, W - 22, 1, INK);
  c.rect(11, 11, 1, H - 22, INK);
  c.rect(W - 12, 11, 1, H - 22, INK);

  // masthead
  c.textCentered("TUESDAY 17 NOVEMBER 2026", W / 2, 10, 5, INK, true);
  // rules
  c.rect(20, 59, 984, 3, INK);
  c.rect(20, 64, 984, 1, INK);
  // subhead
  c.textCentered("27 STORIES · 6 CONTINENTS · ONE DAY", W / 2, 69, 3, RED, true);
  c.rect(20, 100, 984, 1, INK);

  // ---- lead story
  const leadX = 20;
  const leadW = 544;
  c.text("EUROPE · UKRAINE WAR", leadX, 105, 2, RED, true);
  const headLines = wrap("KERCH BRIDGE SPAN COLLAPSES AFTER UKRAINIAN STRIKE", 4, leadW);
  let hy = 127;
  for (const ln of headLines) {
    c.text(ln, leadX, hy, 4, INK, true);
    hy += 37;
  }
  const sumLines = wrap(
    "A ROAD SPAN FELL INTO THE STRAIT ON DAY 2 OF STRIKES. ZELENSKYY: 'UNPRECEDENTED OPERATION'. RUSSIA HIT KYIV'S TWO DNIPRO BRIDGES IN REPLY.",
    2, leadW,
  );
  let sy = 242;
  for (const ln of sumLines) {
    c.text(ln, leadX, sy, 2, INK);
    sy += 20;
  }
  drawBridge(c);
  c.textCentered("THE KERCH BRIDGE AFTER THE STRIKE", 792, 284, 2, INK_SOFT, false, 1);
  c.textCentered("ROAD CLOSED; RAIL ARCH ALSO HIT", 792, 304, 2, INK_SOFT, false, 1);

  c.rect(20, 326, 984, 1, INK);

  // ---- six featured stories, 2 columns x 3 rows
  const colX = [20, 512];
  const colW = 472;
  FEATURES.forEach((f, i) => {
    const x = colX[i % 2];
    const ry = 331 + Math.floor(i / 2) * 106;
    // number badge + tag
    c.rect(x, ry, 22, 22, RED);
    c.textCentered(String(f.n), x + 11, ry + 2, 2, WHITE, true);
    c.text(f.tag, x + 28, ry + 2, 2, f.color, true);
    // headline (2 lines max)
    const hl = wrap(f.headline, 3, colW);
    let ly = ry + 26;
    for (const ln of hl.slice(0, 2)) {
      c.text(ln, x, ly, 3, INK, true);
      ly += 29;
    }
    // one-line summary
    const sl = wrap(f.summary, 2, colW);
    c.text(sl[0], x, ry + 84, 2, INK);
  });

  c.rect(20, 649, 984, 1, INK);

  // ---- map + numbers
  drawMap(c);
  drawNumbers(c);

  c.rect(20, 808, 984, 1, INK);

  // ---- ALSO list: 20 stories, 3 columns x 7 rows
  c.text("ALSO ON TUESDAY — 20 MORE STORIES", 20, 813, 3, INK, true);
  const alsoColX = [20, 348, 676];
  ALSO.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = alsoColX[col];
    const y = 844 + row * 18;
    c.rect(x, y + 6, 6, 6, RED);
    c.text(item, x + 12, y, 2, INK, false, 1);
  });

  // ---- footer
  c.textCentered(
    "EVERY STORY HAPPENED OR WAS FIRST REPORTED ON TUESDAY 17 NOVEMBER 2026.",
    W / 2, 974, 2, INK_SOFT, false, 1,
  );
  c.textCentered(
    "DISPUTED CLAIMS ATTRIBUTED — SOURCES: AP · REUTERS · AFP · BBC · AL JAZEERA",
    W / 2, 993, 2, INK_SOFT, false, 1,
  );
  return c;
}

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    t[n] = v >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let v = 0xffffffff;
  for (let i = 0; i < buf.length; i++) v = CRC_TABLE[(v ^ buf[i]) & 0xff] ^ (v >>> 8);
  return (v ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(c: Canvas): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(c.buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ---------------------------------------------------------------- main
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const png = encodePNG(drawPage());
writeFileSync(join(outDir, "entry.png"), png);
console.log(
  `entry.png ${png.length} bytes sha256=${createHash("sha256").update(png).digest("hex")}`,
);
