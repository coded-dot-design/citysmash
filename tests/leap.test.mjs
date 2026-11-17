// v14, the jump on a wall (owner: "tap = switch buildings, double tap = let go"): a tap leaps across the gap to
// the next building's near wall in every city (the same height or the highest it can hang), the outer wall of the
// end building has nothing in reach (a short arc down: TOO FAR), a second jump within LEAP_TAP lets go (straight
// down to the street, no wall caught), practice's two steps; deterministic and the same after a restore.
import test from "node:test";
import assert from "node:assert/strict";

const R = await import("../src/round.ts");
const { NCITY } = await import("../src/cities.ts");
const { RUBBLE } = await import("../src/block.ts");
const { HAND, ZW, E_LEAP, LEAP_TAP } = await import("../src/climber.ts");
const { RUN, WALK, AIR, CLIMB } = R;

const quiet = (ci = 0) => {
  const run = R.createRun(20261116);
  run.reset(20261116, ci, 0);
  run.S[0] = RUN;
  for (let h = 0; h < R.NH; h++) run.HE[h * 12 + 8] = 1e9;
  run.TK[4] = 1e9; run.FE[3] = 1e9; run.FE[8] = 1e9; run.FE[10] = 1e9;
  run.SO.fill(0); run.occ.fill(0); run.LIVE.fill(0);
  return run;
};
const hangAt = (run, M, b, s, fl) => {
  M[5] = CLIMB; M[12] = b; M[22] = s; M[0] = run.wallX(b, s); M[2] = ZW; M[6] = -s; M[1] = fl + 0.5 - HAND;
};
function play(run, n, input) {
  const I = new Float64Array(24), ev = [];
  for (let i = 0; i < n; i++) {
    I.fill(0);
    if (input) input(I, i);
    run.step(1 / 60, I);
    for (let k = 0; k < run.n; k++) ev.push([run.ev[k * 3], run.ev[k * 3 + 1], run.ev[k * 3 + 2]]);
    run.clear();
  }
  return ev;
}
const leapsOf = (ev) => ev.filter((e) => e[0] === E_LEAP && e[2] === 0).map((e) => e[1]);

test("a jump on a wall leaps to the next building's near wall, in every city, both ways", () => {
  for (let ci = 0; ci < NCITY; ci++) {
    for (const s of [1, -1]) {
      const run = quiet(ci), M = run.MV[0], nb = run.nb(), b = s > 0 ? 0 : nb - 1;
      hangAt(run, M, b, s, 2);
      const y0 = M[1];
      const ev = play(run, 90, (I, i) => (I[3] = i === 2 ? 1 : 0));
      assert.equal(M[5], CLIMB, `city ${ci} side ${s}: hanging again`);
      assert.equal(M[12], b + s, `city ${ci}: on the next building`);
      assert.equal(M[22], -s, "on its near wall");
      assert.ok(Math.abs(M[1] - Math.min(y0, run.top(b + s) - 1.6)) < 0.8, `about the same height (${y0.toFixed(2)} → ${M[1].toFixed(2)})`);
      assert.deepEqual(leapsOf(ev), [1, 3], "a leap, then caught");
    }
  }
});

test("the end building's outer wall: nothing in reach, a short arc down to the street (TOO FAR)", () => {
  const run = quiet(0), M = run.MV[0];
  hangAt(run, M, 0, -1, 3);
  const ev = play(run, 120, (I, i) => (I[3] = i === 2 ? 1 : 0));
  assert.equal(M[5], WALK, "on the street");
  assert.deepEqual(leapsOf(ev), [0]);
});

test("a double tap lets go: straight down to the street, no wall caught; one tap past the window still leaps", () => {
  const run = quiet(1), M = run.MV[0];
  hangAt(run, M, 1, 1, 3);
  const x0 = M[0], ev = play(run, 150, (I, i) => (I[3] = i === 2 || i === 2 + Math.floor(LEAP_TAP * 60) - 4 ? 1 : 0));
  assert.equal(M[5], WALK, "dropped to the street");
  assert.ok(Math.abs(M[0] - x0) < 1.3, "it came down in the gap");
  assert.deepEqual(leapsOf(ev), [1, 2], "a leap, then let go");
  const run2 = quiet(1), M2 = run2.MV[0];
  hangAt(run2, M2, 1, 1, 3);
  play(run2, 90, (I, i) => (I[3] = i === 2 || i === 2 + Math.ceil(LEAP_TAP * 60) + 6 ? 1 : 0));
  assert.equal(M2[5], CLIMB, "a second tap after the window: caught, then a leap again (no let-go)");
});

test("a fallen neighbour: the leap goes over its rubble to the next standing one in reach", () => {
  const run = quiet(0), M = run.MV[0];
  run.B[1 * 6] = RUBBLE;
  hangAt(run, M, 0, 1, 1);
  const ev = play(run, 120, (I, i) => (I[3] = i === 2 ? 1 : 0));
  const d = run.wallX(2, -1) - run.wallX(0, 1);
  if (d <= 9) assert.ok(M[5] === CLIMB && M[12] === 2, `caught building 2 (${d.toFixed(1)} away)`);
  else assert.deepEqual(leapsOf(ev), [0], "too far");
});

test("practice ticks off the leap and the let-go", () => {
  const run = quiet(0), M = run.MV[0];
  run.S[28] = 1;
  hangAt(run, M, 1, 1, 2);
  play(run, 60, (I, i) => (I[3] = i === 2 ? 1 : 0));
  assert.ok(run.S[29] & R.P_LEAP, "the leap");
  play(run, 60, (I, i) => (I[3] = i === 2 || i === 8 ? 1 : 0));
  assert.ok(run.S[29] & R.P_LETGO, "the let-go");
});

test("the leap is deterministic and restores byte for byte mid-air", () => {
  const go = () => {
    const run = quiet(2), M = run.MV[0];
    hangAt(run, M, 1, 1, 2);
    play(run, 10, (I, i) => (I[3] = i === 2 ? 1 : 0));
    return run;
  };
  const a = go(), b = go();
  assert.equal(a.MV[0][5], AIR, "mid-leap");
  const saved = a.bytes.map((v) => v.slice());
  play(a, 60);
  play(b, 60);
  assert.deepEqual([...a.MV[0]], [...b.MV[0]], "same inputs, same leap");
  const c = go();
  play(c, 0);
  c.bytes.forEach((v, i) => v.set(saved[i]));
  play(c, 60);
  assert.deepEqual([...c.MV[0]], [...a.MV[0]], "restored mid-air, the same landing");
});
