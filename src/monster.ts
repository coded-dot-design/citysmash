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
/** Hair (cyber-punk, in a neon of its own: TRIMS): none, a mohawk (a tall block fin), spikes, a swept crest. */
export const HAIRS = [{ id: "none", name: "NONE" }, { id: "mohawk", name: "MOHAWK" }, { id: "spikes", name: "SPIKES" }, { id: "crest", name: "CREST" }];
/** Gear, one bit each. */
export const GEAR = [
  { id: "arm", name: "CYBER ARM" }, { id: "visor", name: "VISOR" }, { id: "plate", name: "CHEST PLATE" }, { id: "spikes", name: "TAIL SPIKES" },
  { id: "pads", name: "SHOULDER PADS" }, { id: "core", name: "BACK REACTOR" }, { id: "knux", name: "KNUCKLE SPIKES" }, { id: "guard", name: "JAW GUARD" },
];
/** The rivals' names and what they are. */
export const RIVALS = ["SHARDCLAW", "GLOOPMAW", "VOLTWING"];
export const RIVAL_WHAT = ["a crystal crab-beast", "a tentacle blob", "a storm moth"];
/** Each rival's own colour and trim. */
export const RIVAL_C = [["#3d3378", "#7cf6ff"], ["#b23a9e", "#b6ff3a"], ["#4a5f8c", "#fff36b"]];
/** The dress of rival `kind` from a profile's `rlook` ([colour, trim] × 3, −1: its own, undefined here). */
export const rivalDress = (kind: number, rl: number[]) => { const c = rl[(kind - 1) * 2]!, t = rl[(kind - 1) * 2 + 1]!; return [c >= 0 ? FURS[c]!.c : undefined, t >= 0 ? TRIMS[t]!.c : undefined]; };
/** The hero's name: its fur and its face. */
export const heroName = (fur: number, face: number) => (FURS[fur] ?? FURS[0]!).word + " " + (FACES[face] ?? FACES[0]!).word;
/** A monster's name. */
export const monName = (k: number, look: Look) => (k === HERO ? heroName(look.fur, look.face) : RIVALS[k - 1]!);

export interface Look { fur: number; trim: number; pattern: number; face: number; gear: number; hair: number; hairc: number }
export const LOOK0: Look = { fur: 0, trim: 0, pattern: 1, face: 0, gear: 3, hair: 0, hairc: 1 };
export interface RigInk { ink: string; eye: string; pupil: string; teeth: string; night: boolean; metal: string }

/** A rig on a wall (for a monster facing +x, on a building's left side; the other side mirrors). It climbs
 *  the side wall: side-on, chest to the wall, set back behind the building's front corner (sorted behind the
 *  building, so the facade covers whatever overlaps it and the corner edge and the seven reach cells stay in
 *  view). The far arm and leg grip the side wall behind the body; the near leg climbs it; the near arm is
 *  the free one: it rests by the corner and only its fist comes round onto the front face to smash. Fields:
 *  its turn, how far it sits in towards the building and back (negative: behind the front), the torso's
 *  lean, how far the far punch brings it round the front corner and [towards the camera, forward, a roll that shows
 *  the camera its face], the far arm [swing, splay, elbow], the far leg and the near leg [thigh,
 *  knee, splay], the free arm at rest, its wind-up and its hit for each reach cell (./round.ts REACH: level
 *  close, medium, far, up close, medium, down close, medium; [swing, splay, elbow] each), the head's turn.
 *  Fitted per kind (tests/pose.mjs checks them). */
export interface Wall { yaw: number; ox: number; oz: number; lean: number; lunge: number; come: number[]; far: number[]; fleg: number[]; nleg: number[]; rest: number[]; wind: number[]; hit: number[]; neck: number }
/** The depth (z) the scene anchors a held building's cluster at: behind it only the rigs on its walls. */
export const HELD = 0.05;
/** On a wall the renderer's forward shift (./scene.ts wallFwd) stops with the rig's root this far back. */
export const FWD_Z = -1.05;
export const WALL: Wall[] = [
  // the ape
  { yaw: 0.1, ox: -0.15, oz: -0.85, lunge: 1, lean: 0.15, come: [2, 0.2, 0.2], far: [1.105, -0.541, 2.107], fleg: [0.871, -0.25, -0.006], nleg: [1.033, -0.25, 0.353], rest: [-0.759, -0.108, 1.792], wind: [3.636, -1.51, 2.7, 2.593, 1.631, 2.7, -1.65, 2.67, 1.5, 2.253, 0.442, 2.548, 2.253, 0.442, 2.548, 3.7, -0.421, 2.627, 3.7, -0.421, 2.627], hit: [-0.039, -0.862, 1.586, 1.009, -0.847, 0, 1.412, -2.024, 0.81, 1.241, 1.407, 1.679, 1.017, -1.615, 0.242, 0.047, -0.489, 0.919, 0.816, -0.443, 0], neck: -1.2 },
  // SHARDCLAW
  { yaw: 0.1, ox: 0.2, oz: -0.7, lunge: 1.2, lean: 0.9, come: [1.8, 0.2, 0.2], far: [0.111, 0.868, 2.466], fleg: [-0.545, -0.972, 0.259], nleg: [-0.608, -0.717, 0.248], rest: [3.7, 0.063, 2.562], wind: [2.766, 0.41, 2.556, 2.766, 0.41, 2.556, 3, -0.26, 0.75, 2.063, 0.236, 2.527, 2.063, 0.236, 2.527, 3.402, 1.154, 2.248, 3.402, 1.154, 2.248], hit: [-0.792, -0.548, 1.668, 0.251, -0.414, 0.105, 0.731, -0.885, -0.43, -0.352, -0.804, 1.915, 0.538, -0.54, 0.3, -0.506, -0.408, 0.451, -0.042, -0.285, 0.105], neck: -0.5 },
  // GLOOPMAW
  { yaw: 0.1, ox: 0.45, oz: -0.45, lunge: 1.5, lean: 0.35, come: [1.55, 0.2, 0.2], far: [1.663, -0.127, 1.237], fleg: [0.9, 0.6, 0], nleg: [0.9, 0.6, 0], rest: [-0.738, 1.001, 2.422], wind: [2.207, -0.389, 2.27, 2.207, -0.389, 2.27, -1.38, 3.08, 0.9, 2.253, -0.247, 1.744, 2.253, -0.247, 1.744, 2.552, -0.83, 2.586, 2.552, -0.83, 2.586], hit: [0.358, -0.725, 1.753, 1.219, -0.529, 0, 0.684, 1.771, 1.395, 1.298, 0.538, 1.257, 1.681, 1.29, 0, -0.09, -0.249, 1.503, 0.909, -0.218, 0], neck: -0.6 },
  // VOLTWING
  { yaw: 0.1, ox: -0.1, oz: -0.85, lunge: 1, lean: 0.1, come: [2, 0.2, 0.2], far: [0.78, -0.285, 2.4], fleg: [0.623, -1.294, 0.077], nleg: [0.742, -2.204, 0.406], rest: [-0.769, -0.232, 1.86], wind: [2.177, 1.8, 2.7, 2.177, 1.8, 2.7, -1.72, -3.49, 1.64, 2.015, 0.842, 2.7, 2.015, 0.842, 2.7, 3.7, -0.593, 2.7, 3.7, -0.593, 2.7], hit: [-0.098, -0.943, 1.614, 0.986, -0.947, 0.108, 1.368, -2.079, 0.968, 1.298, 1.466, 1.758, 2.054, 1.523, 0.108, 0.123, -0.571, 0.868, 0.825, -0.552, 0.108], neck: -1.1 },
];

type Shape = "box" | "wedge" | "cyl" | "prism";
interface PartOpts { rot?: number[]; sides?: number; top?: number; emissive?: boolean; mask?: number }

/** A monster on `d`: `kind` HERO (dressed by `look`), CRAB, BLOB or MOTH (`dress`: its [colour, trim] when you play it, else its own); `id` keeps its part names apart. */
export function buildMonster(d: Diorama, kind: number, look: Look, K: RigInk, id: string, dress?: (string | undefined)[] | null) {
  const root = d.add({ id, shape: "group", size: [1.6, 0, 1.2], pos: [0, 0, 0], pick: false, tag: id, shadow: 0, cluster: id + "-B" });
  const n = (s: string) => id + "-" + s;
  // Every part is drawn at MK times the numbers below (the monster is about four floors tall).
  const k3 = (v: number[]) => [v[0]! * MK, v[1]! * MK, v[2]! * MK];
  const P = (on: string, shape: Shape, size: number[], pos: number[], color: string, o: PartOpts = {}) =>
    d.add({ shape, size: k3(size), pos: k3(pos), rot: o.rot, sides: o.sides, top: o.top, color, on: on === "" ? id : n(on), emissive: o.emissive, mask: o.mask, pick: false });
  // The body and each side's arms and legs sort as their own clusters, anchored each frame (./pose) at the
  // same height, so the depth sort sees only where they are across the body: off a wall the side nearer the
  // camera draws in front of the body and the far side behind it, at any turn (the garage's turntable too);
  // on a wall the whole rig hangs on the side wall behind the building's front (the facade covers what
  // overlaps it, so the reach stays in view) and only the smashing arm comes in front, while it hits.
  const atB = new Float64Array(3), at4 = [new Float64Array(3), new Float64Array(3), new Float64Array(3), new Float64Array(3)];
  d.cluster(n("B"), { at: atB });
  for (let q = 0; q < 4; q++) d.cluster(n("c" + q), { at: at4[q]! });
  /** The cluster of side s's arms (q 0) or legs (q 2). */
  const side = (s: number, q = 0) => n("c" + (q + (s < 0 ? 0 : 1)));
  const grp = (gid: string, on: string, pos: number[], rot?: number[], s = 0, q = 0) => d.add({ id: n(gid), shape: "group", size: [0.2, 0, 0.2], pos: k3(pos), rot, on: on === "" ? id : n(on), pick: false, cluster: s ? side(s, q) : undefined });
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
      const h = grp("hip" + s, "body", [-0.25, 0.05, s * 0.38], undefined, s, 2);
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
    // The hair, on the head's top (0.74), lit in its own neon.
    const hc = (TRIMS[look.hairc] ?? TRIMS[1]!).c, hair = look.hair, H = { emissive: true };
    if (hair === 1) for (let k = 0; k < 4; k++) P("neck", "box", [0.2, 0.64 - k * 0.11, 0.14], [0.24 - k * 0.19, 0.72, 0], hc, H); // the mohawk: a stepped fin
    else if (hair === 2) for (let k = 0; k < 7; k++) {
      const a = (k - 3) * 0.42; // spikes fanned across the top and back
      P("neck", "cyl", [0.22, 0.64 - Math.abs(k - 3) * 0.06, 0.22], [0.08 - (k % 2) * 0.24, 0.7, Math.sin(a) * 0.3], hc, { ...H, sides: 4, top: 0, rot: [-a * 0.9, 0, 0.35 + (k % 2) * 0.3] });
    } else if (hair === 3) for (let k = 0; k < 3; k++) P("neck", "wedge", [0.62 - k * 0.1, 0.3 - k * 0.05, 0.6 - k * 0.16], [-0.12 - k * 0.1, 0.72 + k * 0.08, 0], hc, { ...H, rot: [0, 0, -0.25] }); // a swept crest
  } else if (kind === CRAB) {
    // ---- SHARDCLAW, the crystal crab-beast ----
    main = dress?.[0] ?? "#3d3378";
    acc = dress?.[1] ?? "#7cf6ff";
    const dark = dress?.[0] ? shade(main, 0.62) : "#262054", claw = dress?.[0] ? shade(main, 1.35) : "#6a58c8";
    hipY = 1.1;
    height = 2.6;
    grp("body", "", [0, hipY, 0]);
    P("body", "box", [2.0, 0.8, 1.6], [0, 0, 0], main);
    P("body", "box", [1.6, 0.3, 1.3], [-0.1, 0.8, 0], dark);
    P("body", "box", [2.05, 0.08, 1.65], [0, 0.38, 0], acc, { emissive: true });
    for (let k = 0; k < 5; k++) P("body", "cyl", [0.3, 0.7 + (k % 2) * 0.35, 0.3], [-0.65 + k * 0.32, 1.05, ((k * 7) % 3 - 1) * 0.3], k % 2 ? acc : "#c9a6ff", { sides: 5, top: 0, emissive: true, rot: [0, 0, 0.3 - k * 0.15] });
    // Six legs.
    for (let k = 0; k < 6; k++) {
      const s = k < 3 ? -1 : 1, x = -0.65 + (k % 3) * 0.6, h = grp("hip" + k, "body", [x, 0.2, s * 0.8], [s * 0.6, 0, 0], s, 2);
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
    main = dress?.[0] ?? "#4a5f8c";
    acc = dress?.[1] ?? "#fff36b";
    const dark = dress?.[0] ? shade(main, 0.6) : "#2b3a5c", fluff = "#d9e2f2", wing = dress?.[0] ? shade(main, 1.3) : "#6d86c4";
    hipY = 1.05;
    height = 3.2;
    grp("body", "", [0, hipY, 0]);
    grp("tor", "body", [0, 0, 0], [0, 0, -0.2]);
    P("tor", "box", [0.95, 1.3, 1.0], [0, 0, 0], main);
    P("tor", "box", [0.75, 0.5, 1.1], [0.1, 0.9, 0], fluff);
    for (let k = 0; k < 3; k++) P("tor", "box", [0.98, 0.07, 1.04], [0, 0.2 + k * 0.3, 0], dark);
    for (const s of [-1, 1]) {
      const wg = grp("wing" + s, "tor", [-0.35, 1.0, s * 0.45], [s * 0.4, 0, 0], s, 2);
      P("wing" + s, "box", [1.3, 1.7, 0.06], [-0.4, 0.2, s * 0.05], wing, { rot: [0, 0, 0.35] });
      P("wing" + s, "cyl", [0.5, 0.05, 0.5], [-0.45, 0.45, s * 0.09], acc, { sides: 10, rot: [Math.PI / 2, 0, 0], emissive: true });
      P("wing" + s, "box", [0.9, 0.06, 0.08], [-0.5, -0.35, s * 0.09], acc, { emissive: K.night, rot: [0, 0, 0.5] });
      wings.push(wg);
      const h = grp("hip" + s, "body", [-0.15, 0.05, s * 0.3], undefined, s, 2);
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
    main = dress?.[0] ?? "#b23a9e";
    acc = dress?.[1] ?? "#b6ff3a";
    const dark = dress?.[0] ? shade(main, 0.68) : "#7a2470";
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
  // On a wall (fitted per kind: tests/pose.mjs): side-on on the side wall behind the front corner, chest to
  // the wall; the far arm and leg grip the side wall behind the body, the near leg climbs it, the near arm is
  // free and its fist comes round the corner onto the front face to smash. Climbing it shimmies: the far arm
  // reaches up, the hips push in, the body pulls up, the legs follow.
  const W = WALL[kind]!;
  let yaw = -0.35;
  /** `fwd`: on a wall, how far forward (towards the front corner, +z) the renderer sets the rig for this
   *  frame's view of the side wall (./scene.ts wallFwd; render only, the run's state is untouched). */
  function pose(M: Float64Array, t: number, dt: number, spin?: number, fwd = 0) {
    const md = M[5]!, f = M[6]!, ph = M[13]!, ga = M[10]!, nom = M[18]!, squash = M[19]!, zap = M[23]!;
    const wall = md === CLIMB, pt = PUNCH_CD - M[8]!, punching = M[8]! > 0 && zap <= 0;
    // On the street: three quarters to the camera. On a wall: side-on, chest to the wall.
    const want = wall ? (f > 0 ? W.yaw : Math.PI - W.yaw) : f > 0 ? -0.35 : Math.PI + 0.35;
    let dy = want - yaw;
    dy -= 6.283185307179586 * Math.floor(dy / 6.283185307179586 + 0.5);
    yaw = spin ?? yaw + dy * Math.min(1, dt * 14);
    // The climb's cycle (it runs only while it moves up or down) and the idle breath.
    const moving = Math.abs(M[3]!) > 0.3 || (wall && Math.abs(M[33]!) > 0.3), a = ph * 2.4, cyc = Math.sin(a), br = Math.sin(t * 1.9);
    // The shimmy: reach (cyc), then the hips push in (hump), then the body pulls up (lift), then the legs.
    const hump = wall ? (moving ? 0.5 + 0.5 * Math.sin(a - 1.3) : 0.3 + br * 0.08) : 0, lift = moving ? 0.5 + 0.5 * Math.sin(a - 2.3) : 0, step = moving ? Math.sin(a - 3.1) : 0;
    // The far swing brings the body round the front corner, towards the camera (W.lunge across, W.come: in
    // front, forward, a roll that shows the camera its face): half-way in by the end of the wind-up (head leading,
    // drawn in front of the facade from a third of the way), at the hit its shoulder and head come past the corner
    // over the front face, back on the recovery.
    const lk = wall && punching && M[38]! === 3 ? (M[34]! > 0 ? Math.min(1, pt / PUNCH_HIT) * 0.8 : 1 - (Math.max(0, (pt - PUNCH_HIT) / (PUNCH_CD - PUNCH_HIT) - 0.3) / 0.7) ** 2) : 0;
    root.pos[0] = M[0]! + (wall ? f * (W.ox + W.lunge * lk) : 0);
    root.pos[1] = M[1]! + (wall ? (moving ? lift * 0.16 : br * 0.03) * MK : 0);
    // (forward only as far as keeps its feet and far hand on the side wall: the root no nearer than FWD_Z)
    root.pos[2] = M[2]! + (wall ? W.oz + Math.min(fwd, Math.max(0, FWD_Z - M[2]! - W.oz)) + W.come[0]! * lk : 0);
    root.rot[1] = yaw;
    root.rot[2] = md === KO ? -1.35 : zap > 0 ? Math.sin(t * 60) * 0.06 : 0;
    // A shock flickers it light and dark; a hit flashes it white.
    root.tint = zap > 0 ? ((t * 16) | 0) & 1 ? "#ffffff" : K.ink : M[11]! > 0.18 ? "#ffffff" : null;
    const walking = md === 0 || md === ROOF, sw = walking ? Math.sin(ph * 3.2) : 0;
    const bob = walking && moving ? Math.abs(Math.cos(ph * 3.2)) * 0.1 : 0;
    body.pos[0] = hump * 0.14 * MK;
    body.pos[1] = (hipY + bob - squash * 0.25) * MK;
    if (tor) tor.rot[2] = wall ? W.lean - hump * 0.12 - lk * W.come[1]! : lean0;
    else body.rot[2] = wall ? W.lean + hump * 0.08 - lk * W.come[1]! : 0;
    (tor ?? body).rot[0] = f * lk * W.come[2]!;
    // Which side is the far one (away from the camera): its arm and leg climb, the near arm smashes.
    const far = wall ? (f > 0 ? 0 : 1) : -1, out = wall ? 1 - far : f > 0 ? 1 : 0;
    // Legs. On a wall both feet plant on the side wall (the far one behind the body); they push in turn.
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
    // grips the side wall behind the body, reaching up as it climbs, and never lets go; the near arm rests by
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
          // The far swing's haymaker load eases out: cocked back early (upper arm behind the shoulder, fist up by the
          // ear on the far side from the window), held into the hit.
          let k = Math.min(1, pt / PUNCH_HIT);
          if (wall && j === 6) k *= 2 - k;
          (r += (wr - r) * k), (sp += (ws - sp) * k), (er += (we - er) * k);
        } else {
          const k = Math.max(0, (pt - PUNCH_HIT) / (PUNCH_CD - PUNCH_HIT) - 0.3) / 0.7;
          (r = hr + (r - hr) * k * k), (er = he + (er - he) * k * k), (sp = hs + (sp - hs) * k * k);
        }
      }
      if (ga > 0 && outside && zap <= 0) {
        // The grab: out to the window, then back to the mouth.
        const k = ga > 0.5 ? (1 - ga) * 2 : 1;
        const gj = (M[41]! > 0 ? M[41]! - 1 : 0) * 3, gs = wall ? s * W.hit[gj + 1]! : sp;
        let gr = wall ? W.hit[gj]! : 1.9, ge = wall ? W.hit[gj + 2]! : 0.2;
        // v11: off a wall the arm reaches for the very spot it grabs (./round.ts M[50], M[51]): straight from
        // the shoulder, down to the street, out ahead or up over the head.
        if (!wall && M[51]! > 0) {
          const fw = Math.max(0.3, (M[50]! - M[0]!) * f - 0.3), up = M[51]! - M[1]! - height * MK * 0.65;
          gr = Math.max(0.25, Math.min(2.9, Math.atan2(fw, -up)));
          ge = 0.08;
        }
        r = r + (gr - r) * k;
        sp = sp + (gs - sp) * (ga > 0.5 ? k : 1 - (1 - ga * 2));
        er = ga > 0.5 ? er + (ge - er) * k : er + (2.1 - er) * (1 - ga * 2);
      }
      ar.rot[2] = r;
      ar.rot[0] = sp;
      e.rot[2] = er;
    }
    // The clusters, all anchored at the street's height (so only where they are across the body counts). Off
    // a wall: the body at its middle, each side's arms out to that side and a little ahead (an arm hangs in
    // front of the torso, so facing the camera both draw over it, facing away both under), its legs out to
    // that side. On a wall (side-on on the side wall, behind the building's front): everything behind the
    // building, far side, body, near side, in that order; the smashing arm comes in front once its fist is
    // out (the hit frame through the recovery, the grab; the far swing's wind-up with the body), then goes back.
    const rx = root.pos[0]!, rz = root.pos[2]!, c = Math.cos(yaw), sn = Math.sin(yaw);
    // (On a wall the rig sorts just in front of every building but the one it holds, which the scene sorts at
    // HELD, just in front of the rig: the facade it holds covers it, a neighbour never does.)
    atB[0] = rx; atB[2] = wall ? (lk > (M[34]! > 0 ? 0.3 : 0.6) ? rz + 2 : -DEPTH + 0.02) : rz;
    for (let q = 0; q < 4; q++) {
      const A = at4[q]!, s = q & 1 ? 1 : -1, leg = q > 1;
      A[1] = 0;
      if (wall) {
        const isFar = (q & 1) === far, fist = !leg && !isFar && ((punching && (M[34]! <= 0 || lk > 0.3)) || (ga > 0 && zap <= 0));
        A[0] = rx;
        A[2] = fist ? rz + 2.5 : -DEPTH + 0.02 + (isFar ? -0.01 : 0.01);
      } else {
        const l = s * (leg ? 0.45 : 0.8) * MK, fw = leg ? 0 : 0.35 * MK;
        A[0] = rx + fw * c + l * sn;
        A[2] = rz - fw * sn + l * c;
      }
    }
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
