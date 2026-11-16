// CitySmash's monsters, all our own designs in flat colours with neon trim: the hero, a giant cyber
// ape the garage dresses (fur colour and pattern, a face, gear: a cyber arm on the smashing arm, a
// visor, a chest plate, tail spikes, shoulder pads, a back reactor, knuckle spikes, a jaw guard, in a
// trim colour of your pick), and three rivals: SHARDCLAW (a crystal crab-beast: a low shell with
// glowing crystals, six legs, two big claws, eyes on stalks), GLOOPMAW (a tentacle blob: a dome of
// goo on tentacles, one eye, a wide mouth) and VOLTWING (a storm moth: a furry body on two legs, big
// wings that crackle, feathered antennae). The rigs are @fzlt/core/diorama parts on a few pivots
// (hips, shoulders, elbows, neck, jaw, tail, wings) posed each frame from a monster's state in
// ./round.ts: walk, hang on a side wall and climb, the punch (sideways, up or down), the grab and the
// nom, a hit, a shock (it flickers dark and light), a landing, the knock-out. Posing allocates nothing.
// Grown from the Fizlet gallery daily (DOM Kaiju, #124): the same rig and pose.
import type { Diorama, DioramaObject } from "@fzlt/core/diorama";
import { AIR, CLIMB, ROOF, KO, MK } from "./climber.ts";
import { DEPTH } from "./block.ts";
import { HERO, CRAB, BLOB, MOTH, PUNCH_CD, PUNCH_HIT } from "./round.ts";

/** The hero's fur, with the word its name takes. */
export const FURS = [
  { name: "ember", c: "#c4552e", word: "EMBER" },
  { name: "ash", c: "#6d6a80", word: "ASH" },
  { name: "moss", c: "#4f7f4c", word: "MOSS" },
  { name: "midnight", c: "#2e3266", word: "MIDNIGHT" },
  { name: "frost", c: "#d6dae8", word: "FROST" },
  { name: "dune", c: "#b08a5a", word: "DUNE" },
  { name: "rust", c: "#8c3b28", word: "RUST" },
  { name: "plum", c: "#6b3a78", word: "PLUM" },
  { name: "teal", c: "#2f7f86", word: "TIDE" },
  { name: "coal", c: "#2b2830", word: "COAL" },
  { name: "candy", c: "#e67fae", word: "CANDY" },
  { name: "gold", c: "#c9a03a", word: "GILT" },
];
/** The neon trim (eyes, the spine line, the gear's lights). */
export const TRIMS = [
  { name: "cyan", c: "#22e6ff" },
  { name: "pink", c: "#ff4fa8" },
  { name: "lime", c: "#39ffb0" },
  { name: "gold", c: "#ffd23f" },
  { name: "violet", c: "#a98bff" },
  { name: "red", c: "#ff2e55" },
  { name: "white", c: "#f4f7ff" },
  { name: "orange", c: "#ff8a1f" },
];
export const PATTERNS = [{ id: "plain", name: "PLAIN" }, { id: "stripes", name: "STRIPES" }, { id: "patches", name: "PATCHES" }, { id: "spots", name: "SPOTS" }, { id: "circuit", name: "CIRCUIT" }];
export const FACES = [{ id: "brow", name: "BROW", word: "BROWLER" }, { id: "crest", name: "CREST", word: "CRESTBACK" }, { id: "tusks", name: "TUSKS", word: "TUSKER" }, { id: "horns", name: "HORNS", word: "HORNHEAD" }, { id: "mane", name: "MANE", word: "SHAGGER" }];
/** Gear, one bit each. */
export const GEAR = [
  { id: "arm", name: "CYBER ARM" }, { id: "visor", name: "VISOR" }, { id: "plate", name: "CHEST PLATE" }, { id: "spikes", name: "TAIL SPIKES" },
  { id: "pads", name: "SHOULDER PADS" }, { id: "core", name: "BACK REACTOR" }, { id: "knux", name: "KNUCKLE SPIKES" }, { id: "guard", name: "JAW GUARD" },
];
/** The rivals' names and what they are. */
export const RIVALS = ["SHARDCLAW", "GLOOPMAW", "VOLTWING"];
export const RIVAL_WHAT = ["a crystal crab-beast", "a tentacle blob", "a storm moth"];
/** The hero's name: its fur and its face. */
export const heroName = (fur: number, face: number) => (FURS[fur] ?? FURS[0]!).word + " " + (FACES[face] ?? FACES[0]!).word;
/** A monster's name. */
export const monName = (k: number, look: Look) => (k === HERO ? heroName(look.fur, look.face) : RIVALS[k - 1]!);

export interface Look { fur: number; trim: number; pattern: number; face: number; gear: number }
export const LOOK0: Look = { fur: 0, trim: 0, pattern: 1, face: 0, gear: 3 };
export interface RigInk { ink: string; eye: string; pupil: string; teeth: string; night: boolean; metal: string }

/** A rig mounted on a wall (for a monster facing +x, on a building's left side; the other side mirrors). It
 *  hugs the building's front corner: chest pressed to the corner, its back three quarters to the camera.
 *  The far arm and far leg wrap round onto the side wall (drawn behind the building, so only their tips
 *  show); the near leg clamps the front corner; the near arm is the free one and does the smashing. Fields:
 *  its turn into the corner, how far it sits in towards the building and out towards the camera, the
 *  torso's lean in, the far arm [swing, splay, elbow], the far leg and the near leg [thigh, knee, splay],
 *  the free arm at rest, its wind-up and its hit for each reach cell (./round.ts REACH: level close, medium, far,
 *  up close, medium, down close, medium; [swing, splay, elbow] each),
 *  the head's turn, and how far the body leans in for the far swing (a short arm needs it). Measured per kind (tests/pose.mjs checks them). */
export interface Wall { yaw: number; ox: number; oz: number; lean: number; lunge: number; far: number[]; fleg: number[]; nleg: number[]; rest: number[]; wind: number[]; hit: number[]; neck: number }
export const WALL: Wall[] = [
  // the ape
  { yaw: 0.5, ox: 0.55, oz: 0.95, lunge: 0, lean: -0.4, far: [2.181,  -0.566,  1.916], fleg: [1.406,  -0.494,  -0.35], nleg: [1.428,  -0.922,  0.047], rest: [-0.8,  0.144,  2.337], wind: [2.748,  -1.8,  2.256,  3.7,  -1.8,  1.673,  3.7,  -1.258,  1.02,  -0.9,  0.203,  1.234,  -0.9,  0.112,  0.631,  3.232,  -0.704,  1.814,  3.7,  -1.8,  1.585], hit: [-0.689,  0.273,  2.622,  0.505,  -0.001,  1.977,  1.38,  0.496,  1.129,  1.85,  -0.466,  2.249,  1.593,  -0.024,  1.833,  -0.381,  0.135,  1.825,  0.394,  0.017,  1.366], neck: -1 },
  // SHARDCLAW
  { yaw: 0.5, ox: 0.35, oz: 1.2, lunge: 0.55, lean: 0.9, far: [-0.244,  0.456,  1.572], fleg: [0.188,  0,  0.363], nleg: [-0.175,  0,  0.441], rest: [-0.8,  0.1,  1.3], wind: [2.881,  -1.8,  2.324,  3.163,  0.131,  2.209,  2.398,  -0.688,  1.629,  -0.9,  0.4,  0,  3.7,  -1.8,  1.583,  1.221,  -0.881,  2.545,  2.415,  -0.124,  2.413], hit: [-0.659,  0.281,  1.395,  -0.41,  -0.026,  1.5,  0.363,  0,  0.15,  -0.026,  0.511,  1.764,  0.658,  0.019,  0.4,  -0.791,  0.069,  1.1,  -0.218,  0,  0.35], neck: -0.5 },
  // GLOOPMAW
  { yaw: 0.5, ox: 0.25, oz: 1.1, lunge: 1.05, lean: 0.35, far: [1.981,  -1.369,  0.059], fleg: [0.9,  0.6,  0], nleg: [0.9,  0.6,  0], rest: [0.038,  0.375,  1.828], wind: [1.466,  -1.68,  2.424,  2.385,  -0.13,  2.516,  3.125,  -0.611,  0.105,  -0.9,  0.481,  1.794,  2.934,  -1.8,  2.369,  1.9,  -0.455,  1.298,  2.148,  -0.204,  1.985], hit: [0.607,  0.677,  0.899,  0.9,  0.059,  0.567,  1.177,  0.007,  0.15,  1.359,  -0.747,  1.299,  1.573,  -0.374,  0.038,  0.219,  0.205,  1.1,  0.824,  0.036,  0.233], neck: -0.5 },
  // VOLTWING
  { yaw: 0.5, ox: 0.65, oz: 0.9, lunge: 0, lean: -0.3, far: [1.441,  -0.569,  2.466], fleg: [0.938,  0,  -0.069], nleg: [0.594,  0,  0.141], rest: [-0.8,  -0.088,  2.275], wind: [3.7,  0.289,  2.648,  3.7,  -0.282,  2.199,  3.568,  -1.15,  1.445,  -0.9,  0.087,  1.307,  -0.504,  -0.001,  0,  2.935,  -0.475,  2.287,  3.7,  -0.354,  1.942], hit: [-0.763,  0.004,  2.589,  0.197,  -0.368,  2.038,  0.86,  -1.522,  0.901,  1.12,  -0.166,  2.695,  1.189,  0.177,  2.04,  -0.376,  0.026,  1.763,  0.361,  -0.154,  1.236], neck: -0.8 },
];

type Shape = "box" | "wedge" | "cyl" | "prism";
interface PartOpts { rot?: number[]; sides?: number; top?: number; emissive?: boolean; mask?: number }

/** A monster on `d`: `kind` HERO (dressed by `look`), CRAB or BLOB; `id` keeps its part names apart. */
export function buildMonster(d: Diorama, kind: number, look: Look, K: RigInk, id: string) {
  const root = d.add({ id, shape: "group", size: [1.6, 0, 1.2], pos: [0, 0, 0], pick: false, tag: id, shadow: 0 });
  const n = (s: string) => id + "-" + s;
  // Every part is drawn at MK times the numbers below (the monster is about four floors tall).
  const k3 = (v: number[]) => [v[0]! * MK, v[1]! * MK, v[2]! * MK];
  const P = (on: string, shape: Shape, size: number[], pos: number[], color: string, o: PartOpts = {}) =>
    d.add({ shape, size: k3(size), pos: k3(pos), rot: o.rot, sides: o.sides, top: o.top, color, on: on === "" ? id : n(on), emissive: o.emissive, mask: o.mask, pick: false });
  // Each side's limbs sort as their own cluster, anchored each frame (./pose): on a wall the far side's
  // behind the building (so the facade covers all but their tips), the near side's in front of the body.
  const atL = new Float64Array(3), atR = new Float64Array(3);
  d.cluster(n("L"), { at: atL });
  d.cluster(n("R"), { at: atR });
  const side = (s: number) => n(s < 0 ? "L" : "R");
  const grp = (gid: string, on: string, pos: number[], rot?: number[], s = 0) => d.add({ id: n(gid), shape: "group", size: [0.2, 0, 0.2], pos: k3(pos), rot, on: on === "" ? id : n(on), pick: false, cluster: s ? side(s) : undefined });
  const legs: DioramaObject[] = [], arms: DioramaObject[] = [], fore: DioramaObject[] = [], tent: DioramaObject[] = [], wings: DioramaObject[] = [];
  // The hero's arm parts (for the recolour: which arm is the smashing one) and its colours: fur, dark fur, skin, dark metal.
  const kit: { upper: DioramaObject; pad: DioramaObject; fa: DioramaObject; fist: DioramaObject; kn: DioramaObject[]; ln: DioramaObject[] }[] = [];
  const furs = ["", "", "", ""];
  /** Where it touches a wall: its hands (fists, claws, tentacle ends) and its feet. */
  const hands: DioramaObject[] = [], feet: DioramaObject[] = [], knees: DioramaObject[] = [];
  let cyberOn = false;
  let tail: DioramaObject | null = null, hipY = 1, height = 3;
  let main: string, acc: string;
  const trim = (TRIMS[look.trim] ?? TRIMS[0]!).c;

  if (kind === HERO) {
    // ---- the cyber ape ----
    main = (FURS[look.fur] ?? FURS[0]!).c;
    acc = trim;
    const dark = shade(main, 0.6), skin = look.fur === 4 || look.fur === 10 ? "#7a7690" : "#3a2f40", g = look.gear;
    hipY = 0.95;
    height = 3.3;
    grp("body", "", [0, hipY, 0]);
    grp("tor", "body", [0, 0, 0], [0, 0, -0.28]);
    P("tor", "box", [1.15, 1.25, 1.2], [0, 0, 0], main);
    P("tor", "box", [1.0, 0.55, 1.35], [0.15, 0.85, 0], main); // the shoulders' bulk
    P("tor", "box", [0.2, 0.9, 0.8], [0.6, 0.15, 0], g & 4 ? K.metal : skin); // chest (or the plate)
    if (g & 4) P("tor", "box", [0.06, 0.08, 0.86], [0.71, 0.95, 0], trim, { emissive: true });
    P("tor", "box", [1.18, 0.07, 0.08], [-0.05, 1.33, 0], trim, { emissive: true }); // the neon spine line
    if (look.pattern === 1) for (let k = 0; k < 3; k++) P("tor", "box", [0.16, 0.95, 1.26], [-0.4 + k * 0.32, 0.18, 0], dark);
    else if (look.pattern === 3) for (let k = 0; k < 6; k++) for (const s of [-1, 1]) P("tor", "cyl", [0.16, 0.05, 0.16], [-0.42 + (k % 3) * 0.36, 0.0 + ((k / 3) | 0) * 0.55 + (k % 2) * 0.12, s * 0.61], dark, { sides: 6, rot: [(s * Math.PI) / 2, 0, 0] });
    else if (look.pattern === 4) for (const s of [-1, 1]) {
      P("tor", "box", [0.9, 0.05, 1.23], [-0.05, 0.35, 0], trim, { emissive: K.night });
      P("tor", "box", [0.05, 0.6, 1.23], [-0.35, 0.05, 0], trim, { emissive: K.night });
      P("tor", "box", [0.05, 0.4, 1.23], [0.25, 0.55, 0], trim, { emissive: K.night });
      void s;
    }
    else if (look.pattern === 2) for (let k = 0; k < 4; k++) for (const s of [-1, 1]) P("tor", "cyl", [0.3 + (k % 2) * 0.12, 0.05, 0.3 + (k % 2) * 0.12], [-0.35 + k * 0.22, 0.25 + ((k * 3) % 4) * 0.2, s * 0.61], shade(main, 1.35), { sides: 8, rot: [(s * Math.PI) / 2, 0, 0] });
    // Legs: short and thick, a knee to bend (on a wall the feet plant on it).
    for (const s of [-1, 1]) {
      const h = grp("hip" + s, "body", [-0.25, 0.05, s * 0.38], undefined, s);
      P("hip" + s, "box", [0.52, 0.46, 0.5], [0, -0.46, 0], s < 0 ? dark : main);
      const kn = grp("kn" + s, "hip" + s, [0, -0.44, 0]);
      P("kn" + s, "box", [0.48, 0.42, 0.48], [0, -0.42, 0], s < 0 ? dark : main);
      feet.push(P("kn" + s, "box", [0.72, 0.18, 0.55], [0.12, -0.56, 0], skin));
      legs.push(h);
      knees.push(kn);
    }
    // Arms: long, furry, a knuckle fist. Both carry the cyber arm's parts; only the smashing arm (which
    // one turns with the way it faces) shows them, and only with the gear on (recoloured in the pose).
    for (const s of [-1, 1]) {
      const sh = grp("sh" + s, "tor", [0.3, 1.0, s * 0.78], undefined, s);
      const upper = P("sh" + s, "box", [0.5, 1.0, 0.48], [0, -1.0, 0], main);
      const pad = P("sh" + s, "box", [0.62, 0.34, 0.6], [0, -0.3, 0], K.metal);
      const el = grp("el" + s, "sh" + s, [0, -1.0, 0]);
      const fa = P("el" + s, "box", [0.52, 0.95, 0.5], [0, -0.95, 0], main);
      const fist = P("el" + s, "box", [0.64, 0.44, 0.6], [0.04, -1.32, 0], skin); // the fist
      const kn: DioramaObject[] = [];
      for (let k = 0; k < 4; k++) kn.push(P("el" + s, "box", [0.14, 0.14, 0.13], [0.36, -1.24, -0.22 + k * 0.147], skin)); // the knuckles
      P("el" + s, "box", [0.56, 0.07, 0.54], [0, -0.35, 0], trim, { emissive: true }); // a wrist band
      if (g & 64) for (let k = 0; k < 3; k++) P("el" + s, "cyl", [0.1, 0.22, 0.1], [0.44, -1.24, -0.15 + k * 0.15], K.metal, { sides: 5, top: 0, rot: [0, 0, -Math.PI / 2] });
      const ln: DioramaObject[] = [];
      for (let k = 0; k < 2; k++) ln.push(P("el" + s, "box", [0.06, 0.7, 0.06], [0.27, -0.85 + k * 0.05, -0.12 + k * 0.24], trim, { emissive: true }));
      kit.push({ upper, pad, fa, fist, kn, ln });
      hands.push(fist);
      arms.push(sh);
      fore.push(el);
    }
    if (g & 16) for (const s of [-1, 1]) P("tor", "box", [0.72, 0.22, 0.6], [0.3, 1.18, s * 0.78], K.metal), P("tor", "box", [0.74, 0.05, 0.62], [0.3, 1.3, s * 0.78], trim, { emissive: true });
    if (g & 32) {
      P("tor", "box", [0.36, 0.8, 0.7], [-0.72, 0.45, 0], K.metal);
      P("tor", "cyl", [0.28, 0.5, 0.28], [-0.92, 0.5, 0], trim, { sides: 8, emissive: true, rot: [0, 0, Math.PI / 2] });
    }
    furs[0] = main;
    furs[1] = dark;
    furs[2] = skin;
    furs[3] = shade(K.metal, 0.75);
    cyberOn = (g & 1) > 0;
    if (g & 8) {
      tail = grp("tail", "body", [-0.62, 0.3, 0], [0, 0, -0.9]);
      P("tail", "box", [0.9, 0.22, 0.22], [-0.45, -0.1, 0], main);
      for (let k = 0; k < 3; k++) P("tail", "cyl", [0.14, 0.3, 0.14], [-0.2 - k * 0.28, 0.1, 0], trim, { sides: 5, top: 0, emissive: K.night });
    }
    // The head: a block, a muzzle, the face's part, eyes in the trim colour.
    grp("neck", "tor", [0.55, 1.15, 0]);
    P("neck", "box", [0.82, 0.74, 0.82], [0.05, 0, 0], main);
    P("neck", "box", [0.42, 0.34, 0.6], [0.45, 0.04, 0], skin);
    grp("jaw", "neck", [0.35, 0.05, 0]);
    P("jaw", "box", [0.5, 0.18, 0.56], [0.12, -0.18, 0], skin);
    for (let t = 0; t < 3; t++) P("jaw", "box", [0.08, 0.1, 0.08], [0.33, 0, -0.16 + t * 0.16], K.teeth);
    for (const s of [-1, 1]) P("neck", "box", [0.06, 0.13, 0.15], [0.47, 0.42, s * 0.2], trim, { emissive: true });
    const face = look.face;
    P("neck", "box", [0.34, face === 0 ? 0.2 : 0.12, 0.88], [0.32, 0.55, 0], face === 0 ? dark : main, { rot: [0, 0, face === 0 ? -0.15 : 0] }); // the brow
    if (face === 1) for (let k = 0; k < 3; k++) P("neck", "wedge", [0.38, 0.32 - k * 0.06, 0.12], [-0.05 - k * 0.2, 0.74, 0], trim, { emissive: K.night });
    if (face === 2) for (const s of [-1, 1]) P("jaw", "cyl", [0.13, 0.38, 0.13], [0.32, -0.08, s * 0.24], K.teeth, { sides: 6, top: 0, rot: [s * 0.25, 0, -0.35] });
    if (face === 3) for (const s of [-1, 1]) P("neck", "cyl", [0.14, 0.5, 0.14], [0.1, 0.62, s * 0.32], K.teeth, { sides: 6, top: 0, rot: [s * -0.5, 0, -0.5] });
    if (face === 4) for (let k = 0; k < 4; k++) P("neck", "box", [0.5, 0.2, 1.0], [-0.25 + k * 0.05, 0.45 - k * 0.22, 0], dark);
    if (g & 2) P("neck", "box", [0.1, 0.13, 0.9], [0.48, 0.42, 0], trim, { emissive: true }); // the visor
    if (g & 128) P("jaw", "box", [0.18, 0.24, 0.62], [0.34, -0.12, 0], K.metal), P("jaw", "box", [0.04, 0.05, 0.64], [0.44, -0.04, 0], trim, { emissive: true });
    for (const s of [-1, 1]) P("neck", "box", [0.16, 0.2, 0.08], [0, 0.45, s * 0.44], skin); // ears
  } else if (kind === CRAB) {
    // ---- SHARDCLAW, the crystal crab-beast ----
    main = "#3d3378";
    acc = "#7cf6ff";
    const dark = "#262054", claw = "#6a58c8";
    hipY = 1.1;
    height = 2.6;
    grp("body", "", [0, hipY, 0]);
    P("body", "box", [2.0, 0.8, 1.6], [0, 0, 0], main);
    P("body", "box", [1.6, 0.3, 1.3], [-0.1, 0.8, 0], dark);
    P("body", "box", [2.05, 0.08, 1.65], [0, 0.38, 0], acc, { emissive: true });
    for (let k = 0; k < 5; k++) P("body", "cyl", [0.3, 0.7 + (k % 2) * 0.35, 0.3], [-0.65 + k * 0.32, 1.05, ((k * 7) % 3 - 1) * 0.3], k % 2 ? acc : "#c9a6ff", { sides: 5, top: 0, emissive: true, rot: [0, 0, 0.3 - k * 0.15] });
    // Six legs.
    for (let k = 0; k < 6; k++) {
      const s = k < 3 ? -1 : 1, x = -0.65 + (k % 3) * 0.6, h = grp("hip" + k, "body", [x, 0.2, s * 0.8], [s * 0.6, 0, 0], s);
      void h;
      const lg = P("hip" + k, "box", [0.18, 1.3, 0.18], [0, -1.3, 0], dark);
      if (k === 2 || k === 5) feet.push(lg);
      legs.push(h);
    }
    // Two claws on the arms.
    for (const s of [-1, 1]) {
      const sh = grp("sh" + s, "body", [0.9, 0.5, s * 0.7], undefined, s);
      P("sh" + s, "box", [0.32, 0.9, 0.32], [0, -0.9, 0], claw);
      const el = grp("el" + s, "sh" + s, [0, -0.9, 0]);
      P("el" + s, "box", [0.55, 0.6, 0.5], [0, -0.6, 0], claw);
      hands.push(P("el" + s, "wedge", [0.7, 0.3, 0.42], [0.05, -0.95, 0], acc, { emissive: K.night, rot: [0, 0, Math.PI / 2] }));
      P("el" + s, "wedge", [0.5, 0.22, 0.4], [0.3, -0.95, 0], claw, { rot: [0, 0, Math.PI / 2] });
      arms.push(sh);
      fore.push(el);
    }
    grp("neck", "body", [0.95, 0.75, 0]);
    for (const s of [-1, 1]) {
      P("neck", "box", [0.1, 0.55, 0.1], [0, 0, s * 0.3], dark);
      P("neck", "cyl", [0.22, 0.22, 0.22], [0, 0.55, s * 0.3], K.eye, { sides: 8, emissive: true });
    }
    grp("jaw", "body", [1.0, 0.1, 0]);
    P("jaw", "box", [0.3, 0.2, 0.8], [0.05, -0.1, 0], dark);
    for (let t = 0; t < 4; t++) P("jaw", "box", [0.08, 0.1, 0.08], [0.2, 0, -0.27 + t * 0.18], K.teeth);
  } else if (kind === MOTH) {
    // ---- VOLTWING, the storm moth ----
    main = "#4a5f8c";
    acc = "#fff36b";
    const dark = "#2b3a5c", fluff = "#d9e2f2", wing = "#6d86c4";
    hipY = 1.05;
    height = 3.2;
    grp("body", "", [0, hipY, 0]);
    grp("tor", "body", [0, 0, 0], [0, 0, -0.2]);
    P("tor", "box", [0.95, 1.3, 1.0], [0, 0, 0], main);
    P("tor", "box", [0.75, 0.5, 1.1], [0.1, 0.9, 0], fluff);
    for (let k = 0; k < 3; k++) P("tor", "box", [0.98, 0.07, 1.04], [0, 0.2 + k * 0.3, 0], dark);
    for (const s of [-1, 1]) {
      const wg = grp("wing" + s, "tor", [-0.35, 1.0, s * 0.45], [s * 0.4, 0, 0], s);
      P("wing" + s, "box", [1.3, 1.7, 0.06], [-0.4, 0.2, s * 0.05], wing, { rot: [0, 0, 0.35] });
      P("wing" + s, "cyl", [0.5, 0.05, 0.5], [-0.45, 0.45, s * 0.09], acc, { sides: 10, rot: [Math.PI / 2, 0, 0], emissive: true });
      P("wing" + s, "box", [0.9, 0.06, 0.08], [-0.5, -0.35, s * 0.09], acc, { emissive: K.night, rot: [0, 0, 0.5] });
      wings.push(wg);
      const h = grp("hip" + s, "body", [-0.15, 0.05, s * 0.3], undefined, s);
      P("hip" + s, "box", [0.32, 0.95, 0.32], [0, -0.85, 0], s < 0 ? dark : main);
      feet.push(P("hip" + s, "box", [0.55, 0.14, 0.4], [0.12, -1.0, 0], dark));
      legs.push(h);
      const sh = grp("sh" + s, "tor", [0.2, 1.0, s * 0.6], undefined, s);
      P("sh" + s, "box", [0.34, 0.95, 0.34], [0, -0.95, 0], main);
      const el = grp("el" + s, "sh" + s, [0, -0.95, 0]);
      P("el" + s, "box", [0.3, 0.85, 0.3], [0, -0.85, 0], dark);
      hands.push(P("el" + s, "wedge", [0.5, 0.36, 0.4], [0.05, -1.2, 0], acc, { emissive: K.night, rot: [0, 0, Math.PI / 2] }));
      arms.push(sh);
      fore.push(el);
    }
    grp("neck", "tor", [0.45, 1.2, 0]);
    P("neck", "box", [0.75, 0.62, 0.8], [0, 0, 0], fluff);
    for (const s of [-1, 1]) {
      P("neck", "cyl", [0.32, 0.36, 0.32], [0.3, 0.1, s * 0.25], K.night ? "#ff4f5e" : "#e63946", { sides: 8, emissive: true, rot: [0, 0, Math.PI / 2] });
      P("neck", "box", [0.06, 0.8, 0.06], [0.05, 0.6, s * 0.2], dark, { rot: [s * 0.4, 0, -0.5] });
      P("neck", "box", [0.3, 0.5, 0.04], [-0.05, 0.75, s * 0.32], acc, { rot: [s * 0.4, 0, -0.5], emissive: K.night });
    }
    grp("jaw", "neck", [0.38, -0.2, 0]);
    P("jaw", "box", [0.3, 0.14, 0.4], [0.05, -0.05, 0], dark);
    for (let t = 0; t < 3; t++) P("jaw", "box", [0.07, 0.09, 0.07], [0.18, 0.02, -0.12 + t * 0.12], K.teeth);
  } else {
    // ---- GLOOPMAW, the tentacle blob ----
    main = "#b23a9e";
    acc = "#b6ff3a";
    const dark = "#7a2470";
    hipY = 0.35;
    height = 2.9;
    grp("body", "", [0, hipY, 0]);
    P("body", "cyl", [1.8, 1.7, 1.6], [0, 0, 0], main, { sides: 12, top: 0.62 });
    P("body", "cyl", [1.1, 0.18, 1.0], [0, 1.7, 0], main, { sides: 12, top: 0.55 });
    for (let k = 0; k < 4; k++) P("body", "cyl", [0.3, 0.06, 0.3], [-0.5 + k * 0.3, 0.5 + (k % 2) * 0.5, 0.76], acc, { sides: 8, rot: [Math.PI / 2, 0, 0], emissive: K.night });
    for (let k = 0; k < 5; k++) {
      const a = -1.2 + k * 0.6, tg = grp("tn" + k, "body", [Math.cos(a) * 0.55, 0.15, Math.sin(a) * 0.6], [Math.sin(a) * 0.5, -a, 0]);
      P("tn" + k, "box", [0.75, 0.22, 0.24], [0.35, -0.24, 0], k % 2 ? dark : main);
      const tip = grp("tn" + k + "t", "tn" + k, [0.7, -0.24, 0]);
      const tp = P("tn" + k + "t", "box", [0.5, 0.15, 0.17], [0.22, 0, 0], acc);
      if (k === 1 || k === 3) feet.push(tp);
      tent.push(tg, tip);
    }
    for (const s of [-1, 1]) {
      const sh = grp("sh" + s, "body", [0.15, 1.0, s * 0.92], undefined, s);
      P("sh" + s, "box", [0.32, 0.9, 0.3], [0, -0.9, 0], main);
      const el = grp("el" + s, "sh" + s, [0, -0.9, 0]);
      P("el" + s, "box", [0.26, 0.8, 0.26], [0, -0.8, 0], acc);
      hands.push(P("el" + s, "cyl", [0.42, 0.22, 0.42], [0, -1.0, 0], acc, { sides: 8 }));
      arms.push(sh);
      fore.push(el);
    }
    grp("neck", "body", [0.05, 1.62, 0]);
    P("neck", "box", [0.08, 0.5, 0.5], [0.77, 0.5, 0], K.eye, { emissive: true });
    P("neck", "box", [0.06, 0.24, 0.24], [0.82, 0.62, 0.03], K.pupil, { emissive: true });
    grp("jaw", "neck", [0.7, 0.3, 0]);
    P("jaw", "box", [0.55, 0.2, 0.9], [0.2, -0.2, 0], dark);
    for (let t = 0; t < 5; t++) P("jaw", "box", [0.09, 0.12, 0.09], [0.4, 0, -0.32 + t * 0.16], K.teeth);
  }
  const body = d.get(n("body"))!, neck = d.get(n("neck"))!, jaw = d.get(n("jaw"))!, tor = d.get(n("tor")) ?? null, lean0 = tor ? tor.rot[2]! : 0;

  // ---- the pose ----
  // On a wall (measured per kind: tests/pose.mjs): mounted on the building's front corner, chest pressed to
  // it and its back three quarters to the camera; the far arm and leg wrap round onto the side wall (the
  // building covers them but for their tips), the near leg clamps the corner, the near arm is free and
  // smashes across the front face. Climbing it shimmies: the far arm reaches up, the hips push in, the body
  // pulls up, the legs follow.
  const W = WALL[kind]!;
  let yaw = -0.35;
  function pose(M: Float64Array, t: number, dt: number) {
    const md = M[5]!, f = M[6]!, ph = M[13]!, ga = M[10]!, nom = M[18]!, squash = M[19]!, zap = M[23]!;
    const wall = md === CLIMB, pt = PUNCH_CD - M[8]!, punching = M[8]! > 0 && zap <= 0;
    // On the street: three quarters to the camera. On a wall: into the corner, its back to the camera.
    const want = wall ? (f > 0 ? W.yaw : Math.PI - W.yaw) : f > 0 ? -0.35 : Math.PI + 0.35;
    let dy = want - yaw;
    dy -= 6.283185307179586 * Math.floor(dy / 6.283185307179586 + 0.5);
    yaw += dy * Math.min(1, dt * 14);
    // The climb's cycle (it runs only while it moves up or down) and the idle breath.
    const moving = Math.abs(M[3]!) > 0.3 || (wall && Math.abs(M[33]!) > 0.3), a = ph * 2.4, cyc = Math.sin(a), br = Math.sin(t * 1.9);
    // The shimmy: reach (cyc), then the hips push in (hump), then the body pulls up (lift), then the legs.
    const hump = wall ? (moving ? 0.5 + 0.5 * Math.sin(a - 1.3) : 0.3 + br * 0.08) : 0, lift = moving ? 0.5 + 0.5 * Math.sin(a - 2.3) : 0, step = moving ? Math.sin(a - 3.1) : 0;
    // The far swing leans the body in (with the arm: in on the wind-up, back on the recovery).
    const cell = M[38]! - 1, lk = wall && punching && cell === 2 ? (M[34]! > 0 ? Math.min(1, pt / PUNCH_HIT) * 0.4 : 1 - (Math.max(0, (pt - PUNCH_HIT) / (PUNCH_CD - PUNCH_HIT) - 0.3) / 0.7) ** 2) : 0;
    root.pos[0] = M[0]! + (wall ? f * (W.ox + W.lunge * lk) : 0);
    root.pos[1] = M[1]! + (wall ? (moving ? lift * 0.16 : br * 0.03) * MK : 0);
    root.pos[2] = M[2]! + (wall ? W.oz : 0);
    root.rot[1] = yaw;
    root.rot[2] = md === KO ? -1.35 : zap > 0 ? Math.sin(t * 60) * 0.06 : 0;
    // A shock flickers it light and dark; a hit flashes it white.
    root.tint = zap > 0 ? ((t * 16) | 0) & 1 ? "#ffffff" : K.ink : M[11]! > 0.18 ? "#ffffff" : null;
    const walking = md === 0 || md === ROOF, sw = walking ? Math.sin(ph * 3.2) : 0;
    const bob = walking && moving ? Math.abs(Math.cos(ph * 3.2)) * 0.1 : 0;
    body.pos[0] = hump * 0.14 * MK;
    body.pos[1] = (hipY + bob - squash * 0.25) * MK;
    if (tor) tor.rot[2] = wall ? W.lean - hump * 0.12 : lean0;
    else body.rot[2] = wall ? W.lean + hump * 0.08 : 0;
    // Which side is the far one (away from the camera): its arm and leg climb, the near arm smashes.
    const far = wall ? (f > 0 ? 0 : 1) : -1, out = wall ? 1 - far : f > 0 ? 1 : 0;
    // Legs. On a wall the far foot plants on the side wall, the near foot clamps the front corner; they push in turn.
    for (let i = 0; i < legs.length; i++) {
      const s = kind === CRAB ? (i < 3 ? -1 : 1) : i & 1 ? 1 : -1, lg = legs[i]!, isFar = (s > 0 ? 1 : 0) === far, L = isFar ? W.fleg : W.nleg, push = isFar ? step : -step;
      if (kind === CRAB) {
        const j = i % 3;
        lg.rot[2] = wall ? L[0]! + (j - 2) * 0.25 + push * 0.2 : Math.sin(ph * 6 + i * 2.1) * (moving ? 0.35 : 0.04);
        lg.rot[0] = s * (wall ? L[2]! : 0.6);
      } else if (wall) (lg.rot[2] = L[0]! + push * 0.3 + br * 0.02), (lg.rot[0] = (f > 0 ? -s : s) * L[2]!);
      else (lg.rot[2] = md === AIR ? (i ? 0.6 : -0.1) : moving ? sw * 0.6 * s : 0), (lg.rot[0] = 0);
    }
    for (let i = 0; i < knees.length; i++) {
      const isFar = i === far, push = isFar ? step : -step;
      knees[i]!.rot[2] = wall ? (isFar ? W.fleg[1]! : W.nleg[1]!) - push * 0.35 : md === AIR ? -0.5 : walking && moving ? -Math.max(0, Math.sin(ph * 3.2 + i * Math.PI)) * 0.5 : 0;
    }
    for (let k = 0; k < tent.length; k += 2) {
      const w = Math.sin(t * 4 + k + ph * 3);
      tent[k]!.rot[2] = (md === AIR ? 0.4 : wall ? W.fleg[0]! : 0) + w * (moving ? 0.25 : 0.06);
      tent[k + 1]!.rot[2] = w * 0.35 + (wall ? W.fleg[1]! : 0);
    }
    for (let i = 0; i < wings.length; i++) wings[i]!.rot[1] = (i ? -1 : 1) * (md === AIR ? 0.4 + Math.sin(t * 22) * 0.5 : wall ? 0.2 + hump * 0.15 : 0.15 + Math.sin(t * 2.2 + i) * 0.08 + (zap > 0 ? Math.sin(t * 40) * 0.3 : 0));
    if (tail) (tail.rot[2] = -0.9 + Math.sin(t * 2 + ph) * 0.15), (tail.rot[1] = Math.sin(t * 1.7 + ph * 2) * 0.25);
    // Arms. Angles swing forward from hanging straight down (0: down, π/2: straight ahead, π: overhead), elbows
    // bend the forearm forward, a splay (about the arm's own x) takes a hand in or out. On a wall the far arm
    // wraps round onto the side wall, reaching up as it climbs, and never lets go; the near arm rests cocked by
    // the chest and does the smashing (and the grabbing) across the front face. On the street the smashing arm
    // is the one nearer the camera. The punch keeps the round's fixed timing (./round.ts PUNCH_CD, PUNCH_HIT):
    // the wind-up (pulled back along the body), the hit frame (the fist in the window the round hits: the one
    // level with the hand, above or below), a short hold, the recovery.
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, ar = arms[i]!, e = fore[i]!, outside = i === out;
      let r = 0, er = 0, sp = s * 0.08;
      if (zap > 0) (r = 2.6 + Math.sin(t * 50 + i) * 0.3), (er = 0.3), (sp = s * 0.5);
      else if (wall && i === far) (r = W.far[0]! + (moving ? cyc * 0.3 : br * 0.02)), (sp = s * W.far[1]!), (er = W.far[2]! - (moving ? cyc * 0.3 : 0));
      else if (wall) (r = W.rest[0]! + br * 0.04), (sp = s * W.rest[1]!), (er = W.rest[2]!);
      else if (md === AIR) (r = 2.3 - i * 0.4), (er = 0.3);
      else if (md === KO) (r = 0.6), (er = 0.2);
      else if (moving && walking) (r = (kind === HERO ? 0.3 : 0.15) + sw * 0.5 * s), (er = 0.35);
      else (r = 0.22 + Math.sin(t * 1.6 + i) * 0.04), (er = 0.3);
      if (punching && outside) {
        // On a wall, one motion per reach cell (./round.ts REACH): a jab close, a hook to the middle, a full
        // swing far, and the up and down ones; each lands the fist in its window.
        const d = M[32]!, j = (M[38]! > 0 ? M[38]! - 1 : d > 0 ? 3 : d < 0 ? 5 : 0) * 3;
        // On a wall the hit and the wind-up come from the table; on the street, a slam by the direction.
        const wr = wall ? W.wind[j]! : d > 0 ? 3.3 : d < 0 ? 1.45 : 0.6, ws = wall ? s * W.wind[j + 1]! : sp, we = wall ? W.wind[j + 2]! : d > 0 ? 1.3 : d < 0 ? 1.1 : 1.7;
        const hr = wall ? W.hit[j]! : d > 0 ? 2.55 : d < 0 ? 0.8 : 1.6, hs = wall ? s * W.hit[j + 1]! : sp, he = wall ? W.hit[j + 2]! : d !== 0 ? 0.15 : 0;
        // (The round's hit frame is when its countdown M[34] runs out: until then the wind-up.)
        if (M[34]! > 0) {
          const k = Math.min(1, pt / PUNCH_HIT);
          (r += (wr - r) * k), (sp += (ws - sp) * k), (er += (we - er) * k);
        } else {
          const k = Math.max(0, (pt - PUNCH_HIT) / (PUNCH_CD - PUNCH_HIT) - 0.3) / 0.7;
          (r = hr + (r - hr) * k * k), (er = he + (er - he) * k * k), (sp = hs + (sp - hs) * k * k);
        }
      }
      if (ga > 0 && outside && zap <= 0) {
        // The grab: out to the window, then back to the mouth.
        const k = ga > 0.5 ? (1 - ga) * 2 : 1;
        const gj = (M[41]! > 0 ? M[41]! - 1 : 0) * 3, gr = wall ? W.hit[gj]! : 1.9, gs = wall ? s * W.hit[gj + 1]! : sp, ge = wall ? W.hit[gj + 2]! : 0.2;
        r = r + (gr - r) * k;
        sp = sp + (gs - sp) * (ga > 0.5 ? k : 1 - (1 - ga * 2));
        er = ga > 0.5 ? er + (ge - er) * k : er + (2.1 - er) * (1 - ga * 2);
      }
      ar.rot[2] = r;
      ar.rot[0] = sp;
      e.rot[2] = er;
    }
    // The limbs' clusters: on a wall the far side's behind the building, the near side's in front of the body;
    // elsewhere just behind and just in front of it (the side nearer the camera in front).
    const nearR = Math.cos(yaw) > 0, rx = root.pos[0]!, ry = root.pos[1]! + 1.5 * MK, rz = root.pos[2]!;
    const zf = wall ? -DEPTH - 0.5 : rz - 0.4, zn = rz + (wall ? 1.2 : 0.4);
    atL[0] = atR[0] = rx;
    atL[1] = atR[1] = ry;
    atL[2] = nearR ? zf : zn;
    atR[2] = nearR ? zn : zf;
    // The hero's colours follow the smashing arm: fur near, darker fur far; the cyber arm (with the gear on)
    // on the smashing arm only.
    for (let i = 0; i < kit.length; i++) {
      const p = kit[i]!, cy = cyberOn && i === out, fur = i === out ? furs[0]! : furs[1]!;
      if (p.upper.color !== fur) p.upper.color = fur;
      const fa = cy ? K.metal : fur, fs = cy ? furs[3]! : furs[2]!;
      if (p.fa.color !== fa) p.fa.color = fa;
      if (p.fist.color !== fs) {
        p.fist.color = fs;
        for (let k = 0; k < p.kn.length; k++) p.kn[k]!.color = fs;
      }
      const la = cy ? 1 : 0;
      if (p.pad.alpha !== la) (p.pad.alpha = la), (p.ln[0]!.alpha = la), (p.ln[1]!.alpha = la);
    }
    // The head turns to the camera on a wall.
    neck.rot[1] = wall ? (f > 0 ? W.neck : -W.neck) : 0;
    neck.rot[2] = md === KO ? 0.4 : zap > 0 ? 0.3 : wall ? 0.25 : Math.sin(t * 1.3) * 0.04 - (nom > 0 ? 0.25 : 0);
    jaw.rot[2] = nom > 0 ? -Math.abs(Math.sin(nom * 18)) * 0.6 : zap > 0 || M[11]! > 0 ? -0.5 : M[8]! > 0 ? -0.35 : -0.05;
  }
  return { root, pose, height: height * MK, main, acc, hands, feet, tor: tor ?? body, arms, fore, legs, knees };
}
export type Monster = ReturnType<typeof buildMonster>;

/** `#rrggbb` darker (k < 1) or lighter (k > 1). */
export function shade(c: string, k: number) {
  const n = parseInt(c.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)))).toString(16).padStart(2, "0");
  return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}
