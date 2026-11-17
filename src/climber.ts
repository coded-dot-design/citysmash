// CitySmash's wall climber, headless: a giant on the street walks, jumps (a jump at a building's side
// wall grabs it), hangs on the side and climbs it, gets up onto the roof, wall-jumps across a gap and
// drops off. Hanging, it never drifts: still while a punch is out, the last way it climbed sets the
// next punch's direction (up, middle, down). Knocked out, it shrinks and runs off the table's end.
// A brick candidate: the wall climber (walk, a jump that grabs, hang and climb a side, the roof, a wall
// jump, drop-off). Grown from the Fizlet gallery daily (DOM Kaiju, #124), same numbers.
// Monster fields (MW numbers each, see ./round.ts): [0] x, [1] y, [2] z, [3] vx, [4] vy, [5] mode,
// [6] face, [8] punch cooldown, [12] on building, [13] walk phase, [15] invulnerable, [19] land squash,
// [22] the side it hangs on, [23] shock, [24] in play, [31] kind, [33] climbing up or down a moment ago.
import { STREET0, type Block } from "./block.ts";

/** Monster modes. */
export const WALK = 0, AIR = 1, CLIMB = 2, ROOF = 3, KO = 4;
/** The monster's scale: about four floors tall (./monster.ts draws it at this size). */
export const MK = 1.3;
/** The street walk's z, a side wall being climbed (in the gap), a roof. */
export const ZS = 1.9, ZW = -0.55, ZR = -1.45;
/** Hanging: the hand over the feet, how far under the roof the feet stop. */
export const HAND = 1.9, CLIMB_TOP = 1.6;
/** Down held at the bottom of a wall this long lets go (a moment: the bottom floor stays in reach). */
export const DROP_HOLD = 0.3;
export const G = 26;
/** A monster in play, waiting to come in, or out. */
export const OUT = 0, IN = 1, WAIT = 2;
export const E_JUMP = 18, E_LAND = 19, E_CLIMB = 20, E_OUT = 24;
void STREET0;

export interface ClimberHooks {
  emit(t: number, v: number): void;
  /** A hard landing on the street at x (stomps). */
  landed(M: Float64Array, fall: number): void;
}

export function createClimber(bk: Block, h: ClimberHooks) {
  const { BLD, standing, top, wallX } = bk;
  /** A side wall to catch at x (moving by v), or −1: code b * 2 + (right side). */
  function wallAt(x: number, v: number, y: number, r: number) {
    for (let b = 0; b < bk.nb(); b++) {
      if (!standing(b) || y > top(b) - CLIMB_TOP + 0.3) continue;
      for (let s = -1; s <= 1; s += 2) if (Math.abs(x - wallX(b, s)) < r && v * -s > 0.2) return b * 2 + (s > 0 ? 1 : 0);
    }
    return -1;
  }
  function hang(M: Float64Array, code: number) {
    const b = code >> 1, s = code & 1 ? 1 : -1;
    M[5] = CLIMB; M[12] = b; M[22] = s; M[0] = wallX(b, s); M[3] = 0; M[4] = 0; M[6] = -s; M[33] = 0;
    if (M[1]! < 0.05) M[1] = 0.05;
    h.emit(E_CLIMB, b);
  }
  /** The building under the climbers goes: they drop off. */
  function dropOff(M: Float64Array, b: number) {
    if (M[12] !== b || (M[5] !== CLIMB && M[5] !== ROOF)) return;
    M[3] = M[5] === CLIMB ? M[22]! * 2 : M[6]! * 2;
    M[5] = AIR;
    M[12] = -1;
    M[4] = 3;
  }
  /** One step of monster M (its index `k`, for the events), with the stick (mx, my up) and a jump press. */
  function step(M: Float64Array, k: number, dt: number, mx: number, my: number, jump: number, hero: boolean) {
    const md = M[5]!, SX = bk.L[3]!;
    // (Not while it turns round for a grab behind it, ./round.ts TURN_T.)
    if (Math.abs(mx) > 0.25 && md !== KO && md !== CLIMB && !(M[49]! > 0)) M[6] = mx > 0 ? 1 : -1;
    M[8] = Math.max(0, M[8]! - dt); M[11] = Math.max(0, M[11]! - dt); M[14] = Math.max(0, M[14]! - dt); M[15] = Math.max(0, M[15]! - dt); M[18] = Math.max(0, M[18]! - dt);
    M[9] = Math.max(0, M[9]! - dt * 4.5); M[10] = Math.max(0, M[10]! - dt * 3.5); M[19] = Math.max(0, M[19]! - dt * 5); M[23] = Math.max(0, M[23]! - dt);
    if (md === WALK) {
      M[3] = mx * 5.2;
      M[0] = M[0]! + M[3]! * dt;
      M[2] = M[2]! + (ZS - M[2]!) * Math.min(1, dt * 8);
      M[13] = M[13]! + Math.abs(M[3]!) * dt * 1.3;
      // Up at a side wall climbs it.
      if (my > 0.5) {
        const w = wallAt(M[0]!, M[6]!, 0, 0.9);
        if (w >= 0) return hang(M, w);
      }
      if (jump) (M[5] = AIR), (M[4] = 11), (M[3] = mx * 5.2), h.emit(E_JUMP, 0);
    } else if (md === KO && M[1]! <= 0) {
      // Shrunk: a tiny figure running for the nearest end of the table, then out.
      M[3] = M[0]! < 0 ? -6.5 : 6.5;
      M[0] = M[0]! + M[3]! * dt;
      M[13] = M[13]! + dt * 12;
      M[2] = M[2]! + (ZS + 1.4 - M[2]!) * Math.min(1, dt * 4);
      if (Math.abs(M[0]!) > SX + 2.5) (M[24] = OUT), h.emit(E_OUT, k);
      return;
    } else if (md === AIR || md === KO) {
      if (md === AIR) M[3] = M[3]! + (mx * 5 - M[3]!) * Math.min(1, dt * 5);
      else M[3] = M[3]! * (1 - dt * 3);
      M[4] = M[4]! - G * dt;
      const x0 = M[0]!;
      M[0] = x0 + M[3]! * dt;
      const y0 = M[1]!;
      M[1] = y0 + M[4]! * dt;
      // A jump at a wall grabs it (the hanging spot crossed, or reached, heading at the building).
      if (md === AIR && M[23]! <= 0 && M[15]! <= 0 && M[1]! > 0.15) {
        const v = M[3]! || M[6]! * 0.5, w = wallAt(M[0]!, v, M[1]!, 0.55 + Math.abs(M[0]! - x0));
        if (w >= 0) return hang(M, w);
      }
      // A roof under it, if it came from that height.
      let rb = -1;
      for (let b = 0; b < bk.nb(); b++) if (standing(b) && M[0]! > BLD[b * 4]! + 0.1 && M[0]! < BLD[b * 4]! + BLD[b * 4 + 1]! - 0.1) rb = b;
      const over = rb >= 0 && M[2]! < ZS - 1.2 && y0 >= top(rb) - 0.05;
      if (!over) M[2] = M[2]! + (ZS - M[2]!) * Math.min(1, dt * 5);
      if (over && M[4]! <= 0 && M[1]! <= top(rb)) return void ((M[1] = top(rb)), (M[4] = 0), (M[5] = md === KO ? KO : ROOF), (M[12] = rb), (M[19] = 1), h.emit(E_LAND, 1));
      if (M[1]! <= 0) {
        const fall = -M[4]!;
        M[1] = 0;
        M[4] = 0;
        M[5] = md === KO ? KO : WALK;
        M[12] = -1;
        M[19] = Math.min(1, fall / 12);
        h.emit(E_LAND, 0);
        if (md !== KO && fall > 4) h.landed(M, fall);
      }
    } else if (md === CLIMB) {
      // Hanging on a side: up and down; a jump pushes off (and catches the wall across the gap).
      const b = M[12]!, s = M[22]!, tp = top(b);
      M[2] = M[2]! + (ZW - M[2]!) * Math.min(1, dt * 9);
      M[0] = M[0]! + (wallX(b, s) - M[0]!) * Math.min(1, dt * 12);
      // Still while a punch is out (it never drifts off its spot); the last way it climbed sets the next punch.
      const mv = M[8]! > 0 ? 0 : my;
      M[1] = M[1]! + mv * 3.4 * dt;
      M[13] = M[13]! + Math.abs(mv) * dt * 2;
      if (mv > 0.3) M[33] = 0.35;
      else if (mv < -0.3) M[33] = -0.35;
      else if (M[8]! <= 0) M[33] = M[33]! > 0 ? Math.max(0, M[33]! - dt) : Math.min(0, M[33]! + dt);
      const hi = tp - CLIMB_TOP;
      if (M[1]! > hi) M[1] = hi;
      if (M[1]! >= hi - 0.01 && mv > 0.5) {
        M[5] = ROOF; M[1] = tp; M[2] = ZR;
        M[0] = s < 0 ? BLD[b * 4]! + 0.8 : BLD[b * 4]! + BLD[b * 4 + 1]! - 0.8;
        M[19] = 0.6;
        return void h.emit(E_LAND, 2);
      }
      // At the bottom it stops (the bottom floor in reach: the down cells); held down a moment more, it lets go.
      M[48] = M[1]! <= 0.05 && mv < -0.3 ? M[48]! + dt : 0;
      if (M[48]! > DROP_HOLD && M[33]! < -0.3) return void ((M[1] = 0), (M[5] = WALK), (M[12] = -1), (M[33] = 0), (M[48] = 0));
      if (M[1]! < 0.05) M[1] = 0.05;
      if (jump) return void ((M[5] = AIR), (M[12] = -1), (M[4] = 7.5), (M[3] = s * 5.5), (M[6] = s), h.emit(E_JUMP, 1));
    } else if (md === ROOF) {
      const b = M[12]!, x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!;
      M[1] = top(b);
      M[0] = M[0]! + mx * 4 * dt;
      M[13] = M[13]! + Math.abs(mx) * 4 * dt * 1.3;
      if (jump) return void ((M[5] = AIR), (M[12] = -1), (M[4] = 10), (M[3] = mx * 4.8), h.emit(E_JUMP, 2));
      if (M[0]! < x0 + 0.1 || M[0]! > x0 + w - 0.1) (M[5] = AIR), (M[12] = -1), (M[4] = 2), (M[3] = mx * 4.8);
    }
    if (M[0]! < -SX - 1) M[0] = -SX - 1;
    if (M[0]! > SX + 1) M[0] = SX + 1;
    // A rival comes in from the table's end: it walks onto the street.
    if (M[5] === WALK && Math.abs(M[0]!) > SX - 0.5 && !hero) M[0] = M[0]! - (M[0]! > 0 ? 1 : -1) * dt * 3;
    if (M[5] === WALK && hero) M[0] = Math.max(-SX, Math.min(SX, M[0]!));
  }
  return { step, wallAt, hang, dropOff };
}
export type Climber = ReturnType<typeof createClimber>;
