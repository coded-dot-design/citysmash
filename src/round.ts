// CitySmash's run, headless: city after city (./cities.ts), the giants, the army and each city's
// feature. Up to four monsters: the hero ape and three rivals of our own (SHARDCLAW the crystal crab,
// GLOOPMAW the tentacle blob, VOLTWING the storm moth); each is a seat (a player: one of four, on one
// screen or online) or the AI. The rules are the daily's (the Fizlet gallery's DOM Kaiju, #124): the
// inside arm grips and climbs (./climber.ts), the outside arm smashes the window by the climb (middle,
// up, down), three hits a window (chip, crack, hole), one target, fixed timing, no drift; buildings
// shake then pancake (./block.ts); live parts shock; people at the windows are snacks; soldiers,
// snipers, helicopters and a tank fight back; at zero health a monster shrinks and runs off. A city
// ends when it is flat (a card, then the next one, the score carried); the run ends when every player
// has shrunk, or after the last city. Difficulty grows: more soldiers, armour on the tank, faster
// helicopters; then the city's feature (a gunboat, a train, floodlights, surges, trucks, neon, two
// helicopters). Deterministic: one seeded random in the state, fixed inputs → the same run; every
// number in typed arrays (`bytes`: the rollback saves and restores them); zero allocation per step.
import { createBlock, STAND, FALL, RUBBLE, HOLE, STREET0, STREET1, E_CHIP, E_CRACK, type Block } from "./block.ts";
import { createClimber, WALK, AIR, CLIMB, ROOF, KO, ZS, HAND, CLIMB_TOP, G, OUT, IN, WAIT, E_LEAP, LEAP_TAP } from "./climber.ts";
import { CITIES, NCITY, HARBOUR, RAIL, STADIUM, PLANT, BRIDGE, SKYPORT } from "./cities.ts";

export { WALK, AIR, CLIMB, ROOF, KO, OUT, IN, WAIT, E_LEAP, LEAP_TAP };
export const READY = 0, RUN = 1, CLEAR = 2, DONE = 3;
/** Events (one ring, read and cleared each step): what, a value, and which monster. */
export const E_START = 1, E_PUNCH = 2, E_HOLE = 3, E_SHAKE = 4, E_FLOOR = 5, E_FLAT = 6, E_HELI = 7, E_HELI_CRASH = 8, E_NOM = 9,
  E_HURT = 10, E_FLING = 11, E_DROP = 12, E_KO = 13, E_END = 14, E_WHIFF = 15, E_SHOT = 16, E_STOMP = 17, E_JUMP = 18, E_LAND = 19, E_CLIMB = 20,
  E_SHOCK = 21, E_TANK = 22, E_BONK = 23, E_OUT = 24, E_BURN = 25, E_JOIN = 26, E_CHIP_ = E_CHIP, E_CRACK_ = E_CRACK, E_ARMOUR = 29, E_TRAIN = 30,
  E_BELLS = 31, E_RAM = 32, E_TRUCK = 33, E_SURGE = 34, E_CITY = 35, E_CLEAR = 36,
  /** v12, the fight: a power punch lands on a rival (v: its monster), knocks one off a wall, a pounce, a combo on a stunned one, an AI's tell. */
  E_POWER = 37, E_KNOCKOFF = 38, E_POUNCE = 39, E_COMBO_HIT = 40, E_TELL = 41;
/** The monsters, in seat order online: the ape, then the rivals. */
export const NM = 4, MW = 60, HERO = 0, CRAB = 1, BLOB = 2, MOTH = 3;
/** Who drives a monster: a seat 0..3, or the AI. */
export const SEATS = 4, AI = 9;
export const MAX_HP = 100, SHOCK_HP = 7;
/** Pools: soldiers, pebbles and shells, parachutes, helicopters, trucks. */
export const NS = 9, NP = 48, NCH = 20, NH = 2, NT = 2;
/** The punch, arcade style: always the same timing (a wind-up, the hit on a fixed frame, a recovery). */
export const PUNCH_CD = 0.24, PUNCH_HIT = 0.08;
/** The combo: each targeted action in reach that starts within COMBO_GAP s of the last one steps the speed of
 *  the wind-up and the recovery up this ladder (×1 → ×1.25 → ×1.5 → ×1.6); a whiff or a pause drops it to ×1. */
export const COMBO = [1, 1.25, 1.5, 1.6], COMBO_GAP = 0.6;
/** A swing or a grab at something out of reach costs this much more before the next one (spam does not pay). */
export const WHIFF_T = 0.2;
const GRAB_CD = 0.4, CARD_T = 4.2, FIGHT_T = 4;
/** The autopilot's order through the reach: level close, medium, far, down close, medium, up close, medium. */
const AI_ORDER = [0, 1, 2, 5, 6, 3, 4];
/** Numbers per seat in IN: mx, my (−1..1, my up), punch, jump, grab (1 on the press), and a target (T_*). */
export const NI = 6;
/** The reach on a wall, one table: [rows up (+) or down (−), column in from the edge it holds (1 = next to
 *  the edge)] per cell: level close, medium, far; up close, medium; down close, medium. Seven on a wall, five
 *  on its top floor (no row above; the bottom floor the same with no row below). */
export const REACH = [0, 1, 0, 2, 0, 3, 1, 1, 1, 2, -1, 1, -1, 2], NR = 7;
/** v11 (owner: "it's based on the centre of the ape, which works for punching but not grabbing"): the grab
 *  reaches from the hand on the side it faces, never behind it or under its body. Off a wall: a fan in front,
 *  [cells out from the hand, rows up from the hand]; cell (0, 0) is centred GRAB_X out from the body's middle
 *  (the fist's reach, clear of the body: BODY_X is the body's half width) at the hand's height; the fan runs
 *  from the street to over his head on the front side (12), and from the shoulder up it comes in a cell nearer
 *  (−1: by his head, where the body is narrower; the scene never takes one his body covers on screen): 15.
 *  Mirrors with where it faces. */
export const GRAB = [0, -1, 0, 0, 0, 1, 0, 2, 0, 3, 1, -1, 1, 0, 1, 1, 1, 2, 2, 0, 2, 1, 2, -1, -1, 1, -1, 2, -1, 3], NG = 15;
export const GRAB_X = 1.9, GRAB_Y = 1.6, BODY_X = 1.3;
/** On a wall, one rule (if it can punch a window it can grab what is in it), from the free hand: the seven
 *  reach cells on the front (./REACH, in its order: g = c for reach cell c), the windows two floors up and
 *  down from them (close, mid), and the air of the gap on his side, over his head and under his feet; never
 *  behind the building, behind him or where his body is. [cells in from the edge it holds, rows up]: 13. */
export const GRAB_WALL: number[] = [], NGW = 13;
for (let c = 0; c < NR; c++) GRAB_WALL.push(REACH[c * 2 + 1]!, REACH[c * 2]!);
GRAB_WALL.push(1, 2, 2, 2, 1, -2, 2, -2, 0, 3, 0, -3);
/** Helicopters (a swat): the eight cells nearest the hand in front of it, and the one over his head (the same frame as GRAB). */
export const GRAB_HELI = [1, -1, 1, 0, 1, 1, 1, 2, 2, -1, 2, 0, 2, 1, 0, 3], NGH = 8;
/** Turning round for something behind: this long, then the grab (fixed). */
export const TURN_T = 0.12;
/** A target in the input (a tap or a click, 7 bits): 0 none, a reach cell to punch (T_CELL + cell), a grab
 *  cell to grab from (T_GRAB + g: whoever is at the window there; g in GRAB_WALL on a wall, GRAB off it), a
 *  helicopter to swat (T_HELI + h), a parachute (T_CHUTE + k) or a soldier (T_SOLDIER + s) to grab; off a
 *  wall a punch turned left or right (T_STREET + 0 or 1, at whatever is in front); a swing at nothing in
 *  reach (T_MISS: a whiff, no effect). */
export const T_CELL = 1, T_GRAB = 8, T_HELI = 23, T_CHUTE = 25, T_SOLDIER = 45, T_END = 54, T_STREET = 54, T_MISS = 56;
/** v11, off a wall: something behind him at grab cell g once he has turned (T_BACK + g: he turns, then
 *  grabs); a window on the bottom floor from the street, j columns out from the hand (T_LOW + j; behind
 *  him T_LOW + 3 + j: he turns, then punches it). Still 7 bits. */
export const T_BACK = 57, T_LOW = 72, NLOW = 3, T_TOP = 78;
/** v12 (owner: "use the wind-up power punch on the enemies; he jumps on them and punches them"): a tap on another
 *  monster in reach is the POWER PUNCH at it (T_RIVAL + its monster): the far punch's haymaker language, a longer
 *  fixed wind-up (POWER_HIT: the body comes forward, the arm cocks back, then fires), POWER_HP and a knockback; a
 *  rival on a wall or a roof is knocked off it. The reach is from the punching shoulder (POWER_R; behind him on the
 *  street he turns in the wind-up). A jump that comes down on a rival's head or back is a POUNCE: POUNCE_HP and it
 *  is stunned for STUN_T (no moves); a power punch on a stunned rival adds COMBO_HP (the combo). Still 7 bits. */
export const T_RIVAL = 78, T_RIVAL_END = 82;
/** v12 (owner: "I don't seem to be able to kill the tanks"): the tank (the gunboat on the harbour) was never a tap
 *  target (it stands out on the street, in front of the grab cells a tap is matched against), so a tap on it was TOO
 *  FAR. A tap on it in reach (from the punching shoulder: TANK_R) is a downward power smash (T_TANK; from a wall, a
 *  down punch at one below); a jump onto it crushes it. It takes TANK_HITS hits (TANK_HITS + 1 from city TANK_ARMOUR). */
export const T_TANK = 82, TANK_R = 4.2, TANK_HITS = 2, TANK_ARMOUR = 3;
/** The street's enemies on the ground (the owner: "tapping a tank says TOO FAR, even when it looks close"): off a wall
 *  the reach for them is a generous band along the ground in front of the punching shoulder (GROUND_R; at his feet
 *  too; behind him he turns): the tank, a soldier to smash (T_FOE + s; in the grab's fan a tap still eats it), a
 *  truck (T_TRUCK + t). */
export const GROUND_R = 8, T_FOE = 83, T_TRUCK = 92, T_GROUND_END = 94;
export const POWER_CD = 0.62, POWER_HIT = 0.36, POWER_HP = 16, COMBO_HP = 12, POWER_R = 3.6, SHOULDER_Y = 2.5;
export const POUNCE_HP = 10, STUN_T = 1.4, POUNCE_LO = 1.1, POUNCE_HI = 3.8;
/** The AI's moves: a power punch at most every AI_POWER s, a pounce after a crouch of POUNCE_TELL s (fixed: dodge it). */
export const AI_POWER = 3.2, POUNCE_TELL = 0.4;
/** Is target t a punch (else a grab)? */
export const isPunch = (t: number) => (t >= T_CELL && t < T_GRAB) || (t >= T_HELI && t < T_CHUTE) || (t >= T_STREET && t <= T_MISS) || (t >= T_LOW && t < T_GROUND_END);

/** Practice (S[28]): one player, no army (a parked helicopter that never fires), no health lost, flattened
 *  buildings come back; its steps (bits in S[29]): walk, onto a wall, climb, punch all seven reach cells
 *  (S[30], a bit a cell), eat someone, swat the helicopter, a punch past a live window. */
export const P_WALK = 1, P_WALL = 2, P_CLIMB = 4, P_REACH = 8, P_NOM = 16, P_HELI = 32, P_LIVE = 64, P_POWER = 128, P_POUNCE = 256, P_LEAP = 512, P_LETGO = 1024, P_ALL = 2047;
/** v12: practice's sparring dummy (a harmless training rival: it never fights back, never runs out of health). */
export const DUMMY = 1;
/** A run. `step(dt, IN)`: IN holds NI numbers per seat (mx, my −1..1 with my up, punch, jump, grab: 1 on the press, a target). */
export function createRun(seed = 20261116) {
  // The one random: an LCG in the state (so the rollback saves it with the rest).
  const R = new Uint32Array(1);
  const rnd = () => ((R[0] = (Math.imul(R[0]!, 1664525) + 1013904223) >>> 0), R[0]! / 4294967296);
  /** [0] phase, [1] city time, [2] team score, [3] holes, [4] buildings flat, [5] helicopters down, [6] snacks, [7] soldiers flung,
   *  [8] floors down, [9] end delay, [10] best, [11] tanks, [12] shocks, [13] last hole, [14] last punch direction, [15] last nom's monster,
   *  [16] city, [17] card timer, [18] cities cleared this run, [19] run time, [20] won, [21] first city, [22] rivals on, [23] trains,
   *  [24] trucks, [25] surges, [26] city start score, [27] attract (no end: the next city loops), [28] practice (./PRACTICE),
   *  [29] practice steps done (bits, ./P_*), [30] reach cells punched in practice (bits), [31] practice: a flat building's rebuild timer,
   *  [32] practice: the sparring dummy is in (1). */
  const S = new Float64Array(34);
  /** Per monster (MW numbers each): [0] x, [1] y, [2] z, [3] vx, [4] vy, [5] mode, [6] face, [7] hp, [8] punch cooldown, [9] punch anim,
   *  [10] grab anim, [11] hurt, [12] on building, [13] walk phase, [14] grab cooldown, [15] invulnerable, [16] fist x, [17] fist y,
   *  [18] mouth, [19] land squash, [20] a punch pressed during the cooldown, [21] the same for a grab, [22] the side it hangs on,
   *  [23] shock, [24] in play, [25] its score, [26] its snacks, [27] its holes, [28] who drives it, [29] knocked out, [30] the wait
   *  before it comes in, [31] its kind, [32] its last punch's direction, [33] climbing up or down a moment ago, [34] time to the hit
   *  frame, [35] that punch's direction, [36] its buildings flat, [37] its knock-outs this run, [38] that punch's reach cell + 1
   *  (0: not a wall punch), [39] the aim (0 close, 1 medium, 2 far), [40] the stick in a moment ago (−1, 0, 1: a flick steps the
   *  aim), [41] the grab's reach cell + 1, [42] that punch's target, [43] a punch's target pressed during the cooldown, [44] the
   *  same for a grab, [45] a whiff's recovery left (no punch or grab till it runs out), [46] the combo (./COMBO; 0 or 1: none), [47] the time since
   *  its last action ended (the combo's gap), [48] time held down at the bottom of a wall (a drop-off
   *  needs a hold: the bottom floor stays in reach), [49] turning round for a grab behind (time left), [50] [51] where
   *  the grab reaches to (x, y; 0: nowhere picked: the arm's own reach), [52] v12: the power punch's rival + 1 (0: none),
   *  [53] stunned (time left: no moves), [54] fighting (time left: the health bar shows), [55] an AI pounce's crouch (time
   *  left, then the jump), [56] a grab re-queued after a turn (it chained already: the combo counts it once), [57] an AI pounce's
   *  target + 1, [58] v14: a leap's double-tap window, [59] a leap under way (1) or let go (2) (./climber.ts). */
  const MS = new Float64Array(NM * MW), MV: Float64Array[] = [];
  for (let k = 0; k < NM; k++) MV.push(MS.subarray(k * MW, k * MW + MW)), (MV[k]![31] = k);
  let M = MV[0]!, cur = 0;
  const setCur = (k: number) => void ((cur = k), (M = MV[k]!));
  /** Soldiers: [alive, x, z, dir, state (0 walk, 1 aim), timer, want, step]. */
  const SO = new Float64Array(NS * 8);
  /** Pebbles and shells: [life, x, y, z, vx, vy, vz, kind (0 pebble, 1 helicopter, 2 shell)]. */
  const PB = new Float64Array(NP * 8);
  /** Parachutes: [life, x, y, z, vx, vy, kind (1 person, 2 soldier), landed, t]. */
  const CH = new Float64Array(NCH * 9);
  /** Helicopters, 12 each: [0] state (0 away, 1 flying, 2 falling), x, y, z, vx, vy, [6] fire timer, [7] burst left, [8] away timer, [9] spin, [10] t, [11] tilt. */
  const HE = new Float64Array(NH * 12);
  /** The tank (the gunboat in the harbour): [0] state (0 away, 1 rolling, 2 a wreck), [1] x, [2] dir, [3] fire timer, [4] away timer,
   *  [5] wreck timer, [6] recoil, [7] z, [8] tread phase, [9] armour left, [10] hit flash. */
  const TK = new Float64Array(11);
  /** The feature: [0] train state (0 waiting, 1 bells, 2 rolling, 3 a wreck), [1] its head's x, [2] its way, [3] its timer, [4] its z,
   *  [8] the surge timer, [9] a surge's time left, [10] the trucks' timer. */
  const FE = new Float64Array(16);
  /** Trucks, 6 each: [alive (1 driving, 2 a wreck), x, dir, speed, z, wreck timer]. */
  const TR = new Float64Array(NT * 6);
  /** Spawn timers: [0] soldiers, [1] new people at windows. */
  const T = new Float64Array(2);
  /** The autopilot, per monster: [0] target building, [1] side, [2] jump cool, [3] side tries, [4] grab cool, [5] bonk cool. */
  const AS = new Float64Array(NM * 8), AV: Float64Array[] = [];
  for (let k = 0; k < NM; k++) AV.push(AS.subarray(k * 8, k * 8 + 8));
  let A = AV[0]!;
  const ev = new Float64Array(96), IA = new Float64Array(NI), SAVE = new Float64Array(10), TG = new Float64Array(2), GC = new Float64Array(2);

  function emit(t: number, v: number) {
    if (t === E_WHIFF) M[46] = 1;
    if (S[28] && cur === 0) S[29] = S[29]! | (t === E_NOM ? P_NOM : t === E_HELI ? P_HELI : t === E_LEAP && v === 3 ? P_LEAP : t === E_LEAP && v === 2 ? P_LETGO : 0);
    if (run.n < 32) (ev[run.n * 3] = t), (ev[run.n * 3 + 1] = v), (ev[run.n * 3 + 2] = cur), run.n++;
    if (t === E_CHIP) pts(1);
    else if (t === E_CRACK) pts(2);
  }
  function pts(n: number) {
    S[2]! += n;
    M[25]! += n;
  }
  const ptsTo = (k: number, n: number) => ((S[2]! += n), (MV[k]![25]! += n));

  const bk: Block = createBlock({
    rnd, emit,
    holed(_i, _b, x, y, o) {
      S[3]!++;
      M[27]!++;
      pts(10);
      S[13] = _i;
      if (o === 1) chute(x, y, 0.3, 1, (rnd() - 0.5) * 2);
      else if (o === 2) chute(x, y, 0.3, 2, (rnd() - 0.5) * 2), S[7]!++, pts(50);
    },
    floor(_b, last) {
      S[8]!++;
      ptsTo(last, 40);
    },
    flat(b, last) {
      S[4]!++;
      MV[last]![36]!++;
      ptsTo(last, b === CITIES[S[16]!]!.landmark ? 1500 : 500);
    },
    chute: (x, y, z, kind, vx) => chute(x, y, z, kind, vx),
    drop(b) {
      for (let k = 0; k < NM; k++) cl.dropOff(MV[k]!, b);
    },
  });
  const { BLD, C0, LIVE, ANT, B, cell, occ, ocT } = bk;
  const cl = createClimber(bk, { emit, landed: stomp });
  const { standing, top, yOff, wallX, rowOf, rowTarget } = bk;
  const nb = () => bk.L[0]!;
  const SXv = () => bk.L[3]!;
  const city = () => CITIES[S[16]!]!;

  const run = {
    S, M: MV[0]!, MV, SO, PB, CH, HE, TK, FE, TR, AS, T, ev, n: 0, R, bk,
    cell, occ, B, BLD, C0, LIVE, ANT, crackT: bk.crackT, HIT: bk.HIT,
    /** Every view of the run's state: saved, restored and hashed byte for byte. */
    bytes: [] as Uint8Array[],
    reset, step, clear, autopilot, autopilotOwn, join, setCur, humans, loadCity, top, yOff, standing, wallX, rowOf, sideTarget, nb, city,
    levelRow, reachCell, reachCount, inReach, grabCell, grabCount, inGrab, winAt, lowCell, GC, powerReach, tankReach, groundReach,
    get SX() {
      return SXv();
    },
  };
  for (const v of [R, S, MS, SO, PB, CH, HE, TK, FE, TR, T, AS]) run.bytes.push(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  run.bytes.push(...bk.bytes);

  function humans() {
    let n = 0;
    for (let k = 0; k < NM; k++) if (MV[k]![28]! !== AI && MV[k]![24] === IN) n++;
    return n;
  }
  /** Monster k goes to `driver` (a seat 0..3, or AI); a seat taking a monster brings it in. */
  function join(k: number, driver: number) {
    const O = MV[k]!;
    O[28] = driver;
    if (driver !== AI && O[24] !== IN) (O[24] = WAIT), (O[30] = 0), (O[7] = Math.max(O[7]!, 60)), (O[29] = 0), (O[5] = WALK), (O[1] = 0);
    else if (driver === AI && S[22] === 0 && k !== HERO && O[24] !== IN) O[24] = OUT;
    setCur(k);
    emit(E_JOIN, driver === AI ? 0 : 1);
    setCur(0);
  }
  /** The nearest monster in play to x (the army aims at it), or 0. */
  function nearest(x: number) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[24] !== IN || O[5] === KO) continue;
      const d = Math.abs(O[0]! - x);
      if (d < bd) (bd = d), (best = k);
    }
    return best;
  }
  function clear() {
    run.n = 0;
  }

  /** A new run from city `first`; `rivals` 1: the AI rivals come in (0: none); the drivers stay. */
  function reset(s = seed, first = 0, rivals = 1, practice = 0) {
    R[0] = s >>> 0;
    S.fill(0);
    S[21] = first;
    S[22] = practice ? 0 : rivals;
    S[28] = practice;
    const drivers = [MV[0]![28]!, MV[1]![28]!, MV[2]![28]!, MV[3]![28]!], kinds = [MV[0]![31]!, MV[1]![31]!, MV[2]![31]!, MV[3]![31]!];
    MS.fill(0);
    for (let k = 0; k < NM; k++) (MV[k]![28] = k === HERO ? (drivers[k] === AI ? 0 : drivers[k]!) : drivers[k] || AI), (MV[k]![7] = MAX_HP), (MV[k]![24] = IN), (MV[k]![31] = kinds[k]!);
    loadCity(first);
    S[0] = READY;
    run.n = 0;
  }
  /** Lay out city ci, its army and feature; the monsters come back (players topped up, the KO'd back in). */
  function loadCity(ci: number) {
    S[16] = ci;
    S[1] = 0;
    S[3] = S[4] = S[8] = S[9] = S[17] = 0;
    S[26] = S[2]!;
    bk.layout(ci);
    bk.reset(city().feature === STADIUM ? 1.8 : 1);
    const sx = SXv();
    let ai = 0;
    const want = S[22] ? Math.min(3, 1 + Math.floor(ci / 2)) : 0;
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!, human = O[28] !== AI, hp = O[24] === IN && !O[29] ? O[7]! : 0, kd = O[31]!;
      O.fill(0, 0, 24);
      O.fill(0, 29, 36);
      O.fill(0, 38, MW);
      O[31] = kd;
      O[2] = ZS;
      O[12] = -1;
      if (human) {
        // Players start on the street, spread out; health topped up, the KO'd back in.
        O[0] = -sx * 0.45 + k * 2.6;
        O[6] = 1;
        O[7] = Math.min(MAX_HP, hp + 40);
        if (O[7]! < 70) O[7] = 70;
        O[24] = IN;
      } else {
        O[7] = MAX_HP;
        O[0] = k & 1 ? sx + 1 : -sx - 1;
        O[6] = k & 1 ? -1 : 1;
        O[24] = k !== HERO && ai < want ? WAIT : OUT;
        O[30] = 1.5 + ai * 9;
        if (O[24] === WAIT) ai++;
        // Practice's sparring dummy: on the street a little way in front of the player, facing it.
        if (S[28] && k === DUMMY) (O[24] = IN), (O[0] = -sx * 0.45 + 5.5), (O[6] = -1), (S[32] = 1);
      }
    }
    for (let k = 0; k < NM * 8; k++) AS[k] = 0;
    for (let k = 0; k < NM; k++) AS[k * 8] = -1;
    setCur(0);
    SO.fill(0);
    PB.fill(0);
    CH.fill(0);
    HE.fill(0);
    for (let h = 0; h < NH; h++) HE[h * 12 + 8] = Math.max(3, 6 - ci * 0.4) + h * 7;
    TK.fill(0);
    TK[4] = Math.max(5, 9 - ci * 0.6);
    FE.fill(0);
    FE[3] = 6;
    FE[8] = 5;
    FE[10] = 3;
    TR.fill(0);
    T[0] = 2.5;
    T[1] = 1.2;
    emit(E_CITY, ci);
  }

  // ---- the people and the shots ----
  function chute(x: number, y: number, z: number, kind: number, vx: number) {
    let j = -1, lo = Infinity;
    for (let i = 0; i < NCH; i++) {
      if (CH[i * 9]! <= 0) { j = i; break; }
      if (CH[i * 9 + 8]! < lo) (lo = CH[i * 9 + 8]!), (j = i);
    }
    const o = j * 9;
    CH[o] = 1; CH[o + 1] = x; CH[o + 2] = y; CH[o + 3] = z; CH[o + 4] = vx; CH[o + 5] = 3.2; CH[o + 6] = kind; CH[o + 7] = 0; CH[o + 8] = 0;
  }
  function pebble(x: number, y: number, z: number, speed: number, kind: number) {
    let j = -1;
    for (let i = 0; i < NP; i++) if (PB[i * 8]! <= 0) { j = i; break; }
    if (j < 0) return;
    // Aimed at the nearest monster's chest, with a little scatter.
    const O = MV[nearest(x)]!, tx = O[0]! + (rnd() - 0.5) * 1.1, ty = O[1]! + 2.1 + (rnd() - 0.5) * 1.1, tz = O[2]!;
    const dx = tx - x, dy = ty - y, dz = tz - z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, o = j * 8;
    PB[o] = 2.4; PB[o + 1] = x; PB[o + 2] = y; PB[o + 3] = z;
    PB[o + 4] = (dx / l) * speed; PB[o + 5] = (dy / l) * speed; PB[o + 6] = (dz / l) * speed; PB[o + 7] = kind;
    emit(E_SHOT, kind);
  }
  function hurt(n: number) {
    if (M[15]! > 0 || M[5] === KO || S[0] !== RUN || S[28]) return;
    M[7] = Math.max(0, M[7]! - n);
    M[11] = 0.3;
    M[15] = 0.12;
    emit(E_HURT, n);
    if (M[7]! <= 0) knockOut();
  }
  /** Out of health: it shrinks to a tiny figure that drops and runs off the table. */
  function knockOut() {
    M[5] = KO;
    M[29] = 1;
    M[37]!++;
    M[3] = 0;
    M[4] = Math.max(0, M[4]!);
    M[12] = -1;
    emit(E_KO, cur);
  }
  /** Knocked flat (a train, a truck): a little health, off whatever it hangs on, thrown along. */
  function knock(n: number, vx: number) {
    if (M[15]! > 0 || M[5] === KO) return;
    M[5] = AIR;
    M[12] = -1;
    M[58] = M[59] = 0;
    M[4] = 6;
    M[3] = vx;
    hurt(n);
    M[15] = 0.8;
  }
  /** A live part bites: a zap, a little health, it lets go and drops away from the wall. */
  function shock(at: number) {
    M[23] = 0.9;
    if (!S[28]) M[7] = Math.max(0, M[7]! - SHOCK_HP);
    M[11] = 0.3;
    M[15] = 0.5;
    S[12]!++;
    emit(E_SHOCK, at);
    const wasOn = M[5] === CLIMB || M[5] === ROOF;
    M[5] = AIR;
    M[12] = -1;
    M[58] = M[59] = 0;
    M[4] = 3.5;
    M[3] = wasOn ? -M[6]! * 3 : 0;
    if (M[7]! <= 0) knockOut();
  }

  // ---- the punch and the grab ----
  function fist() {
    const md = M[5]!, f = M[6]!;
    if (md === CLIMB) (M[16] = M[0]! + f * 1.35), (M[17] = M[1]! + HAND);
    else if (md === ROOF) (M[16] = M[0]! + f * 2), (M[17] = M[1]! + 2.4);
    else (M[16] = M[0]! + f * 1.95), (M[17] = M[1]! + 1.6);
  }
  /** The one window a punch from the wall hits now: on the floor at the hand (d 0), the one above (1) or
   *  below (−1), the first window that is not a hole yet from the wall in; −1 when that floor is gone through. */
  function sideTarget(d: number) {
    const b = M[12]!, s = M[22]!;
    if (b < 0 || !standing(b)) return -1;
    return rowTarget(b, Math.floor(M[1]! + HAND - yOff(b)) + d, s < 0);
  }
  /** The floor level with monster O's hand on the wall it hangs on (clamped to the floors still up), or −1. */
  function levelRow(O: Float64Array) {
    const b = O[12]!;
    if (O[5] !== CLIMB || b < 0 || !standing(b)) return -1;
    return Math.max(B[b * 6 + 3]!, Math.min(BLD[b * 4 + 2]! - 1, Math.floor(O[1]! + HAND - yOff(b))));
  }
  /** The window in reach cell c (./REACH) of monster O on its wall, or −1 (off the building, or not on a wall). */
  function reachCell(O: Float64Array, c: number) {
    const r = levelRow(O);
    if (r < 0 || c < 0 || c >= NR) return -1;
    const b = O[12]!, w = BLD[b * 4 + 1]!, fl = r + REACH[c * 2]!, col = REACH[c * 2 + 1]!;
    if (fl < B[b * 6 + 3]! || fl >= BLD[b * 4 + 2]! || col > w) return -1;
    return C0[b]! + fl * w + (O[22]! < 0 ? col - 1 : w - col);
  }
  /** How many reach cells monster O has where it hangs (7 on a wall, 5 on its top or bottom floor). */
  function reachCount(O: Float64Array) {
    let n = 0;
    for (let c = 0; c < NR; c++) if (reachCell(O, c) >= 0) n++;
    return n;
  }
  /** Is (x, y) in monster O's reach? On a wall: the reach cells' span (three rows, its own edge to three
   *  windows in, and the gap it hangs in); elsewhere: by the fist. */
  function inReach(O: Float64Array, x: number, y: number) {
    const r = levelRow(O);
    if (r >= 0) {
      const b = O[12]!, s = O[22]!, edge = s < 0 ? BLD[b * 4]! : BLD[b * 4]! + BLD[b * 4 + 1]!, u = (x - edge) * -s, y0 = yOff(b) + r;
      return u > -1.8 && u < 3.2 && y > y0 - 1.3 && y < y0 + 2.3;
    }
    const md = O[5]!, f = O[6]!, fx = O[0]! + f * (md === ROOF ? 2 : 1.95), fy = O[1]! + (md === ROOF ? 2.4 : 1.6);
    return Math.abs(x - fx) < 2.6 && Math.abs(y - fy) < 2.6;
  }
  /** Grab cell g's centre (in the world) for monster O into GC (./GRAB about its own cell: on a wall half a
   *  window out from the edge it holds, level with the floor at its hand; elsewhere at its hand). */
  function grabCell(O: Float64Array, g: number, T?: number[]) {
    const r = levelRow(O), U = T ?? (r >= 0 ? GRAB_WALL : GRAB), dx = U[g * 2]!, dy = U[g * 2 + 1]!;
    if (r >= 0) {
      const b = O[12]!, s = O[22]!;
      GC[0] = (s < 0 ? BLD[b * 4]! : BLD[b * 4]! + BLD[b * 4 + 1]!) + (0.5 - dx) * s;
      GC[1] = yOff(b) + r + 0.5 + dy;
    } else (GC[0] = O[0]! + (GRAB_X + dx) * O[6]!), (GC[1] = O[1]! + (O[5] === ROOF ? 2.4 : GRAB_Y) + dy);
  }
  /** How many grab cells monster O has (GRAB_WALL's 13 on a wall, GRAB's 12 off it). */
  function grabCount(O: Float64Array) {
    return levelRow(O) >= 0 ? NGW : NG;
  }
  /** The bottom floor's window j columns out from monster O's hand on the street (j 0..2), or −1. */
  function lowCell(O: Float64Array, j: number) {
    if (O[5] !== WALK && !(O[5] === AIR && O[1]! < 0.6)) return -1;
    const x = O[0]! + (GRAB_X + j) * O[6]!;
    for (let b = 0; b < nb(); b++) {
      const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!;
      if (x < x0 || x >= x0 + w || !standing(b)) continue;
      const fl = B[b * 6 + 3]!;
      return fl < BLD[b * 4 + 2]! ? C0[b]! + fl * w + Math.floor(x - x0) : -1;
    }
    return -1;
  }
  /** Is (x, y) in monster O's grab reach (one of its grab cells; `heli`: the helicopters' eight)? */
  function inGrab(O: Float64Array, x: number, y: number, heli = false) {
    for (let g = 0, n = heli ? NGH : grabCount(O); g < n; g++) {
      grabCell(O, g, heli ? GRAB_HELI : undefined);
      if (Math.abs(x - GC[0]!) < 0.62 && Math.abs(y - GC[1]!) < 0.62) return true;
    }
    return false;
  }
  /** The window at world (x, y) on a standing building's front, or −1. */
  function winAt(x: number, y: number) {
    for (let b = 0; b < nb(); b++) {
      const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!;
      if (x < x0 || x >= x0 + w || !standing(b)) continue;
      const fl = Math.floor(y - yOff(b));
      if (fl < B[b * 6 + 3]! || fl >= BLD[b * 4 + 2]!) return -1;
      return C0[b]! + fl * w + Math.floor(x - x0);
    }
    return -1;
  }
  /** Where target t is (a helicopter, a parachute, a soldier) into tx/ty; false when it is gone. */
  function targetAt(t: number) {
    if (t >= T_HELI && t < T_CHUTE) {
      const o = (t - T_HELI) * 12;
      return HE[o] === 1 ? ((TG[0] = HE[o + 1]!), (TG[1] = HE[o + 2]!), true) : false;
    }
    if (t >= T_CHUTE && t < T_SOLDIER) {
      const o = (t - T_CHUTE) * 9;
      return CH[o]! > 0 && !CH[o + 7] ? ((TG[0] = CH[o + 1]!), (TG[1] = CH[o + 2]!), true) : false;
    }
    if (t >= T_SOLDIER && t < T_END) {
      const o = (t - T_SOLDIER) * 8;
      return SO[o]! > 0 ? ((TG[0] = SO[o + 1]!), (TG[1] = 0.8), true) : false;
    }
    return false;
  }
  /** A punch starts: the wind-up; its direction is fixed now. On a wall it goes for one reach cell: the one
   *  tapped (t), else the stick's row (up, level, down) at the aim (close, medium, far), past holes further
   *  in, then closer. A tapped target out of reach is a whiff (the swing, no effect). */
  function punch(my: number, t: number) {
    const md = M[5]!;
    let c = -1;
    // A helicopter behind him (off a wall): he turns to it in the wind-up.
    if (t >= T_HELI && t < T_CHUTE && md !== CLIMB && targetAt(t) && (TG[0]! - M[0]!) * M[6]! < 0) M[6] = -M[6]!;
    // v12: a rival tapped (the power punch): behind him off a wall, he turns to it in the wind-up; out of the
    // shoulder's reach (or itself, or out of play) a whiff.
    const pw = t >= T_RIVAL && t < T_RIVAL_END;
    if (pw && t - T_RIVAL !== cur && md !== CLIMB && (MV[t - T_RIVAL]![0]! - M[0]!) * M[6]! < 0) M[6] = -M[6]!;
    if (pw && (t - T_RIVAL === cur || !powerReach(M, t - T_RIVAL))) t = T_MISS;
    const gr = t >= T_FOE && t < T_GROUND_END;
    if ((t === T_TANK || gr) && md !== CLIMB && md !== ROOF && (groundX(t) - M[0]!) * M[6]! < 0) M[6] = -M[6]!;
    if (t === T_TANK && !tankReach(M)) t = T_MISS;
    if (gr && !(groundX(t) === groundX(t) && groundReach(M, groundX(t)))) t = T_MISS;
    // A tapped target out of reach (or gone) is a whiff.
    if ((t >= T_CELL && t < T_GRAB && reachCell(M, t - T_CELL) < 0) || (t >= T_HELI && t < T_CHUTE && (!targetAt(t) || !inGrab(M, TG[0]!, TG[1]!, true)))) t = T_MISS;
    if (t >= T_CELL && t < T_GRAB) c = t - T_CELL;
    else if (t === T_MISS) {
      // The swing at air, then a recovery on top of it.
      M[45] = PUNCH_CD + WHIFF_T;
      if (md === CLIMB && levelRow(M) >= 0) c = 0;
    } else if (t === T_STREET || t === T_STREET + 1) {
      if (md !== CLIMB) M[6] = t === T_STREET ? -1 : 1;
    } else if (t >= T_LOW && t < T_TOP) {
      // The bottom floor from the street: behind him, he turns first (the wind-up covers it).
      if (md === CLIMB || md === ROOF) t = T_MISS, (M[45] = PUNCH_CD + WHIFF_T);
      else if (t >= T_LOW + NLOW) (M[6] = -M[6]!), (t -= NLOW);
    } else if (t >= T_HELI && t < T_CHUTE) {
      // (a swat: the helicopter check at the hit frame)
    } else if (md === CLIMB && levelRow(M) >= 0) {
      const row = my > 0.3 ? 1 : my < -0.3 ? -1 : 0, base = row > 0 ? 3 : row < 0 ? 5 : 0, n = row ? 2 : 3, a = Math.min(n - 1, M[39]!);
      c = base + a;
      for (let k = 0; k < n; k++) {
        const q = base + (a + k < n ? a + k : n - 1 - k), i = reachCell(M, q);
        if (i >= 0 && cell[i] !== HOLE) {
          c = q;
          break;
        }
      }
    }
    // (the tank: off a wall the power punch's clock, slammed down; from a wall the close down punch's motion)
    if (t === T_TANK && md === CLIMB) c = 5;
    const power = (t >= T_RIVAL && t < T_RIVAL_END) || (t === T_TANK && md !== CLIMB) || (t >= T_FOE && t < T_GROUND_END);
    const d = t >= T_TANK && t < T_GROUND_END ? -1 : c >= 0 ? REACH[c * 2]! : md === ROOF && my < -0.4 ? -1 : 0;
    M[8] = power ? POWER_CD : PUNCH_CD; M[9] = 1; M[34] = power ? POWER_HIT : PUNCH_HIT; M[35] = d; M[32] = d; M[38] = c + 1; M[42] = t; M[52] = power ? (t >= T_TANK ? NM + 1 : t - T_RIVAL + 1) : 0;
    S[14] = d;
    emit(E_PUNCH, d);
    return true;
  }
  /** On a wall a flick of the stick in towards the building steps the aim further (close, medium, far),
   *  a flick out steps it back. */
  function aim(mx: number) {
    if (M[5] !== CLIMB) return void (M[40] = 0);
    const v = mx * -M[22]!, q = v > 0.5 ? 1 : v < -0.5 ? -1 : 0;
    if (q && q !== M[40]) M[39] = Math.max(0, Math.min(2, M[39]! + q));
    M[40] = q;
  }
  /** The punch's hit frame. */
  function landPunch() {
    fist();
    const fx = M[16]!, fy = M[17]!, md = M[5]!, d = M[35]!, t = M[42]!;
    // A swing at nothing in reach: a whiff.
    if (t === T_MISS) return void emit(E_WHIFF, 0);
    if (t >= T_RIVAL && t < T_RIVAL_END) return powerLand(t - T_RIVAL);
    if (t === T_TANK) return void (tankReach(M) ? (tankHit(), (M[54] = FIGHT_T)) : emit(E_WHIFF, 0));
    if (t >= T_FOE && t < T_GROUND_END) {
      const x = groundX(t);
      if (!(x === x) || !groundReach(M, x)) return void emit(E_WHIFF, 0);
      if (t >= T_TRUCK) return truckBust(t - T_TRUCK);
      const o = (t - T_FOE) * 8;
      SO[o] = 0;
      chute(SO[o + 1]!, 0.6, SO[o + 2]!, 2, M[6]! * 3);
      S[7]!++;
      pts(50);
      return void emit(E_FLING, t - T_FOE);
    }
    // A helicopter first (a jump, a wall or a roof gets you up to it; a tapped one anywhere in reach).
    for (let h = 0; h < NH; h++) {
      const o = h * 12;
      if (HE[o] === 1 && (t === T_HELI + h ? inGrab(M, HE[o + 1]!, HE[o + 2]!, true) : Math.abs(HE[o + 1]! - fx) < 2 && Math.abs(HE[o + 2]! - fy) < 1.7)) {
        HE[o] = 2; HE[o + 4] = M[6]! * 4; HE[o + 5] = 2;
        S[5]!++;
        pts(250);
        return void emit(E_HELI, h);
      }
    }
    // Another monster in reach: a bonk (off a wall, off a roof). On a wall, one hanging beside it either way.
    for (let j = 0; j < NM; j++) {
      const O = MV[j]!;
      if (j === cur || O[24] !== IN || O[5] === KO) continue;
      // On a wall a punch at a window bonks only a monster in the way of it (at that window or between).
      const ci = md === CLIMB ? reachCell(M, M[38]! - 1) : -1;
      if (ci >= 0) {
        const b = M[12]!, w = BLD[b * 4 + 1]!, rel = ci - C0[b]!, fl = (rel / w) | 0, wx = BLD[b * 4]! + rel - fl * w + 0.5, wy = yOff(b) + fl + 0.5;
        if ((O[0]! - M[0]!) * (wx - M[0]!) > 0 && Math.abs(O[0]! - M[0]!) < Math.abs(wx - M[0]!) + 0.6 && wy > O[1]! + 0.2 && wy < O[1]! + 3.6) return bonk(j);
        continue;
      }
      const side = md === CLIMB ? Math.abs(O[0]! - M[0]!) < 2.6 && fy > O[1]! + 0.2 && fy < O[1]! + 3.6 : false;
      if (side || (Math.abs(O[0]! - fx) < 1.5 && (O[0]! - M[0]!) * M[6]! > 0 && fy > O[1]! + 0.3 && fy < O[1]! + 3.6)) return bonk(j);
    }
    if (md === CLIMB) {
      // The reach cell picked at the wind-up; a hole there is a whiff (the fist goes in, nothing to break).
      const i = reachCell(M, M[38]! - 1);
      if (S[28] && i >= 0 && cur === 0) {
        S[30] = S[30]! | (1 << (M[38]! - 1));
        if (S[30] === 127) S[29] = S[29]! | P_REACH;
        if (!LIVE[i]) for (let c = 0; c < NR; c++) if (LIVE[reachCell(M, c)]! && reachCell(M, c) >= 0) S[29] = S[29]! | P_LIVE;
      }
      if (i >= 0 && cell[i] !== HOLE) return void (LIVE[i] ? shock(i) : bk.strike(i, cur));
      return void emit(E_WHIFF, 0);
    }
    if (md === ROOF) {
      // Down through the roof: the top floor under the fist; the antenna bites.
      const b = M[12]!;
      if (ANT[b]! === ANT[b]! && Math.abs(ANT[b]! - fx) < 1.1) return shock(-1 - b);
      if (d < 0) {
        const w = BLD[b * 4 + 1]!, c = Math.max(0, Math.min(w - 1, Math.floor(M[0]! - BLD[b * 4]!)));
        for (let fl = BLD[b * 4 + 2]! - 1; fl >= B[b * 6 + 3]! && fl >= BLD[b * 4 + 2]! - 2; fl--) {
          const i = C0[b]! + fl * w + c;
          if (cell[i] === HOLE) continue;
          return void (LIVE[i] ? shock(i) : bk.strike(i, cur));
        }
      }
      return void emit(E_WHIFF, 0);
    }
    // From the street: a window on the bottom floor in front (v11, owner: "you can't smash the bottom floor"),
    // then soldiers, the tank, the train, the trucks.
    if (t >= T_LOW && t < T_LOW + NLOW) {
      const i = lowCell(M, t - T_LOW);
      if (i >= 0 && cell[i] !== HOLE) return void (LIVE[i] ? shock(i) : bk.strike(i, cur));
      return void emit(E_WHIFF, 0);
    }
    let hit = false;
    if (M[1]! < 2.5) {
      for (let s = 0; s < NS; s++) {
        const o = s * 8;
        if (SO[o]! > 0 && Math.abs(SO[o + 1]! - fx) < 1.5) {
          SO[o] = 0;
          chute(SO[o + 1]!, 0.6, SO[o + 2]!, 2, M[6]! * 3);
          S[7]!++;
          pts(50);
          emit(E_FLING, s);
          hit = true;
        }
      }
      if (TK[0] === 1 && Math.abs(TK[1]! - fx) < 2.2) tankHit(), (hit = true);
      if (FE[0] === 2 && fx > Math.min(FE[1]!, FE[1]! - FE[2]! * 9) - 0.5 && fx < Math.max(FE[1]!, FE[1]! - FE[2]! * 9) + 0.5 && Math.abs(FE[1]! - fx) < 3.2) derail(), (hit = true);
      for (let t = 0; t < NT; t++) if (TR[t * 6] === 1 && Math.abs(TR[t * 6 + 1]! - fx) < 1.9) truckBust(t), (hit = true);
    }
    if (!hit) emit(E_WHIFF, 0);
  }
  /** A punch on the tank: armour first (later cities), then it blows. */
  function tankHit() {
    if (TK[9]! > 1) {
      TK[9]!--;
      TK[10] = 0.3;
      pts(60);
      return emit(E_ARMOUR, TK[1]!);
    }
    TK[0] = 2; TK[5] = 4; TK[4] = Math.max(8, 13 - S[16]!);
    S[11]!++;
    pts(300);
    emit(E_TANK, TK[1]!);
  }
  function derail() {
    FE[0] = 3;
    FE[3] = 4;
    S[23]!++;
    pts(400);
    emit(E_TRAIN, FE[1]!);
  }
  function truckBust(t: number) {
    TR[t * 6] = 2;
    TR[t * 6 + 5] = 3;
    S[24]!++;
    pts(150);
    emit(E_TRUCK, TR[t * 6 + 1]!);
  }
  /** Monster j takes a punch: health, and off whatever it hangs on. */
  function bonk(j: number) {
    const O = MV[j]!;
    O[7] = Math.max(S[28] ? 1 : 0, O[7]! - 6);
    O[11] = 0.3;
    O[54] = M[54] = FIGHT_T;
    if (O[5] === CLIMB || O[5] === ROOF) (O[5] = AIR), (O[12] = -1), (O[4] = 4), (O[3] = M[6]! * 5), (O[15] = 0.7), (O[58] = O[59] = 0);
    else O[3] = M[6]! * 3;
    pts(30);
    emit(E_BONK, j);
    if (O[7]! <= 0) {
      const k = cur;
      setCur(j);
      knockOut();
      setCur(k);
    }
  }
  /** v12: is monster j in reach of monster O's power punch? From the punching shoulder (the side j is on: off a
   *  wall he turns to it), to j's chest, POWER_R (the same at the hit frame: a step
   *  or a jump clear in the wind-up is a dodge). Not itself, not out of play or shrunk. */
  function powerReach(O: Float64Array, j: number, slack = 1) {
    const R = MV[j]!;
    if (R === O || R[24] !== IN || R[5] === KO) return false;
    const f = R[0]! >= O[0]! ? 1 : -1, dx = R[0]! - (O[0]! + f * 0.55), dy = R[1]! + 1.7 - (O[1]! + (O[5] === CLIMB ? HAND + 0.5 : SHOULDER_Y)), r = POWER_R * slack;
    return dx * dx + dy * dy < r * r;
  }
  /** v12: is the tank in reach of monster O's smash (from the punching shoulder, either side: off a wall he turns)? */
  function tankReach(O: Float64Array) {
    if (TK[0] !== 1 || O[5] === ROOF) return false;
    if (O[5] !== CLIMB) return groundReach(O, TK[1]!);
    const f = TK[1]! >= O[0]! ? 1 : -1, dx = TK[1]! - (O[0]! + f * 0.55), dy = 0.9 - (O[1]! + (O[5] === CLIMB ? HAND + 0.5 : SHOULDER_Y));
    return dx * dx + dy * dy < TANK_R * TANK_R;
  }
  /** Off a wall, is ground x in the band in front of monster O's punching shoulder (either side: he turns)? */
  function groundReach(O: Float64Array, x: number) {
    if (O[5] === CLIMB || O[5] === ROOF || O[1]! > 3) return false;
    const f = x >= O[0]! ? 1 : -1;
    return (x - (O[0]! + f * 0.55)) * f < GROUND_R;
  }
  /** Where ground target t (a soldier, a truck) is, or NaN when it is gone. */
  function groundX(t: number) {
    if (t >= T_FOE && t < T_FOE + NS) return SO[(t - T_FOE) * 8]! > 0 ? SO[(t - T_FOE) * 8 + 1]! : NaN;
    if (t >= T_TRUCK && t < T_TRUCK + NT) return TR[(t - T_TRUCK) * 6] === 1 ? TR[(t - T_TRUCK) * 6 + 1]! : NaN;
    return TK[0] === 1 ? TK[1]! : NaN;
  }
  /** Monster j takes a hit in the fight: n health (the dummy never goes under 1), the health bars show. */
  function fightHit(j: number, n: number) {
    const O = MV[j]!;
    O[7] = Math.max(S[28] ? 1 : 0, O[7]! - n);
    O[11] = 0.35;
    O[54] = M[54] = FIGHT_T;
    // A stunned or hit monster drops what it was doing (an AI's crouch, a wind-up).
    O[55] = O[57] = 0;
  }
  /** The power punch's hit frame: it lands if the rival is still in reach (moved or jumped clear: a whiff), with the
   *  combo's bonus on a stunned one, a knockback, and off whatever wall or roof it is on. */
  function powerLand(j: number) {
    const O = MV[j]!;
    if (!powerReach(M, j)) return void emit(E_WHIFF, 0);
    const stun = O[53]! > 0, on = O[5] === CLIMB || O[5] === ROOF, dir = O[0]! >= M[0]! ? 1 : -1;
    fightHit(j, POWER_HP + (stun ? COMBO_HP : 0));
    O[53] = 0; O[8] = O[34] = O[52] = O[20] = O[21] = 0;
    O[5] = AIR; O[12] = -1; O[4] = on ? 2.5 : 5; O[3] = dir * (on ? 6 : 8); O[15] = 0.6; O[58] = O[59] = 0;
    pts(stun ? 160 : 80);
    if (S[28] && cur === 0) S[29] = S[29]! | P_POWER;
    emit(E_POWER, j);
    if (stun) emit(E_COMBO_HIT, j);
    if (on) emit(E_KNOCKOFF, j);
    if (O[7]! <= 0) {
      const k = cur;
      setCur(j);
      knockOut();
      setCur(k);
    }
  }
  /** A jump coming down on another monster's head or back (in the air, falling, over it): a pounce. It is
   *  stunned (STUN_T: no moves), loses POUNCE_HP, is knocked off a wall; the jumper bounces up off it. */
  function pounce() {
    if (M[5] !== AIR || M[4]! > -1 || M[15]! > 0) return;
    // v12: onto the tank: crushed (not the gunboat: it is out on the water); onto a soldier: flung.
    if (TK[0] === 1 && city().feature !== HARBOUR && Math.abs(TK[1]! - M[0]!) < 1.9 && M[1]! < 2.2) return void ((TK[9] = 0), tankHit(), (M[4] = 7));
    if (M[1]! < 1.4)
      for (let s = 0; s < NS; s++) {
        const o = s * 8;
        if (SO[o]! > 0 && Math.abs(SO[o + 1]! - M[0]!) < 1.3) (SO[o] = 0), chute(SO[o + 1]!, 0.5, SO[o + 2]!, 2, (SO[o + 1]! > M[0]! ? 1 : -1) * 3), S[7]!++, pts(50), emit(E_STOMP, s);
      }
    for (let j = 0; j < NM; j++) {
      const O = MV[j]!;
      if (j === cur || O[24] !== IN || O[5] === KO || O[53]! > 0 || Math.abs(O[0]! - M[0]!) > 1.3) continue;
      const h = M[1]! - O[1]!;
      if (h < POUNCE_LO || h > POUNCE_HI) continue;
      const on = O[5] === CLIMB || O[5] === ROOF;
      fightHit(j, POUNCE_HP);
      O[53] = STUN_T; O[8] = O[34] = O[52] = O[20] = O[21] = 0;
      if (on) (O[5] = AIR), (O[12] = -1), (O[4] = 0), (O[3] = 0), (O[15] = 0.6), (O[58] = O[59] = 0);
      M[4] = 7; M[3] = M[6]! * 1.5;
      pts(60);
      if (S[28] && cur === 0) S[29] = S[29]! | P_POUNCE;
      emit(E_POUNCE, j);
      if (on) emit(E_KNOCKOFF, j);
      if (O[7]! <= 0) {
        const k = cur;
        setCur(j);
        knockOut();
        setCur(k);
      }
      return;
    }
  }
  /** An action starts: a targeted one (a tap, a click: something picked in reach) soon after the last steps
   *  the combo (./COMBO; the AI only to its second step); anything else leaves it, a whiff drops it (./emit). */
  function chain(t: number, ai: boolean) {
    if (t > 0 && t !== T_MISS && M[46]! >= 1 && M[47]! <= COMBO_GAP) {
      let s = 0;
      while (s < COMBO.length - 1 && COMBO[s]! <= (M[46]! || 1)) s++;
      M[46] = ai ? Math.min(COMBO[1]!, COMBO[s]!) : COMBO[s]!;
    } else if (t > 0 && t !== T_MISS) M[46] = 1;
    M[47] = 0;
  }
  /** A grab: what was tapped (a window's person in reach, a parachute, a soldier), else the nearest snack
   *  by the hand; a tapped target out of reach: the hand closes on air. */
  function grab(t: number) {
    const md = M[5]!;
    let i = -1;
    // Behind him (off a wall): he turns to face it (TURN_T), then grabs (the target queued again).
    const off = md !== CLIMB && md !== KO;
    let back = off && t >= T_BACK && t < T_BACK + NG;
    if (!back && off && t >= T_CHUTE && t < T_END && targetAt(t) && (TG[0]! - M[0]!) * M[6]! < 0) back = true;
    if (back) {
      M[6] = -M[6]!;
      M[49] = TURN_T;
      M[14] = TURN_T;
      M[21] = TURN_T + 0.3;
      M[44] = t >= T_BACK && t < T_BACK + NG ? t - T_BACK + T_GRAB : t;
      // (a parachute or a soldier behind chained the combo on this press already: not again when it fires)
      M[56] = t >= T_BACK && t < T_BACK + NG ? 0 : 1;
      return true;
    }
    M[50] = M[51] = 0;
    // A tapped target out of reach (or gone): the hand closes on air.
    let miss = false;
    if (t >= T_GRAB && t < T_HELI) {
      if (t - T_GRAB >= grabCount(M)) miss = true;
      else if (grabCell(M, t - T_GRAB), (M[50] = GC[0]!), (M[51] = GC[1]!), (i = winAt(GC[0]!, GC[1]!)) < 0) miss = true;
    } else if (t >= T_CHUTE && t < T_END && (!targetAt(t) || !inGrab(M, TG[0]!, TG[1]!))) miss = true;
    else if (t >= T_CHUTE && t < T_END) (M[50] = TG[0]!), (M[51] = TG[1]!);
    M[14] = GRAB_CD;
    M[10] = 1;
    // The arm's motion: the punch's for that cell when it is one of the punch's seven, else the close jab's.
    M[41] = 0;
    if (i >= 0 && md === CLIMB && t - T_GRAB < NR) M[41] = t - T_GRAB + 1;
    fist();
    const fx = M[16]!, fy = M[17]! + 0.2;
    if (miss) return (M[45] = GRAB_CD + WHIFF_T), emit(E_WHIFF, 1), true;
    if (i >= 0) {
      // The tapped window: whoever is at it (a hot pot burns), a live part bites, else nothing.
      const kind = occ[i]!;
      if (kind === 3) return burn(i), true;
      if (kind) return (occ[i] = 0), snack(kind === 2 ? 12 : 16, i), true;
      if (LIVE[i] && cell[i] !== HOLE) return shock(i), true;
      return emit(E_WHIFF, 1), true;
    }
    if (t >= T_CHUTE && t < T_SOLDIER) return (CH[(t - T_CHUTE) * 9] = 0), snack(16, -1), true;
    if (t >= T_SOLDIER && t < T_END) return (SO[(t - T_SOLDIER) * 8] = 0), S[7]!++, snack(12, -1), true;
    grabNear(md, fx, fy);
    return true;
  }
  function grabNear(md: number, fx: number, fy: number) {
    if (md === CLIMB) {
      // The building it holds: whoever is in one of the seven reach cells (the punch's: if it can punch it, it
      // can grab it), the closest first; then the next building across the gap, its edge windows by the hand.
      let best = -1, bd = 9;
      for (let c = 0; c < NR; c++) {
        const i = reachCell(M, c);
        if (i < 0 || !occ[i] || cell[i] === HOLE) continue;
        const d = Math.abs(REACH[c * 2]!) + (REACH[c * 2 + 1]! - 1) * 0.6 + (occ[i] === 3 ? 2 : 0);
        if (d < bd) (bd = d), (best = i), (M[41] = c + 1);
      }
      for (let side = M[22]!, n = 0; n < 1; n++) {
        const tb = M[12]! + side;
        if (tb < 0 || tb >= nb() || !standing(tb)) continue;
        const x0 = BLD[tb * 4]!, w = BLD[tb * 4 + 1]!, edge = side > 0 ? x0 : x0 + w;
        if (Math.abs(edge - M[0]!) > 2.4) continue;
        const r0 = rowOf(tb, fy);
        for (let fl = r0 - 1; fl <= r0 + 1; fl++) {
          if (fl < B[tb * 6 + 3]! || fl >= BLD[tb * 4 + 2]!) continue;
          for (let k = 0; k < 2; k++) {
            const c = side > 0 ? k : w - 1 - k, i = C0[tb]! + fl * w + c;
            if (!occ[i]) continue;
            const d = Math.abs(fl - r0) + k * 0.6 + 0.5 + (occ[i] === 3 ? 2 : 0);
            if (d < bd) (bd = d), (best = i), (M[41] = 0);
          }
        }
      }
      if (best >= 0) {
        const kind = occ[best]!;
        if (kind === 3) return burn(best);
        occ[best] = 0;
        return snack(kind === 2 ? 12 : 16, best);
      }
      // No one there: the hand closes on what is next to it; a live part bites.
      const i = reachCell(M, 0);
      if (i >= 0 && LIVE[i] && cell[i] !== HOLE) return shock(i);
      return void emit(E_WHIFF, 1);
    }
    if (md === ROOF && ANT[M[12]!]! === ANT[M[12]!]! && Math.abs(ANT[M[12]!]! - fx) < 1.1) return shock(-1 - M[12]!);
    // Off a wall (the keys', a gamepad's grab): whoever is at a window in the front fan, nearest the hand first.
    if (md !== ROOF) {
      let best = -1, bd = 99, bg = 0;
      for (let g = 0; g < NG; g++) {
        grabCell(M, g);
        const j = winAt(GC[0]!, GC[1]!);
        if (j < 0 || !occ[j] || cell[j] === HOLE) continue;
        const d = Math.abs(GRAB[g * 2]!) + Math.abs(GRAB[g * 2 + 1]!) + (occ[j] === 3 ? 4 : 0);
        if (d < bd) (bd = d), (best = j), (bg = g);
      }
      if (best >= 0) {
        grabCell(M, bg);
        (M[50] = GC[0]!), (M[51] = GC[1]!);
        const kind = occ[best]!;
        if (kind === 3) return burn(best);
        occ[best] = 0;
        return snack(kind === 2 ? 12 : 16, best);
      }
    }
    // A soldier off the street.
    if (md === WALK || (md === AIR && M[1]! < 2))
      for (let s = 0; s < NS; s++) {
        const o = s * 8;
        if (SO[o]! > 0 && Math.abs(SO[o + 1]! - fx) < 1.7) return void ((SO[o] = 0), S[7]!++, snack(12, -1));
      }
    // A parachute in reach.
    for (let k = 0; k < NCH; k++) {
      const o = k * 9;
      if (CH[o]! > 0 && !CH[o + 7] && Math.abs(CH[o + 1]! - fx) < 1.3 && Math.abs(CH[o + 2]! - fy) < 1.4) return void ((CH[o] = 0), snack(16, -1));
    }
    emit(E_WHIFF, 1);
  }
  function snack(hp: number, from: number) {
    M[7] = Math.min(MAX_HP, M[7]! + hp);
    M[18] = 0.6;
    S[6]!++;
    M[26]!++;
    pts(100);
    S[15] = cur;
    emit(E_NOM, from);
  }
  function burn(i: number) {
    S[15] = cur;
    emit(E_BURN, i);
    M[15] = 0;
    hurt(5);
    M[23] = Math.max(M[23]!, 0.25);
  }
  /** A hard landing on the street: soldiers under it go packing, the tank blows, a truck is crushed. */
  function stomp(O: Float64Array) {
    for (let s = 0; s < NS; s++) {
      const o = s * 8;
      if (SO[o]! > 0 && Math.abs(SO[o + 1]! - O[0]!) < 1.6) (SO[o] = 0), chute(SO[o + 1]!, 0.5, SO[o + 2]!, 2, (SO[o + 1]! - O[0]! > 0 ? 1 : -1) * 3), S[7]!++, pts(50), emit(E_STOMP, s);
    }
    if (TK[0] === 1 && city().feature !== HARBOUR && Math.abs(TK[1]! - O[0]!) < 1.9) (TK[9] = 0), tankHit();
    for (let t = 0; t < NT; t++) if (TR[t * 6] === 1 && Math.abs(TR[t * 6 + 1]! - O[0]!) < 1.8) truckBust(t);
  }

  // ---- the army and the feature ----
  function stepArmy(dt: number) {
    const t = S[1]!, ci = S[16]!, F = MV[nearest(0)]!, mx = F[0]!, sx = SXv(), feat = city().feature;
    // Soldiers walk in from the ends, stop at their range, and throw; more of them city by city.
    T[0]! -= dt;
    if (T[0]! <= 0) {
      T[0] = Math.max(1.5, 4.2 - t * 0.03 - ci * 0.32) * (0.7 + rnd() * 0.6);
      let alive = 0;
      for (let s = 0; s < NS; s++) if (SO[s * 8]! > 0) alive++;
      for (let s = 0; s < NS && alive < 3 + ci; s++) {
        const o = s * 8;
        if (SO[o]! > 0) continue;
        const side = mx > 6 ? -1 : mx < -6 ? 1 : rnd() < 0.5 ? -1 : 1;
        SO[o] = 1; SO[o + 1] = side * (sx + 1); SO[o + 2] = STREET0 + 1.9 + rnd() * 2.2; SO[o + 3] = -side; SO[o + 4] = 0; SO[o + 5] = 1 + rnd(); SO[o + 6] = 3.5 + rnd() * 3; SO[o + 7] = rnd() * 6;
        break;
      }
    }
    for (let s = 0; s < NS; s++) {
      const o = s * 8;
      if (SO[o]! <= 0) continue;
      const dx = MV[nearest(SO[o + 1]!)]![0]! - SO[o + 1]!, d = Math.abs(dx);
      SO[o + 3] = dx > 0 ? 1 : -1;
      if (d > SO[o + 6]! + 0.5) (SO[o + 1] = SO[o + 1]! + SO[o + 3]! * 2.6 * dt), (SO[o + 4] = 0), (SO[o + 7] = SO[o + 7]! + dt * 9);
      else if (d < SO[o + 6]! - 1.2) (SO[o + 1] = SO[o + 1]! - SO[o + 3]! * 2.2 * dt), (SO[o + 4] = 0), (SO[o + 7] = SO[o + 7]! + dt * 9);
      else SO[o + 4] = 1;
      SO[o + 5]! -= dt;
      if (SO[o + 5]! <= 0 && d < 11) (SO[o + 5] = Math.max(1.4, 2.4 - ci * 0.12) + rnd() * 1.4), pebble(SO[o + 1]! + SO[o + 3]! * 0.2, 0.55, SO[o + 2]!, 8, 0);
    }
    // Snipers in the windows.
    for (let b = 0; b < nb(); b++) {
      if (B[b * 6] !== STAND) continue;
      const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
      for (let fl = B[b * 6 + 3]!; fl < f; fl++) for (let c = 0; c < w; c++) {
        const i = C0[b]! + fl * w + c;
        if (occ[i] !== 2) continue;
        ocT[i] = ocT[i]! - dt;
        if (ocT[i]! <= 0) {
          ocT[i] = 2.6 + rnd() * 1.6;
          const x = x0 + c + 0.5;
          if (Math.abs(x - mx) < 9) pebble(x, yOff(b) + fl + 0.5, 0.2, 7, 0);
        }
      }
    }
    // New people come to the windows (snacks, and a sniper now and then; a crowd at the stadium).
    T[1]! -= dt;
    if (T[1]! <= 0) {
      T[1] = (0.9 + rnd() * 0.7) * (feat === STADIUM ? 0.5 : 1);
      const b = Math.floor(rnd() * nb());
      if (B[b * 6] === STAND) {
        const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, i = C0[b]! + Math.floor(rnd() * f) * w + Math.floor(rnd() * w);
        if (cell[i] !== HOLE && !occ[i] && !LIVE[i]) {
          const r = rnd();
          occ[i] = r < 0.2 + ci * 0.015 ? 2 : r < 0.3 ? 3 : 1;
          ocT[i] = 2 + rnd() * 2;
        }
      }
    }
    // The tank (the gunboat on the harbour's water): in from the far side, stops at its range, fires shells.
    if (TK[0] === 0) {
      TK[4]! -= dt;
      if (TK[4]! <= 0) {
        const side = mx > 0 ? -1 : 1;
        TK[0] = 1; TK[1] = side * (sx + 2); TK[2] = -side; TK[3] = 2.5; TK[6] = 0; TK[7] = feat === HARBOUR ? STREET1 + 1.3 : STREET0 + 3.1; TK[9] = ci >= TANK_ARMOUR ? TANK_HITS + 1 : TANK_HITS;
      }
    } else if (TK[0] === 1) {
      const dx = mx - TK[1]!;
      TK[2] = dx > 0 ? 1 : -1;
      if (Math.abs(dx) > (feat === HARBOUR ? 2.5 : 7.5)) (TK[1] = TK[1]! + TK[2]! * (feat === HARBOUR ? 2.6 : 1.8) * dt), (TK[8] = TK[8]! + dt * 1.8);
      TK[6] = Math.max(0, TK[6]! - dt * 3);
      TK[10] = Math.max(0, TK[10]! - dt);
      TK[3]! -= dt;
      if (TK[3]! <= 0 && Math.abs(dx) < 12) (TK[3] = Math.max(1.8, 3.2 - ci * 0.2) + rnd()), (TK[6] = 1), pebble(TK[1]! + TK[2]! * 1.7, 1.05, TK[7]!, 9, 2);
    } else if (TK[0] === 2) {
      TK[5]! -= dt;
      if (TK[5]! <= 0) TK[0] = 0;
    }
    // The helicopters: in from a side, circle the monster, fire bursts; punched, they spin down.
    const nh = feat === SKYPORT || ci >= 5 ? 2 : 1, hs = 6 + ci * 0.6 + (feat === SKYPORT ? 1.5 : 0);
    for (let h = 0; h < nh; h++) {
      const o = h * 12, he = HE[o]!;
      HE[o + 10] = HE[o + 10]! + dt;
      if (he === 0) {
        HE[o + 8]! -= dt;
        if (HE[o + 8]! <= 0) {
          const side = (mx > 0 ? -1 : 1) * (h ? -1 : 1);
          HE[o] = 1; HE[o + 1] = side * (sx + 3); HE[o + 2] = 9; HE[o + 3] = 2.6 + h * 0.6; HE[o + 4] = 0; HE[o + 5] = 0; HE[o + 6] = 2.5; HE[o + 7] = 0; HE[o + 10] = h * 3.1;
        }
      } else if (he === 1) {
        // It swings in close now and then (the time to swat it), then stands off.
        const ht = HE[o + 10]!, tx = mx + Math.cos(ht * 0.55) * (3.8 + Math.sin(ht * 0.37) * 2.3) * (h ? -1 : 1), ty = Math.min(11.5 + ci * 0.3, Math.max(5, F[1]! + 4.3 + Math.sin(ht * 1.3) * 1.3));
        const ax = (tx - HE[o + 1]!) * 1.6 - HE[o + 4]! * 1.4, ay = (ty - HE[o + 2]!) * 2 - HE[o + 5]! * 1.8;
        HE[o + 4] = HE[o + 4]! + ax * dt; HE[o + 5] = HE[o + 5]! + ay * dt;
        const sp = Math.abs(HE[o + 4]!);
        if (sp > hs) HE[o + 4] = (HE[o + 4]! / sp) * hs;
        HE[o + 1] = HE[o + 1]! + HE[o + 4]! * dt; HE[o + 2] = HE[o + 2]! + HE[o + 5]! * dt;
        HE[o + 11] = HE[o + 11]! + (Math.max(-0.4, Math.min(0.4, HE[o + 4]! * 0.08)) - HE[o + 11]!) * Math.min(1, dt * 4);
        HE[o + 6]! -= dt;
        if (HE[o + 6]! <= 0) {
          if (HE[o + 7]! <= 0) HE[o + 7] = 3;
          pebble(HE[o + 1]!, HE[o + 2]! - 0.4, HE[o + 3]!, 10, 1);
          HE[o + 7]!--;
          HE[o + 6] = HE[o + 7]! > 0 ? 0.14 : Math.max(1.4, 2.6 - ci * 0.15) + rnd();
        }
      } else if (he === 2) {
        HE[o + 5] = HE[o + 5]! - G * 0.55 * dt;
        HE[o + 1] = HE[o + 1]! + HE[o + 4]! * dt; HE[o + 2] = HE[o + 2]! + HE[o + 5]! * dt;
        HE[o + 9] = HE[o + 9]! + dt * 9;
        if (HE[o + 2]! <= 0.4) (HE[o] = 0), (HE[o + 8] = Math.max(3.5, 6.5 - ci * 0.4)), (HE[o + 9] = 0), emit(E_HELI_CRASH, HE[o + 1]!);
      }
    }
    if (feat === RAIL) stepTrain(dt, sx);
    else if (feat === BRIDGE) stepTrucks(dt, sx);
    else if (feat === PLANT) stepSurge(dt);
    // Pebbles and shells fly; one that reaches a monster stings.
    for (let k = 0; k < NP; k++) {
      const o = k * 8;
      if (PB[o]! <= 0) continue;
      PB[o]! -= dt;
      PB[o + 1] = PB[o + 1]! + PB[o + 4]! * dt; PB[o + 2] = PB[o + 2]! + PB[o + 5]! * dt; PB[o + 3] = PB[o + 3]! + PB[o + 6]! * dt;
      for (let m = 0; m < NM; m++) {
        const O = MV[m]!;
        if (O[24] !== IN || O[5] === KO) continue;
        const dx = PB[o + 1]! - O[0]!, dy = PB[o + 2]! - (O[1]! + 2), dz = PB[o + 3]! - O[2]!;
        if (dx * dx + dy * dy * 0.45 + dz * dz * 0.4 < 1.35) {
          PB[o] = 0;
          setCur(m);
          hurt(PB[o + 7] === 2 ? 6 : 3);
          break;
        }
      }
      if (PB[o]! > 0 && PB[o + 2]! < 0) PB[o] = 0;
    }
    // Parachutes float down, land and run for it.
    for (let k = 0; k < NCH; k++) {
      const o = k * 9;
      if (CH[o]! <= 0) continue;
      CH[o + 8] = CH[o + 8]! + dt;
      if (!CH[o + 7]) {
        CH[o + 5] = Math.max(-1.25, CH[o + 5]! - 9 * dt);
        CH[o + 4] = CH[o + 4]! * (1 - dt * 0.8);
        CH[o + 1] = CH[o + 1]! + CH[o + 4]! * dt; CH[o + 2] = CH[o + 2]! + CH[o + 5]! * dt;
        CH[o + 3] = CH[o + 3]! + (STREET0 + 2.4 - CH[o + 3]!) * Math.min(1, dt * 0.8);
        if (CH[o + 2]! <= 0) (CH[o + 2] = 0), (CH[o + 7] = 1), (CH[o + 4] = CH[o + 1]! > mx ? 4.5 : -4.5);
      } else {
        CH[o + 1] = CH[o + 1]! + CH[o + 4]! * dt;
        if (Math.abs(CH[o + 1]!) > sx + 2) CH[o] = 0;
      }
    }
  }
  /** The freight train: bells, then nine units of engine and wagons along the street, bowling over
   *  anything on it; punched at the engine, it derails. */
  function stepTrain(dt: number, sx: number) {
    FE[3]! -= dt;
    if (FE[0] === 0 && FE[3]! <= 0) (FE[0] = 1), (FE[3] = 2), (FE[2] = rnd() < 0.5 ? 1 : -1), (FE[1] = -FE[2]! * (sx + 4)), (FE[4] = STREET0 + 1.6), emit(E_BELLS, FE[2]!);
    else if (FE[0] === 1 && FE[3]! <= 0) FE[0] = 2;
    else if (FE[0] === 2) {
      FE[1] = FE[1]! + FE[2]! * (10 + S[16]! * 0.6) * dt;
      const a = Math.min(FE[1]!, FE[1]! - FE[2]! * 9), b = Math.max(FE[1]!, FE[1]! - FE[2]! * 9);
      for (let m = 0; m < NM; m++) {
        const O = MV[m]!;
        if (O[24] !== IN || O[5] === KO || O[1]! > 1.4 || O[5] === CLIMB || O[5] === ROOF) continue;
        if (O[0]! > a - 0.6 && O[0]! < b + 0.6) setCur(m), knock(9, FE[2]! * 7), emit(E_RAM, 0);
      }
      setCur(0);
      if ((FE[1]! - FE[2]! * 9) * FE[2]! > sx + 5) (FE[0] = 0), (FE[3] = Math.max(5, 9 - S[16]! * 0.5) + rnd() * 3);
    } else if (FE[0] === 3 && FE[3]! <= 0) (FE[0] = 0), (FE[3] = 7);
  }
  /** Trucks across the bridge deck both ways: they knock you flat; landed on or punched, they stop. */
  function stepTrucks(dt: number, sx: number) {
    FE[10]! -= dt;
    if (FE[10]! <= 0) {
      FE[10] = Math.max(2.6, 5 - S[1]! * 0.02) + rnd() * 2;
      for (let t = 0; t < NT; t++) {
        const o = t * 6;
        if (TR[o]) continue;
        const d = rnd() < 0.5 ? 1 : -1;
        TR[o] = 1; TR[o + 1] = -d * (sx + 3); TR[o + 2] = d; TR[o + 3] = 7 + rnd() * 3; TR[o + 4] = d > 0 ? STREET0 + 3.0 : STREET0 + 4.0; TR[o + 5] = 0;
        break;
      }
    }
    for (let t = 0; t < NT; t++) {
      const o = t * 6;
      if (TR[o] === 2) {
        TR[o + 5]! -= dt;
        if (TR[o + 5]! <= 0) TR[o] = 0;
        continue;
      }
      if (TR[o] !== 1) continue;
      TR[o + 1] = TR[o + 1]! + TR[o + 2]! * TR[o + 3]! * dt;
      for (let m = 0; m < NM; m++) {
        const O = MV[m]!;
        if (O[24] !== IN || O[5] === KO || O[1]! > 1.2 || O[5] === CLIMB || O[5] === ROOF) continue;
        if (Math.abs(O[0]! - TR[o + 1]!) < 1.4) setCur(m), knock(5, TR[o + 2]! * 5), emit(E_RAM, 1);
      }
      setCur(0);
      if (Math.abs(TR[o + 1]!) > sx + 4) TR[o] = 0;
    }
  }
  /** The grid surges: every live part arcs to the wall beside it; a climber on that side, near that floor, gets it. */
  function stepSurge(dt: number) {
    if (FE[9]! > 0) {
      FE[9]! -= dt;
      for (let m = 0; m < NM; m++) {
        const O = MV[m]!;
        if (O[24] !== IN || O[5] !== CLIMB || O[15]! > 0) continue;
        const b = O[12]!, w = BLD[b * 4 + 1]!, s = O[22]!, col = s < 0 ? 0 : w - 1, fl = rowOf(b, O[1]! + HAND);
        for (let d = -1; d <= 1; d++) {
          const f2 = fl + d;
          if (f2 < B[b * 6 + 3]! || f2 >= BLD[b * 4 + 2]!) continue;
          if (LIVE[C0[b]! + f2 * w + col]) {
            setCur(m);
            shock(C0[b]! + f2 * w + col);
            break;
          }
        }
      }
      setCur(0);
    } else if ((FE[8] = FE[8]! - dt) <= 0) (FE[8] = Math.max(4.5, 7 - S[1]! * 0.02)), (FE[9] = 1.4), S[25]!++, emit(E_SURGE, 0);
  }

  function step(dt: number, I: Float64Array) {
    const ph = S[0]!;
    if (ph === DONE) return stepFall(dt);
    if (ph === READY) {
      let any = false;
      for (let s = 0; s < SEATS * NI; s++) if (Math.abs(I[s]!) > 0.3) any = true;
      if (!any) return false;
      S[0] = RUN;
      emit(E_START, 0);
    }
    S[19] = S[19]! + dt;
    if (ph === CLEAR) {
      // The card between cities: the next one after the card's time, or a press once it has been up a moment.
      S[17]! -= dt;
      let skip = false;
      for (let s = 0; s < SEATS; s++) if (I[s * NI + 2] || I[s * NI + 3]) skip = true;
      if (S[17]! <= 0 || (skip && S[17]! < CARD_T - 1.2)) {
        const next = S[16]! + 1;
        if (next >= NCITY) return S[27] ? (loadCity(0), (S[0] = RUN), true) : (end(1), true);
        loadCity(next);
        S[0] = RUN;
      }
      return true;
    }
    S[1] = S[1]! + dt;
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[24] === WAIT && (O[30] = O[30]! - dt) <= 0) O[24] = IN;
      if (O[24] !== IN) continue;
      const who = O[28]!;
      if (who === AI) autopilot(IA, k);
      else for (let j = 0; j < NI; j++) IA[j] = I[who * NI + j]!;
      setCur(k);
      // v12: stunned (a pounce) it can't move; an AI's pounce crouches, then jumps at where its target was.
      M[53] = Math.max(0, M[53]! - dt);
      M[54] = Math.max(0, M[54]! - dt);
      if (M[55]! > 0) {
        M[19] = Math.max(M[19]!, 0.7);
        if ((M[55] = Math.max(0, M[55]! - dt)) <= 0 && M[5] === WALK && M[57]! > 0) {
          const dx = MV[M[57]! - 1]![0]! - M[0]!;
          M[5] = AIR; M[4] = 11.5; M[3] = Math.max(-6, Math.min(6, dx / 0.5)); M[6] = dx >= 0 ? 1 : -1;
          emit(E_JUMP, 0);
        }
      } else if (M[5] !== AIR) M[57] = 0;
      const ko = M[5] === KO || M[53]! > 0 || M[55]! > 0, py = M[1]!;
      cl.step(M, k, dt, ko ? 0 : IA[0]!, ko ? 0 : IA[1]!, ko ? 0 : IA[3]!, who !== AI);
      if (M[1]! < py) pounce();
      if (M[5] !== KO && !(M[53]! > 0)) {
        aim(IA[0]!);
        const t = IA[5]!;
        if (IA[2]) (M[20] = 0.3), (M[43] = isPunch(t) ? t : 0);
        if (IA[4]) (M[21] = 0.3), (M[44] = (t >= T_GRAB && t < T_HELI) || (t >= T_CHUTE && t < T_END) || (t >= T_BACK && t < T_BACK + NG) ? t : 0);
        M[49] = Math.max(0, M[49]! - dt);
        M[45] = Math.max(0, M[45]! - dt);
        // The combo: the wind-up and the recovery run faster (./COMBO); a pause between actions drops it.
        const cm = M[46]! || 1;
        // (not the power punch: its wind-up is one fixed length, a tell to dodge)
        if (cm > 1 && !M[52]) (M[8] = Math.max(0, M[8]! - dt * (cm - 1))), (M[14] = Math.max(0, M[14]! - dt * (cm - 1)));
        if (M[8]! <= 0) M[52] = 0;
        if (M[8]! <= 0 && M[14]! <= 0 && M[34]! <= 0 && (M[47] = M[47]! + dt) > COMBO_GAP) M[46] = 1;
        if (M[20]! > 0 && M[8]! <= 0 && M[45]! <= 0) (M[20] = 0), chain(M[43]!, who === AI), punch(IA[1]!, M[43]!), (M[43] = 0);
        if (M[34]! > 0 && (M[34] = M[34]! - dt * (M[52] ? 1 : cm)) <= 0) (M[34] = 0), M[5] !== KO && landPunch();
        if (M[21]! > 0 && M[14]! <= 0 && M[45]! <= 0 && M[5] !== KO) {
          const q = M[44]!;
          (M[21] = 0), (M[44] = 0);
          if (!(q >= T_BACK && q < T_BACK + NG) && !M[56]) chain(q, who === AI);
          M[56] = 0;
          grab(q);
        }
        M[20] = Math.max(0, M[20]! - dt);
        M[21] = Math.max(0, M[21]! - dt);
      }
    }
    setCur(0);
    bk.step(dt);
    if (S[28]) return stepPractice(dt);
    stepArmy(dt);
    setCur(0);
    if (S[9]! > 0) {
      S[9]! -= dt;
      if (S[9]! <= 0) {
        if (S[4] === nb()) {
          // The city is flat: a bonus, the card, the next city.
          S[18]!++;
          S[2]! += 1000;
          for (let k = 0; k < NM; k++) if (MV[k]![28] !== AI) MV[k]![25]! += 1000;
          S[0] = CLEAR;
          S[17] = CARD_T;
          emit(E_CLEAR, S[16]!);
        } else end(0);
      }
    } else if (S[4] === nb() || humans() === 0) S[9] = S[4] === nb() ? 1.6 : 1.4;
    return true;
  }
  /** Practice, after the monsters: the steps the player has done, the parked helicopter (back a moment after a
   *  swat), and a flattened building rebuilt (the whole block, the monster dropped off it). */
  function stepPractice(dt: number) {
    const O = MV[0]!, md = O[5]!, D = MV[DUMMY]!;
    O[7] = MAX_HP;
    // The dummy gets its health back between bouts.
    if (S[32] && D[54]! <= 0) D[7] = Math.min(MAX_HP, D[7]! + dt * 30);
    S[29] = S[29]! | (md === WALK && Math.abs(O[3]!) > 0.5 ? P_WALK : 0) | (md === CLIMB ? P_WALL : 0) | (md === CLIMB && Math.abs(O[33]!) > 0.3 ? P_CLIMB : 0);
    const h = HE;
    if (h[0] !== 1) {
      h[8] = (h[0] === 2 ? h[8]! : 0) + dt;
      if (h[0] === 2) (h[5] = h[5]! - G * 0.5 * dt), (h[1] = h[1]! + h[4]! * dt), (h[2] = Math.max(0, h[2]! + h[5]! * dt)), (h[9] = h[9]! + dt * 8);
      if (h[0] !== 2 || h[8]! > 2.2) {
        // Parked beside the second building's top floor, nose to it, still.
        const b = Math.min(1, nb() - 1);
        h.fill(0, 0, 12);
        h[0] = 1; h[1] = BLD[b * 4]! + BLD[b * 4 + 1]! + 1.6; h[2] = top(b) - 1.2; h[3] = 0.4; h[6] = 1e9;
        h[0] = 1;
      }
    }
    for (let b = 0; b < nb(); b++) if (B[b * 6] === RUBBLE) S[31] = S[31]! + dt;
    if (S[31]! > 1.5) {
      S[31] = 0;
      for (let k = 0; k < NM; k++) cl.dropOff(MV[k]!, MV[k]![12]!);
      bk.reset(1);
    }
    return true;
  }
  /** After the end: what is still falling settles (a last floor, the monster). */
  function stepFall(dt: number) {
    let any = false;
    for (let b = 0; b < nb(); b++) if (B[b * 6 + 4]! > 0) (B[b * 6 + 4] = Math.max(0, B[b * 6 + 4]! - dt / 0.22)), (any = true);
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[24] !== IN || O[29]) continue;
      if (O[11]! > 0 || O[18]! > 0) (O[11] = Math.max(0, O[11]! - dt)), (O[18] = Math.max(0, O[18]! - dt)), (any = true);
      if (O[1]! > 0 || O[19]! > 0 || O[9]! > 0 || O[23]! > 0) {
        O[4] = O[4]! - G * dt;
        O[1] = Math.max(0, O[1]! + O[4]! * dt);
        if (O[1] === 0) O[4] = 0;
        O[19] = Math.max(0, O[19]! - dt * 5);
        O[9] = Math.max(0, O[9]! - dt * 4.5);
        O[23] = Math.max(0, O[23]! - dt);
        any = true;
      }
    }
    return any;
  }
  function end(won: number) {
    S[0] = DONE;
    S[9] = 0;
    S[20] = won;
    if (S[2]! > S[10]!) S[10] = S[2]!;
    emit(E_END, won);
  }

  // ---- the autopilot (the AI rivals, the landing page's hero, the tests): the nearest standing building,
  // a jump at its side wall, then work the floors from there (the windows that are not live first); swat
  // a helicopter that comes near, punch the tank, snack when hurt, keep off the train and the trucks. ----
  function autopilot(I: Float64Array, k = 0) {
    setCur(k);
    A = AV[k]!;
    I[0] = I[1] = I[2] = I[3] = I[4] = I[5] = 0;
    if (S[0] === DONE || M[5] === KO || M[24] !== IN) return setCur(0);
    if (S[0] === READY || S[0] === CLEAR) return void ((I[0] = S[0] === READY ? 0.6 : 0), setCur(0));
    const x = M[0]!, md = M[5]!, rival = k !== HERO;
    // Practice's dummy never fights back: it stands, and walks back to its spot between bouts.
    if (S[28] && k === DUMMY) {
      const home = -SXv() * 0.45 + 5.5;
      if (md === WALK && M[54]! <= 0 && Math.abs(home - x) > 0.4) I[0] = home > x ? 0.4 : -0.4;
      return setCur(0);
    }
    // v12: a pounce under way: the crouch holds still (the tell), the jump keeps its line.
    if (M[55]! > 0 || M[53]! > 0) return setCur(0);
    if (md === AIR && M[57]! > 0) return void ((I[0] = M[3]! / 5), setCur(0));
    A[5] = Math.max(0, A[5]! - 1 / 60);
    A[6] = Math.max(0, A[6]! - 1 / 60);
    A[7] = Math.max(0, A[7]! - 1 / 60);
    // v12: rivals fight back with the same moves, at an AI's rate: a power punch at a player in reach (its wind-up
    // is the tell: step or jump clear), or on the street a pounce at one a little way off (a crouch first).
    // (only a monster the run drives: online a screen's own seat on the autopilot must leave the run's state alone)
    if (rival && M[28] === AI && M[8]! <= 0)
      for (let j = 0; j < NM; j++) {
        const O = MV[j]!;
        if (j === k || O[28] === AI || O[24] !== IN || O[5] === KO) continue;
        if (A[6]! <= 0 && powerReach(M, j)) return void ((A[6] = AI_POWER), (I[2] = 1), (I[5] = T_RIVAL + j), setCur(0));
        const d = Math.abs(O[0]! - x);
        if (A[7]! <= 0 && md === WALK && O[5] === WALK && d > 1.6 && d < 3.2) return void ((A[7] = AI_POWER * 1.6), (M[55] = POUNCE_TELL), (M[57] = j + 1), (M[6] = O[0]! > x ? 1 : -1), emit(E_TELL, j), setCur(0));
      }
    // A rival bonks whoever is in reach, now and then.
    if (rival && A[5]! <= 0 && M[8]! <= 0) {
      fist();
      for (let j = 0; j < NM; j++) {
        const O = MV[j]!;
        if (j === k || O[24] !== IN || O[5] === KO) continue;
        if (Math.abs(O[0]! - x) < 2.4 && M[17]! > O[1]! + 0.3 && M[17]! < O[1]! + 3.6) return void ((A[5] = 1.4), (I[0] = O[0]! > x ? 0.3 : -0.3), (I[2] = 1), setCur(0));
      }
    }
    A[2] = Math.max(0, A[2]! - 1 / 60);
    A[4] = Math.max(0, A[4]! - 1 / 60);
    fist();
    // A helicopter in reach: face it and punch.
    for (let h = 0; h < NH; h++) {
      const o = h * 12;
      if (HE[o] === 1 && Math.abs(HE[o + 1]! - x) < 2.8 && HE[o + 2]! - M[17]! < 3.2 && HE[o + 2]! - M[17]! > -1.5 && md !== ROOF) {
        I[0] = HE[o + 1]! > x ? 0.3 : -0.3;
        if (Math.abs(HE[o + 2]! - M[17]!) < 1.4) return void ((I[2] = 1), setCur(0));
        if (md === WALK && A[2]! <= 0) return void ((I[3] = 1), (A[2] = 0.8), setCur(0));
        if (md === CLIMB) return void ((I[1] = Math.max(-1, Math.min(1, (HE[o + 2]! - M[17]!) * 2))), setCur(0));
      }
    }
    // The bells ring or a truck comes: off the street (a jump at the nearest wall does it).
    if ((FE[0] === 1 || FE[0] === 2) && md === WALK && A[2]! <= 0) return void ((I[3] = 1), (A[2] = 0.9), (I[0] = M[6]!), setCur(0));
    // The tank on the street near: go and punch it.
    if (TK[0] === 1 && (md === WALK || md === AIR) && Math.abs(TK[1]! - x) < 5) {
      I[0] = TK[1]! > x ? 1 : -1;
      if (Math.abs(TK[1]! - x) < 2.6) (I[0] *= 0.3), (I[2] = 1);
      return setCur(0);
    }
    // A truck near: punch it.
    for (let t = 0; t < NT; t++) if (TR[t * 6] === 1 && md === WALK && Math.abs(TR[t * 6 + 1]! - x) < 3.5 && (TR[t * 6 + 1]! - x) * TR[t * 6 + 2]! < 0) return void ((I[0] = TR[t * 6 + 1]! > x ? 0.3 : -0.3), (I[2] = 1), setCur(0));
    // Hungry (a rival always is: it steals the snacks): grab the person next to the hand.
    if ((rival || M[7]! < 85) && md === CLIMB && A[4]! <= 0) {
      const c = personNear();
      if (c >= 0) return void ((I[4] = 1), (I[5] = T_GRAB + c), (A[4] = rival ? 0.9 : 0.5), setCur(0));
    }
    if (md === ROOF) return void ((I[0] = A[1]! < 0 ? -1 : 1), setCur(0));
    // On a wall: work it; nothing left this side, the other.
    if (md === CLIMB) {
      if (A[0] !== M[12] || A[1] !== M[22]) A[3] = 0;
      A[0] = M[12]!;
      A[1] = M[22]!;
      const b = M[12]!, s = M[22]!;
      I[0] = -s * 0.3;
      // A surge coming (the plant): off the wall next to a live part.
      if (FE[9]! > 0 && FE[9]! < 1.4) return void ((I[3] = 2), setCur(0));
      // The same reach as a player: the best cell in it (no hole, nothing live; level first, then down, then up).
      for (let q = 0; q < NR && B[b * 6] === STAND; q++) {
        const c = AI_ORDER[q]!, i = reachCell(M, c);
        if (i < 0 || cell[i] === HOLE || LIVE[i]) continue;
        if (M[33] === 0) (I[2] = 1), (I[5] = T_CELL + c);
        return setCur(0);
      }
      if (B[b * 6] === STAND && M[1]! < top(b) - CLIMB_TOP - 0.05 && A[3]! < 1) return void ((I[1] = 1), setCur(0));
      A[3] = 1;
      if (M[1]! > 0.1 && B[b * 6] === STAND) return void ((I[1] = -1), setCur(0));
      A[1] = -s;
      A[3] = 0;
      return void ((I[3] = 2), setCur(0));
    }
    // On the street: pick a building and a side, walk at its wall, jump at it.
    let tb = A[0]!;
    if (tb < 0 || tb >= nb() || B[tb * 6] !== STAND || (goodRow(tb, -1) < 0 && goodRow(tb, 1) < 0)) {
      tb = -1;
      let bd = Infinity;
      for (let b = 0; b < nb(); b++) {
        if (B[b * 6] !== STAND || (goodRow(b, -1) < 0 && goodRow(b, 1) < 0)) continue;
        const cx = BLD[b * 4]! + BLD[b * 4 + 1]! / 2, d = Math.abs(cx - x) + (rival ? ((b * 7 + k * 3) % 5) * 1.3 : 0);
        if (d < bd) (bd = d), (tb = b);
      }
      A[0] = tb;
      A[1] = 0;
    }
    if (tb < 0) return setCur(0);
    let s = A[1]!;
    if (!s || goodRow(tb, s) < 0) s = A[1] = goodRow(tb, -1) >= 0 && (goodRow(tb, 1) < 0 || Math.abs(wallX(tb, -1) - x) < Math.abs(wallX(tb, 1) - x)) ? -1 : 1;
    const wx = wallX(tb, s), dx = wx - x;
    if (md === WALK) {
      // Run up and jump at the wall from a little way off (the jump grabs it).
      if (Math.abs(dx) > 1.6) I[0] = dx > 0 ? 1 : -1;
      else if ((-s > 0) === (dx > -0.2 && dx < 1.6) || (-s < 0) === (dx < 0.2 && dx > -1.6)) (I[0] = -s), A[2]! <= 0 && ((I[3] = 1), (A[2] = 0.5));
      else I[0] = dx > 0 ? 1 : -1;
    } else if (md === AIR) I[0] = -s;
    setCur(0);
  }
  /** The autopilot for a player's own monster outside the run's step (online: the screen's own seat on
   *  the autopilot): it reads the run, but its own timers live in `own` (10 numbers), so the run's
   *  bytes are left exactly as they were (every screen must step the same state). */
  function autopilotOwn(I: Float64Array, k: number, own: Float64Array) {
    const a = AV[k]!, O = MV[k]!;
    for (let j = 0; j < 8; j++) (SAVE[j] = a[j]!), (a[j] = own[j]!);
    SAVE[8] = O[16]!; SAVE[9] = O[17]!;
    autopilot(I, k);
    for (let j = 0; j < 8; j++) (own[j] = a[j]!), (a[j] = SAVE[j]!);
    O[16] = SAVE[8]!; O[17] = SAVE[9]!;
  }
  /** The floor a punch from side s of building b should go for (lowest first), skipping floors whose next window in is live. */
  function goodRow(b: number, s: number) {
    if (B[b * 6] !== STAND) return -1;
    const f = BLD[b * 4 + 2]!;
    for (let fl = B[b * 6 + 3]!; fl < f; fl++) {
      if (fl + 0.5 - HAND > f - CLIMB_TOP + 0.6) break;
      // In reach from this side: the first three windows in.
      const w = BLD[b * 4 + 1]!;
      for (let k = 0; k < Math.min(3, w); k++) {
        const i = C0[b]! + fl * w + (s < 0 ? k : w - 1 - k);
        if (cell[i] !== HOLE && !LIVE[i]) return fl;
      }
    }
    return -1;
  }
  /** A grab cell with someone to eat at it (not a hot pot), or −1. */
  function personNear() {
    for (let g = 0, n = grabCount(M); g < n; g++) {
      grabCell(M, g);
      const i = winAt(GC[0]!, GC[1]!), o = i >= 0 ? occ[i]! : 0;
      if (o === 1 || o === 2) return g;
    }
    return -1;
  }
  void [FALL, RUBBLE, STREET1];

  MV[0]![28] = 0;
  for (let k = 1; k < NM; k++) MV[k]![28] = AI;
  reset();
  return run;
}
export type Run = ReturnType<typeof createRun>;
