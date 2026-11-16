// The profile and the garage, headless (src/profile.ts, src/monster.ts): a fresh profile; a save
// survives the round trip; partial and out-of-range saves are repaired (a locked part falls back);
// a newer game's save is never written over; the CS1- export code round-trips and refuses a slip;
// clearing a city unlocks its parts (once) and opens the next city to start from; locked parts can't
// be worn; the garage's parts and names are our own.
import test from "node:test";
import assert from "node:assert/strict";
const P = await import("../src/profile.ts");
const Mo = await import("../src/monster.ts");
const { CITIES, NCITY } = await import("../src/cities.ts");

const mem = () => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), m }; };

test("a fresh profile: the starting parts, the first city, rivals on", () => {
  const p = P.fresh();
  assert.equal(p.v, P.VERSION);
  assert.deepEqual(P.startable(p), [0]);
  assert.equal(p.rivals, 1);
  for (const t of ["fur:0", "trim:0", "pattern:1", "face:0", "gear:0", "gear:1"]) assert.ok(p.owned.includes(t), t);
  assert.deepEqual(p.look, Mo.LOOK0);
});

test("save and load; garbage and nothing load fresh; a newer save is never written over", () => {
  const s = mem(), p = { ...P.fresh(), best: 1234 };
  P.save(p, s);
  assert.equal(P.load(s).profile.best, 1234);
  s.set(P.KEY, "{not json");
  assert.deepEqual(P.load(s).profile, P.fresh());
  assert.deepEqual(P.load(mem()).profile, P.fresh());
  s.set(P.KEY, JSON.stringify({ ...p, v: P.VERSION + 1 }));
  const r = P.load(s);
  assert.equal(r.newer, true);
  assert.equal(P.save(r.profile, s, r.newer), false, "not written over");
  assert.match(s.get(P.KEY), new RegExp(`"v":${P.VERSION + 1}`));
});

test("partial and out-of-range saves are repaired; a part you don't own falls back", () => {
  const p = P.normalize({ look: { fur: 9, trim: 99, pattern: -1, face: "x", gear: 255 }, owned: ["fur:3", "nope", "gear:9", "gear:4"], cleared: ["port-lumen", "atlantis"], best: -5 });
  assert.equal(p.look.fur, Mo.LOOK0.fur, "fur 9 is locked");
  assert.equal(p.look.trim, Mo.LOOK0.trim);
  assert.equal(p.look.gear, 1 | 2 | 16, "only owned gear bits stay on");
  assert.ok(p.owned.includes("fur:3") && !p.owned.includes("nope") && !p.owned.includes("gear:9"));
  assert.deepEqual(p.cleared, ["port-lumen"]);
  assert.equal(p.best, 0);
});

test("the CS1- export code round-trips; a slipped character is refused", () => {
  let p = P.fresh();
  p = P.clearCity(p, 0).profile;
  p = P.setPart(p, "fur", 3);
  p = { ...p, best: 98765 };
  const code = P.exportCode(p);
  assert.match(code, /^CS1-[A-Za-z0-9+/=]+-[0-9a-z]{3}$/);
  assert.deepEqual(P.importCode(code), p);
  const bad = code.slice(0, 10) + (code[10] === "A" ? "B" : "A") + code.slice(11);
  assert.equal(P.importCode(bad), null);
  assert.equal(P.importCode("OB1-xyz-abc"), null);
});

test("clearing a city unlocks its parts (once) and opens the next city; locked parts can't be worn", () => {
  let p = P.fresh();
  assert.equal(P.setPart(p, "fur", 3), p, "locked: refused");
  const a = P.clearCity(p, 0);
  assert.deepEqual(a.fresh, P.UNLOCKS[0]);
  p = a.profile;
  assert.deepEqual(P.startable(p), [0, 1]);
  assert.deepEqual(P.clearCity(p, 0).fresh, [], "only once");
  p = P.setPart(p, "fur", 3);
  assert.equal(p.look.fur, 3);
  p = P.setPart(p, "gear", 2);
  assert.ok(p.look.gear & 4, "the chest plate on");
  p = P.setPart(p, "gear", 2);
  assert.ok(!(p.look.gear & 4), "and off");
  // Every part is owned from the start or unlocked by exactly one city; every city unlocks something.
  const all = [["fur", Mo.FURS.length], ["trim", Mo.TRIMS.length], ["pattern", Mo.PATTERNS.length], ["face", Mo.FACES.length], ["gear", Mo.GEAR.length]];
  for (const [k, n] of all) for (let i = 0; i < n; i++) {
    const t = `${k}:${i}`, by = P.UNLOCKS.filter((u) => u.includes(t)).length;
    assert.equal(P.BASE.includes(t) ? 0 : 1, by, t);
  }
  assert.equal(P.UNLOCKS.length, NCITY);
  for (let ci = 0; ci < NCITY; ci++) p = P.clearCity(p, ci).profile;
  assert.equal(P.startable(p).length, NCITY);
  const end = P.endRun(p, 5000, { buildings: 6, snacks: 3, helis: 1 });
  assert.deepEqual([end.best, end.stats.runs, end.stats.buildings], [5000, 1, 6]);
});

test("the garage: the ape's name from its fur and face; three rivals of our own (never a lizard or a wolf)", () => {
  assert.equal(Mo.heroName(0, 0), "EMBER BROWLER");
  assert.deepEqual(Mo.RIVALS, ["SHARDCLAW", "GLOOPMAW", "VOLTWING"]);
  assert.ok(Mo.FURS.length >= 10 && Mo.GEAR.length === 8 && Mo.FACES.length === 5 && Mo.PATTERNS.length === 5);
  const words = [...Mo.FURS.map((f) => f.word), ...Mo.FACES.map((f) => f.word), ...Mo.RIVALS, ...CITIES.map((c) => c.name)];
  assert.equal(new Set(words).size, words.length, "every name its own");
  for (const w of Mo.RIVAL_WHAT) assert.doesNotMatch(w, /lizard|wolf/i);
});
