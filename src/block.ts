// CitySmash's destructible buildings, headless: one city's block on the table, seen side-on, its
// buildings along the back of the street with gaps between them. Each building is a grid of windows
// (floor × column, on the front face). A window takes three hits: a chip, a crack, a hole; the holes
// eat in from the side the punch comes from. Enough holes and the building shakes, then pancakes floor
// by floor (continuous heights: the floors above sink into the gap) to rubble. Some windows are live
// (power boxes and neon signs on the edge columns), some roofs carry a live antenna; people, snipers
// and hot pots sit at the windows. A brick candidate: the destructible building.
// Grown from the Fizlet gallery daily (DOM Kaiju, #124): the same rules, the layout now per city.
// Deterministic and zero allocation per step: every number lives in the typed arrays (`bytes`).
import { CITIES, R_ANT, STADIUM, NEON, type City } from "./cities.ts";

/** At most this many buildings and windows in a city. */
export const NBMAX = 8, NCMAX = 256;
/** Cells: 2 intact, 1 cracked, 0 a hole. Occupants: 0 none, 1 a person, 2 a sniper, 3 something hot. */
export const INTACT = 2, CRACKED = 1, HOLE = 0;
/** Building states. */
export const STAND = 0, SHAKE = 1, FALL = 2, RUBBLE = 3;
export const SHAKE_T = 1.0, FLOOR_T = 0.3, DROP_T = 0.22;
/** A window's hits: the second cracks it, the third holes it. */
export const HITS_CRACK = 2, HITS_HOLE = 3;
/** The street: the gap between buildings, the depth of a building. */
export const GAP = 2.6, DEPTH = 3, STREET0 = 0.9, STREET1 = 5.6;
/** Hanging on a side: the monster's x from the wall. */
export const WALLX = 1.3;

export interface Hooks {
  rnd(): number;
  emit(t: number, v: number): void;
  /** A hole's points to whoever punched it (the round keeps the scores). */
  holed(i: number, b: number, x: number, y: number, occ: number): void;
  /** A floor down (the points go to the last puncher), and a building flat. */
  floor(b: number, last: number): void;
  flat(b: number, last: number): void;
  /** Someone at a window jumps for it. */
  chute(x: number, y: number, z: number, kind: number, vx: number): void;
  /** The building under the climbers goes. */
  drop(b: number): void;
}
export const E_HOLE = 3, E_SHAKE = 4, E_FLOOR = 5, E_FLAT = 6, E_DROP = 12, E_CHIP = 27, E_CRACK = 28;

/** The block's state: the layout (per city) and what has happened to it. */
export function createBlock(h: Hooks) {
  /** Layout: [left x, columns, floors, look (0..4 the city's walls, 5 the landmark)] per building. */
  const BLD = new Float64Array(NBMAX * 4);
  /** [0] buildings, [1] windows, [2] floors in all, [3] half the street's length (SX), [4] the city. */
  const L = new Float64Array(8);
  const C0 = new Int32Array(NBMAX + 1);
  /** Per window: 1 a live power box, 2 a live neon sign. */
  const LIVE = new Uint8Array(NCMAX);
  /** A live antenna's x per building, or NaN. */
  const ANT = new Float64Array(NBMAX);
  /** Holes it takes to bring a building down. */
  const NEED = new Int32Array(NBMAX);
  /** The last monster to punch each building. */
  const LH = new Int8Array(NBMAX);
  const HIT = new Uint8Array(NCMAX), cell = new Uint8Array(NCMAX), occ = new Uint8Array(NCMAX);
  const ocT = new Float64Array(NCMAX), crackT = new Float64Array(NCMAX);
  /** Buildings: [state, holes, timer, floors removed, drop (1 → 0), shake] per building. */
  const B = new Float64Array(NBMAX * 6);

  const nb = () => L[0]!;
  /** A building's roof height now (it sinks while it pancakes). */
  const top = (b: number) => BLD[b * 4 + 2]! - B[b * 6 + 3]! + B[b * 6 + 4]!;
  /** World y of floor 0's bottom (floors removed sink the rest). */
  const yOff = (b: number) => -B[b * 6 + 3]! + B[b * 6 + 4]!;
  const standing = (b: number) => B[b * 6]! < FALL;
  /** Where a climber hangs on building b's side s (−1 left, 1 right). */
  const wallX = (b: number, s: number) => (s < 0 ? BLD[b * 4]! - WALLX : BLD[b * 4]! + BLD[b * 4 + 1]! + WALLX);
  /** The floor of building b at world height y (clamped to the floors still up). */
  const rowOf = (b: number, y: number) => Math.max(B[b * 6 + 3]!, Math.min(BLD[b * 4 + 2]! - 1, Math.floor(y - yOff(b))));
  const bOf = (i: number) => {
    let b = 0;
    while (C0[b + 1]! <= i) b++;
    return b;
  };

  /** Lay out city `ci`: building x from the widths and the gaps, centred on the table; live parts on edge
   *  windows (spread by a fixed pattern, never two above each other); antennas on the roofs that carry one. */
  function layout(ci: number) {
    const c: City = CITIES[ci]!, n = c.b.length;
    let w = GAP * (n - 1);
    for (const [cols] of c.b) w += cols;
    let x = -w / 2;
    BLD.fill(0);
    C0.fill(0);
    for (let b = 0; b < n; b++) {
      const [cols, fl] = c.b[b]!;
      BLD[b * 4] = x; BLD[b * 4 + 1] = cols; BLD[b * 4 + 2] = fl; BLD[b * 4 + 3] = b === c.landmark ? 5 : (b + ci) % 5;
      C0[b + 1] = C0[b]! + cols * fl;
      x += cols + GAP;
    }
    for (let b = n + 1; b <= NBMAX; b++) C0[b] = C0[n]!;
    L[0] = n; L[1] = C0[n]!; L[3] = w / 2 + 2.2; L[4] = ci;
    let floors = 0;
    for (let b = 0; b < n; b++) floors += BLD[b * 4 + 2]!;
    L[2] = floors;
    LIVE.fill(0);
    // Live parts: building k*3+1 mod n, alternating sides, floors spread through the height.
    for (let k = 0; k < c.live; k++) {
      const b = (k * 3 + 1 + ci) % n, cols = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, side = (k + b) & 1, fl = 1 + ((k * 5 + ci * 3) % Math.max(1, f - 1));
      const i = C0[b]! + Math.min(f - 1, fl) * cols + (side ? cols - 1 : 0);
      if (!LIVE[i - cols] && !LIVE[i + cols]) LIVE[i] = c.feature === NEON || k & 1 ? 2 : 1;
    }
    for (let b = 0; b < NBMAX; b++) ANT[b] = NaN;
    for (let b = 0; b < n; b++) {
      const r = c.roofs[(b + ci) % c.roofs.length]!;
      if (b !== c.landmark && (r === R_ANT || c.feature === STADIUM || (c.feature === NEON && b % 2 === 0))) ANT[b] = BLD[b * 4]! + BLD[b * 4 + 1]! - 0.8;
    }
    for (let b = 0; b < NBMAX; b++) NEED[b] = b < n ? Math.max(4, Math.ceil(BLD[b * 4 + 1]! * BLD[b * 4 + 2]! * 0.26)) : 0;
  }
  /** The block as it stands at the start: every window whole, people at some of them. */
  function reset(people: number) {
    LH.fill(0);
    cell.fill(INTACT);
    HIT.fill(0);
    occ.fill(0);
    ocT.fill(0);
    crackT.fill(0);
    B.fill(0);
    for (let b = 0; b < nb(); b++) {
      const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
      for (let fl = 0; fl < f; fl++) for (let c = 0; c < w; c++) {
        const i = C0[b]! + fl * w + c, r = h.rnd();
        occ[i] = LIVE[i] ? 0 : r < 0.18 * people ? 1 : r < 0.18 * people + 0.06 && fl > 0 ? 2 : r < 0.18 * people + 0.09 ? 3 : 0;
        ocT[i] = 1.5 + h.rnd() * 3;
      }
    }
  }

  /** One hit on window i by monster `who`: a chip, a crack, a hole. False when there is nothing to hit. */
  function strike(i: number, who: number) {
    if (cell[i] === HOLE || LIVE[i]) return false;
    const b = bOf(i);
    HIT[i]!++;
    LH[b] = who;
    crackT[i] = 0.2;
    if (HIT[i]! < HITS_HOLE) {
      if (HIT[i] === HITS_CRACK) (cell[i] = CRACKED), h.emit(E_CRACK, i);
      else h.emit(E_CHIP, i);
      return true;
    }
    return hole(i, b);
  }
  function hole(i: number, b: number) {
    if (cell[i] === HOLE || LIVE[i]) return false;
    cell[i] = HOLE;
    crackT[i] = 0.35;
    B[b * 6 + 1]!++;
    const w = BLD[b * 4 + 1]!, r = i - C0[b]!, fl = (r / w) | 0, c = r - fl * w;
    h.holed(i, b, BLD[b * 4]! + c + 0.5, yOff(b) + fl + 0.5, occ[i]!);
    occ[i] = 0;
    h.emit(E_HOLE, i);
    if (B[b * 6] === STAND && B[b * 6 + 1]! >= NEED[b]!) (B[b * 6] = SHAKE), (B[b * 6 + 2] = SHAKE_T), h.emit(E_SHAKE, b);
    return true;
  }
  /** The first window on floor fl of building b that is not a hole yet, from the near edge in; −1 when gone through. */
  function rowTarget(b: number, fl: number, fromLeft: boolean) {
    const w = BLD[b * 4 + 1]!;
    if (fl < B[b * 6 + 3]! || fl >= BLD[b * 4 + 2]!) return -1;
    for (let k = 0; k < w; k++) {
      const i = C0[b]! + fl * w + (fromLeft ? k : w - 1 - k);
      if (cell[i] !== HOLE) return i;
    }
    return -1;
  }
  function step(dt: number) {
    for (let i = 0; i < L[1]!; i++) if (crackT[i]! > 0) crackT[i] = Math.max(0, crackT[i]! - dt);
    for (let b = 0; b < nb(); b++) {
      const o = b * 6, st = B[o]!;
      if (B[o + 4]! > 0) B[o + 4] = Math.max(0, B[o + 4]! - dt / DROP_T);
      if (st === SHAKE) {
        B[o + 5] = 1;
        B[o + 2]! -= dt;
        if (B[o + 2]! <= 0) (B[o] = FALL), (B[o + 2] = 0), h.emit(E_DROP, b), h.drop(b);
      } else if (st === FALL) {
        B[o + 5] = 1;
        B[o + 2]! -= dt;
        if (B[o + 2]! <= 0) {
          B[o + 2] = FLOOR_T;
          // The bottom floor goes; everyone on it parachutes out; the rest falls into its place.
          const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, fl = B[o + 3]!;
          for (let c = 0; c < w; c++) {
            const i = C0[b]! + fl * w + c;
            if (occ[i]) h.chute(BLD[b * 4]! + c + 0.5, 0.5 + h.rnd() * 0.6, 0.4, occ[i]!, (h.rnd() - 0.5) * 3), (occ[i] = 0);
            cell[i] = HOLE;
          }
          B[o + 3] = fl + 1;
          B[o + 4] = 1;
          h.floor(b, LH[b]!);
          h.emit(E_FLOOR, b);
          if (fl + 1 >= f) (B[o] = RUBBLE), (B[o + 5] = 0), h.flat(b, LH[b]!), h.emit(E_FLAT, b);
        }
        // People in the windows above jump for it as it goes.
        if (h.rnd() < dt * 3) {
          const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, fl = B[o + 3]! + 1 + Math.floor(h.rnd() * Math.max(1, f - B[o + 3]! - 1));
          const c = Math.floor(h.rnd() * w), i = C0[b]! + Math.min(f - 1, fl) * w + c;
          if (fl < f && occ[i]) h.chute(BLD[b * 4]! + c + 0.5, yOff(b) + fl + 0.5, 0.4, occ[i]!, (h.rnd() - 0.5) * 3), (occ[i] = 0);
        }
      } else B[o + 5] = B[o + 1]! >= NEED[b]! - 2 && st === STAND ? 0.25 : 0;
    }
  }
  return {
    BLD, L, C0, LIVE, ANT, NEED, LH, HIT, cell, occ, ocT, crackT, B,
    /** Every view of the block's state (the round adds them to its own). */
    bytes: [BLD, L, C0, LIVE, ANT, NEED, LH, HIT, cell, occ, ocT, crackT, B].map((v) => new Uint8Array(v.buffer, v.byteOffset, v.byteLength)),
    nb, top, yOff, standing, wallX, rowOf, bOf, layout, reset, strike, rowTarget, step,
  };
}
export type Block = ReturnType<typeof createBlock>;
