// A city on screen: the gallery daily DOM Kaiju's scene (#124), kept for the feel (side-on, a little
// above the street; the framing set once per stage shape, a resize only changes the field of view,
// never a speed zoom; the camera walks with the hero, steady), now carrying a run of cities: each
// city's skyline kit (its walls, its window cut, its roof furniture, the far skyline behind), its
// landmark's crown, its feature (the gunboat on the harbour, the train and its crossing, the floodlights,
// the surge, the trucks on the bridge, the neon, two helicopters), day into dusk into night. Board UI
// stickers: a chip per monster (name, who drives it, health, score), the city, the team's score, how
// much is flat; the calls; the card between cities; the run's score card. The run (./round.ts) is
// headless; this file draws it and feeds it input: four seats (the keyboard's halves, gamepads, the
// touch pad for seat one). Online, ./game.ts steps the run through the rollback instead (`net`).
import { createEngine } from "@fzlt/core/kernel";
import { diorama, type DioramaObject, type DioramaPoints } from "@fzlt/core/diorama";
import { effects } from "@fzlt/core/fx";
import { controls } from "@fzlt/core/input";
import { pad } from "@fzlt/core/pad";
import { sound } from "@fzlt/core/sound";
import { wreckage, type Wreckage } from "./fx.ts";
import { person, sniper, soldier, cracks, bite, type Ink } from "./paint.ts";
import { DEPTH, STREET0, STREET1, INTACT, CRACKED, HOLE, SHAKE, FALL, RUBBLE } from "./block.ts";
import {
  createRun, NM, NS, NP, NCH, NH, NT, SEATS, AI, HERO, CRAB, IN, READY, RUN, CLEAR, DONE, CLIMB, ROOF, KO,
  E_START, E_HOLE, E_SHAKE, E_FLOOR, E_FLAT, E_HELI, E_HELI_CRASH, E_NOM, E_HURT, E_FLING, E_DROP, E_KO, E_END, E_STOMP, E_JUMP, E_LAND, E_CLIMB,
  E_SHOCK, E_TANK, E_BONK, E_BURN, E_JOIN, E_CHIP_, E_CRACK_, E_ARMOUR, E_TRAIN, E_BELLS, E_RAM, E_TRUCK, E_SURGE, E_CITY, E_CLEAR, E_PUNCH,
  NI, NR, NG, P_ALL, T_CELL, T_GRAB, T_HELI, T_CHUTE, T_SOLDIER, T_STREET, T_MISS,
  type Run,
} from "./round.ts";
import { CITIES, NCITY, HARBOUR, RAIL, STADIUM, PLANT, BRIDGE, NEON, SKYPORT, DAY, DUSK, NIGHT, R_TANK, R_ANT, R_DOME, R_BOARD, C_LIGHT, C_CLOCK, C_BOWL, C_COOL, C_PYLON, C_ARCADE, C_SPIRE, type City } from "./cities.ts";
import { buildMonster, monName, shade, RIVALS, WALL, TRIMS, type Look, type Monster, type RigInk } from "./monster.ts";

const TAU = 6.283185307179586;
/** Practice's steps, in ./round.ts P_* order. */
const PRACTICE = ["Walk", "Jump onto a building's side", "Climb it", "Punch all 7 reach cells", "Grab someone at a window", "Swat the parked helicopter", "Punch past a live (sparking) window"];
const mix = (a: string, b: string, k: number) => {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), f = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k).toString(16).padStart(2, "0");
  return "#" + f(16) + f(8) + f(0);
};
// The shared shades by theme (the daily's palettes); the city and the time of day fill in the rest.
const BASE_D = {
  light: [-0.45, 1, 0.6], amb: 0.52, star: "#cfd8ff", moon: "#efe9ff",
  table: "#0c0a1a", plinth: "#15122b", rim: "#22e6ff", walk: "#2b2847", curb: "#22e6ff", dash: "#ffd166",
  roof: "#1c1934", win: "#ffd27a", win2: "#7cf6ff", crack: "#c99a5a", hole: "#07060f", holeRim: "#ff4fa8", door: "#120f22", awning: ["#ff4fa8", "#22e6ff", "#ffd166", "#9d7bff", "#39ffb0"],
  rubble: ["#3b3466", "#2c2650", "#4b426e"], tank: "#5a5480", pole: "#3a3658", lamp: "#fff1c2", glow: "#ffcf7a", antenna: "#ff2e55",
  heli: "#5d6b4a", heli2: "#3e4a32", glass: "#7cf6ff", rotor: "#1a1a26", army: "#55613e", army2: "#3b442b", wreck: "#2a2630",
  box: "#5b5f78", hazard: "#ffd23f", neon: "#ff4fa8", zap: "#fff36b", water: "#13234a", water2: "#22e6ff", rail: "#8a84b8", train: "#c43d4b", train2: "#3b3466", truck: "#ffb03a", truck2: "#2c3f6a",
  soldier: "#7d8b52", helmet: "#4e5a30", skin: "#e8b48f", people: ["#ff8fb8", "#6fd3ff", "#ffd166", "#7ee0a8", "#c0c6ff", "#ff9e6b"], chute: ["#ff4fa8", "#ffffff", "#22e6ff", "#ffd166"],
  pebble: "#ffe066", shell: "#ff8a1f", dust: "#8a84b8", shard: "#bff6ff", smoke: "#a39fc4", spark: "#ffd166", fire: "#ff6a2a", shadow: "#000000",
  ink: "#0b0a14", paper: "#f6f3ff", eye: "#fff6c9", pupil: "#0b0a14", teeth: "#f6f3ff", metal: "#9aa3c8",
};
const BASE_L: typeof BASE_D = {
  ...BASE_D, light: [0.55, 1, 0.7], amb: 0.6, star: "#ffffff", moon: "#fff6cc",
  table: "#c9a585", plinth: "#8a6448", rim: "#fff3dc", walk: "#dcd6cc", curb: "#f4efe6", dash: "#fff3b0",
  roof: "#7d6b9e", win: "#e8f6ff", win2: "#cfeeff", crack: "#b9c6d6", hole: "#2a2236", holeRim: "#ef476f", door: "#6d4c41", awning: ["#ef476f", "#118ab2", "#ffd166", "#8e7dbe", "#06d6a0"],
  rubble: ["#d9c2a5", "#bfa88c", "#e8d6be"], tank: "#9aa0b8", pole: "#7b8094", lamp: "#fff6cc", glow: "#fff6cc", antenna: "#e63946",
  heli: "#6f8a5a", heli2: "#4f6642", glass: "#cfe8ff", rotor: "#2a2a33", army: "#6f8a4a", army2: "#4f6634", wreck: "#4a4048",
  box: "#8d93ab", hazard: "#ffb703", neon: "#ef476f", zap: "#ffe14d", water: "#5aa9e6", water2: "#e8f6ff", rail: "#7b8094", train: "#d9434f", train2: "#5a5480", truck: "#ff9f1c", truck2: "#3a5a9a",
  soldier: "#6f8a4a", helmet: "#4f6634", chute: ["#ef476f", "#ffffff", "#118ab2", "#ffd166"],
  pebble: "#ff9f1c", shell: "#e85d04", dust: "#d9d2c3", shard: "#ffffff", smoke: "#eeeeee", spark: "#ffb703", fire: "#ff5a1f", shadow: "#3a2a24",
  ink: "#1b1420", paper: "#ffffff", eye: "#ffffff", pupil: "#1b1420", teeth: "#ffffff", metal: "#b8bfd8",
};
const SKY = {
  light: [["", "#e8f6ff", "#fff3dc"], ["#7d6bc0", "#ff9e8a", "#ffd39a"], ["#2c3570", "#55609e", "#8b8fc4"]],
  dark: [["#1b2f5e", "#35508a", "#6a7fb4"], ["#1d1240", "#6a2a6e", "#d0567a"], ["#07051c", "#1d0d3d", "#45145e"]],
};
function palette(c: City, light: boolean) {
  const b = light ? BASE_L : BASE_D, s = (light ? SKY.light : SKY.dark)[c.tod]!, night = c.tod === NIGHT || (!light && c.tod === DUSK);
  const wall = (w: string) => (light ? (c.tod === NIGHT ? mix(w, "#3a3d7a", 0.28) : w) : mix(shade(w, 0.5), "#1d1840", 0.35));
  const walls = c.walls.map(wall).concat(wall(c.mark));
  return {
    ...b, night,
    sky0: s[0] || c.sky, sky1: s[1]!, sky2: s[2]!,
    walls, ledge: walls.map((w) => (light ? shade(w, 0.85) : shade(w, 1.25))),
    street: light ? c.street : shade(c.street, 0.42), far: light ? mix(s[1]!, "#5a5f8a", c.tod === DAY ? 0.35 : 0.55) : mix(s[1]!, "#000000", 0.45),
    win: night ? (light ? "#ffe9a8" : b.win) : light ? b.win : "#9fb4d8", win2: night ? b.win2 : light ? b.win2 : "#b6c8e6",
    amb: b.amb + (c.tod === DAY ? 0.05 : c.tod === NIGHT ? -0.06 : 0),
  };
}
type Pal = ReturnType<typeof palette>;
const WORDS = ["CRUNCH!", "KRAK!", "SMASH!", "TIMBER!", "FLAT!", "SWAT!", "KA-BLAM!", "NOM!", "BOINK!", "STOMP!", "OOF!", "ZZAP!", "BONK!", "KER-THOOM!", "OUCH! HOT!", "POOF!", "CLANG!", "DERAILED!", "WHAM!"];
const W_CRUNCH = 0, W_TIMBER = 3, W_FLAT = 4, W_SWAT = 5, W_BLAM = 6, W_NOM = 7, W_BOINK = 8, W_STOMP = 9, W_OOF = 10, W_ZAP = 11, W_BONK = 12, W_THOOM = 13, W_HOT = 14, W_POOF = 15, W_CLANG = 16, W_DERAIL = 17, W_WHAM = 18;
const TOD = ["DAY", "DUSK", "NIGHT"];
/** Bits of facade knocked off: they fall to the street and stay there as rubble (until the city changes). */
const BITS = 180;
/** The colours of the four seats' tags. */
export const SEAT_C = ["#ff4fa8", "#22e6ff", "#39ffb0", "#ffd166"];

export interface SceneOptions {
  look: Look;
  seed?: number;
  /** The city the run starts in. */
  first?: number;
  /** AI rivals come in (1) or not (0). */
  rivals?: number;
  /** Who drives each monster at the start: a seat 0..3 or AI (the ape is always seat 0). */
  drivers?: number[];
  theme: () => "dark" | "light";
  sound?: boolean;
  /** The landing page's hero: the ape on the autopilot, no stickers, the cities loop. */
  attract?: boolean;
  /** Practice: the controls without the danger (./round.ts S[28]), its steps ticked off on a card. */
  practice?: boolean;
  /** Online: this screen's seat (the camera follows its monster); ./game.ts steps the run. */
  net?: { seat: number } | null;
  /** The shell's hooks: a city cleared, the run's end, the menu key. */
  on(what: "clear" | "end" | "menu" | "join", value: number): void;
  /** The garage parts a cleared city unlocks (for the card). */
  unlocks?(city: number): string;
}
export type Scene = ReturnType<typeof mountScene>;

export function mountScene(stage: HTMLElement, so: SceneOptions) {
  const engine = createEngine({ root: stage, settle: 0.5, seed: so.seed ?? 20261116 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const look: Look = { ...so.look };
  const light = () => so.theme() === "light";
  const run: Run = createRun(so.seed ?? 20261116), S = run.S, MV = run.MV;
  const drivers = so.drivers ?? [0, AI, AI, AI];
  for (let k = 0; k < NM; k++) run.MV[k]![28] = k === HERO ? 0 : drivers[k] ?? AI;
  run.reset(so.seed ?? 20261116, so.first ?? 0, so.rivals ?? 1, so.practice ? 1 : 0);
  if (so.attract) S[27] = 1;
  let built = -1, P: Pal = palette(CITIES[S[16]!]!, light());
  const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1;
  const net = so.net ?? null;

  // ---- the stage: the canvas, the play surface, the stickers, the cards, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "cs-canvas";
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "cs-play";
  play.setAttribute("aria-label", "CitySmash: A and D walk, W and S climb, K jumps (a jump at a wall grabs it), Space or J punches (W or S held: up or down), L grabs and eats. Player two: the arrow keys, comma punches, period jumps, slash grabs. Gamepads join as players three and four. M mutes, Escape for the menu");
  const hud = L.add(document.createElement("div"));
  hud.className = "cs-hud";
  hud.hidden = !!so.attract;
  hud.innerHTML = `<div class="cs-head"><p class="cs-top"><b class="cs-chip cs-city"><span></span><em></em></b><b class="cs-chip cs-team"><em>SCORE</em><span>0</span></b><b class="cs-chip cs-flat"><span>0%</span><em>FLAT</em></b></p><p class="cs-mons">${[0, 1, 2, 3].map((k) => `<b class="cs-chip cs-mon cs-m${k}" hidden><i></i><em></em><u><s></s></u><span>0</span></b>`).join("")}</p><p class="cs-hint"></p><div class="cs-prac" hidden><b>PRACTICE</b> <small>nothing hurts · ☰ to leave</small><ol>${PRACTICE.map((t) => `<li>${t}</li>`).join("")}</ol><p class="cs-dots" aria-label="Reach cells punched">${"<i></i>".repeat(NR)}</p></div></div>`
    + `<p class="cs-toast" hidden></p><p class="cs-live" aria-live="polite"></p><p class="cs-keys"><button type="button" class="cs-key cs-menu" aria-label="Menu (Escape)">☰</button><button type="button" class="cs-key cs-mute" aria-label="Mute (M)" aria-pressed="true">♪</button></p>`
    + `<div class="cs-card cs-ccard" role="dialog" aria-label="City flattened" hidden><small></small><b></b><p class="cs-t"></p><p class="cs-next"></p><p class="cs-unl"></p><p class="cs-go-say"></p></div>`
    + `<div class="cs-card cs-end" role="dialog" aria-label="Run over" hidden><b></b><p class="cs-t"></p><ol class="cs-board"></ol><p class="cs-stats"></p><p class="cs-row"><button type="button" class="bui-key cs-again">PLAY AGAIN</button><button type="button" class="bui-key cs-retry"></button><button type="button" class="bui-key cs-tomenu">MENU</button></p></div>`;
  const q = <T extends HTMLElement>(s: string) => hud.querySelector(s) as T;
  const cityEl = q(".cs-city span"), todEl = q(".cs-city em"), teamEl = q(".cs-team span"), flatEl = q(".cs-flat span"), hintEl = q(".cs-hint"), pracEl = q(".cs-prac"), toastEl = q(".cs-toast"), live = q(".cs-live");
  const monChips = [0, 1, 2, 3].map((k) => q(".cs-m" + k));
  const ccard = q(".cs-ccard"), endC = q(".cs-end"), board = q(".cs-board");
  const muteK = q<HTMLButtonElement>(".cs-mute"), menuK = q<HTMLButtonElement>(".cs-menu"), again = q<HTMLButtonElement>(".cs-again"), retry = q<HTMLButtonElement>(".cs-retry"), toMenu = q<HTMLButtonElement>(".cs-tomenu");
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { start: "roar", punch: "punch", hole: "glass", floor: "thud", flat: "boom", heli: "hit", crash: "boom", tank: "boom", nom: "nom", hurt: "hurt", fling: "click", bonk: "hit", shock: "zap", burn: "hurt", ko: "end", end: "win", jump: "click", climb: "click", join: "ready", bells: "bells", clang: "hit", city: "roar", clear: "win" },
    notes: {
      roar: [[150, 70, 0.5, 0, "sawtooth", 0.12], [110, 55, 0.55, 0.05, "square", 0.06]],
      punch: [[160, 60, 0.09, 0, "square", 0.1]],
      glass: [[2400, 1300, 0.07, 0, "triangle", 0.06], [3100, 1800, 0.06, 0.03, "triangle", 0.04]],
      thud: [[90, 40, 0.22, 0, "sawtooth", 0.1]],
      nom: [[420, 300, 0.07, 0, "square", 0.07], [380, 260, 0.07, 0.1, "square", 0.07]],
      zap: [[1800, 300, 0.05, 0, "sawtooth", 0.08], [2200, 400, 0.05, 0.06, "sawtooth", 0.08], [1600, 200, 0.08, 0.12, "square", 0.06]],
      bells: [[1250, 1250, 0.12, 0, "triangle", 0.06], [1050, 1050, 0.12, 0.25, "triangle", 0.06], [1250, 1250, 0.12, 0.5, "triangle", 0.06], [1050, 1050, 0.12, 0.75, "triangle", 0.06]],
    },
    volume: 0.1,
  });
  if (so.sound === false || so.attract) snd.on = false;
  const c = controls(engine, { keys: { left: [], right: [], up: [], down: [], punch: [], jump: [], grab: [] }, target: play });
  const PUNCH = c.id("punch"), JUMP = c.id("jump"), GRAB = c.id("grab");
  const ICON_JUMP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 12h5v8h6v-8h5z" fill="currentColor"/></svg>';
  const thePad = pad(engine, c, {
    scheme: "stick",
    move: ["up", "down", "left", "right"],
    // Move and jump only: everything else is a tap on what to smash or grab.
    actions: [{ intent: "jump", label: "JUMP", icon: ICON_JUMP, name: "Jump (Space or K)", key: "K", role: "go" }],
    host: stage,
  });
  thePad.el.classList.add("cs-pad");
  if (so.attract) thePad.el.hidden = true;
  const toggle = () => {
    snd.on = !snd.on;
    muteK.textContent = snd.on ? "♪" : "×";
    muteK.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the diorama ----
  const fx = effects({ cap: 320, scorch: 0, words: WORDS, colors: ["#fff4ff", "#ffc21a", "#ff8a1f", "#ff2e88", "#19f0ff", "#39ffb0", "#9a63ff", "#07060f"] });
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.table, overlay: drawOverlay, maxVerts: 90000, maxFaces: 16000, get shadowColor() { return P.shadow; } });
  const groups: DioramaObject[] = [], floors: DioramaObject[][] = [], wins: DioramaObject[] = [], rubble: DioramaObject[] = [], roofs: DioramaObject[] = [], lives: DioramaObject[] = [], liveCell: number[] = [];
  const mons: Monster[] = [], helis: DioramaObject[] = [], rotors: DioramaObject[] = [], tailRotors: DioramaObject[] = [], trucks: DioramaObject[] = [];
  let tank: DioramaObject, turret: DioramaObject, train: DioramaObject | null = null, xing: DioramaObject[] = [], beam: DioramaObject | null = null, steam = 0;
  let bits: DioramaPoints, soldiers: DioramaPoints, pebbles: DioramaPoints, chutes: DioramaPoints, runners: DioramaPoints, W: Wreckage;
  const folk: DioramaPoints[] = [];
  const rnd = engine.random;
  let sky: CanvasGradient | null = null;
  const STARS = new Float32Array(90), FAR = new Float32Array(64);
  for (let i = 0; i < 90; i++) STARS[i] = rnd();
  /** The little drawings' colours (./paint.ts), refilled with the palette. */
  const PI: Ink = { ink: "", paper: "", skin: "", hole: "", slab: "", rebar: "", glow: "", uniform: "", helmet: "", metal: "", tie: "", shirts: [], hair: ["#3a2a20", "#e0b04a", "#1b1420", "#a5532e", "#7a7690"] };
  const INK: RigInk = { ink: "", eye: "", pupil: "", teeth: "", night: true, metal: "" };

  function buildScene() {
    const ci = S[16]!, cty = CITIES[ci]!, nb = run.nb(), SX = run.SX, BLD = run.BLD, C0 = run.C0;
    built = ci;
    P = palette(cty, light());
    dio.clear();
    groups.length = floors.length = rubble.length = roofs.length = folk.length = lives.length = liveCell.length = mons.length = helis.length = rotors.length = tailRotors.length = trucks.length = 0;
    wins.length = run.bk.L[1]!;
    xing = [];
    train = beam = null;
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("ground", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    for (let i = 0; i < 64; i++) FAR[i] = ((i * 2654435761 + ci * 40503) >>> 0) / 4294967296;
    const G = (size: number[], pos: number[], color: string, layer: number, emissive = false) => dio.add({ size, pos, color, cluster: "ground", layer, emissive, pick: false });
    const feat = cty.feature, front = feat === HARBOUR ? 3.4 : 0;
    G([SX * 2 + 9, 0.5, DEPTH + STREET1 + 8 + front], [0, -1.55, 1.2 + front / 2], P.table, 0);
    G([SX * 2 + 2, 1.05, DEPTH + STREET1 + 1.6 + front], [0, -1.05, (STREET1 - DEPTH + front) / 2], P.plinth, 1);
    G([SX * 2 + 2.2, 0.1, DEPTH + STREET1 + 1.8 + front], [0, -0.16, (STREET1 - DEPTH + front) / 2], P.rim, 2, true);
    G([SX * 2 + 1.6, 0.02, DEPTH + 0.8], [0, -0.02, -DEPTH / 2 + 0.2], P.walk, 3);
    G([SX * 2 + 1.6, 0.06, STREET0 + 0.1], [0, -0.02, STREET0 / 2], P.walk, 4);
    G([SX * 2 + 1.6, 0.02, STREET1 - STREET0], [0, -0.04, (STREET0 + STREET1) / 2], P.street, 3);
    if (feat === HARBOUR) {
      // The quay's edge and the water in front of the street.
      G([SX * 2 + 1.6, 0.02, 3.4], [0, -0.03, STREET1 + 1.9], P.water, 3, P.night);
      for (let x = -SX; x < SX; x += 3.1) G([1.4, 0.01, 0.06], [x + (x % 2) * 0.7, -0.01, STREET1 + 1.0 + ((x * 7) % 3) * 0.6], P.water2, 4, true);
      for (let x = -SX + 1; x < SX; x += 4) G([0.25, 0.5, 0.25], [x, 0.1, STREET1 + 0.12], P.pole, 5);
    }
    if (feat === RAIL) {
      // Two rails and the sleepers across the street; crossing lights at the kerb.
      for (const z of [STREET0 + 1.15, STREET0 + 2.05]) G([SX * 2 + 1.6, 0.06, 0.08], [0, 0.0, z], P.rail, 5);
      for (let x = -SX; x < SX; x += 0.9) G([0.18, 0.02, 1.3], [x, -0.02, STREET0 + 1.6], shade(P.rail, 0.6), 4);
      for (const x of [-SX + 1.2, SX - 1.2]) {
        G([0.1, 1.6, 0.1], [x, 0, STREET0 + 0.2], P.pole, 6);
        xing.push(dio.add({ shape: "cyl", sides: 8, size: [0.32, 0.32, 0.1], pos: [x - 0.22, 1.5, STREET0 + 0.25], color: P.antenna, cluster: "ground", layer: 7, emissive: true, pick: false }));
        xing.push(dio.add({ shape: "cyl", sides: 8, size: [0.32, 0.32, 0.1], pos: [x + 0.22, 1.5, STREET0 + 0.25], color: P.antenna, cluster: "ground", layer: 7, emissive: true, pick: false }));
      }
    } else for (let x = -SX + 0.6; x < SX; x += 2.4) G([1.2, 0.01, 0.14], [x, -0.02, (STREET0 + STREET1) / 2 + 0.3], P.dash, 5, P.night);
    if (feat === BRIDGE) for (let x = -SX; x <= SX; x += 1.6) G([0.12, 0.6, 0.12], [x, 0, STREET1 - 0.1], P.pole, 6), G([1.6, 0.08, 0.1], [x + 0.8, 0.55, STREET1 - 0.1], P.pole, 6);
    dio.decal("ground", 9, paintCurb);
    dio.decal("ground", 9.2, paintPools);
    dio.decal("ground", 9.5, paintShadow);
    const lamps = Math.round(SX / 3.4);
    for (let k = 0; k < lamps; k++) {
      const id = "lp" + k, x = -SX + 0.4 + (k * (SX * 2 - 0.8)) / Math.max(1, lamps - 1);
      dio.add({ id, shape: "cyl", sides: 6, size: [0.12, 2.3, 0.12], pos: [x, 0, STREET0 - 0.25], color: P.pole, cluster: "ground", layer: 6, pick: false });
      dio.add({ size: [0.5, 0.08, 0.14], pos: [0.18, 0, 0], on: id, color: P.pole, pick: false });
      dio.add({ shape: "cyl", sides: 6, size: [0.26, 0.12, 0.26], pos: [0.38, -0.12, 0], on: id, color: P.lamp, emissive: true, pick: false });
    }
    // The buildings: a group per building that sinks as it pancakes; a box per floor with a ledge, a
    // window per cell (recoloured as it cracks and goes), a door and an awning on the ground floor, a roof.
    const [ww, wh] = cty.win;
    for (let b = 0; b < nb; b++) {
      const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, lk = BLD[b * 4 + 3]!, id = "bg" + b, cl = "b" + b, mark = lk === 5;
      dio.cluster(cl, { at: [x0 + w / 2, 0, -DEPTH] });
      groups.push(dio.add({ id, shape: "group", size: [w, 0, DEPTH], pos: [x0 + w / 2, 0, -DEPTH / 2], cluster: cl, pick: false }));
      const fs: DioramaObject[] = [];
      for (let fl = 0; fl < f; fl++) {
        const fid = id + "f" + fl;
        fs.push(dio.add({ id: fid, size: [w, 1, DEPTH], pos: [0, fl, 0], on: id, color: P.walls[lk]!, pick: false, layer: 5 }));
        dio.add({ size: [w + 0.12, mark ? 0.14 : 0.09, DEPTH + 0.12], pos: [0, -0.09, 0], on: fid, color: P.ledge[lk]!, pick: false, layer: 6 });
        for (let col = 0; col < w; col++) {
          const i = C0[b]! + fl * w + col, gf = fl === 0, door = gf && col === ((w / 2) | 0);
          if (door) dio.add({ size: [0.5, 0.78, 0.05], pos: [col - w / 2 + 0.5, -1, DEPTH / 2 + 0.01], on: fid, color: P.door, pick: false, layer: 7 });
          wins[i] = dio.add({ size: door ? [0.5, 0.18, 0.05] : gf ? [0.74, 0.5, 0.05] : [ww, wh, 0.05], pos: [col - w / 2 + 0.5, door ? -0.2 : gf ? -0.84 : -0.5 - wh / 2 - 0.06, DEPTH / 2 + 0.01], on: fid, color: P.win, emissive: P.night, pick: false, layer: 7 });
        }
        if (fl === 0) for (let k = 0; k < w * 2; k++) dio.add({ size: [0.5, 0.06, 0.5], pos: [-w / 2 + 0.25 + k * 0.5, -0.12, DEPTH / 2 + 0.25], rot: [-0.35, 0, 0], on: fid, color: P.awning[(k + lk) & 1 ? lk % 5 : (lk + 2) % 5]!, pick: false, layer: 8 });
      }
      floors.push(fs);
      // The roof: a parapet, its furniture (a live antenna where the round says), a vent; the landmark's crown.
      const rid = id + "r";
      roofs.push(dio.add({ id: rid, shape: "group", size: [w, 0, DEPTH], pos: [0, f, 0], on: id, pick: false }));
      dio.add({ size: [w + 0.16, 0.22, DEPTH + 0.16], pos: [0, 0, 0], on: rid, color: P.roof, pick: false, layer: 6 });
      const R = (s: number[], p: number[], col: string, o: { shape?: "box" | "cyl" | "wedge" | "prism"; sides?: number; top?: number; emissive?: boolean; rot?: number[] } = {}) =>
        dio.add({ shape: o.shape ?? "box", sides: o.sides, top: o.top, size: s, pos: p, rot: o.rot, on: rid, color: col, emissive: o.emissive, pick: false, layer: 7 });
      if (mark) crown(cty, R, w, f);
      else {
        const kit = cty.roofs[(b + ci) % cty.roofs.length]!;
        if (run.ANT[b] === run.ANT[b]) {
          // A live antenna (a floodlight mast at the stadium, a sign mast on the strip).
          const ax = run.ANT[b]! - x0 - w / 2;
          R([0.1, 1.7, 0.1], [ax, 0.2, 0], P.pole);
          if (feat === STADIUM) R([0.8, 0.4, 0.2], [ax, 1.9, 0.1], P.lamp, { emissive: true }), R([0.9, 0.08, 0.3], [ax, 1.85, 0.1], P.pole);
          else for (let k = 0; k < 3; k++) R([0.6 - k * 0.15, 0.05, 0.05], [ax, 0.8 + k * 0.4, 0], P.pole);
          R([0.2, 0.2, 0.2], [ax, 1.9, 0], P.zap, { shape: "cyl", sides: 6, emissive: true });
        }
        if (kit === R_TANK) {
          R([0.9, 0.9, 0.9], [-w / 2 + 1, 0.55, -0.4], P.tank, { shape: "cyl", sides: 8 });
          for (const lx of [-0.3, 0.3]) R([0.06, 0.4, 0.06], [-w / 2 + 1 + lx, 0.18, -0.4], P.pole);
        } else if (kit === R_DOME) R([1.4, 0.7, 1.4], [-w / 2 + 1.1, 0.1, -0.3], P.ledge[lk]!, { shape: "cyl", sides: 10, top: 0.35 });
        else if (kit === R_BOARD) {
          R([0.08, 0.7, 0.08], [-w / 2 + 0.6, 0.2, 0.6], P.pole), R([0.08, 0.7, 0.08], [-w / 2 + 2.2, 0.2, 0.6], P.pole);
          R([2.0, 0.9, 0.08], [-w / 2 + 1.4, 0.85, 0.65], P.night ? P.awning[(b + 1) % 5]! : shade(P.awning[(b + 1) % 5]!, 1.1), { emissive: P.night });
          R([1.4, 0.12, 0.1], [-w / 2 + 1.4, 1.0, 0.7], P.paper, { emissive: P.night });
        }
        R([0.7, 0.35, 0.5], [0.6, 0.2, 0.5], P.ledge[lk]!);
      }
      const rb = dio.add({ id: id + "x", shape: "group", size: [w, 0, DEPTH], pos: [x0 + w / 2, 0, -DEPTH / 2], cluster: cl, pick: false, alpha: 0 });
      for (let k = 0; k < 13; k++) {
        const s = 0.6 + ((k * 37) % 5) * 0.17, u = (k * 0.618) % 1, v = (k * 0.414) % 1, hgt = k < 6 ? 0 : k < 10 ? 0.35 : 0.7;
        const col = k % 3 === 0 ? P.walls[lk]! : k % 3 === 1 ? P.ledge[lk]! : P.rubble[k % 3]!;
        dio.add({ shape: k % 4 === 1 ? "wedge" : "box", size: [s * 1.5, s * 0.5, s * 0.9], pos: [-w / 2 + 0.6 + u * (w - 1.2), hgt, -1 + v * 2], rot: [0, k * 0.9, ((k % 3) - 1) * 0.22], on: id + "x", color: col, pick: false });
      }
      rubble.push(rb);
      dio.decal(cl, 6.5, paintScars(b));
      dio.decal(cl, 7.5, paintHoles(b));
      SCAR[b] = shade(P.walls[lk]!, P.night ? 0.42 : 0.55);
      DENT[b] = shade(P.walls[lk]!, P.night ? 0.75 : 0.84);
      folk.push(dio.points({ cap: w * f, cluster: cl, layer: 7.6, paint: paintFolk }));
    }
    // The live parts: power boxes (a hazard stripe) and neon signs (a bolt) over their windows.
    for (let b = 0; b < nb; b++) {
      const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
      for (let fl = 0; fl < f; fl++) for (let col = 0; col < w; col++) {
        const i = C0[b]! + fl * w + col, kind = run.LIVE[i]!;
        if (!kind) continue;
        const fid = "bg" + b + "f" + fl, neon = kind === 2;
        const box = dio.add({ size: neon ? [0.82, 0.62, 0.12] : [0.62, 0.66, 0.2], pos: [col - w / 2 + 0.5, -0.82, DEPTH / 2 + 0.02], on: fid, color: neon ? P.neon : P.box, emissive: neon, pick: false, layer: 7.2 });
        if (!neon) dio.add({ size: [0.64, 0.12, 0.04], pos: [0, 0.42, 0.11], on: fid, color: P.hazard, emissive: true, pick: false, layer: 7.3 }), (box.pos[1] = -0.85);
        lives.push(box);
        liveCell.push(i);
      }
    }
    dio.decal("ground", 9.8, paintLive);
    // The monsters: the hero (dressed), the rivals.
    PI.ink = P.ink; PI.paper = P.paper; PI.skin = P.skin; PI.hole = P.hole; PI.slab = light() ? "#b9b2c4" : "#5d5874"; PI.rebar = light() ? "#7a4a3a" : "#c9a07a"; PI.glow = P.fire; PI.uniform = P.soldier; PI.helmet = P.helmet; PI.metal = P.metal; PI.tie = P.antenna; PI.shirts = P.people;
    INK.ink = P.ink; INK.eye = P.eye; INK.pupil = P.pupil; INK.teeth = P.teeth; INK.night = P.night; INK.metal = P.metal;
    for (let k = 0; k < NM; k++) mons.push(buildMonster(dio, k, look, INK, "mon" + k));
    // The helicopters.
    for (let h = 0; h < NH; h++) {
      const hid = "heli" + h;
      helis.push(dio.add({ id: hid, shape: "group", size: [2, 0, 1], pos: [0, -20, 2.6], pick: false }));
      const hp = (size: number[], pos: number[], color: string, o: { shape?: "box" | "cyl" | "wedge"; emissive?: boolean; on?: string } = {}) =>
        dio.add({ shape: o.shape || "box", size, pos, color, on: o.on || hid, emissive: o.emissive, pick: false });
      hp([1.3, 0.75, 0.8], [0, 0, 0], h ? shade(P.heli, 0.8) : P.heli);
      hp([0.6, 0.5, 0.7], [0.55, 0.12, 0], P.glass, { emissive: P.night });
      hp([1.5, 0.22, 0.22], [-1.25, 0.38, 0], P.heli2);
      hp([0.4, 0.55, 0.08], [-1.95, 0.4, 0], P.heli2, { shape: "wedge" });
      for (const z of [-0.36, 0.36]) hp([1.4, 0.06, 0.06], [0, -0.32, z], P.rotor), hp([0.06, 0.3, 0.06], [0.3, -0.3, z], P.rotor), hp([0.06, 0.3, 0.06], [-0.3, -0.3, z], P.rotor);
      hp([0.12, 0.2, 0.12], [0, 0.75, 0], P.rotor, { shape: "cyl" });
      rotors.push(dio.add({ id: hid + "r", shape: "group", size: [0.2, 0, 0.2], pos: [0, 0.95, 0], on: hid, pick: false }));
      hp([3.0, 0.05, 0.22], [0, 0, 0], P.rotor, { on: hid + "r" });
      hp([0.22, 0.05, 3.0], [0, 0, 0], P.rotor, { on: hid + "r" });
      tailRotors.push(dio.add({ id: hid + "t", shape: "group", size: [0.1, 0, 0.1], pos: [-1.95, 0.75, 0.08], on: hid, pick: false }));
      hp([0.06, 0.9, 0.12], [0, -0.45, 0], P.rotor, { on: hid + "t" });
      hp([0.16, 0.06, 0.1], [0, -0.03, 0.4], P.antenna, { on: hid, emissive: true });
    }
    // The tank (on the harbour: the gunboat): a hull, a turret and its gun.
    tank = dio.add({ id: "tank", shape: "group", size: [2.6, 0, 1.4], pos: [0, 0, 4], pick: false });
    const tp = (size: number[], pos: number[], color: string, on = "tank", shape: "box" | "cyl" | "wedge" = "box", rot?: number[], emissive = false) => dio.add({ shape, size, pos, rot, color, on, emissive, pick: false });
    if (feat === HARBOUR) {
      tp([3.0, 0.5, 1.3], [0, -0.25, 0], P.army2);
      tp([0.9, 0.5, 1.3], [1.9, -0.25, 0], P.army2, "tank", "wedge", [0, 0, -Math.PI / 2]);
      tp([1.4, 0.55, 0.9], [-0.5, 0.25, 0], P.army);
      tp([0.08, 1.0, 0.08], [-0.6, 0.8, 0], P.pole);
      tp([0.2, 0.1, 0.4], [-0.6, 1.8, 0], P.antenna, "tank", "box", undefined, true);
    } else {
      for (const z of [-0.55, 0.55]) tp([2.6, 0.45, 0.36], [0, 0, z], P.army2);
      tp([2.2, 0.45, 1.2], [0, 0.35, 0], P.army);
    }
    turret = dio.add({ id: "tur", shape: "group", size: [1, 0, 1], pos: [0, 0.8, 0], on: "tank", pick: false });
    tp([1.1, 0.45, 0.9], [-0.1, 0, 0], P.army, "tur");
    tp([1.2, 0.14, 0.14], [0.95, 0.18, 0], P.army2, "tur");
    tp([0.1, 0.08, 0.3], [0.2, 0.46, 0], P.antenna, "tur");
    // The train (the rail yard): an engine and three wagons in one group.
    if (feat === RAIL) {
      train = dio.add({ id: "train", shape: "group", size: [9, 0, 1.2], pos: [0, 0, STREET0 + 1.6], pick: false, alpha: 0 });
      const t = (s: number[], p: number[], col: string, e = false) => dio.add({ size: s, pos: p, color: col, on: "train", emissive: e, pick: false });
      t([2.4, 1.3, 1.2], [0, 0.15, 0], P.train);
      t([0.9, 0.6, 1.25], [-0.5, 1.45, 0], P.train2);
      t([0.3, 0.25, 0.9], [1.25, 0.9, 0], P.lamp, true);
      for (let k = 0; k < 3; k++) t([2.0, 1.1, 1.15], [-2.3 - k * 2.2, 0.15, 0], k & 1 ? P.train2 : shade(P.train, 0.8)), t([2.0, 0.12, 1.2], [-2.3 - k * 2.2, 1.25, 0], P.rail);
    }
    if (feat === BRIDGE) for (let t = 0; t < NT; t++) {
      const id = "truck" + t;
      trucks.push(dio.add({ id, shape: "group", size: [2.4, 0, 1.1], pos: [0, 0, 4], pick: false, alpha: 0 }));
      dio.add({ size: [1.7, 1.1, 1.05], pos: [-0.35, 0.15, 0], color: t ? P.truck2 : P.truck, on: id, pick: false });
      dio.add({ size: [0.7, 0.75, 1.0], pos: [0.85, 0.15, 0], color: P.army2, on: id, pick: false });
      dio.add({ size: [0.1, 0.3, 0.8], pos: [1.22, 0.55, 0], color: P.glass, on: id, emissive: P.night, pick: false });
    }
    // The street's little people, the shots, the parachutes, a knocked-out monster running, the wreckage.
    soldiers = dio.points({ cap: NS, paint: paintSoldier });
    chutes = dio.points({ cap: NCH, paint: paintChute });
    runners = dio.points({ cap: NM, paint: paintRunner });
    pebbles = dio.points({ cap: NP, paint: paintPebble });
    bits = dio.points({ cap: BITS, paint: paintBit });
    nBits = stopF = 0;
    nudge = 0;
    LEAN.fill(0);
    FLASH[3] = 0;
    W = wreckage(dio, { dust: P.dust, smoke: P.smoke, chunk: P.rubble[1]!, shard: P.shard, spark: P.spark });
    sky = null;
    hudDirty = true;
    pose(0);
  }
  /** The landmark's crown on its roof. */
  function crown(cty: City, R: (s: number[], p: number[], col: string, o?: { shape?: "box" | "cyl" | "wedge" | "prism"; sides?: number; top?: number; emissive?: boolean; rot?: number[] }) => DioramaObject, w: number, f: number) {
    const m = P.walls[5]!, acc = P.awning[(cty.crown + 1) % 5]!, k = cty.crown;
    void f;
    if (k === C_LIGHT) {
      R([w * 0.62, 1.1, 1.6], [0, 0.1, 0], m, { shape: "cyl", sides: 10 });
      R([w * 0.55, 0.12, 1.5], [0, 1.2, 0], P.ink, { shape: "cyl", sides: 10 });
      R([w * 0.42, 0.75, 1.2], [0, 1.3, 0], P.lamp, { shape: "cyl", sides: 10, emissive: true });
      R([w * 0.5, 0.7, 1.4], [0, 2.05, 0], P.antenna, { shape: "cyl", sides: 10, top: 0 });
      beam = R([5.5, 0.08, 0.3], [2.6, 1.7, 0], P.lamp, { emissive: true });
      beam.alpha = 0.55;
    } else if (k === C_CLOCK) {
      R([w * 0.7, 1.6, 1.8], [0, 0.1, 0], m);
      R([1.2, 1.2, 0.06], [0, 0.3, 0.92], P.paper, { emissive: P.night });
      R([0.08, 0.5, 0.04], [0, 0.9, 0.97], P.ink), R([0.4, 0.07, 0.04], [0.16, 0.9, 0.97], P.ink);
      R([w * 0.8, 1.3, 2.0], [0, 1.7, 0], P.roof, { shape: "cyl", sides: 4, top: 0, rot: [0, Math.PI / 4, 0] });
    } else if (k === C_BOWL) {
      R([w + 0.6, 0.6, DEPTH + 0.6], [0, 0.1, 0], m, { shape: "cyl", sides: 14, top: 1.12 });
      R([w + 0.9, 0.1, DEPTH + 0.9], [0, 0.7, 0], acc, { shape: "cyl", sides: 14 });
      for (const s of [-1, 1]) R([0.12, 2.6, 0.12], [s * (w / 2 + 0.2), 0.3, 0.8], P.pole), R([0.9, 0.45, 0.2], [s * (w / 2 + 0.2), 2.9, 0.85], P.lamp, { emissive: true });
    } else if (k === C_COOL) {
      R([w * 0.8, 2.2, 2.4], [0, 0.1, -0.2], m, { shape: "cyl", sides: 14, top: 0.72 });
      R([w * 0.6, 0.9, 1.75], [0, 2.3, -0.2], m, { shape: "cyl", sides: 14, top: 1.2 });
      R([w * 0.62, 0.08, 1.8], [0, 1.4, -0.2], acc, { shape: "cyl", sides: 14, emissive: P.night });
      steam = 1;
    } else if (k === C_PYLON) {
      for (const s of [-1, 1]) R([0.4, 4.2, 0.4], [s * (w / 2 - 0.5), 0.1, 0.4], m, { rot: [0, 0, -s * 0.08] });
      R([w - 0.4, 0.35, 0.5], [0, 2.4, 0.4], m), R([w - 0.6, 0.3, 0.5], [0, 4.0, 0.4], m);
      for (const s of [-1, 1]) R([0.2, 0.2, 0.2], [s * (w / 2 - 0.5), 4.4, 0.4], P.antenna, { shape: "cyl", sides: 6, emissive: true });
    } else if (k === C_ARCADE) {
      R([w + 0.3, 1.5, 0.2], [0, 0.2, 1.3], P.ink);
      R([w, 1.25, 0.12], [0, 0.32, 1.42], acc, { emissive: true });
      for (let i = 0; i < 4; i++) R([0.5, 0.5, 0.1], [-w / 2 + 0.7 + i * ((w - 1.4) / 3), 0.7, 1.5], i & 1 ? P.paper : P.zap, { shape: "cyl", sides: 5, emissive: true });
      R([w * 0.5, 0.9, 1.4], [0, 0.1, -0.4], m, { shape: "cyl", sides: 8, top: 0.4 });
    } else if (k === C_SPIRE) {
      R([w * 0.7, 1.4, 2.0], [0, 0.1, 0], m, { shape: "cyl", sides: 8, top: 0.75 });
      R([w * 0.45, 2.4, 1.3], [0, 1.5, 0], m, { shape: "cyl", sides: 8, top: 0.4 });
      R([0.16, 2.2, 0.16], [0, 3.9, 0], P.pole);
      R([0.3, 0.3, 0.3], [0, 6.1, 0], P.antenna, { shape: "cyl", sides: 6, emissive: true });
      R([w * 0.75, 0.1, 2.1], [0, 1.45, 0], acc, { shape: "cyl", sides: 8, emissive: true });
    }
  }

  // The damage each hit shows (the daily's, #124): the scar colours per building, its lean (wanted, now), the
  // rubble bits ([x, y, z, vx, vy, vz, spin, look, landed] each, a ring), the punch flash ([x, y, z, time]),
  // the hit-stop (frames; on one screen only: online the run never waits) and the camera's nudge (px).
  const SCAR: string[] = [], DENT: string[] = [];
  const LEAN = new Float64Array(16 * 2), BIT = new Float64Array(BITS * 9), FLASH = new Float64Array(4);
  let nBits = 0, stopF = 0, nudge = 0;

  // ---- state ----
  const INP = new Float64Array(SEATS * NI), I1 = new Float64Array(NI), OWN = new Float64Array(10).fill(-1, 0, 1), tmp = new Float64Array(3), tmp2 = new Float64Array(3), TQ = new Float64Array(4), DASH = [3, 4], NODASH: number[] = [];
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] base oy, [5] drawn once, [6] gamepads on, [7] tall, [8] half width shown, [9] base ty.
  const V = new Float64Array(10);
  V[0] = V[1] = 1;
  let auto = !!so.attract, dirty = true, hudDirty = true, shake = 0, toastT = 0, endT = -1, flash = 0, lastDt = 1 / 60, cardUp = -1;
  /** Seats in: which seats a player holds on this screen (bit per seat). */
  let seatsIn = 1;
  for (let k = 1; k < NM; k++) if (drivers[k] !== undefined && drivers[k] !== AI) seatsIn |= 1 << drivers[k]!;
  const was = new Float64Array(24).fill(-1);
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  addEventListener("gamepadconnected", () => ((V[6] = 1), engine.wake()), sig);

  // One camera per stage shape: side-on, a little above the street; the city's whole height (its tallest
  // building and its crown, the street in front) always fits the stage under the
  // HUD, on every viewport; the camera only pans left and right; a resize changes the field of view only.
  function frame() {
    const Wd = dio.width, H = dio.height, tall = Wd / H < 1.25, cam = dio.cam, cty = CITIES[S[16]!]!, BLD = run.BLD;
    V[7] = tall ? 1 : 0;
    cam.yaw = 0;
    cam.pitch = tall ? 0.16 : 0.22;
    cam.dist = 30;
    cam.tz = cty.feature === HARBOUR ? 1.5 : 0.2;
    cam.ox = 0;
    cam.oy = 0;
    // The tallest thing: a building's roof (the landmark's crown on top).
    let hi = 0;
    for (let b = 0; b < run.nb(); b++) hi = Math.max(hi, BLD[b * 4 + 2]! + (b === cty.landmark ? (cty.crown === C_SPIRE ? 4.4 : 2.6) : 0.8));
    const yTop = hi + 0.3, yBot = -0.2, top = V[3]! + 4, bot = H - 4;
    // Wide: about 25 units across, unless that crops the height; tall: as much width as the height leaves
    // (the hero a quarter of the stage or more wherever the height allows; the full height wins).
    V[9] = (yTop + yBot) / 2;
    cam.tx = camWant(0);
    cam.ty = V[9]!;
    let hv = tall ? (yTop - yBot) / 2 : 12.5 * (H / Wd);
    for (let it = 0; it < 6; it++) {
      cam.fov = 2 * Math.atan(hv / cam.dist);
      dio.project(cam.tx, yTop, -DEPTH, tmp);
      dio.project(cam.tx, yBot, STREET1, tmp2);
      const span = tmp2[1]! - tmp[1]!, room = bot - top;
      if (!tall && it === 0 && span <= room) break;
      hv *= span / room;
    }
    cam.fov = 2 * Math.atan(hv / cam.dist);
    dio.project(cam.tx, yTop, -DEPTH, tmp);
    dio.project(cam.tx, yBot, STREET1, tmp2);
    // Centre the city's height in the room under the HUD.
    cam.oy = V[4] = (top + bot) / 2 - (tmp[1]! + tmp2[1]!) / 2;
    V[8] = Math.tan(cam.fov / 2) * cam.dist * (Wd / H);
  }
  /** The monster the camera follows: this screen's online, else the players' middle, else the hero. */
  function focus(axis: number) {
    if (net) return MV[net.seat]![axis]!;
    let s = 0, n = 0;
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[28] !== AI && O[24] === IN && !O[29]) (s += O[axis]!), n++;
    }
    return n ? s / n : MV[0]![axis]!;
  }
  function camWant(axis: number) {
    if (axis === 0) {
      const lim = Math.max(0, run.SX + 1.5 - V[8]!);
      return Math.max(-lim, Math.min(lim, focus(0)));
    }
    return V[9]!;
  }
  function stepCam(dt: number) {
    const cam = dio.cam, d = camWant(0) - cam.tx, e = camWant(1) - cam.ty;
    let moving = false;
    if (Math.abs(d) > 0.005) (cam.tx += d * Math.min(1, dt * 3)), (moving = true);
    if (Math.abs(e) > 0.005) (cam.ty += e * Math.min(1, dt * 2)), (moving = true);
    return moving;
  }

  function pose(dt: number) {
    const B = run.B, BLD = run.BLD, C0 = run.C0;
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!, m = mons[k]!, inPlay = O[24] === IN, small = O[29] && O[1]! <= 0.01;
      m.root.alpha = inPlay && !small ? 1 : 0;
      if (inPlay) m.pose(O, engine.time + k * 1.7, dt);
      runners.a[k] = inPlay && small ? 1 : 0;
      runners.x[k] = O[0]!; runners.y[k] = 0.35; runners.z[k] = O[2]!; runners.r[k] = 0.5;
    }
    runners.n = NM;
    for (let b = 0; b < run.nb(); b++) {
      const st = B[b * 6]!, rem = B[b * 6 + 3]!, g = groups[b]!, fs = floors[b]!, sh = B[b * 6 + 5]!;
      g.pos[1] = run.yOff(b);
      g.pos[0] = BLD[b * 4]! + BLD[b * 4 + 1]! / 2 + (sh ? Math.sin(engine.time * 47 + b) * 0.07 * sh * calm : 0);
      g.rot[2] = LEAN[b * 2 + 1]! * (st === RUBBLE ? 0 : 1) + (sh ? Math.sin(engine.time * 31 + b * 2) * 0.014 * sh * calm : 0);
      for (let fl = 0; fl < fs.length; fl++) fs[fl]!.alpha = fl < rem ? 0 : 1;
      roofs[b]!.alpha = st === RUBBLE ? 0 : 1;
      const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
      for (let fl = 0; fl < f; fl++) for (let col = 0; col < w; col++) {
        const i = C0[b]! + fl * w + col, cs = run.cell[i]!, o = wins[i]!;
        const want = cs === INTACT ? ((fl + col * 3 + b) % 5 === 1 ? P.win2 : P.win) : cs === CRACKED ? P.crack : P.hole;
        if (o.color !== want) (o.color = want), (o.emissive = P.night && cs !== HOLE);
      }
      rubble[b]!.alpha = st === RUBBLE ? 1 : 0;
      const pts = folk[b]!;
      pts.n = w * f;
      const yo = run.yOff(b);
      for (let k = 0; k < w * f; k++) {
        const i = C0[b]! + k, fl = (k / w) | 0, col = k - fl * w;
        pts.a[k] = run.occ[i] && fl >= rem && st !== RUBBLE ? 1 : 0;
        pts.x[k] = g.pos[0]! - w / 2 + col + 0.5;
        pts.y[k] = yo + fl + (fl === 0 ? 0.25 : 0.3);
        pts.z[k] = 0.04;
        pts.r[k] = 0.32;
      }
    }
    const surge = run.FE[9]! > 0;
    for (let k = 0; k < lives.length; k++) {
      const i = liveCell[k]!, b = run.bk.bOf(i), fl = ((i - C0[b]!) / BLD[b * 4 + 1]!) | 0;
      lives[k]!.alpha = B[b * 6]! >= FALL && B[b * 6 + 3]! > fl ? 0 : 1;
      if (run.LIVE[i] === 2 || surge) lives[k]!.color = ((engine.time * (surge ? 14 : 5) + k) | 0) % (surge ? 2 : 5) ? (run.LIVE[i] === 2 ? P.neon : P.box) : P.paper;
    }
    if (beam) (beam.rot[1] = engine.time * 0.9 * calm), (beam.alpha = P.night ? 0.55 : 0.3);
    // The helicopters, the tank, the train, the trucks.
    const HE = run.HE, TK = run.TK, FE = run.FE, TR = run.TR, M0 = MV[0]!;
    for (let h = 0; h < NH; h++) {
      const o = h * 12, he = HE[o]!, heli = helis[h]!;
      heli.hidden = he === 0;
      heli.pos[0] = HE[o + 1]!; heli.pos[1] = he ? HE[o + 2]! : -20; heli.pos[2] = HE[o + 3]!;
      heli.rot[1] = he === 2 ? HE[o + 9]! : HE[o + 1]! < M0[0]! ? 0.25 : Math.PI - 0.25;
      heli.rot[2] = he === 2 ? 0.5 : HE[o + 1]! < M0[0]! ? -HE[o + 11]! - 0.08 : HE[o + 11]! - 0.08;
      heli.tint = he === 2 ? P.wreck : null;
      rotors[h]!.rot[1] = engine.time * (he === 2 ? 9 : 26);
      tailRotors[h]!.rot[2] = engine.time * 30;
    }
    const boat = CITIES[S[16]!]!.feature === HARBOUR;
    tank.alpha = TK[0] ? 1 : 0;
    tank.pos[0] = TK[1]!; tank.pos[2] = TK[7]! || 4;
    tank.pos[1] = boat ? Math.sin(engine.time * 2.2) * 0.06 * calm : 0;
    tank.rot[1] = TK[2]! > 0 ? 0 : Math.PI;
    tank.rot[2] = boat ? Math.sin(engine.time * 1.7) * 0.03 * calm : 0;
    tank.tint = TK[0] === 2 ? P.wreck : TK[10]! > 0.15 ? P.paper : null;
    turret.pos[0] = -TK[6]! * 0.25;
    turret.rot[2] = TK[0] === 2 ? 0.35 : 0.05;
    if (train) {
      train.alpha = FE[0] === 2 || FE[0] === 3 ? 1 : 0;
      train.pos[0] = FE[1]! - FE[2]! * 1.2;
      train.rot[1] = FE[2]! > 0 ? 0 : Math.PI;
      train.rot[2] = FE[0] === 3 ? 0.4 : 0;
      train.pos[1] = FE[0] === 3 ? 0.4 : 0;
      train.tint = FE[0] === 3 ? P.wreck : null;
      const on = (FE[0] === 1 || FE[0] === 2) && ((engine.time * 4) | 0) & 1;
      for (let k = 0; k < xing.length; k++) xing[k]!.color = on ? (k & 1 ? P.paper : P.antenna) : k & 1 ? P.antenna : P.paper;
    }
    for (let t = 0; t < trucks.length; t++) {
      const o = t * 6, tr = trucks[t]!;
      tr.alpha = TR[o] ? 1 : 0;
      tr.pos[0] = TR[o + 1]!; tr.pos[2] = TR[o + 4]!;
      tr.rot[1] = TR[o + 2]! > 0 ? 0 : Math.PI;
      tr.rot[2] = TR[o] === 2 ? 0.3 : 0;
      tr.tint = TR[o] === 2 ? P.wreck : null;
    }
    soldiers.n = NS;
    for (let s = 0; s < NS; s++) {
      const o = s * 8;
      soldiers.a[s] = run.SO[o]! > 0 ? 1 : 0;
      soldiers.x[s] = run.SO[o + 1]!; soldiers.y[s] = 0.32; soldiers.z[s] = run.SO[o + 2]!; soldiers.r[s] = 0.34;
    }
    pebbles.n = NP;
    for (let k = 0; k < NP; k++) {
      const o = k * 8;
      pebbles.a[k] = run.PB[o]! > 0 ? 1 : 0;
      pebbles.x[k] = run.PB[o + 1]!; pebbles.y[k] = run.PB[o + 2]!; pebbles.z[k] = run.PB[o + 3]!; pebbles.r[k] = run.PB[o + 7] === 2 ? 0.2 : run.PB[o + 7] ? 0.13 : 0.1;
    }
    bits.n = Math.min(nBits, BITS);
    for (let k = 0; k < bits.n; k++) {
      const o = k * 9;
      bits.x[k] = BIT[o]!; bits.y[k] = BIT[o + 1]!; bits.z[k] = BIT[o + 2]!; bits.r[k] = 0.17; bits.a[k] = 1;
    }
    chutes.n = NCH;
    for (let k = 0; k < NCH; k++) {
      const o = k * 9;
      chutes.a[k] = run.CH[o]! > 0 ? 1 : 0;
      chutes.x[k] = run.CH[o + 1]!; chutes.y[k] = run.CH[o + 2]! + 0.3; chutes.z[k] = run.CH[o + 3]!; chutes.r[k] = 0.3;
    }
  }

  // ---- FX ----
  /** n bits of building b's facade knocked off at (x, y): they fly out, fall and stay on the street. */
  function chipOff(x: number, y: number, n: number, b: number) {
    for (let k = 0; k < n; k++) {
      const o = (nBits++ % BITS) * 9;
      BIT[o] = x + (rnd() - 0.5) * 0.8; BIT[o + 1] = y + (rnd() - 0.5) * 0.6; BIT[o + 2] = 0.15;
      BIT[o + 3] = (rnd() - 0.5) * 3; BIT[o + 4] = 0.5 + rnd() * 2.5; BIT[o + 5] = 0.8 + rnd() * 2.2;
      BIT[o + 6] = rnd() * 6; BIT[o + 7] = run.BLD[b * 4 + 3]!; BIT[o + 8] = 0;
    }
  }
  /** Building b after a hit: it leans towards its damaged side and sags a little; live parts beside the hit spark. */
  function hurtBuilding(b: number, i: number) {
    const BLD = run.BLD, C0 = run.C0, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
    let sum = 0, all = 0;
    for (let k = C0[b]!; k < C0[b + 1]!; k++) {
      const h = run.HIT[k]!;
      if (!h) continue;
      sum += h * (((k - C0[b]!) % w) - (w - 1) / 2);
      all += h;
    }
    LEAN[b * 2] = Math.max(-0.07, Math.min(0.07, (-sum / (run.bk.NEED[b]! * 6)) * 0.07)) - Math.min(0.02, all * 0.0006);
    const r = i - C0[b]!, fl = (r / w) | 0, col = r - fl * w;
    for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) {
      const f2 = fl + df, c2 = col + dc;
      if (f2 < 0 || f2 >= f || c2 < 0 || c2 >= w || !run.LIVE[C0[b]! + f2 * w + c2]) continue;
      const x = BLD[b * 4]! + c2 + 0.5, y = run.yOff(b) + f2 + 0.5;
      for (let n = 0; n < 10; n++) W.spark.puff(x, y, 0.2, (rnd() - 0.5) * 6, (rnd() - 0.3) * 5, 1 + rnd() * 2, 0.4, 0.05, 1);
    }
  }
  /** A hit by monster k: the punch flash at the window; for this screen's own, the hit-stop and the camera's nudge into the wall. */
  function heavy(x: number, y: number, size: number, k: number) {
    FLASH[0] = x; FLASH[1] = y; FLASH[2] = 0.3; FLASH[3] = 0.1 * size * calm;
    if (!mine(k)) return;
    if (!net && calm) stopF = 3;
    const O = MV[k]!;
    nudge = (O[5] === CLIMB ? O[6]! : 1) * 7 * size * calm;
  }
  function stepFx(dt: number) {
    let any = W.step(dt);
    const HE = run.HE, B = run.B, BLD = run.BLD;
    for (let h = 0; h < NH; h++)
      if (HE[h * 12] === 2 && rnd() < dt * 40) W.smoke.puff(HE[h * 12 + 1]!, HE[h * 12 + 2]!, HE[h * 12 + 3]!, rnd() - 0.5, 1 + rnd(), rnd() - 0.5, 0.9, 0.22, 0.6), W.spark.puff(HE[h * 12 + 1]!, HE[h * 12 + 2]!, HE[h * 12 + 3]!, (rnd() - 0.5) * 3, rnd() * 2, 0, 0.3, 0.06, 1);
    if (run.TK[0] === 2 && rnd() < dt * 18) W.smoke.puff(run.TK[1]! + (rnd() - 0.5), 1, run.TK[7]!, rnd() - 0.5, 1.2 + rnd(), 0, 1.4, 0.3, 0.5);
    if (run.FE[0] === 3 && rnd() < dt * 18) W.smoke.puff(run.FE[1]! + (rnd() - 0.5) * 4, 1.2, run.FE[4]!, rnd() - 0.5, 1.2 + rnd(), 0, 1.4, 0.3, 0.5);
    for (let b = 0; b < run.nb(); b++) {
      const st = B[b * 6]!;
      if ((st === SHAKE && rnd() < dt * 14) || (st === FALL && rnd() < dt * 40)) {
        const x = BLD[b * 4]! + rnd() * BLD[b * 4 + 1]!;
        W.dust.puff(x, 0.2, 0.3 + rnd() * 0.6, (rnd() - 0.5) * 2, 0.6 + rnd() * 1.2, 0.6 + rnd(), 1.4, 0.45, 0.55);
        if (st === FALL && rnd() < 0.4) W.chunk.puff(x, run.top(b) - 0.2, 0.2, (rnd() - 0.5) * 3, 2 + rnd() * 2, 1 + rnd(), 1, 0.15, 1);
      }
    }
    // Bits and dust fall from the edges of the holes.
    if (S[0] === RUN && calm) for (let b = 0; b < run.nb(); b++) {
      const nh = B[b * 6 + 1]!;
      if (!nh || B[b * 6]! >= FALL || rnd() > dt * Math.min(8, nh) * 0.9) continue;
      const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, fl = (rnd() * f) | 0, col = (rnd() * w) | 0;
      if (!holeAt(b, col, fl)) continue;
      const x = BLD[b * 4]! + col + 0.2 + rnd() * 0.6, y = run.yOff(b) + fl + 0.1;
      W.chunk.P.colorAll = P.walls[BLD[b * 4 + 3]!]!;
      W.chunk.puff(x, y, 0.15, (rnd() - 0.5) * 0.6, -0.2, 0.3 + rnd() * 0.4, 1.2, 0.06 + rnd() * 0.06, 1);
      W.dust.puff(x, y, 0.2, (rnd() - 0.5) * 0.3, -0.3, 0.2, 1.1, 0.16, 0.45);
    }
    // Live parts spark now and then (the warning); the cooling tower steams.
    if (S[0] === RUN && liveCell.length && rnd() < dt * (run.FE[9]! > 0 ? 40 : 9)) {
      const i = liveCell[(rnd() * liveCell.length) | 0]!, b = run.bk.bOf(i), w = BLD[b * 4 + 1]!, fl = ((i - run.C0[b]!) / w) | 0, col = i - run.C0[b]! - fl * w;
      if (B[b * 6] === 0 || B[b * 6 + 3]! <= fl) {
        const x = BLD[b * 4]! + col + 0.5, y = run.yOff(b) + fl + 0.5;
        for (let n = 0; n < 3; n++) W.spark.puff(x + (rnd() - 0.5) * 0.4, y + (rnd() - 0.2) * 0.4, 0.15, (rnd() - 0.5) * 3, rnd() * 2.5, 0.8, 0.25, 0.045, 1);
      }
    }
    if (steam && S[0] === RUN && calm && rnd() < dt * 6) {
      const b = CITIES[S[16]!]!.landmark;
      if (run.B[b * 6] === 0) W.smoke.puff(BLD[b * 4]! + BLD[b * 4 + 1]! / 2 + (rnd() - 0.5), run.top(b) + 3.3, -1.7, (rnd() - 0.5) * 0.4, 1.2, 0, 2.2, 0.5, 0.4);
    }
    // The rubble bits fall and stay; the buildings ease into their lean; the flash and the nudge fade.
    for (let k = 0; k < BITS; k++) {
      const o = k * 9;
      if (k >= nBits || BIT[o + 8]) continue;
      BIT[o + 4] = BIT[o + 4]! - 16 * dt;
      BIT[o] = BIT[o]! + BIT[o + 3]! * dt; BIT[o + 1] = BIT[o + 1]! + BIT[o + 4]! * dt; BIT[o + 2] = Math.min(STREET0 + 1.6, BIT[o + 2]! + BIT[o + 5]! * dt);
      BIT[o + 6] = BIT[o + 6]! + dt * 8;
      if (BIT[o + 1]! <= 0.07) (BIT[o + 1] = 0.07), (BIT[o + 8] = 1);
      any = true;
    }
    for (let b = 0; b < run.nb(); b++) {
      const e = LEAN[b * 2]! - LEAN[b * 2 + 1]!;
      if (Math.abs(e) > 1e-4) (LEAN[b * 2 + 1] = LEAN[b * 2 + 1]! + e * Math.min(1, dt * 6)), (any = true);
    }
    if (FLASH[3]! > 0) (FLASH[3] = Math.max(0, FLASH[3]! - dt)), (any = true);
    if (Math.abs(nudge) > 0.05) (nudge *= Math.exp(-dt * 14)), (any = true);
    else nudge = 0;
    if (fx.live || fx.shake > 0) any = true;
    fx.step(dt);
    if (flash > 0) (flash = Math.max(0, flash - dt)), (any = true);
    return any;
  }
  /** World (x, y, z) to the screen, into tmp; false off the camera. */
  const at = (x: number, y: number, z: number) => dio.project(x, y, z, tmp) && tmp[2]! > 0.5;
  const cellPos = (i: number) => {
    const b = run.bk.bOf(i), BLD = run.BLD, w = BLD[b * 4 + 1]!, r = i - run.C0[b]!, fl = (r / w) | 0;
    tmp2[0] = BLD[b * 4]! + (r - fl * w) + 0.5;
    tmp2[1] = run.yOff(b) + fl + 0.5;
    tmp2[2] = 0.2;
    return b;
  };
  /** Is monster k this screen's (a player here)? */
  const mine = (k: number) => (net ? k === net.seat : MV[k]![28] !== AI);

  // ---- events: stickers, sound, FX ----
  let wordK = 0;
  function events() {
    const BLD = run.BLD;
    for (let k = 0; k < run.n; k++) {
      const type = run.ev[k * 3]!, val = run.ev[k * 3 + 1]!, by = run.ev[k * 3 + 2]!;
      hudDirty = true;
      if (type === E_START) engine.events.emit("start"), toast(`SMASH ${CITIES[S[16]!]!.name}!`, "go"), say("Go: smash the city");
      else if (type === E_PUNCH) engine.events.emit("punch");
      else if (type === E_CHIP_ || type === E_CRACK_) {
        engine.events.emit("punch");
        const b = cellPos(val | 0), crack = type === E_CRACK_, x = tmp2[0]!, y = tmp2[1]!;
        for (let n = 0; n < (crack ? 12 : 8); n++) W.spark.puff(x, y, tmp2[2]!, (rnd() - 0.5) * 6, (rnd() - 0.2) * 5, 1 + rnd() * 2, 0.3, 0.05, 1);
        W.chunk.P.colorAll = P.walls[BLD[b * 4 + 3]!]!;
        for (let n = 0; n < (crack ? 7 : 4); n++) W.chunk.puff(x + (rnd() - 0.5) * 0.9, y + (rnd() - 0.5) * 0.7, 0.25, (rnd() - 0.5) * 4, 1 + rnd() * 2.5, 1 + rnd() * 2.5, 0.9, 0.1 + rnd() * 0.09, 1);
        for (let n = 0; n < (crack ? 9 : 4); n++) W.shard.puff(x, y, 0.25, (rnd() - 0.5) * 3.5, 0.5 + rnd() * 2, 1 + rnd() * 2, 0.8, 0.06, 1);
        for (let n = 0; n < 3; n++) W.dust.puff(x + (rnd() - 0.5) * 0.6, y + (rnd() - 0.5) * 0.5, 0.35, (rnd() - 0.5) * 0.8, 0.2 + rnd() * 0.5, 0.6, 0.7, 0.28, 0.5);
        chipOff(x, y, crack ? 3 : 2, b);
        if (crack && at(x, y, 0.3)) fx.word(tmp[0]!, tmp[1]! - 8, 1, 3, 14);
        shake = Math.max(shake, crack ? 0.16 : 0.1);
        hurtBuilding(b, val | 0);
        heavy(x, y, crack ? 1 : 0.8, by);
      } else if (type === E_HOLE) {
        engine.events.emit("hole");
        const b = cellPos(val | 0);
        W.burst(rnd, tmp2[0]!, tmp2[1]!, tmp2[2]!, 1.6, P.walls[BLD[b * 4 + 3]!]!);
        chipOff(tmp2[0]!, tmp2[1]!, 6, b);
        for (let n = 0; n < 5; n++) W.dust.puff(tmp2[0]! + (rnd() - 0.5), tmp2[1]! + (rnd() - 0.5) * 0.6, 0.4, (rnd() - 0.5) * 1.5, rnd(), 0.8, 1, 0.38, 0.55);
        if (at(tmp2[0]!, tmp2[1]!, 0.3)) fx.blast(tmp[0]!, tmp[1]!, 0.32, 1), fx.word(tmp[0]!, tmp[1]! - 10, W_CRUNCH + (wordK++ % 3), 1, 16);
        shake = Math.max(shake, 0.24);
        hurtBuilding(b, val | 0);
        heavy(tmp2[0]!, tmp2[1]!, 1.3, by);
      } else if (type === E_SHAKE) toast(`IT'S GOING!`, "meh"), say("The building shakes");
      else if (type === E_DROP) {
        if (at(BLD[val * 4]! + BLD[val * 4 + 1]! / 2, BLD[val * 4 + 2]! + 0.5, 0)) fx.word(tmp[0]!, tmp[1]!, W_TIMBER, 2, 24);
        say("Timber");
      } else if (type === E_FLOOR) {
        engine.events.emit("floor");
        const b = val | 0, x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!;
        for (let n = 0; n < 18; n++) W.dust.puff(x0 - 0.5 + rnd() * (w + 1), 0.3, -0.4 + rnd() * 1.8, (rnd() - 0.5) * 4, 0.5 + rnd() * 2, 0.8 + rnd() * 2, 1.5 + rnd() * 0.7, 0.55, 0.6);
        W.chunk.P.colorAll = P.walls[BLD[b * 4 + 3]!]!;
        for (let n = 0; n < 8; n++) W.chunk.puff(x0 + rnd() * w, 0.5, 0.3, (rnd() - 0.5) * 6, 2 + rnd() * 3, 1 + rnd() * 3, 1.1, 0.16 + rnd() * 0.1, 1);
        shake = Math.max(shake, 0.32);
        fx.kick(3 * calm);
      } else if (type === E_FLAT) {
        engine.events.emit("flat");
        const b = val | 0, x = BLD[b * 4]! + BLD[b * 4 + 1]! / 2, lm = b === CITIES[S[16]!]!.landmark;
        if (at(x, 0.4, 0.5)) fx.blast(tmp[0]!, tmp[1]!, 1, 1), fx.word(tmp[0]!, tmp[1]! - 44, W_FLAT, 4, 28);
        W.dust.ring(rnd, x, 0.3, 0.4, 30, 4.4, 1.6, 1.8, 0.65, 0.65);
        W.burst(rnd, x, 0.8, 0.4, 2, P.walls[BLD[b * 4 + 3]!]!);
        shake = 0.6;
        toast(lm ? `${CITIES[S[16]!]!.landmarkName} FALLS! +1500` : S[4] === run.nb() ? "THE WHOLE CITY!" : `${S[4]} OF ${run.nb()} FLAT`, "go");
      } else if (type === E_HELI) {
        engine.events.emit("heli");
        const o = (val | 0) * 12;
        if (at(run.HE[o + 1]!, run.HE[o + 2]!, run.HE[o + 3]!)) fx.word(tmp[0]!, tmp[1]! - 20, W_SWAT, 5, 22), fx.blast(tmp[0]!, tmp[1]!, 0.45, 4);
        W.burst(rnd, run.HE[o + 1]!, run.HE[o + 2]!, run.HE[o + 3]!, 1, P.heli);
        toast("SWATTED!", "clean");
        say("Helicopter swatted");
      } else if (type === E_HELI_CRASH || type === E_TANK || type === E_TRAIN || type === E_TRUCK) {
        engine.events.emit(type === E_HELI_CRASH ? "crash" : "tank");
        const z = type === E_TANK ? run.TK[7]! : type === E_TRAIN ? run.FE[4]! : type === E_TRUCK ? STREET0 + 3.5 : 2.6;
        if (at(val, 0.6, z)) fx.blast(tmp[0]!, tmp[1]!, 1.3, 2), fx.word(tmp[0]!, tmp[1]! - 40, type === E_TANK ? W_THOOM : type === E_TRAIN ? W_DERAIL : type === E_TRUCK ? W_WHAM : W_BLAM, 2, 26);
        W.dust.ring(rnd, val, 0.3, z, 18, 3.5, 1.8, 1.2, 0.45, 0.6);
        W.burst(rnd, val, 0.8, z, 3, type === E_TANK ? P.army : type === E_TRAIN ? P.train : type === E_TRUCK ? P.truck : P.heli);
        for (let n = 0; n < 10; n++) W.smoke.puff(val + (rnd() - 0.5) * 1.5, 0.6 + rnd(), z, (rnd() - 0.5) * 1.5, 1.5 + rnd() * 1.5, 0, 1.6, 0.4, 0.6);
        shake = 0.55;
        if (type === E_TANK) toast(CITIES[S[16]!]!.feature === HARBOUR ? "GUNBOAT SUNK!" : "TANK BUSTED!", "clean"), say("Tank busted");
        else if (type === E_TRAIN) toast("DERAILED! +400", "clean"), say("Train derailed");
        else if (type === E_TRUCK) toast("TRUCK STOPPED!", "clean");
      } else if (type === E_ARMOUR) {
        engine.events.emit("clang");
        if (at(val, 1, run.TK[7]!)) fx.word(tmp[0]!, tmp[1]! - 20, W_CLANG, 3, 16);
        for (let n = 0; n < 8; n++) W.spark.puff(val, 1, run.TK[7]!, (rnd() - 0.5) * 5, rnd() * 4, 0, 0.3, 0.05, 1);
      } else if (type === E_BELLS) engine.events.emit("bells"), toast("TRAIN COMING!", "bad"), say("A train is coming: off the street");
      else if (type === E_RAM) {
        const O = MV[by | 0]!;
        if (at(O[0]!, O[1]! + 2, O[2]!)) fx.word(tmp[0]!, tmp[1]! - 10, W_OOF, 3, 18);
        shake = Math.max(shake, 0.35);
        if (mine(by)) toast(val ? "RUN OVER!" : "HIT BY THE TRAIN!", "bad");
      } else if (type === E_SURGE) engine.events.emit("shock"), (flash = Math.max(flash, 0.12)), toast("POWER SURGE!", "bad"), say("A power surge: off the live walls");
      else if (type === E_NOM) {
        engine.events.emit("nom");
        mouth(S[15]!);
        if (at(tmp2[0]!, tmp2[1]!, tmp2[2]!)) fx.word(tmp[0]!, tmp[1]! - 16, W_NOM, 5, 20);
        if (mine(S[15]!)) toast("NOM! +HP", "clean"), say("Snack: health back");
        else toast(`${who(S[15]!)} ATE ONE!`, "meh");
      } else if (type === E_BURN) {
        engine.events.emit("burn");
        cellPos(val | 0);
        if (at(tmp2[0]!, tmp2[1]!, tmp2[2]!)) fx.word(tmp[0]!, tmp[1]! - 14, W_HOT, 2, 16);
        for (let n = 0; n < 6; n++) W.smoke.puff(tmp2[0]!, tmp2[1]!, 0.3, rnd() - 0.5, 1.4, 0.4, 0.7, 0.18, 0.6);
      } else if (type === E_HURT) {
        engine.events.emit("hurt");
        const O = MV[by | 0]!;
        if (rnd() < 0.25 && at(O[0]!, O[1]! + mons[by | 0]!.height + 0.3, O[2]!)) fx.word(tmp[0]!, tmp[1]!, W_OOF, 3, 14);
      } else if (type === E_SHOCK) {
        engine.events.emit("shock");
        flash = 0.25;
        shake = Math.max(shake, 0.3);
        const v = val | 0;
        if (v >= 0) cellPos(v);
        else (tmp2[0] = run.ANT[-1 - v]!), (tmp2[1] = run.top(-1 - v) + 1.6), (tmp2[2] = 0);
        for (let n = 0; n < 16; n++) W.spark.puff(tmp2[0]!, tmp2[1]!, 0.3, (rnd() - 0.5) * 8, (rnd() - 0.4) * 7, 1 + rnd() * 2, 0.4, 0.06, 1);
        if (at(tmp2[0]!, tmp2[1]!, 0.3)) fx.word(tmp[0]!, tmp[1]! - 18, W_ZAP, 1, 22);
        if (mine(by)) toast("ZAPPED! LIVE WIRE", "bad"), say("Shocked: a live part");
      } else if (type === E_BONK) {
        engine.events.emit("bonk");
        const O = MV[val | 0]!;
        if (at(O[0]!, O[1]! + 2.6, O[2]!)) fx.word(tmp[0]!, tmp[1]! - 10, W_BONK, 3, 18), fx.blast(tmp[0]!, tmp[1]!, 0.25, 3);
        if (mine(val)) toast("BONKED OFF THE WALL!", "bad");
      } else if (type === E_FLING || type === E_STOMP) {
        engine.events.emit("fling");
        const s = val | 0;
        if (at(run.SO[s * 8 + 1]!, 1, run.SO[s * 8 + 2]!)) fx.word(tmp[0]!, tmp[1]! - 12, type === E_STOMP ? W_STOMP : W_BOINK, 1, 15);
        if (type === E_STOMP) W.dust.ring(rnd, MV[by | 0]![0]!, 0.2, MV[by | 0]![2]!, 10, 2.4, 0.8, 0.7, 0.3, 0.55);
      } else if (type === E_KO) {
        engine.events.emit("ko");
        const O = MV[val | 0]!;
        W.smoke.ring(rnd, O[0]!, O[1]! + 1.5, O[2]!, 14, 2.5, 1, 0.9, 0.5, 0.7);
        if (at(O[0]!, O[1]! + 2, O[2]!)) fx.word(tmp[0]!, tmp[1]! - 20, W_POOF, 4, 22);
        toast(`${who(val)} SHRINKS!`, mine(val) ? "bad" : "go");
        say(`${who(val)} is out`);
      } else if (type === E_JOIN) engine.events.emit("join");
      else if (type === E_CITY) {
        engine.events.emit("city");
        const ct = CITIES[val | 0]!;
        toast(`${ct.name} · ${ct.featureName}`, "go");
        say(`${ct.name}. ${ct.featureText}`);
      } else if (type === E_CLEAR) engine.events.emit("clear"), so.on("clear", val);
      else if (type === E_END) engine.events.emit("end"), (endT = 1.1), engine.busy(1.2), so.on("end", val);
      else if (type === E_JUMP) engine.events.emit("jump");
      else if (type === E_CLIMB) engine.events.emit("climb");
      else if (type === E_LAND && MV[by | 0]![19]! > 0.5) {
        const O = MV[by | 0]!;
        W.dust.ring(rnd, O[0]!, O[1]! + 0.1, O[2]!, 8, 2, 0.6, 0.6, 0.28, 0.5);
        shake = Math.max(shake, 0.18);
      }
    }
    run.clear();
  }
  const who = (k: number) => monName(k, look);
  /** Monster k's mouth, in the world, into tmp2. */
  function mouth(k: number) {
    const O = MV[k]!;
    tmp2[0] = O[0]! + O[6]! * 0.9;
    tmp2[1] = O[1]! + mons[k]!.height - 0.5;
    tmp2[2] = O[2]! + 0.3;
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "cs-toast cs-" + kind;
    toastEl.hidden = false;
    toastT = 1.6;
  }
  let said = "";
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  const num = (n: number) => n.toLocaleString("en-US");
  function hudWrite() {
    const ci = S[16]!, cty = CITIES[ci]!;
    if (was[0] !== ci) (was[0] = ci), (cityEl.textContent = cty.name), (todEl.textContent = `${ci + 1}/${NCITY} · ${TOD[cty.tod]}`);
    if (was[1] !== S[2]) (was[1] = S[2]!), (teamEl.textContent = num(S[2]!));
    const fl = Math.round((S[8]! / Math.max(1, run.bk.L[2]!)) * 100);
    if (was[2] !== fl) (was[2] = fl), (flatEl.textContent = fl + "%");
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!, chip = monChips[k]!, d = O[28]!, shown = O[24] === IN || O[25]! > 0 || d !== AI, key = (shown ? 1 : 0) + d * 2 + Math.round(O[7]!) * 32 + O[25]! * 4096 + O[24]! * 7 + (O[29] ? 3 : 0);
      if (was[4 + k] === key) continue;
      was[4 + k] = key;
      chip.hidden = !shown;
      chip.classList.toggle("cs-p", d !== AI);
      chip.classList.toggle("cs-out", O[24] !== IN || !!O[29]);
      chip.style.setProperty("--seat", d !== AI ? SEAT_C[d]! : "transparent");
      (chip.children[0] as HTMLElement).textContent = d !== AI ? (net && d === net.seat ? "YOU" : "P" + (d + 1)) : O[24] === IN && !O[29] ? "CPU" : "OUT";
      (chip.children[1] as HTMLElement).textContent = who(k);
      (chip.querySelector("s") as HTMLElement).style.width = `${Math.round(O[7]!)}%`;
      chip.classList.toggle("cs-low", O[7]! <= 30);
      (chip.lastChild as HTMLElement).textContent = num(O[25]!);
    }
    const pk = S[28] ? S[29]! * 128 + S[30]! : -1;
    if (was[8] !== pk) {
      was[8] = pk;
      pracEl.hidden = pk < 0;
      if (pk >= 0) {
        pracEl.querySelectorAll("li").forEach((li, i) => li.classList.toggle("cs-done", (S[29]! & (1 << i)) > 0));
        pracEl.querySelectorAll("i").forEach((d, i) => d.classList.toggle("cs-done", (S[30]! & (1 << i)) > 0));
        if (S[29] === P_ALL) say("Practice done: every step ticked off");
      }
    }
    const ph = S[0]!;
    if (was[3] !== ph) {
      was[3] = ph;
      const touch = !!thePad.el.offsetParent;
      hintEl.textContent = ph === READY ? (touch ? "↑ at a wall grabs it · ✊ punches the window next to you · ✋ eat a snack · sparks bite" : "A/D walk · K jump at a wall to grab it · W/S climb · Space punch (hold W/S: up, down) · L eat · sparks bite · P2: arrows , . /") : "";
    }
    // The card between cities.
    if (ph === CLEAR && cardUp !== ci) {
      cardUp = ci;
      const next = CITIES[ci + 1] ?? CITIES[0]!;
      (ccard.children[0] as HTMLElement).textContent = `CITY ${ci + 1} OF ${NCITY}`;
      (ccard.children[1] as HTMLElement).textContent = `${cty.name} IS FLAT!`;
      (ccard.children[2] as HTMLElement).textContent = `${num(S[2]! - S[26]!)} pts here · +1,000 city bonus · ${num(S[2]!)} in all`;
      (ccard.children[3] as HTMLElement).textContent = ci + 1 < NCITY || so.attract ? `NEXT: ${next.name} · ${TOD[next.tod]} · ${next.featureName}: ${next.featureText}` : "That was the last city.";
      (ccard.children[4] as HTMLElement).textContent = so.unlocks?.(ci) ?? "";
      (ccard.children[5] as HTMLElement).textContent = "PUNCH TO GO ON";
      ccard.hidden = !!so.attract;
    } else if (ph !== CLEAR && !ccard.hidden) ccard.hidden = true, (cardUp = -1);
  }
  function showEnd() {
    const won = S[20] === 1, cty = CITIES[S[16]!]!;
    (endC.children[0] as HTMLElement).textContent = won ? "EVERY CITY FLAT!" : `SHRUNK IN ${cty.name}`;
    (endC.children[1] as HTMLElement).textContent = `${num(S[2]!)} pts together · ${S[18]} ${S[18] === 1 ? "city" : "cities"} flattened`;
    let html = "";
    const order = [0, 1, 2, 3].filter((k) => MV[k]![28] !== AI || MV[k]![25]! > 0).sort((a, b) => MV[b]![25]! - MV[a]![25]!);
    for (const k of order) {
      const O = MV[k]!, tag = O[28] !== AI ? "P" + (O[28]! + 1) : "CPU";
      html += `<li><i>${tag}</i><b>${who(k)}</b><span>${num(O[25]!)}</span><em>${O[27]} holes · ${O[26]} snacks · ${O[36]} flattened</em></li>`;
    }
    board.innerHTML = html;
    (endC.children[3] as HTMLElement).textContent = `${Math.round(S[19]!)} s · ${S[5]} helicopters · ${S[11]} tanks · ${S[12]} shocks`;
    retry.textContent = `TRY ${cty.name} AGAIN`;
    retry.hidden = won || !!net;
    again.hidden = !!net;
    endC.hidden = false;
    say(`${won ? "Every city flat" : "Run over"}. ${num(S[2]!)} points`);
    (net ? toMenu : again).focus({ preventScroll: true });
  }
  /** A new run from city `first` (the drivers stay). */
  function restart(first = 0) {
    run.reset(so.seed ?? 20261116, first, S[22]!, S[28]!);
    if (so.attract) S[27] = 1;
    endC.hidden = ccard.hidden = true;
    cardUp = -1;
    shake = toastT = flash = 0;
    endT = -1;
    toastEl.hidden = true;
    W.clear(), fx.clear();
    was.fill(-1);
    hudDirty = dirty = true;
    buildScene();
    frame();
    engine.busy(1);
    play.focus({ preventScroll: true });
  }
  /** Seat s takes monster s (a rival) on this screen, or gives it back to the AI. */
  function join(s: number, on: boolean) {
    if (s <= 0 || s >= NM) return;
    run.join(s, on ? s : AI);
    seatsIn = on ? seatsIn | (1 << s) : seatsIn & ~(1 << s);
    if (on) toast(`P${s + 1} IS ${RIVALS[s - 1]}!`, "go"), say(`Player ${s + 1} takes ${RIVALS[s - 1]}`);
    hudDirty = true;
    so.on("join", s);
    engine.busy(1);
    engine.wake();
  }

  // ---- drawing extras ----
  function paintSky(ctx: CanvasRenderingContext2D) {
    const Wd = dio.width, H = dio.height, cty = CITIES[S[16]!]!;
    if (!sky) {
      sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.sky0);
      sky.addColorStop(0.6, P.sky1);
      sky.addColorStop(1, P.sky2);
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, Wd, H);
    if (P.night) {
      ctx.fillStyle = P.star;
      for (let i = 0; i < 90; i += 3) {
        ctx.globalAlpha = 0.25 + STARS[i + 2]! * 0.6;
        ctx.fillRect(STARS[i]! * Wd, STARS[i + 1]! * H * 0.5, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
    // The sun (day), a low big one (dusk), the moon (night).
    const r = Math.min(Wd, H) * (cty.tod === DUSK ? 0.11 : 0.075), sx = Wd * 0.83, sy = H * (cty.tod === DUSK ? 0.42 : 0.2);
    ctx.fillStyle = cty.tod === DAY ? (light() ? "#fff1a8" : "#ffe9a0") : cty.tod === DUSK ? "#ffb070" : P.moon;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fill();
    if (cty.tod === NIGHT) {
      ctx.fillStyle = P.sky0;
      ctx.beginPath();
      ctx.arc(sx - r * 0.42, sy - r * 0.2, r * 0.86, 0, TAU);
      ctx.fill();
    }
    // The far skyline: the city's own shapes, flat, behind the block (a parallax with the camera).
    const base = H * 0.62, u = H / 22, off = -dio.cam.tx * u * 0.25;
    ctx.fillStyle = P.far;
    ctx.beginPath();
    ctx.moveTo(0, H);
    let x = (off % (u * 3)) - u * 3;
    for (let i = 0; x < Wd + u * 3; i++) {
      const rr = FAR[(i + 64 * 4 + Math.floor(-off / (u * 3)) * 0) & 63]!, bw = u * (1.6 + rr * 2.2), bh = u * (2 + rr * (cty.far === 1 ? 9 : 5));
      if (cty.far === 2 && i % 3 === 1) {
        ctx.lineTo(x, base);
        ctx.arc(x + bw / 2, base, bw / 2, Math.PI, 0);
      } else if (cty.far === 3 && i % 4 === 2) {
        ctx.lineTo(x, base);
        ctx.lineTo(x, base - bh * 1.4);
        ctx.lineTo(x + bw * 1.5, base - bh * 1.4);
        ctx.lineTo(x + bw * 1.5, base - bh * 1.3);
        ctx.lineTo(x + bw * 0.25, base - bh * 1.3);
        ctx.lineTo(x + bw * 0.25, base);
      } else {
        ctx.lineTo(x, base - bh);
        ctx.lineTo(x + bw, base - bh);
        if (cty.far === 1 && i % 2) ctx.lineTo(x + bw * 0.5, base - bh - u * 1.5), ctx.lineTo(x + bw, base - bh);
      }
      ctx.lineTo(x + bw, base);
      x += bw + u * 0.3;
    }
    ctx.lineTo(Wd, H);
    ctx.closePath();
    ctx.fill();
    if (P.night) {
      ctx.fillStyle = P.win;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 40; i++) ctx.fillRect((FAR[i]! * Wd + off * 0.3 + Wd * 2) % Wd, base - FAR[(i + 7) & 63]! * u * 5, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
  function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    if (!dio.project(x0, y0, z0, tmp) || tmp[2]! < 0.5 || !dio.project(x1, y1, z1, tmp2) || tmp2[2]! < 0.5) return;
    ctx.moveTo(tmp[0]!, tmp[1]!);
    ctx.lineTo(tmp2[0]!, tmp2[1]!);
  }
  function paintCurb(ctx: CanvasRenderingContext2D) {
    const SX = run.SX;
    ctx.strokeStyle = P.curb;
    ctx.lineWidth = P.night ? 1.8 : 1.3;
    ctx.globalAlpha = P.night ? 0.9 : 0.8;
    if (P.night) ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    seg(ctx, -SX - 0.8, 0.045, STREET0, SX + 0.8, 0.045, STREET0);
    seg(ctx, -SX - 0.8, 0.005, STREET1, SX + 0.8, 0.005, STREET1);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function paintPools(ctx: CanvasRenderingContext2D) {
    if (!P.night) return;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    const f = dio.focal(), SX = run.SX, lamps = Math.round(SX / 3.4);
    for (let k = 0; k < lamps; k++) {
      const x = -SX + 0.4 + (k * (SX * 2 - 0.8)) / Math.max(1, lamps - 1);
      if (!at(x + 0.38, 0, STREET0 + 0.4)) continue;
      const r = (f * 1.8) / tmp[2]!;
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.ellipse(tmp[0]!, tmp[1]!, r * 0.8, r * 0.22, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function paintShadow(ctx: CanvasRenderingContext2D) {
    const f = dio.focal();
    ctx.fillStyle = P.shadow;
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[24] !== IN || O[5] === CLIMB || O[5] === ROOF || (O[29] && O[1]! <= 0.01)) continue;
      if (at(O[0]!, 0.03, O[2]!)) {
        const r = (f * 1.25) / tmp[2]!, lift = O[1]!;
        ctx.globalAlpha = Math.max(0.08, 0.34 - lift * 0.05);
        ctx.beginPath();
        ctx.ellipse(tmp[0]!, tmp[1]!, r * (1 - Math.min(0.5, lift * 0.06)), r * 0.28, 0, 0, TAU);
        ctx.fill();
      }
    }
    for (let h = 0; h < NH; h++)
      if (run.HE[h * 12]! && at(run.HE[h * 12 + 1]!, 0.03, run.HE[h * 12 + 3]!)) {
        const r = (f * 1.1) / tmp[2]!;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.ellipse(tmp[0]!, tmp[1]!, r, r * 0.25, 0, 0, TAU);
        ctx.fill();
      }
    ctx.globalAlpha = 1;
  }
  /** The live parts' warning: a pulsing glow and a bolt; the antennas too; a surge arcs them all. */
  function paintLive(ctx: CanvasRenderingContext2D) {
    const fc = dio.focal(), surge = run.FE[9]! > 0, pulse = surge ? 1 : 0.5 + 0.5 * Math.sin(engine.time * 9), BLD = run.BLD, B = run.B;
    ctx.globalCompositeOperation = P.night ? "lighter" : "source-over";
    for (let k = 0; k < liveCell.length; k++) {
      const i = liveCell[k]!, b = run.bk.bOf(i), w = BLD[b * 4 + 1]!, fl = ((i - run.C0[b]!) / w) | 0, col = i - run.C0[b]! - fl * w;
      if (B[b * 6]! >= FALL || B[b * 6 + 3]! > fl) continue;
      const x = BLD[b * 4]! + col + 0.5, y = run.yOff(b) + fl + 0.45;
      if (!at(x, y, 0.2)) continue;
      const s = fc / tmp[2]!;
      ctx.globalAlpha = 0.18 + pulse * 0.25;
      ctx.fillStyle = P.zap;
      ctx.beginPath();
      ctx.arc(tmp[0]!, tmp[1]!, s * (0.55 + pulse * 0.15 + (surge ? 0.4 : 0)), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      bolt(ctx, tmp[0]!, tmp[1]!, s * 0.42);
      if (surge) {
        // The arc to the wall beside it.
        const sx = tmp[0]!, sy = tmp[1]!;
        if (at(col === 0 ? BLD[b * 4]! - 0.8 : BLD[b * 4]! + w + 0.8, y + Math.sin(engine.time * 40 + k) * 0.3, -0.5)) {
          ctx.strokeStyle = P.zap;
          ctx.lineWidth = Math.max(1.5, s * 0.06);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo((sx + tmp[0]!) / 2 + Math.sin(engine.time * 60 + k) * s * 0.2, (sy + tmp[1]!) / 2 - s * 0.2);
          ctx.lineTo(tmp[0]!, tmp[1]!);
          ctx.stroke();
        }
      }
    }
    for (let b = 0; b < run.nb(); b++) {
      if (run.ANT[b] !== run.ANT[b] || B[b * 6] === RUBBLE) continue;
      if (!at(run.ANT[b]!, run.top(b) + 2.1, -DEPTH / 2)) continue;
      const s = fc / tmp[2]!;
      ctx.globalAlpha = 0.25 + pulse * 0.35;
      ctx.fillStyle = P.zap;
      ctx.beginPath();
      ctx.arc(tmp[0]!, tmp[1]!, s * (0.3 + pulse * 0.2), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    paintReach(ctx);
  }
  function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    if (r < 3) return;
    ctx.fillStyle = P.zap;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + r * 0.15, y - r);
    ctx.lineTo(x - r * 0.45, y + r * 0.1);
    ctx.lineTo(x - r * 0.02, y + r * 0.1);
    ctx.lineTo(x - r * 0.2, y + r);
    ctx.lineTo(x + r * 0.45, y - r * 0.15);
    ctx.lineTo(x + r * 0.02, y - r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  /** The facade round every hit window: a scar of broken render (bigger with each hit), the wall panels beside
   *  it dented, under the windows. */
  function paintScars(b: number) {
    return (ctx: CanvasRenderingContext2D) => {
      const BLD = run.BLD, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, rem = run.B[b * 6 + 3]!, g = groups[b]!, yo = run.yOff(b), fc = dio.focal();
      if (run.B[b * 6] === RUBBLE) return;
      for (let fl = rem; fl < f; fl++) for (let col = 0; col < w; col++) {
        const i = run.C0[b]! + fl * w + col, h = run.HIT[i]! || (run.cell[i] === HOLE ? 3 : 0);
        if (!h || run.LIVE[i]) continue;
        const x = g.pos[0]! - w / 2 + col + 0.5, y = yo + fl + 0.5;
        if (!at(x, y, 0.03)) continue;
        const sc = fc / tmp[2]!, cx = tmp[0]!, cy = tmp[1]!, seed = (i * 7919) % 97, R0 = sc * (0.42 + 0.16 * Math.min(3, h));
        ctx.fillStyle = DENT[b]!;
        for (let k = 0; k < 4; k++) {
          const dx = k === 0 ? -0.5 : k === 1 ? 0.5 : 0, dy = k === 2 ? -0.5 : k === 3 ? 0.5 : 0, qq = sc * (0.08 + 0.05 * Math.min(3, h));
          ctx.fillRect(cx + dx * sc - qq, cy + dy * sc - qq * 0.7, qq * 2, qq * 1.4);
        }
        ctx.fillStyle = SCAR[b]!;
        ctx.beginPath();
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU + seed * 0.11, rr = R0 * (k & 1 ? 0.72 : 1 + ((seed + k * 7) % 5) * 0.06);
          k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9) : ctx.moveTo(cx + rr, cy);
        }
        ctx.closePath();
        ctx.fill();
      }
    };
  }
  /** A bit of facade (flying, then lying on the street). */
  function paintBit(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    const x = p.sx[k]!, y = p.sy[k]!, r = p.sr[k]!, o = k * 9, a = BIT[o + 6]!;
    if (r < 1) return;
    ctx.fillStyle = P.walls[BIT[o + 7]!]!;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = Math.max(1, r * 0.15);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7);
    ctx.lineTo(x + Math.cos(a + 2.1) * r * 0.8, y + Math.sin(a + 2.1) * r * 0.6);
    ctx.lineTo(x + Math.cos(a + 3.9) * r, y + Math.sin(a + 3.9) * r * 0.7);
    ctx.lineTo(x + Math.cos(a + 5.2) * r * 0.6, y + Math.sin(a + 5.2) * r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  /** Is window (col, fl) of building b a hole (and still up)? */
  function holeAt(b: number, col: number, fl: number) {
    const w = run.BLD[b * 4 + 1]!;
    return col >= 0 && col < w && fl >= run.B[b * 6 + 3]! && fl < run.BLD[b * 4 + 2]! && run.cell[run.C0[b]! + fl * w + col] === HOLE;
  }
  /** The damage on building b's facade: first the cracks (crisp branches out over the wall panels, longer
   *  with each hit), then the bites: a chip, a crack (a small dark dent), a hole (a big jagged bite across
   *  the window frame, its rim of bare wall, the floor slab and rebar inside; next to another hole it
   *  stretches into it, so holes merge into gashes down and across the face). */
  function paintHoles(b: number) {
    return (ctx: CanvasRenderingContext2D) => {
      const BLD = run.BLD, C0 = run.C0, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, rem = run.B[b * 6 + 3]!, g = groups[b]!, yo = run.yOff(b), fc = dio.focal();
      if (run.B[b * 6] === RUBBLE) return;
      for (let pass = 0; pass < 2; pass++) for (let fl = rem; fl < f; fl++) for (let col = 0; col < w; col++) {
        const i = C0[b]! + fl * w + col, cs = run.cell[i]!, hh = run.HIT[i]!;
        if ((cs === INTACT && !hh) || run.LIVE[i]) continue;
        const x = g.pos[0]! - w / 2 + col + 0.5, y = yo + fl + (fl === 0 ? 0.45 : 0.5);
        if (!at(x, y, 0.06)) continue;
        const s = fc / tmp[2]!, cx = tmp[0]!, cy = tmp[1]!, lw = Math.max(1, s * 0.03);
        if (pass === 0) {
          // Cracks: a chip's few short ones, a crack's longer net, a hole's long branches.
          const lv = cs === HOLE ? 3 : hh;
          cracks(ctx, cx, cy, s * (0.35 + 0.3 * lv), 2 + lv * 2, i, PI, lw);
          continue;
        }
        if (cs === HOLE) {
          const pop = 1 + run.crackT[i]! * 0.8;
          const L = holeAt(b, col - 1, fl) ? 1.75 : 1, Rr = holeAt(b, col + 1, fl) ? 1.75 : 1, U = holeAt(b, col, fl + 1) ? 1.85 : 1, D = holeAt(b, col, fl - 1) ? 1.85 : 1;
          bite(ctx, cx, cy, s * 0.5 * pop, L, Rr, U, D, i, SCAR[b]!, PI, lw * 1.2, cy + s * 0.42);
          if (run.crackT[i]! > 0) {
            ctx.globalAlpha = run.crackT[i]! * 2;
            ctx.fillStyle = P.fire;
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.2, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        } else if (cs === CRACKED) bite(ctx, cx + s * 0.05, cy - s * 0.03, s * 0.24, 1, 1, 1, 1, i, SCAR[b]!, PI, lw, cy + s * 0.5);
      }
    };
  }
  /** A person at a window (waving; screaming with both arms up when a monster is near), a sniper, or a hot pot. */
  function paintFolk(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    let b = 0;
    while (folk[b] !== p) b++;
    const i = run.C0[b]! + k, kind = run.occ[i]!, x = p.sx[k]!, y = p.sy[k]!, r = p.sr[k]!;
    if (r < 1.5) return;
    const t = engine.time * 6 + k;
    if (kind === 3) {
      // A pot on a stove, glowing hot, steam over it.
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.strokeStyle = P.ink;
      ctx.fillStyle = P.fire;
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2);
      ctx.beginPath();
      ctx.arc(x, y + r * 0.2, r * 0.9, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.roundRect(x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.75, r * 0.15);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = P.paper;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      for (let n = -1; n <= 1; n++) {
        const sx = x + n * r * 0.3, ph = Math.sin(t + n) * r * 0.12;
        ctx.moveTo(sx, y - r * 0.3);
        ctx.quadraticCurveTo(sx + r * 0.2 + ph, y - r * 0.6, sx - ph, y - r);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    let panic = false, near = 0;
    for (let m = 0; m < NM; m++) if (MV[m]![24] === IN && Math.abs(MV[m]![0]! - p.x[k]!) < 3.2) (panic = true), (near = MV[m]![0]! - p.x[k]!);
    if (kind === 2) return sniper(ctx, x, y, r, near > 0 ? 1 : near < 0 ? -1 : (k & 1 ? 1 : -1), PI, t);
    person(ctx, x, y, r, (i * 7 + (i >> 2)) & 3, i, PI, t, panic);
  }
  function paintSoldier(ctx: CanvasRenderingContext2D, s: number, p: DioramaPoints) {
    const x = p.sx[s]!, y = p.sy[s]!, r = p.sr[s]!, o = s * 8;
    if (r < 1.5) return;
    const aim = run.SO[o + 4]!, kick = aim ? Math.max(0, run.SO[o + 5]! - 2.2) * 4 : 0;
    soldier(ctx, x, y, r, run.SO[o + 3]!, aim, run.SO[o + 7]!, Math.min(1, kick), PI);
  }
  function paintPebble(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    const x = p.sx[k]!, y = p.sy[k]!, r = Math.max(1.5, p.sr[k]!), kind = run.PB[k * 8 + 7]!;
    ctx.fillStyle = kind === 2 ? P.shell : P.pebble;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    if (kind === 2) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x - run.PB[k * 8 + 4]! * 1.2, y + run.PB[k * 8 + 5]! * 1.2, r * 0.7, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    if (kind === 2) ctx.stroke();
  }
  function paintChute(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    const x = p.sx[k]!, y = p.sy[k]!, r = p.sr[k]!, o = k * 9, landed = run.CH[o + 7]!, kind = run.CH[o + 6]!, t = run.CH[o + 8]!;
    if (r < 1.5) return;
    const lw = Math.max(1, r * 0.11), sway = landed ? 0 : Math.sin(t * 2.2 + k) * 0.18;
    ctx.lineWidth = lw;
    ctx.strokeStyle = P.ink;
    const by = landed ? y + r * 0.2 : y + r * 0.9;
    if (!landed) {
      const open = Math.min(1, t * 4), cx = x + sway * r * 2, cy = y - r * 0.9, cw = r * (0.6 + open * 0.9);
      ctx.fillStyle = P.chute[k % 4]!;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, r * 0.7 * open + r * 0.2, sway, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = P.chute[(k + 1) % 4]!;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw * 0.36, r * 0.7 * open + r * 0.2, sway, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - cw, cy);
      ctx.lineTo(x - r * 0.2, by - r * 0.45);
      ctx.moveTo(cx + cw, cy);
      ctx.lineTo(x + r * 0.2, by - r * 0.45);
      ctx.stroke();
    }
    ctx.fillStyle = kind === 2 ? P.soldier : P.people[k % 6]!;
    ctx.beginPath();
    ctx.roundRect(x - r * 0.26, by - r * 0.4, r * 0.52, r * 0.6, r * 0.12);
    ctx.fill();
    ctx.stroke();
    if (landed) {
      const st = Math.sin(t * 20) * r * 0.25;
      ctx.beginPath();
      ctx.moveTo(x, by + r * 0.2);
      ctx.lineTo(x - st, by + r * 0.55);
      ctx.moveTo(x, by + r * 0.2);
      ctx.lineTo(x + st, by + r * 0.55);
      ctx.stroke();
    }
    ctx.fillStyle = P.skin;
    ctx.beginPath();
    ctx.arc(x, by - r * 0.62, r * 0.27, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (kind === 2) {
      ctx.fillStyle = P.helmet;
      ctx.beginPath();
      ctx.arc(x, by - r * 0.68, r * 0.3, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, by - r * 0.47, r * 0.1, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  /** A knocked-out monster, shrunk to a tiny comic figure in its own colours, running off the table. */
  function paintRunner(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    const x = p.sx[k]!, y = p.sy[k]!, r = p.sr[k]!, O = MV[k]!, m = mons[k]!, st = Math.sin(O[13]! * 2) * r * 0.4, d = O[3]! > 0 ? 1 : -1;
    if (r < 2) return;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = P.ink;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.3);
    ctx.lineTo(x - st, y + r);
    ctx.moveTo(x, y + r * 0.3);
    ctx.lineTo(x + st, y + r);
    ctx.moveTo(x, y - r * 0.2);
    ctx.lineTo(x - d * r * 0.6, y - r * 0.9 - st * 0.3);
    ctx.moveTo(x, y - r * 0.2);
    ctx.lineTo(x + d * r * 0.5, y - r * 0.8 + st * 0.3);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = m.main;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.45, r * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + d * r * 0.1, y - r * 0.75, r * 0.38, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.paper;
    ctx.beginPath();
    ctx.arc(x + d * r * 0.24, y - r * 0.8, r * 0.13, 0, TAU);
    ctx.arc(x + d * r * 0.0, y - r * 0.8, r * 0.13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = m.acc;
    ctx.beginPath();
    ctx.arc(x - d * r * 0.45, y - r * 1.15, r * 0.09, 0, TAU);
    ctx.fill();
  }
  /** A shocked monster: bolts round it, and every other flicker its bones show (an x-ray gag). */
  function paintZap(ctx: CanvasRenderingContext2D, k: number) {
    const O = MV[k]!, zap = O[23]!;
    if (zap <= 0 || O[24] !== IN || !at(O[0]!, O[1]! + mons[k]!.height * 0.55, O[2]!)) return;
    const s = dio.focal() / tmp[2]!, cx = tmp[0]!, cy = tmp[1]!, h = mons[k]!.height * s;
    ctx.strokeStyle = P.zap;
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.globalCompositeOperation = P.night ? "lighter" : "source-over";
    ctx.beginPath();
    for (let n = 0; n < 6; n++) {
      const a = n * 1.05 + engine.time * 30, r0 = h * 0.35, r1 = h * 0.62;
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a + 0.25) * (r0 + r1) * 0.5, cy + Math.sin(a - 0.2) * (r0 + r1) * 0.5);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    if (((engine.time * 16) | 0) & 1) return;
    ctx.strokeStyle = P.paper;
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.beginPath();
    ctx.arc(cx + O[6]! * h * 0.12, cy - h * 0.36, h * 0.1, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.25);
    ctx.lineTo(cx, cy + h * 0.3);
    for (let n = 0; n < 4; n++) {
      const yy = cy - h * 0.18 + n * h * 0.08, ww = h * (0.16 - n * 0.02);
      ctx.moveTo(cx - ww, yy + h * 0.03);
      ctx.quadraticCurveTo(cx, yy - h * 0.03, cx + ww, yy + h * 0.03);
    }
    ctx.moveTo(cx - h * 0.12, cy + h * 0.32);
    ctx.lineTo(cx + h * 0.12, cy + h * 0.32);
    ctx.stroke();
  }
  /** A tag over each player's monster (P1..P4 in the seat's colour) when more than one plays. */
  function paintTags(ctx: CanvasRenderingContext2D) {
    if (so.attract || (!net && seatsIn === 1)) return;
    ctx.font = `900 ${Math.max(11, Math.min(15, dio.width / 60))}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = "center";
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!, d = O[28]!;
      if (d === AI || O[24] !== IN || O[29] || !at(O[0]!, O[1]! + mons[k]!.height + 0.6, O[2]!)) continue;
      const t = net && d === net.seat ? "YOU" : "P" + (d + 1), w = ctx.measureText(t).width + 12;
      ctx.fillStyle = SEAT_C[d]!;
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(tmp[0]! - w / 2, tmp[1]! - 18, w, 18, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0b0a14";
      ctx.fillText(t, tmp[0]!, tmp[1]! - 5);
    }
  }
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (fx.live) fx.draw(ctx, !P.night);
    for (let k = 0; k < NM; k++) {
      paintZap(ctx, k);
      const O = MV[k]!;
      if (O[18]! > 0 && O[24] === IN) {
        mouth(k);
        if (at(tmp2[0]!, tmp2[1]!, tmp2[2]!)) {
          const qq = O[18]! / 0.6, r = (dio.focal() * (0.3 + (1 - qq) * 0.5)) / tmp[2]!;
          ctx.globalAlpha = qq * 0.8;
          ctx.fillStyle = P.paper;
          ctx.strokeStyle = P.ink;
          ctx.lineWidth = 2;
          for (let n = 0; n < 3; n++) {
            ctx.beginPath();
            ctx.arc(tmp[0]! + (n - 1) * r * 0.8, tmp[1]! - r * (0.4 + (n & 1) * 0.5), r * 0.5, 0, TAU);
            ctx.fill();
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
    }
    // The punch flash: a white star where the fist lands.
    if (FLASH[3]! > 0 && at(FLASH[0]!, FLASH[1]!, FLASH[2]!)) {
      const r = (dio.focal() / tmp[2]!) * (0.5 + (0.1 - Math.min(0.1, FLASH[3]!)) * 6), cx = tmp[0]!, cy = tmp[1]!;
      ctx.globalAlpha = Math.min(1, FLASH[3]! * 12);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU, rr = k & 1 ? r * 0.35 : r;
        k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + rr, cy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    paintTags(ctx);
    if (flash > 0 && calm) {
      ctx.globalAlpha = flash * 1.4;
      ctx.fillStyle = P.zap;
      ctx.fillRect(0, 0, dio.width, dio.height);
      ctx.globalAlpha = 1;
    }
  }

  // ---- taps and clicks: the target, the reach outline ----
  /** A tap waiting for the next input read: 1 a punch, 2 a grab, and its target; the cell lit by it, the
   *  mouse's cell, a miss's ring. */
  let tapK = 0, tapT = 0, tapC = -1, tapF = 0, hoverC = -1, hoverG = false, missF = 0, missX = 0, missY = 0;
  /** This screen's own monster (online its seat's, else seat one's). */
  function own() {
    if (net) return MV[net.seat]!;
    for (let k = 0; k < NM; k++) if (MV[k]![28] === 0) return MV[k]!;
    return MV[0]!;
  }
  /** Window i's corners on screen into TQ (x0, y0, x1, y1); false off screen. */
  function winRect(i: number) {
    const b = run.bk.bOf(i), w = run.BLD[b * 4 + 1]!, rel = i - run.C0[b]!, fl = (rel / w) | 0, col = rel - fl * w, x = run.BLD[b * 4]! + col, y = run.yOff(b) + fl;
    if (!dio.project(x + 0.04, y + 0.96, 0.05, tmp) || !dio.project(x + 0.96, y + 0.04, 0.05, tmp2)) return false;
    TQ[0] = tmp[0]!; TQ[1] = tmp[1]!; TQ[2] = tmp2[0]!; TQ[3] = tmp2[1]!;
    return true;
  }
  /** The reach cell of monster O under screen point (x, y), or −1. */
  function cellAt(O: Float64Array, x: number, y: number) {
    for (let k = 0; k < NR; k++) {
      const i = run.reachCell(O, k);
      if (i >= 0 && winRect(i) && x >= TQ[0]! - 2 && x <= TQ[2]! + 2 && y >= TQ[1]! - 2 && y <= TQ[3]! + 2) return k;
    }
    return -1;
  }
  /** Grab cell g of monster O on screen into TQ; false off screen. */
  function grabRect(O: Float64Array, g: number) {
    run.grabCell(O, g);
    const x = run.GC[0]!, y = run.GC[1]!;
    if (!dio.project(x - 0.46, y + 0.46, 0.05, tmp) || !dio.project(x + 0.46, y - 0.46, 0.05, tmp2)) return false;
    TQ[0] = tmp[0]!; TQ[1] = tmp[1]!; TQ[2] = tmp2[0]!; TQ[3] = tmp2[1]!;
    return true;
  }
  const inTQ = (x: number, y: number) => x >= TQ[0]! - 2 && x <= TQ[2]! + 2 && y >= TQ[1]! - 2 && y <= TQ[3]! + 2;
  /** What a tap at (x, y) does, as a target code: a window in the punch's reach is a punch (a grab when
   *  someone is at it), a grabbable in the grab's reach (./round.ts GRAB) a grab, a helicopter next to it (GRAB_HELI) a swat; off a
   *  wall a tap near enough punches that way; anything else a whiff (T_MISS). 0: nothing (not in play). */
  function tapAt(x: number, y: number) {
    const O = own(), fc = dio.focal(), near = (wx: number, wy: number, wz: number, r: number) => dio.project(wx, wy, wz, tmp) && Math.hypot(tmp[0]! - x, tmp[1]! - y) < Math.max(22, (fc * r) / tmp[2]!);
    if (O[24] !== IN || O[5] === KO) return 0;
    const HE = run.HE, CH = run.CH, SO = run.SO;
    for (let h = 0; h < NH; h++) if (HE[h * 12] === 1 && near(HE[h * 12 + 1]!, HE[h * 12 + 2]!, HE[h * 12 + 3]!, 1.4)) return run.inGrab(O, HE[h * 12 + 1]!, HE[h * 12 + 2]!, true) ? T_HELI + h : T_MISS;
    for (let k = 0; k < NCH; k++) if (CH[k * 9]! > 0 && !CH[k * 9 + 7] && near(CH[k * 9 + 1]!, CH[k * 9 + 2]!, CH[k * 9 + 3]!, 0.8)) return run.inGrab(O, CH[k * 9 + 1]!, CH[k * 9 + 2]!) ? T_CHUTE + k : T_MISS;
    for (let k = 0; k < NS; k++) if (SO[k * 8]! > 0 && near(SO[k * 8 + 1]!, 0.8, SO[k * 8 + 2]!, 0.8)) return run.inGrab(O, SO[k * 8 + 1]!, 0.8) ? T_SOLDIER + k : T_MISS;
    const k = cellAt(O, x, y);
    if (k >= 0) {
      const i = run.reachCell(O, k), o = run.occ[i]!;
      return o && run.cell[i] !== HOLE ? T_GRAB + k : T_CELL + k;
    }
    // Someone at a window in the grab's reach (the next building across the gap, above, below).
    for (let g = 0; g < NG; g++) {
      if (!grabRect(O, g) || !inTQ(x, y)) continue;
      const i = run.winAt(run.GC[0]!, run.GC[1]!);
      if (i >= 0 && run.occ[i] && run.cell[i] !== HOLE) return T_GRAB + g;
    }
    if (O[5] !== CLIMB) {
      // Off a wall: a tap within reach either way punches that way (the street's soldiers, the tank, the trucks).
      for (let g = 0; g < NG; g++) if (grabRect(O, g) && inTQ(x, y)) return T_STREET + (run.GC[0]! > O[0]! ? 1 : 0);
    }
    return T_MISS;
  }
  /** Is a grabbable under (x, y) (someone at a window, a parachute, a soldier)? The mouse shows the grab's reach then. */
  function grabbableAt(x: number, y: number) {
    const t = tapAt(x, y);
    if (t >= T_GRAB && t < T_HELI || t >= T_CHUTE && t < T_STREET) return true;
    // Out of reach too: someone at a window under the pointer.
    for (let b = 0; b < run.nb(); b++) {
      const w = run.BLD[b * 4 + 1]!, f = run.BLD[b * 4 + 2]!;
      for (let k = 0; k < w * f; k++) {
        const i = run.C0[b]! + k;
        if (run.occ[i] && run.cell[i] !== HOLE && winRect(i) && inTQ(x, y)) return true;
      }
    }
    return false;
  }
  /** The reach on a wall, subtly: a thin neon outline round each cell in reach (live ones in the warning
   *  colour, with a pulse unless motion is reduced), the aimed or hovered cell brighter, a tapped one lit;
   *  a miss's ring where a tap found nothing in reach. */
  function paintReach(ctx: CanvasRenderingContext2D) {
    const O = own();
    if (O[5] === CLIMB && O[24] === IN && !so.attract) {
      const my = O[28] === 0 && !net ? I1[1]! : 0, row = my > 0.3 ? 3 : my < -0.3 ? 5 : 0, aimC = row + Math.min(row ? 1 : 2, O[39]!), trim = TRIMS[look.trim]?.c ?? P.zap;
      const pulse = calm ? 0.5 + 0.5 * Math.sin(engine.time * 8) : 0.5;
      for (let k = 0; k < NR; k++) {
        const i = run.reachCell(O, k);
        if (i < 0 || !winRect(i)) continue;
        const live = run.LIVE[i]! > 0 && run.cell[i] !== HOLE, hot = k === hoverC || k === aimC, lit = k === tapC && tapF > 0;
        ctx.globalAlpha = lit ? 0.95 : hot ? 0.8 : 0.38;
        ctx.strokeStyle = live ? P.zap : trim;
        ctx.lineWidth = lit || hot ? 2.2 : 1.2;
        if (live) ctx.globalAlpha = Math.min(1, ctx.globalAlpha + pulse * 0.3);
        ctx.strokeRect(TQ[0]!, TQ[1]!, TQ[2]! - TQ[0]!, TQ[3]! - TQ[1]!);
        if (lit) (ctx.globalAlpha = 0.25 * (tapF / 0.35)), (ctx.fillStyle = trim), ctx.fillRect(TQ[0]!, TQ[1]!, TQ[2]! - TQ[0]!, TQ[3]! - TQ[1]!);
      }
    }
    // The grab's reach (all four sides), faint and dashed, while the mouse is on something to grab.
    if (hoverG && O[24] === IN && O[5] !== KO && !so.attract) {
      ctx.setLineDash(DASH);
      ctx.strokeStyle = TRIMS[look.trim]?.c ?? P.zap;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      for (let g = 0; g < NG; g++) if (grabRect(O, g)) ctx.strokeRect(TQ[0]!, TQ[1]!, TQ[2]! - TQ[0]!, TQ[3]! - TQ[1]!);
      ctx.setLineDash(NODASH);
    }
    if (missF > 0) {
      ctx.globalAlpha = Math.min(1, missF * 2.5) * 0.7;
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(missX, missY, 10 + (0.4 - missF) * 30 * calm, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- input: four seats (the keyboard's halves, gamepads, the pad for seat one) ----
  const GP = new Float64Array(SEATS * 6), GB = new Uint8Array(SEATS * 3);
  // Seat two's keys: [left, right, up, down] held, and the presses (punch, jump, grab).
  const K2 = new Float64Array(4), K2P = new Uint8Array(3);
  /** Read every seat on this screen into IN (NI numbers a seat); seat one's tap or click rides as a target. */
  function readSeats(out: Float64Array) {
    out.fill(0);
    if (!endC.hidden) return;
    if (auto) net ? run.autopilotOwn(I1, net.seat, OWN) : run.autopilot(I1, 0);
    else {
      const stick = c.stick.active;
      I1[0] = GP[0]! || (stick ? c.stick.x : c.axis("left", "right"));
      I1[1] = -GP[1]! || (stick ? -c.stick.y : c.axis("down", "up"));
      // A press punches once; held, it keeps punching at the punch's own steady rhythm.
      I1[2] = c.hit(PUNCH) || c.down(PUNCH) || GP[2]! || GP[5]! ? 1 : 0;
      I1[3] = c.hit(JUMP) || GP[3]! ? 1 : 0;
      I1[4] = c.hit(GRAB) || GP[4]! ? 1 : 0;
      I1[5] = 0;
      if (tapK) (I1[5] = tapT), (I1[tapK === 1 ? 2 : 4] = 1), (tapK = 0);
    }
    for (let j = 0; j < NI; j++) out[j] = I1[j]!;
    out[NI] = GP[6]! || K2[1]! - K2[0]!;
    out[NI + 1] = -GP[7]! || K2[2]! - K2[3]!;
    out[NI + 2] = K2P[0] || GP[8]! ? 1 : 0;
    out[NI + 3] = K2P[1] || GP[9]! ? 1 : 0;
    out[NI + 4] = K2P[2] || GP[10]! ? 1 : 0;
    for (let s = 2; s < SEATS; s++) {
      const o = s * 6;
      out[s * NI] = GP[o]!;
      out[s * NI + 1] = -GP[o + 1]!;
      out[s * NI + 2] = GP[o + 2]!;
      out[s * NI + 3] = GP[o + 3]!;
      out[s * NI + 4] = GP[o + 4]!;
    }
    K2P.fill(0);
    for (let s = 0; s < SEATS; s++) GP[s * 6 + 2] = GP[s * 6 + 3] = GP[s * 6 + 4] = 0;
  }
  function gamepadRead() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    for (let s = 0; s < SEATS; s++) GP[s * 6] = GP[s * 6 + 1] = 0;
    if (!pads) return;
    let n = 0;
    for (let i = 0; i < pads.length && n < SEATS; i++) {
      const p = pads[i];
      if (!p || !p.connected) continue;
      const o = n * 6, ax = p.axes, bt = p.buttons, v = (k: number) => (bt[k] && bt[k]!.pressed ? 1 : 0);
      const dz = (a: number) => (a > 0.2 ? (a - 0.2) / 0.8 : a < -0.2 ? (a + 0.2) / 0.8 : 0);
      GP[o] = dz(ax[0] ?? 0) || v(15) - v(14);
      GP[o + 1] = dz(ax[1] ?? 0) || v(13) - v(12);
      const now0 = v(2) || v(7), now1 = v(0), now2 = v(1) || v(3), g = n * 3;
      if (n === 0) GP[5] = now0;
      if (now0 && !GB[g]) GP[o + 2] = 1;
      if (now1 && !GB[g + 1]) GP[o + 3] = 1;
      if (now2 && !GB[g + 2]) GP[o + 4] = 1;
      GB[g] = now0; GB[g + 1] = now1; GB[g + 2] = now2;
      const any = GP[o] || GP[o + 1] || now0 || now1 || now2;
      if (any && n === 0) (auto = false), engine.wake();
      // A pad's first press brings its seat in (seats two to four take the rivals).
      if (any && n > 0 && !net && !(seatsIn & (1 << n)) && endC.hidden) join(n, true);
      n++;
    }
  }

  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        buildScene();
        dirty = true;
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), head = hud.firstElementChild!.getBoundingClientRect(), cr = getComputedStyle(canvas).position === "absolute" ? canvas.getBoundingClientRect() : sr;
        dio.resize(cr.width || 1, cr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = Math.max(8, head.bottom - sr.top + 8);
        sky = null;
        frame();
        hudDirty = dirty = true;
      }
      if (V[6]) gamepadRead();
    },
    step(e, dt) {
      // A hit's hit-stop (one screen only): everything holds for a few frames (the run included), then goes on.
      if (stopF > 0) return void (stopF--, e.busy(), (dirty = true));
      if (endT > 0 && (endT -= dt) <= 0) showEnd();
      if (!net) {
        readSeats(INP);
        if (run.step(dt, INP)) dirty = true;
        if (run.n) events();
      }
      // A new city: its own framing (its tallest building fits), set once.
      if (built !== S[16]) buildScene(), frame();
      let moving = false;
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (tapF > 0 || missF > 0) (tapF = Math.max(0, tapF - dt)), (missF = Math.max(0, missF - dt)), (moving = true);
      if (S[0] === RUN || S[0] === CLEAR || (net && S[0] !== DONE)) moving = true;
      if (!net && S[0] === DONE && run.step(0, INP)) moving = true;
      if (moving || dirty) e.busy(), (dirty = true), (hudDirty = true);
      lastDt = dt;
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (!dirty) return;
      dirty = false;
      pose(lastDt);
      const cam = dio.cam, k = (shake * shake * 16 + fx.shake * 0.5) * calm, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx + nudge), (cam.oy += sy);
      dio.draw();
      (cam.ox -= sx + nudge), (cam.oy -= sy), (V[5] = 1);
    },
  });

  // Keys on the stage: seat one (WASD, Space/J, K, L; the arrows too while seat two is out), seat two
  // (the arrows, comma, period, slash: its first press brings it in), M mutes, Escape is the menu.
  const MAP: Record<string, string> = { KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down", Space: "jump", KeyJ: "punch", KeyK: "jump", KeyL: "grab" };
  const ARROWS: Record<string, string> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  const P2KEYS: Record<string, number> = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 }, P2ACT: Record<string, number> = { Comma: 0, Period: 1, Slash: 2 };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "Escape") return void (e.preventDefault(), so.on("menu", 0));
    const p2 = !!(seatsIn & 2);
    if (P2ACT[e.code] !== undefined && !net) {
      e.preventDefault();
      if (!p2 && endC.hidden) join(1, true);
      if (!e.repeat) K2P[P2ACT[e.code]!] = 1;
      return void engine.wake();
    }
    if (p2 && !net && P2KEYS[e.code] !== undefined) return void (e.preventDefault(), (K2[P2KEYS[e.code]!] = 1), engine.wake());
    const k = MAP[e.code] ?? ARROWS[e.code];
    if (!k || (e.target as Element).closest?.(".bui-pad")) return;
    if ((e.target as Element).closest?.(".cs-card") && (e.code === "Space" || e.code === "Enter")) return;
    e.preventDefault();
    if (!endC.hidden) return;
    auto = false;
    if (!e.repeat) c.press(k);
    engine.wake();
  }, sig);
  stage.addEventListener("keyup", (e) => {
    if (P2KEYS[e.code] !== undefined) K2[P2KEYS[e.code]!] = 0;
    const k = MAP[e.code] ?? ARROWS[e.code];
    if (k) c.press(k, false);
  }, sig);
  // A tap or a click: on what is in reach (a window: a punch, or a grab when someone is at it; a helicopter:
  // a swat; a parachute or a soldier: a grab); out of reach nothing happens (the cells don't light, a ring
  // marks the miss). Off a wall a tap on nothing punches in front (as before).
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (!endC.hidden || so.attract) return;
    auto = false;
    const r = canvas.getBoundingClientRect(), t = tapAt(e.clientX - r.left, e.clientY - r.top);
    if (t <= 0) return;
    tapK = (t >= T_CELL && t < T_GRAB) || (t >= T_HELI && t < T_CHUTE) || t >= T_STREET ? 1 : 2;
    tapT = t;
    tapC = t >= T_CELL && t < T_GRAB ? t - T_CELL : -1;
    tapF = 0.35;
    if (t === T_MISS) (missX = e.clientX - r.left), (missY = e.clientY - r.top), (missF = 0.4);
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, h = cellAt(own(), x, y), g = grabbableAt(x, y);
    if (h !== hoverC || g !== hoverG) (hoverC = h), (hoverG = g), (dirty = true), engine.wake();
  }, sig);
  muteK.addEventListener("click", toggle, sig);
  menuK.addEventListener("click", () => so.on("menu", 0), sig);
  again.addEventListener("click", () => restart(S[21]!), sig);
  retry.addEventListener("click", () => restart(S[16]!), sig);
  toMenu.addEventListener("click", () => so.on("menu", 1), sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), engine.wake()), sig);

  buildScene();
  engine.start();
  return {
    engine,
    run,
    look,
    get auto() {
      return auto;
    },
    /** A practice run (./round.ts S[28]). */
    get practice() {
      return S[28] === 1;
    },
    set auto(on: boolean) {
      auto = on;
      engine.wake();
    },
    get state() {
      const M = MV[net ? net.seat : 0]!;
      return {
        phase: S[0]!, city: S[16]!, cityId: CITIES[S[16]!]!.id, mode: M[5]!, hp: M[7]!, score: S[2]!, mine: M[25]!, flat: Math.round((S[8]! / Math.max(1, run.bk.L[2]!)) * 100), holes: S[3]!, snacks: S[6]!,
        cleared: S[18]!, won: S[20]!, end: !endC.hidden, card: !ccard.hidden, x: M[0]!, y: M[1]!, seats: seatsIn, drawn: V[5] === 1, name: monName(0, look),
      };
    },
    join,
    restart,
    /** Read this screen's seats (online: ./game.ts packs its own seat's numbers into the wire bits). */
    readSeats,
    /** Online: one frame of the run with every seat's numbers; `live` plays its stickers, sound and FX. */
    stepNet(inputs: Float64Array, live: boolean) {
      run.step(1 / 60, inputs);
      if (run.n) live ? events() : run.clear();
      dirty = true;
    },
    /** Dress the hero (a rebuild: the garage, the online host's look). */
    setLook(l: Look) {
      Object.assign(look, l);
      V[1] = 1;
      hudDirty = true;
      was.fill(-1);
      engine.wake();
    },
    retheme() {
      V[1] = 1;
      engine.wake();
    },
    /** Where monster k's hands (in rig order), then its feet, are in the
     *  world as of the last draw, by their centres: [x, y, z, …] (tests/pose.mjs checks the grip and the hit). */
    contacts(k: number) {
      const m = mons[k]!, out: number[] = [];
      for (const o of [...m.hands, ...m.feet]) {
        const M = o.M, h = o.size[1]! / 2;
        out.push(M[9]! + M[1]! * h, M[10]! + M[4]! * h, M[11]! + M[7]! * h);
      }
      return out;
    },
    /** Which hand grips on a wall (the other smashes): the rig's index, for monster k facing f. */
    gripHand: (k: number, f: number) => (f > 0 ? 0 : 1),
    /** Monster k's torso as of the last draw: its centre and which way its front faces, [x, y, z, fx, fy, fz]
     *  (tests/pose.mjs checks it hugs the building). */
    torso(k: number) {
      const M = mons[k]!.tor.M;
      return [M[9]!, M[10]!, M[11]!, M[0]!, M[3]!, M[6]!];
    },
    /** World (x, y, z) to the screen (CSS px of the canvas's backing store) and its depth. */
    project: (x: number, y: number, z: number) => (dio.project(x, y, z, tmp), [tmp[0]!, tmp[1]!, tmp[2]!]),
    /** Monster k's rig (tests read its joints). */
    rig: (k: number) => mons[k]!,
    /** The diorama (tests redraw it to check the rigs' depth order). */
    dio,
    /** The wall table (tests tune and check it). */
    wall: WALL,
    where: (k: number) => (dio.project(MV[k]![0]!, MV[k]![1]! + mons[k]!.height * 0.5, MV[k]![2]!, tmp), [tmp[0]!, tmp[1]!, dio.focal() / tmp[2]!]),
    /** The landing page's poster resolution. */
    poster() {
      V[2] = 0.6;
      V[0] = 1;
    },
    destroy: () => engine.destroy(),
  };
}
void [E_CLIMB, CRAB, NIGHT, R_ANT, C_SPIRE, PLANT, NEON, SKYPORT, BRIDGE];
