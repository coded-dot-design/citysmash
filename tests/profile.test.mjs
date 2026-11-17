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

test("the hair: a v1 save and a v1 code (before the hair) still load, with none; the hair round-trips the save and the code", () => {
  const v1 = { v: 1, look: { fur: 1, trim: 0, pattern: 1, face: 0, gear: 3 }, owned: ["fur:1"], cleared: [], best: 7, rivals: 1, stats: { runs: 1, buildings: 0, snacks: 0, helis: 0 } };
  const s = mem();
  s.set(P.KEY, JSON.stringify(v1));
  const got = P.load(s).profile;
  assert.equal(got.v, P.VERSION);
  assert.deepEqual([got.look.fur, got.look.hair, got.look.hairc, got.best], [1, 0, Mo.LOOK0.hairc, 7]);
  // A CS1- code made by the v1 game (the same format: base64 of the JSON, a checksum).
  const sum = (t) => { let h = 7; for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0; return (h % 46656).toString(36).padStart(3, "0"); };
  const body = Buffer.from(JSON.stringify(v1)).toString("base64"), old = P.importCode(`CS1-${body}-${sum(body)}`);
  assert.ok(old && old.look.hair === 0 && old.look.fur === 1, "an old code imports");
  let p = P.setPart(P.setPart(P.fresh(), "hair", 3), "hairc", 5);
  assert.deepEqual([p.look.hair, p.look.hairc], [3, 5], "every hair and colour is yours from the start");
  assert.deepEqual(P.importCode(P.exportCode(p)).look, p.look, "the code carries the hair");
  P.save(p, s);
  assert.deepEqual(P.load(s).profile.look, p.look, "the save carries the hair");
  assert.equal(P.normalize({ ...p, look: { ...p.look, hair: 9, hairc: -1 } }).look.hair, 0, "out of range: none");
  assert.deepEqual(Mo.HAIRS.map((h) => h.id), ["none", "mohawk", "spikes", "crest"]);
});

test("v10: the playable rivals: only the ape at first; beating a rival unlocks it (once); a locked one can't be picked", () => {
  let p = P.fresh();
  assert.equal(p.mon, 0);
  assert.ok(p.owned.includes("mon:0") && !p.owned.some((t) => /^mon:[123]$/.test(t)), "only the ape");
  assert.equal(P.setMon(p, 1), p, "SHARDCLAW is locked");
  const a = P.beat(p, 1);
  assert.ok(a.fresh);
  p = a.profile;
  assert.equal(P.beat(p, 1).fresh, false, "only once");
  assert.equal(P.beat(p, 0).fresh, false, "the ape is never won");
  p = P.setMon(p, 1);
  assert.equal(p.mon, 1);
  assert.equal(P.partName("mon:1"), "SHARDCLAW");
  // Its dress: its own colour, or a fur you own; a trim you own.
  assert.equal(P.setRival(p, 1, 0, 5), p, "fur 5 is locked");
  p = P.setRival(p, 1, 0, 1);
  p = P.setRival(p, 1, 1, 2);
  assert.deepEqual(p.rlook.slice(0, 2), [1, 2]);
  assert.deepEqual(Mo.rivalDress(1, p.rlook), [Mo.FURS[1].c, Mo.TRIMS[2].c]);
  assert.deepEqual(Mo.rivalDress(2, p.rlook), [undefined, undefined], "the others in their own colours");
  // It survives the code and a reload.
  assert.deepEqual(P.importCode(P.exportCode(p)), p);
  const s = mem();
  P.save(p, s);
  assert.deepEqual(P.load(s).profile, p);
  // A save that claims a rival it doesn't own plays the ape.
  assert.equal(P.normalize({ ...p, owned: ["fur:0"], mon: 2 }).mon, 0);
});

test("v10: an old save (v2) and an old CS1 code migrate with only the ape playable", () => {
  const old = { v: 2, look: { ...Mo.LOOK0, fur: 1 }, owned: [...P.BASE.filter((t) => !t.startsWith("mon:")), "fur:3", "mon:2"], cleared: ["port-lumen"], best: 77, rivals: 0, stats: { runs: 3, buildings: 4, snacks: 5, helis: 1 } };
  const s = mem();
  s.set(P.KEY, JSON.stringify(old));
  const p = P.load(s).profile;
  assert.equal(p.v, P.VERSION);
  assert.equal(p.mon, 0);
  assert.deepEqual(p.owned.filter((t) => t.startsWith("mon:")), ["mon:0"], "only the ape (a stray mon tag in an old save is dropped)");
  assert.deepEqual([p.look.fur, p.cleared, p.best, p.rivals, p.owned.includes("fur:3")], [1, ["port-lumen"], 77, 0, true], "the rest kept");
  assert.deepEqual(p.rlook, P.RLOOK0);
  // An old code (CS1, a v2 body) loads the same way.
  const b64 = Buffer.from(JSON.stringify(old)).toString("base64");
  let h = 7;
  for (let i = 0; i < b64.length; i++) h = (Math.imul(h, 31) + b64.charCodeAt(i)) >>> 0;
  const q = P.importCode(`CS1-${b64}-${(h % 46656).toString(36).padStart(3, "0")}`);
  assert.ok(q && q.mon === 0 && q.owned.filter((t) => t.startsWith("mon:")).length === 1 && q.best === 77);
});

test("v10: the cast: yours in slot 0, the ape first among the AI when you play a rival", () => {
  assert.deepEqual(P.cast(0), [0, 1, 2, 3]);
  assert.deepEqual(P.cast(1), [1, 0, 2, 3]);
  assert.deepEqual(P.cast(3), [3, 0, 1, 2]);
});

test("v15: the level is saved (MEDIUM by default), repaired when out of range, and an old save (v3) migrates to MEDIUM; the export code keeps it", () => {
  const f = P.fresh();
  assert.equal(P.VERSION, 4);
  assert.equal(f.level, 1, "MEDIUM by default");
  const s = mem();
  for (const level of [0, 1, 2]) {
    P.save({ ...f, level }, s);
    assert.equal(P.load(s).profile.level, level, `level ${level} round-trips`);
  }
  for (const bad of [3, -1, 1.5, "2", null]) assert.equal(P.normalize({ ...f, level: bad }).level, 1, `${bad} → MEDIUM`);
  const v3 = { v: 3, look: { ...Mo.LOOK0 }, owned: P.BASE.slice(), cleared: ["port-lumen"], best: 9, rivals: 1, mon: 0, rlook: P.RLOOK0.slice(), stats: { runs: 2, buildings: 1, snacks: 0, helis: 0 } };
  s.set(P.KEY, JSON.stringify(v3));
  const got = P.load(s).profile;
  assert.deepEqual([got.v, got.level, got.cleared, got.best], [4, 1, ["port-lumen"], 9], "v3 → v4: MEDIUM, the rest kept");
  const hard = { ...f, level: 2 };
  assert.equal(P.importCode(P.exportCode(hard))?.level, 2, "the export code carries it");
});
