// The profile: one ape and its garage, saved on this device (localStorage, guarded: a private window
// or blocked storage just means no save), versioned and migrated step by step, repaired when partial
// (`normalize`), never written over by an older game when a newer one saved it; an export code
// (CS1-…, with a checksum) moves it to another device. Clearing a city unlocks garage parts (UNLOCKS)
// and lets a run start from the next city.
import { FURS, TRIMS, PATTERNS, FACES, GEAR, HAIRS, LOOK0, type Look } from "./monster.ts";
import { CITIES, NCITY } from "./cities.ts";

export const VERSION = 2;
export interface Profile {
  v: number;
  look: Look;
  /** Garage parts unlocked: "fur:3", "gear:2" (a gear bit's index)… */
  owned: string[];
  /** Cities flattened at least once (their ids). */
  cleared: string[];
  best: number;
  /** AI rivals on (1) or off (0). */
  rivals: number;
  stats: { runs: number; buildings: number; snacks: number; helis: number };
}
export interface Store { get(k: string): string | null; set(k: string, v: string): void }
export const KEY = "citysmash:profile";
export const local: Store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* no storage: play on, unsaved */ } },
};
/** What you own from the start. */
export const BASE = ["fur:0", "fur:1", "fur:2", "trim:0", "trim:1", "trim:2", "pattern:0", "pattern:1", "face:0", "face:1", "gear:0", "gear:1", ...HAIRS.map((_, i) => "hair:" + i), ...TRIMS.map((_, i) => "hairc:" + i)];
/** What each city unlocks the first time it is flat. */
export const UNLOCKS: string[][] = [
  ["fur:3", "trim:3", "gear:2"],
  ["fur:4", "pattern:2", "gear:3"],
  ["fur:5", "trim:4", "face:2"],
  ["fur:6", "pattern:3", "gear:4"],
  ["fur:7", "trim:5", "face:3", "gear:5"],
  ["fur:8", "fur:9", "pattern:4", "trim:6", "gear:6"],
  ["fur:10", "fur:11", "face:4", "trim:7", "gear:7"],
];
const KINDS = { fur: FURS.length, trim: TRIMS.length, pattern: PATTERNS.length, face: FACES.length, gear: GEAR.length, hair: HAIRS.length, hairc: TRIMS.length } as const;
export type Part = keyof typeof KINDS;
/** A part's name for the garage and the city card. */
export function partName(tag: string) {
  const [k, i] = tag.split(":") as [Part, string], n = +i;
  return k === "fur" ? `${FURS[n]!.name.toUpperCase()} FUR` : k === "trim" ? `${TRIMS[n]!.name.toUpperCase()} TRIM` : k === "hair" ? `${HAIRS[n]!.name} HAIR` : k === "hairc" ? `${TRIMS[n]!.name.toUpperCase()} HAIR` : k === "pattern" ? `${PATTERNS[n]!.name} PATTERN` : k === "face" ? `${FACES[n]!.name} FACE` : GEAR[n]!.name;
}
/** The city that unlocks a part (−1: owned from the start). */
export const unlockedBy = (tag: string) => UNLOCKS.findIndex((u) => u.includes(tag));

export const fresh = (): Profile => ({ v: VERSION, look: { ...LOOK0 }, owned: BASE.slice(), cleared: [], best: 0, rivals: 1, stats: { runs: 0, buildings: 0, snacks: 0, helis: 0 } });

/** Version steps, in order: each takes the save from v to v + 1. 1 → 2: the hair (none yet, a pink to pick). */
const STEPS: Record<number, (p: any) => any> = { 1: (p) => ({ ...p, v: 2, look: { ...p.look, hair: 0, hairc: LOOK0.hairc } }) };
export function migrate(p: any): any {
  let q = { ...p, v: typeof p.v === "number" ? p.v : 1 };
  while (q.v < VERSION && STEPS[q.v]) q = STEPS[q.v]!(q);
  return q;
}
const okTag = (s: unknown): s is string => {
  if (typeof s !== "string") return false;
  const m = /^(fur|trim|pattern|face|gear|hair|hairc):(\d+)$/.exec(s);
  return !!m && +m[2]! < KINDS[m[1] as Part];
};
const clampI = (n: unknown, max: number, d: number) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) < max ? (n as number) : d);
/** Repair a partial or out-of-range save; a look part you don't own falls back to the start's. */
export function normalize(p: any): Profile {
  const f = fresh(), ids = CITIES.map((c) => c.id), l = p.look ?? {};
  const owned = [...new Set([...BASE, ...(Array.isArray(p.owned) ? p.owned.filter(okTag) : [])])];
  const has = (k: Part, i: number) => owned.includes(`${k}:${i}`);
  const pick = (k: Exclude<Part, "gear">, d: number) => { const i = clampI(l[k], KINDS[k], d); return has(k, i) ? i : d; };
  let gear = Number.isInteger(l.gear) ? l.gear & 255 : LOOK0.gear;
  for (let b = 0; b < GEAR.length; b++) if (gear & (1 << b) && !has("gear", b)) gear &= ~(1 << b);
  const num = (v: unknown) => (Number.isFinite(v) ? Math.max(0, Math.floor(v as number)) : 0);
  return {
    v: VERSION,
    look: { fur: pick("fur", LOOK0.fur), trim: pick("trim", LOOK0.trim), pattern: pick("pattern", LOOK0.pattern), face: pick("face", LOOK0.face), gear, hair: pick("hair", LOOK0.hair), hairc: pick("hairc", LOOK0.hairc) },
    owned,
    cleared: Array.isArray(p.cleared) ? ids.filter((id) => p.cleared.includes(id)) : [],
    best: Math.min(99_999_999, num(p.best)),
    rivals: p.rivals === 0 ? 0 : 1,
    stats: { runs: num(p.stats?.runs), buildings: num(p.stats?.buildings), snacks: num(p.stats?.snacks), helis: num(p.stats?.helis) },
  };
  void f;
}
/** Load: a fresh profile when there is none or it is garbage; `newer` when a newer game wrote it (then it is never written over). */
export function load(s: Store = local): { profile: Profile; newer: boolean } {
  const raw = s.get(KEY);
  if (!raw) return { profile: fresh(), newer: false };
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return { profile: fresh(), newer: false };
    if (typeof p.v === "number" && p.v > VERSION) return { profile: normalize(p), newer: true };
    return { profile: normalize(migrate(p)), newer: false };
  } catch {
    return { profile: fresh(), newer: false };
  }
}
export function save(p: Profile, s: Store = local, newer = false) {
  if (newer) return false;
  s.set(KEY, JSON.stringify(p));
  return true;
}
const sum = (t: string) => { let h = 7; for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0; return (h % 46656).toString(36).padStart(3, "0"); };
const b64 = (t: string) => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
const unb64 = (t: string) => new TextDecoder().decode(Uint8Array.from(atob(t), (ch) => ch.charCodeAt(0)));
/** The export code: CS1-<base64 json>-<checksum>. */
export function exportCode(p: Profile) {
  const body = b64(JSON.stringify(p));
  return `CS1-${body}-${sum(body)}`;
}
/** Read an export code back; null when it is not one (or a character slipped). */
export function importCode(code: string): Profile | null {
  const m = /^CS1-([A-Za-z0-9+/=]+)-([0-9a-z]{3})$/.exec(code.trim());
  if (!m || sum(m[1]!) !== m[2]) return null;
  try {
    const p = JSON.parse(unb64(m[1]!));
    return p && typeof p === "object" ? normalize(migrate(p)) : null;
  } catch {
    return null;
  }
}

/** A city flat: it counts as cleared, its unlocks are yours. Returns the profile and the new tags. */
export function clearCity(p: Profile, ci: number): { profile: Profile; fresh: string[] } {
  const c = CITIES[ci];
  if (!c) return { profile: p, fresh: [] };
  const got = UNLOCKS[ci]!.filter((t) => !p.owned.includes(t));
  return { profile: { ...p, cleared: p.cleared.includes(c.id) ? p.cleared : [...p.cleared, c.id], owned: [...p.owned, ...got] }, fresh: got };
}
/** The cities a run may start from: the first, and each one after a cleared one. */
export function startable(p: Profile) {
  const out = [0];
  for (let i = 1; i < NCITY; i++) if (p.cleared.includes(CITIES[i - 1]!.id)) out.push(i);
  return out;
}
/** A run's end: the best score, the counts. */
export function endRun(p: Profile, score: number, s: { buildings: number; snacks: number; helis: number }): Profile {
  return { ...p, best: Math.max(p.best, score), stats: { runs: p.stats.runs + 1, buildings: p.stats.buildings + s.buildings, snacks: p.stats.snacks + s.snacks, helis: p.stats.helis + s.helis } };
}
/** Set a look part you own (refused when locked); gear toggles its bit. */
export function setPart(p: Profile, k: Part, i: number): Profile {
  if (!p.owned.includes(`${k}:${i}`)) return p;
  const look = { ...p.look };
  if (k === "gear") look.gear ^= 1 << i;
  else look[k] = i;
  return { ...p, look };
}
