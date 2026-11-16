// CitySmash online, headless: the sync gate. The wire carries each seat's numbers in 32 bits (and the
// ape's look in the first frames); two and four screens on src/rollback.ts over an in-memory link
// with latency and jitter (messages overtake) end byte for byte on the run with no network at all,
// across a city change; one wrong input shows in the state hash (the desync check); a seat that leaves
// goes back to the AI on the same frame everywhere; and the corrections allocate (almost) nothing.
import test from "node:test";
import assert from "node:assert/strict";
const R = await import("../src/round.ts");
const N = await import("../src/net.ts");
const { createEngine } = await import("@fzlt/core/kernel");
const { memory } = await import("@fzlt/core/presence");
const { encode, decode, hashOf, rollback, GONE, B_GONE, lookBits, takeLook, lookOf, LOOK_FRAMES, packMode, unpackMode } = N;

/** Seat p's scripted numbers on frame f (its own pattern: only it would know it). */
const I5 = new Float64Array(5);
const script = (f, p) => {
  I5[0] = Math.sin(f / (37 + p * 11) + p); I5[1] = Math.cos(f / (29 + p * 7)); I5[2] = f % (13 + p) === 0 ? 1 : 0; I5[3] = f % (90 + p * 5) === 0 ? 1 : 0; I5[4] = f % 41 === 0 ? 1 : 0;
  return encode(I5, 0);
};
const IN = new Float64Array(20);
/** A run for P seats (seat k drives monster k), from city `ci`. */
const make = (P, ci = 0, seed = 7) => {
  const r = R.createRun(seed);
  for (let k = 1; k < R.NM; k++) r.MV[k][28] = k < P ? k : R.AI;
  r.reset(seed, ci, 1);
  return r;
};
const frame = (r, inputs, P) => {
  IN.fill(0);
  for (let p = 0; p < P; p++) {
    const b = inputs[p];
    if (b & B_GONE) { if (r.MV[p][28] !== R.AI && p > 0) r.join(p, R.AI); continue; }
    decode(b, p, IN);
  }
  r.step(1 / 60, IN);
  r.clear();
};
const same = (a, b) => a.bytes.every((v, i) => Buffer.from(v).equals(Buffer.from(b.bytes[i])));
function straight(P, frames, ci, input = script) {
  const r = make(P, ci), inp = new Uint32Array(P);
  for (let f = 0; f < frames; f++) {
    for (let p = 0; p < P; p++) inp[p] = input(f, p);
    frame(r, inp, P);
  }
  return r;
}
function online(P, frames, ci, { latency = 0, jitter = 0, seed = 3, input = script } = {}) {
  const hub = memory({ peers: P, latency, jitter, seed, cap: 4096 }), off = { hidden: false, offscreen: false, editable: false };
  return Array.from({ length: P }, (_, s) => {
    const e = createEngine({ seed: 1, pause: off }), sim = make(P, ci);
    const rb = rollback(e, { transport: hub.ends[s], slot: s, players: P, gone: GONE, bytes: sim.bytes, input: (f) => input(f, s), step: (inputs) => frame(sim, inputs, P) });
    rb.hold = frames;
    return { e, sim, rb, hub };
  });
}
function drive(runs, frames) {
  for (let t = 0; t < frames * 3 && !runs.every((r) => r.rb.final === frames); t++) {
    runs[0].hub.tick();
    for (const r of runs) r.e.advance(r.e.dt);
  }
}

test("the wire: a seat's numbers survive the trip; the host's pick fits a byte; the ape's look rides four frames", () => {
  const I = new Float64Array([1, -1, 1, 0, 1]), O = new Float64Array(5);
  decode(encode(I, 0), 0, O);
  assert.deepEqual(Array.from(O), [1, -1, 1, 0, 1]);
  decode(encode(new Float64Array(5), 0), 0, O);
  assert.deepEqual(Array.from(O), [0, 0, 0, 0, 0], "a still stick reads 0");
  for (const m of [[0, 1], [6, 0], [3, 1]]) assert.deepEqual(Object.values(unpackMode(packMode(...m))), m);
  const look = { fur: 11, trim: 7, pattern: 4, face: 3, gear: 0b10110101 };
  let acc = 0;
  for (let f = 0; f < LOOK_FRAMES; f++) acc = takeLook(acc, encode(I, 0, lookBits(look, f)), f);
  assert.deepEqual(lookOf(acc), look);
  decode(encode(I, 0, lookBits(look, 0)), 0, O);
  assert.equal(O[0], 1, "the look bits leave the numbers alone");
});

test("one input stream, many screens: identical; one wrong input shows in the hash", () => {
  const P = 3, a = make(P), b = make(P), c = make(P), inp = new Uint32Array(P);
  let first = -1;
  for (let f = 0; f < 60 * 60; f++) {
    for (const [r, bad] of [[a, 0], [b, 0], [c, 1]]) {
      for (let p = 0; p < P; p++) inp[p] = bad && f === 200 && p === 1 ? (script(f, p) & ~15) | 15 : script(f, p);
      frame(r, inp, P);
    }
    if (f % 30 === 29) {
      assert.equal(hashOf(a.bytes), hashOf(b.bytes), `frame ${f}`);
      if (first < 0 && hashOf(a.bytes) !== hashOf(c.bytes)) first = f;
    }
  }
  assert.ok(first >= 200 && first < 240, `caught at ${first}`);
});

test("rollback over a link with latency and jitter: two and four screens end byte for byte on the no-latency run", () => {
  for (const [P, ci] of [[2, 0], [4, 2]]) {
    const F = 1500;
    const want = straight(P, F, ci);
    for (const [latency, jitter, seed] of [[0, 0, 1], [5, 3, 2], [12, 9, 3]]) {
      const runs = online(P, F, ci, { latency, jitter, seed });
      drive(runs, F);
      for (const r of runs) {
        assert.equal(r.rb.final, F, `${P} seats ${latency}±${jitter}: finished`);
        assert.equal(r.rb.desync, -1, `${P} seats ${latency}±${jitter}: no desync`);
        assert.ok(same(r.sim, want), `${P} seats, latency ${latency} ± ${jitter}: byte for byte the no-latency run`);
      }
      if (latency) assert.ok(runs.every((r) => r.rb.corrections > 0), "corrections ran");
      for (const r of runs) r.e.destroy();
    }
  }
});

test("rollback across cities: the autopilot flattens city one and the run moves on, identical on both screens", () => {
  const P = 2, F = 60 * 75, A = new Float64Array(5);
  // Seat 0 plays the autopilot of its own screen's run (the same run everywhere, so the same numbers).
  const ref = make(P);
  const auto = (f) => (f === 0 ? encode(new Float64Array([1, 0, 0, 0, 0]), 0) : (ref.autopilot(A, 0), encode(A, 0)));
  const inputs = [];
  const sim = make(P), inp = new Uint32Array(P);
  for (let f = 0; f < F; f++) {
    ref.bytes.forEach((v, i) => v.set(sim.bytes[i]));
    inp[0] = auto(f); inp[1] = script(f, 1);
    inputs.push(inp[0]);
    frame(sim, inp, P);
  }
  assert.ok(sim.S[16] >= 1, `the run moved on to city ${sim.S[16] + 1}`);
  const runs = online(P, F, 0, { latency: 6, jitter: 4, seed: 5, input: (f, s) => (s === 0 ? inputs[f] ?? 0 : script(f, 1)) });
  drive(runs, F);
  for (const r of runs) assert.ok(r.rb.final === F && r.rb.desync === -1 && same(r.sim, sim), "identical across the city change");
  for (const r of runs) r.e.destroy();
});

test("a seat that leaves: its rival goes back to the AI on the same frame everywhere; the others stay identical", () => {
  const P = 3, GONE_AT = 500, hub = memory({ peers: P, latency: 3, jitter: 2, seed: 5 }), off = { hidden: false, offscreen: false, editable: false }, L = [], runs = [];
  for (let s = 0; s < P; s++) {
    const end = hub.ends[s], t = { send: (d) => end.send(d), listen: (f) => ((L[s] = f), end.listen(f)), close: () => end.close() };
    const e = createEngine({ seed: 1, pause: off }), sim = make(P);
    const rb = rollback(e, { transport: t, slot: s, players: P, gone: GONE, bytes: sim.bytes, input: (f) => script(f, s), step: (inputs) => frame(sim, inputs, P) });
    runs.push({ e, sim, rb });
  }
  let told = false, quiet = 0;
  for (let t = 0; t < 2000; t++) {
    hub.tick();
    for (let s = 0; s < P; s++) if (!(s === 2 && runs[2].rb.frame >= GONE_AT)) runs[s].e.advance(runs[s].e.dt);
    if (runs[2].rb.frame >= GONE_AT && !told && ++quiet > 8) {
      told = true;
      runs[2].rb.destroy();
      for (let s = 0; s < 2; s++) L[s](Uint8Array.of(4, 2, P, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    }
  }
  const [a, b] = runs, at = Math.max(a.rb.frame, b.rb.frame) + 2;
  for (const r of [a, b]) r.rb.hold = at;
  for (let t = 0; t < 600 && ![a, b].every((r) => r.rb.final === at); t++) (hub.tick(), [a, b].forEach((r) => r.e.advance(r.e.dt)));
  assert.ok(told && a.rb.leftAt(2) === b.rb.leftAt(2) && a.rb.leftAt(2) > GONE_AT, "left on the same frame");
  assert.equal(a.sim.MV[2][28], R.AI, "GLOOPMAW is the AI's again");
  assert.ok(same(a.sim, b.sim) && a.rb.desync === -1 && b.rb.desync === -1, "identical, no desync");
  for (const r of runs) r.e.destroy();
});

test("four screens with rollback allocate (almost) nothing", async () => {
  const P = 4, runs = online(P, 1e9, 0, { latency: 5, jitter: 3, seed: 2 });
  const tick = () => (runs[0].hub.tick(), runs.forEach((r) => r.e.advance(r.e.dt)));
  for (const r of runs) r.rb.hold = -1;
  for (let i = 0; i < 4000; i++) tick();
  let minor = 0;
  const obs = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.detail?.kind === 1) minor++; });
  globalThis.gc?.();
  obs.observe({ entryTypes: ["gc"] });
  for (let i = 0; i < 10000; i++) tick();
  await new Promise((ok) => setTimeout(ok, 50));
  obs.disconnect();
  const resims = runs.map((r) => r.rb.resims);
  console.log(`CitySmash online: ${minor} young GCs over 10,000 ticks of four screens with rollback (${resims.join(" / ")} frames run again).`);
  assert.ok(runs.every((r) => r.rb.desync < 0), "no desync");
  assert.ok(resims.every((n) => n > 5000), `corrections ran: ${resims}`);
  assert.ok(minor <= 12, `young GCs: ${minor}`);
  for (const r of runs) r.e.destroy();
});
