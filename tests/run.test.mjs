// CitySmash's run, headless (src/round.ts, src/block.ts, src/climber.ts): every city's layout; the run
// waits for the first input; a jump at a side wall grabs it; from the wall every punch lands on the one
// window by the climb (chip, crack, hole: three presses, fixed timing, no drift); a live part shocks;
// GRAB eats the person at the window; enough holes and a building shakes and pancakes; out of health a
// monster shrinks and runs off; each city's feature (the gunboat, the train, the surge, the trucks, two
// helicopters); city after city (the card, the next city, the score carried, the difficulty rising, the
// unlock hook); the same seed and inputs give the same run; a run restores byte for byte from its bytes;
// and it allocates nothing per step.
import test from "node:test";
import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";

const R = await import("../src/round.ts");
const { CITIES, NCITY, RAIL, PLANT, BRIDGE, HARBOUR, SKYPORT } = await import("../src/cities.ts");
const { NCMAX, NBMAX, HOLE, INTACT, CRACKED, SHAKE, RUBBLE, GAP } = await import("../src/block.ts");
const { HAND, ZW } = await import("../src/climber.ts");
const { READY, RUN, CLEAR, DONE, WALK, AIR, CLIMB, ROOF, KO, IN, OUT, AI, CRAB } = R;

/** Play n frames; `input(I, i)` fills seat one's numbers (I[0..5], R.NI a seat) and the others'; "auto": the autopilot. */
function play(run, n, input) {
  const I = new Float64Array(24), A = new Float64Array(6), ev = [];
  for (let i = 0; i < n && run.S[0] !== DONE; i++) {
    I.fill(0);
    if (input === "auto") run.autopilot(A, 0), I.set(A, 0);
    else if (input) input(I, i);
    run.step(1 / 60, I);
    for (let k = 0; k < run.n; k++) ev.push([run.ev[k * 3], run.ev[k * 3 + 1], run.ev[k * 3 + 2]]);
    run.clear();
  }
  return ev;
}
/** A run in city ci with no army, nobody at the windows and no rivals: the rules alone. */
const quiet = (ci = 0) => {
  const run = R.createRun(20261116);
  run.reset(20261116, ci, 0, 0, 2); // (HARD: every rule at its plain number)
  run.S[0] = RUN;
  for (let h = 0; h < R.NH; h++) run.HE[h * 12 + 8] = 1e9;
  run.TK[4] = 1e9; run.FE[3] = 1e9; run.FE[8] = 1e9; run.FE[10] = 1e9;
  run.SO.fill(0); run.occ.fill(0);
  return run;
};
const cellOf = (run, b, fl, col) => run.C0[b] + fl * run.BLD[b * 4 + 1] + col;
const hangAt = (run, M, b, s, fl) => {
  M[5] = CLIMB; M[12] = b; M[22] = s; M[0] = run.wallX(b, s); M[2] = ZW; M[6] = -s; M[1] = fl + 0.5 - HAND;
};
const hash = (run) => {
  let h = 2166136261;
  for (const v of run.bytes) for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v[i], 16777619);
  return h >>> 0;
};

test("seven original cities: buildings with gaps to hang in, a landmark, live parts on edge windows, a feature each", () => {
  assert.equal(NCITY, 7);
  const run = R.createRun(1), seen = new Set();
  for (let ci = 0; ci < NCITY; ci++) {
    run.reset(1, ci, 1);
    const c = CITIES[ci], nb = run.nb(), BLD = run.BLD;
    seen.add(c.feature);
    assert.ok(nb >= 5 && nb <= NBMAX, `${c.name}: ${nb} buildings`);
    assert.ok(run.bk.L[1] <= NCMAX, `${c.name}: ${run.bk.L[1]} windows fit`);
    assert.ok(c.landmark >= 0 && c.landmark < nb && BLD[c.landmark * 4 + 3] === 5, `${c.name}: the landmark`);
    for (let b = 1; b < nb; b++) assert.ok(Math.abs(BLD[b * 4] - BLD[(b - 1) * 4] - BLD[(b - 1) * 4 + 1] - GAP) < 1e-9, "a gap to hang in");
    let live = 0;
    for (let b = 0; b < nb; b++) {
      const w = BLD[b * 4 + 1], f = BLD[b * 4 + 2];
      assert.ok(run.bk.NEED[b] >= 4 && run.bk.NEED[b] < (w * f) / 2, `${c.name} building ${b}: ${run.bk.NEED[b]} holes`);
      for (let fl = 0; fl < f; fl++) for (let col = 0; col < w; col++) if (run.LIVE[cellOf(run, b, fl, col)]) (live++, assert.ok(col === 0 || col === w - 1, "live parts on an edge column"));
    }
    assert.ok(live >= 3, `${c.name}: ${live} live parts`);
    assert.ok(Math.abs(BLD[0] + run.SX - 2.2) < 1e-9, "the table's ends past the outer buildings");
  }
  assert.equal(seen.size, 7, "a different feature in every city");
  assert.deepEqual(CITIES.map((c) => c.tod), [0, 0, 1, 1, 2, 2, 2], "day, dusk, night across a run");
});

test("the run waits for the first input; the AI rivals come in from the table's ends", () => {
  const run = R.createRun(5);
  play(run, 30);
  assert.equal(run.S[0], READY);
  assert.equal(run.S[1], 0, "the clock waits");
  const ev = play(run, 1, (I) => (I[0] = 1));
  assert.equal(run.S[0], RUN);
  assert.equal(ev[0][0], R.E_START);
  play(run, 120, (I) => (I[0] = 0.01));
  assert.equal(run.MV[CRAB][24], IN, "SHARDCLAW is in");
  assert.equal(run.MV[2][24], R.OUT, "city one: one rival");
});

test("a jump at a side wall grabs it; up the side to the roof; a wall jump off", () => {
  const run = quiet(), M = run.M;
  M[0] = run.wallX(1, -1) - 2.2;
  const ev = play(run, 60, (I, i) => { I[0] = 1; I[3] = i === 10 ? 1 : 0; });
  assert.equal(M[5], CLIMB, "hanging on the wall");
  assert.deepEqual([M[12], M[22]], [1, -1], "building 1, its left side");
  assert.ok(ev.some((e) => e[0] === R.E_CLIMB));
  play(run, 60 * 4, (I) => (I[1] = 1));
  assert.equal(M[5], ROOF, "up onto the roof");
  play(run, 1, (I) => (I[3] = 1));
  assert.equal(M[5], AIR, "a jump off");
});

test("from the wall every punch lands on the one window in front (chip, crack, hole: three presses, fixed timing), it never drifts", () => {
  const run = quiet(), M = run.M, b = 3, i = cellOf(run, b, 3, 0);
  hangAt(run, M, b, -1, 3);
  play(run, 30);
  const at0 = [M[0], M[1], M[2]], seen = [];
  for (let n = 0; n < 3; n++) {
    const ev = play(run, Math.round(R.PUNCH_CD * 60) + 2, (I, f) => (I[2] = f === 0 ? 1 : 0));
    seen.push([run.HIT[i], run.cell[i]]);
    assert.equal(ev.filter((e) => e[0] === R.E_PUNCH).length, 1, "one punch per press");
    assert.deepEqual([M[0], M[1], M[2]], at0, "it stays on its spot");
  }
  assert.deepEqual(seen, [[1, INTACT], [2, CRACKED], [3, HOLE]], "a chip, a crack, a hole");
  for (let k = 0; k < run.bk.L[1]; k++) if (k !== i) assert.equal(run.HIT[k], 0, "one target");
  const r = quiet(), j = cellOf(r, b, 3, 0);
  hangAt(r, r.M, b, -1, 3);
  play(r, 30);
  let frame = -1;
  play(r, 30, (I, f) => { I[2] = f === 0 ? 1 : 0; if (frame < 0 && r.HIT[j]) frame = f; });
  assert.equal(frame, Math.round(R.PUNCH_HIT * 60), "the hit lands on a fixed frame");
  // Up held with the punch: the window above (the climb stops while the punch is out).
  const u = quiet();
  hangAt(u, u.M, b, -1, 2);
  play(u, 6);
  const fl = Math.floor(u.M[1] + HAND - u.yOff(b));
  play(u, 20, (I, f) => ((I[2] = f === 0 ? 1 : 0), (I[1] = f === 0 ? 1 : 0)));
  assert.equal(u.HIT[cellOf(u, b, fl + 1, 0)], 1, "up: the window above");
});

test("the reach on a wall: 7 cells (level close, medium, far; up and down close, medium), 5 on the top floor; the far side out of reach", () => {
  const run = quiet(), M = run.M, BLD = run.BLD;
  assert.deepEqual(R.REACH, [0, 1, 0, 2, 0, 3, 1, 1, 1, 2, -1, 1, -1, 2], "one table");
  let b = -1;
  for (let k = 0; k < run.nb(); k++) if (BLD[k * 4 + 1] >= 5 && BLD[k * 4 + 2] >= 5) b = k;
  assert.ok(b >= 0, "a building at least 5 wide");
  const w = BLD[b * 4 + 1], f = BLD[b * 4 + 2];
  for (const s of [-1, 1]) {
    hangAt(run, M, b, s, 2);
    assert.equal(run.reachCount(M), 7, `side ${s}: seven on the wall`);
    const col = (c) => (s < 0 ? c - 1 : w - c);
    for (let c = 0; c < R.NR; c++) assert.equal(run.reachCell(M, c), cellOf(run, b, 2 + R.REACH[c * 2], col(R.REACH[c * 2 + 1])), `side ${s}, cell ${c}`);
    // Never past the third window in: the far side is the other edge's.
    for (let c = 0; c < R.NR; c++) { const i = run.reachCell(M, c) - run.C0[b], cc = i % w; assert.ok(s < 0 ? cc < 3 : cc > w - 4, "in reach only three windows in"); }
    hangAt(run, M, b, s, f - 1);
    assert.equal(run.reachCount(M), 5, `side ${s}: five on the top floor`);
    hangAt(run, M, b, s, 0); M[1] = 0.05 - 1; // (the hand on the bottom floor: a monster hung low)
    assert.equal(run.levelRow(M), 0);
    assert.equal(run.reachCount(M), 5, `side ${s}: five on the bottom floor`);
  }
});

test("a tap picks the window: in reach it is punched (live parts too), out of reach a whiff; keys aim close, medium, far", () => {
  const run = quiet(), M = run.M, b = 3, w = run.BLD[b * 4 + 1];
  run.LIVE.fill(0);
  hangAt(run, M, b, -1, 3);
  play(run, 10);
  // The far window, past the close and medium ones (still whole).
  play(run, 20, (I, f) => ((I[2] = f === 0 ? 1 : 0), (I[5] = f === 0 ? R.T_CELL + 2 : 0)));
  assert.equal(run.HIT[cellOf(run, b, 3, 2)], 1, "the far window chipped");
  assert.equal(run.HIT[cellOf(run, b, 3, 0)] + run.HIT[cellOf(run, b, 3, 1)], 0, "the near ones untouched");
  // Down medium.
  play(run, 20, (I, f) => ((I[2] = f === 0 ? 1 : 0), (I[5] = f === 0 ? R.T_CELL + 6 : 0)));
  assert.equal(run.HIT[cellOf(run, b, 2, 1)], 1, "down medium chipped");
  // A miss: the swing and nothing else.
  const before = run.HIT.reduce((a, v) => a + v, 0);
  const ev = play(run, 20, (I, f) => ((I[2] = f === 0 ? 1 : 0), (I[5] = f === 0 ? R.T_MISS : 0)));
  assert.ok(ev.some((e) => e[0] === R.E_PUNCH) && ev.some((e) => e[0] === R.E_WHIFF), "a swing, a whiff");
  assert.equal(run.HIT.reduce((a, v) => a + v, 0), before, "nothing hit");
  // A cell off the building (the top floor's up row): a whiff too.
  hangAt(run, M, b, -1, run.BLD[b * 4 + 2] - 1);
  play(run, 10);
  const ev2 = play(run, 20, (I, f) => ((I[2] = f === 0 ? 1 : 0), (I[5] = f === 0 ? R.T_CELL + 3 : 0)));
  assert.ok(ev2.some((e) => e[0] === R.E_WHIFF), "out of reach: a whiff");
  // Keys: a flick in towards the building steps the aim (close → medium → far), the punch goes there.
  const k = quiet(), K = k.M;
  k.LIVE.fill(0);
  hangAt(k, K, b, -1, 3);
  play(k, 10);
  play(k, 4, (I, f) => (I[0] = f < 2 ? 1 : 0));
  play(k, 4, (I, f) => (I[0] = f < 2 ? 1 : 0));
  assert.equal(K[39], 2, "aimed far");
  play(k, 20, (I, f) => (I[2] = f === 0 ? 1 : 0));
  assert.equal(k.HIT[cellOf(k, b, 3, 2)], 1, "the key punch went far");
  void w;
});

test("v11: the grab reaches from the facing hand: a fan in front, above and below, never behind him or under his body; it mirrors with where he faces", () => {
  assert.equal(R.GRAB.length, R.NG * 2, "12 grab cells, one table");
  assert.equal(R.GRAB_HELI.length, R.NGH * 2, "8 for the helicopters, one table");
  const run = quiet(), M = run.M;
  M[5] = WALK; M[0] = 0; M[1] = 0; M[2] = 1.9;
  for (const f of [1, -1]) {
    M[6] = f;
    for (const T of [undefined, R.GRAB_HELI]) for (let g = 0, n = T ? R.NGH : R.NG; g < n; g++) {
      run.grabCell(M, g, T);
      const out = (run.GC[0] - M[0]) * f;
      // Every cell is in front: below the shoulder its whole width out past the body (the cell is 0.92 wide,
      // half 0.46); from the shoulder up (by the head, narrower) its centre at least as far out as the hand's side.
      const dy = (T ?? R.GRAB)[g * 2 + 1];
      if (dy < 1) assert.ok(out - 0.46 >= R.BODY_X - 0.01, `facing ${f}, cell ${g}${T ? " (helicopter)" : ""}: ${out.toFixed(2)} out, clear of the body`);
      else assert.ok(out >= 0.85, `facing ${f}, cell ${g}: ${out.toFixed(2)} out, in front of him`);
      assert.ok(run.GC[1] > 0, "not under the street");
    }
  }
  // In front, above the head and down at the street all count; behind, not.
  M[6] = 1;
  const hy = R.GRAB_Y;
  assert.ok(run.inGrab(M, R.GRAB_X, hy), "in front, at the hand");
  assert.ok(run.inGrab(M, R.GRAB_X, hy + 3), "in front, over his head");
  assert.ok(run.inGrab(M, R.GRAB_X, hy - 1), "in front, down at the street");
  assert.ok(run.inGrab(M, R.GRAB_X + 2, hy), "two out");
  assert.ok(!run.inGrab(M, -R.GRAB_X, hy) && !run.inGrab(M, 0, hy) && !run.inGrab(M, 0, hy + 1) && !run.inGrab(M, -0.9, hy + 2), "behind him and his own body's middle: not in reach");
  assert.ok(run.inGrab(M, 0.9, hy + 2), "by his head, in front: in reach");
  M[6] = -1;
  assert.ok(run.inGrab(M, -R.GRAB_X, hy) && !run.inGrab(M, R.GRAB_X, hy), "it mirrors with where he faces");
});

test("v11: on the street a person in front is grabbed (the pop: NOM); one behind: he turns (fixed time), then grabs; a soldier behind too; out of reach a whiff", () => {
  const run = quiet(1), M = run.M, b = 2, x0 = run.BLD[b * 4];
  run.LIVE.fill(0);
  const grab = (t, n = 40) => play(run, n, (I, f) => ((I[4] = f === 0 ? 1 : 0), (I[5] = f === 0 ? t : 0)));
  const noms = (ev) => ev.filter((e) => e[0] === R.E_NOM).length;
  const g = (dx, dy) => { for (let i = 0; i < R.NG; i++) if (R.GRAB[i * 2] === dx && R.GRAB[i * 2 + 1] === dy) return i; return -1; };
  const stand = (x, f) => { M[5] = WALK; M[0] = x; M[1] = 0; M[2] = 1.9; M[6] = f; M[3] = 0; M[14] = 0; M[45] = 0; M[49] = 0; play(run, 2); };
  // Facing the building, the ground floor's window two columns in front of the hand: someone there.
  stand(x0 + 0.5 - R.GRAB_X, 1);
  run.grabCell(M, g(0, 0));
  const i = run.winAt(run.GC[0], run.GC[1]);
  assert.ok(i >= 0, "the cell in front of the hand is a window");
  run.occ[i] = 1;
  const ev = grab(R.T_GRAB + g(0, 0));
  assert.equal(noms(ev), 1, "in front: eaten, with the pop");
  assert.equal(run.occ[i], 0);
  assert.ok(M[50] !== 0 && Math.abs(M[50] - (x0 + 0.5)) < 0.6, "the arm reaches to that spot");
  // Behind: he faces away from it; the scene's code for it is T_BACK + the cell once turned.
  stand(x0 + 0.5 + R.GRAB_X, 1);
  run.occ[i] = 1;
  const before = M[6];
  const ev2 = play(run, 4, (I, f) => ((I[4] = f === 0 ? 1 : 0), (I[5] = f === 0 ? R.T_BACK + g(0, 0) : 0)));
  assert.equal(M[6], -before, "he turned to face it");
  assert.equal(noms(ev2), 0, "not yet: the turn first");
  const ev3 = play(run, 30);
  assert.equal(noms(ev3), 1, "then grabbed");
  assert.equal(run.occ[i], 0);
  // A soldier behind him in reach once turned: he turns, then eats it.
  stand(0, 1);
  run.SO.fill(0);
  run.SO.set([1, -R.GRAB_X, 2, 1, 0, 9, 0, 0], 0);
  const ev4 = grab(R.T_SOLDIER + 0, 40);
  assert.equal(M[6], -1, "turned round to the soldier");
  assert.equal(noms(ev4), 1, "and ate him");
  // Far off: the hand closes on air.
  stand(0, 1);
  run.CH.fill(0);
  run.CH.set([1, 7, 1.6, 0.3, 0, 0, 1, 0, 0], 0);
  const m = grab(R.T_CHUTE + 0);
  assert.ok(m.some((e) => e[0] === R.E_WHIFF) && noms(m) === 0 && run.CH[0] > 0, "out of reach: a whiff");
});

test("v11: on a wall the grab is the 7 punch cells, the windows above and below them on the front and the gap's air over his head and under his feet; nothing behind the building or behind him; every grab pops", () => {
  assert.equal(R.GRAB_WALL.length, R.NGW * 2, "one wall table");
  for (let c = 0; c < R.NR; c++) assert.deepEqual([R.GRAB_WALL[c * 2], R.GRAB_WALL[c * 2 + 1]], [R.REACH[c * 2 + 1], R.REACH[c * 2]], `grab cell ${c} is reach cell ${c}`);
  for (let g = 0; g < R.NGW; g++) {
    const dx = R.GRAB_WALL[g * 2], dy = R.GRAB_WALL[g * 2 + 1];
    assert.ok(dx >= 0, `wall grab cell ${g}: not behind him`);
    if (dx === 0) assert.ok(Math.abs(dy) >= 3, `wall grab cell ${g}: in the gap only over his head or under his feet`);
  }
  const run = quiet(), M = run.M, b = 3;
  run.LIVE.fill(0);
  hangAt(run, M, b, -1, 4);
  play(run, 10);
  const grab = (t) => play(run, 30, (I, f) => ((I[4] = f === 0 ? 1 : 0), (I[5] = f === 0 ? t : 0)));
  const noms = (ev) => ev.filter((e) => e[0] === R.E_NOM).length;
  for (let g = 0; g < R.NGW; g++) {
    run.grabCell(M, g);
    const i = run.winAt(run.GC[0], run.GC[1]);
    if (i < 0) continue;
    run.occ.fill(0);
    run.occ[i] = 1;
    assert.equal(noms(grab(R.T_GRAB + g)), 1, `wall grab cell ${g}: eaten, with the pop`);
  }
  const lv = run.yOff(b) + 4 + 0.5, edge = run.BLD[b * 4];
  assert.ok(!run.inGrab(M, edge - 1.5, lv) && !run.inGrab(M, edge - 2.5, lv), "behind him (out in the street's air): nothing");
  assert.ok(!run.inGrab(M, edge - 0.5, lv) && !run.inGrab(M, edge - 0.5, lv - 1), "his own column, where his body is: nothing");
  assert.ok(!run.inGrab(M, edge + 3.5, lv), "4 in is too far");
  const m = grab(R.T_GRAB + R.NGW);
  assert.ok(m.some((e) => e[0] === R.E_WHIFF) && noms(m) === 0, "a code past the table: a whiff");
  run.occ.fill(0);
  run.occ[run.reachCell(M, 2)] = 1;
  assert.equal(noms(play(run, 30, (I, f) => (I[4] = f === 0 ? 1 : 0))), 1, "the gamepad's grab reaches the far cell");
  M[5] = WALK; M[1] = 0; M[2] = 1.9;
  assert.equal(run.grabCount(M), R.NG, "off a wall: 15");
  hangAt(run, M, b, -1, 4);
  assert.equal(run.grabCount(M), R.NGW, "on a wall: 13");
  // Helicopters: in front of the hand, swatted; behind him, not.
  const heli = (x) => {
    run.HE.fill(0);
    run.HE.set([1, x, lv, 0.4], 0);
    run.HE[8] = run.HE[20] = 1e9;
    return play(run, 20, (I, f) => ((I[2] = f === 0 ? 1 : 0), (I[5] = f === 0 ? R.T_HELI : 0)));
  };
  assert.ok(heli(edge - 1.5).some((e) => e[0] === R.E_WHIFF) && run.HE[0] === 1, "a chopper behind him: a whiff");
  assert.ok(heli(edge + 0.5).some((e) => e[0] === R.E_HELI), "a chopper in front of the hand: swatted");
});

test("v11: the bottom floor smashes: from the street a ground-floor window in front reaches a hole (chip, crack, hole); behind, he turns; from the wall at the lowest hang the down cell reaches it; held down at the bottom a moment, he lets go", () => {
  const run = quiet(2), M = run.M, b = 1, x0 = run.BLD[b * 4];
  run.LIVE.fill(0);
  const punch = (t) => play(run, 30, (I, f) => ((I[2] = f === 0 ? 1 : 0), (I[5] = f === 0 ? t : 0)));
  M[5] = WALK; M[0] = x0 + 0.5 - R.GRAB_X; M[1] = 0; M[2] = 1.9; M[6] = 1;
  play(run, 2);
  const i = run.lowCell(M, 0);
  assert.equal(i, cellOf(run, b, 0, 0), "the window in front of the hand on the bottom floor");
  for (let k = 0; k < 3; k++) punch(R.T_LOW);
  assert.equal(run.cell[i], HOLE, "from the street: three hits, a hole");
  // Behind: he turns in the wind-up and hits it.
  M[6] = 1; M[0] = x0 + 1.5 + R.GRAB_X;
  play(run, 2);
  const j = cellOf(run, b, 0, 1);
  punch(R.T_LOW + R.NLOW);
  // (now it is in front: the scene's next taps on it are front codes)
  punch(R.T_LOW); punch(R.T_LOW);
  assert.equal(M[6], -1, "turned to it");
  assert.equal(run.cell[j], HOLE, "behind: a hole too");
  // From the wall: climb down to the bottom (down held, not long enough to let go), punch down close.
  const b2 = 3, w2 = run.BLD[b2 * 4 + 1];
  hangAt(run, M, b2, 1, 2);
  play(run, 120, (I, f) => (I[1] = f < 100 && run.M[1] > 0.06 ? -1 : 0));
  assert.equal(M[5], CLIMB, "still on the wall at the bottom");
  assert.ok(M[1] <= 0.06, "at the lowest hang");
  const g = run.reachCell(M, 5);
  assert.equal(g, cellOf(run, b2, 0, w2 - 1), "down close is the bottom floor's edge window");
  for (let k = 0; k < 3; k++) punch(R.T_CELL + 5);
  assert.equal(run.cell[g], HOLE, "from the wall: a hole on the bottom floor");
  // Down held on at the bottom: after a moment he lets go.
  play(run, 40, (I) => (I[1] = -1));
  assert.equal(M[5], WALK, "held down at the bottom, he lets go");
});

test("the combo: fast, accurate taps speed the punch up (x1 -> x1.25 -> x1.5 -> x1.6); a whiff or a pause drops it; ten taps out of reach give nothing; the AI only to x1.25", () => {
  const run = quiet(), M = run.M, b = 3;
  run.LIVE.fill(0);
  hangAt(run, M, b, -1, 2);
  play(run, 10);
  // (The windows mend each frame: a hole is no target, so the chain stays on fresh glass.)
  const tap = (t) => (I, f) => { run.cell.fill(INTACT); run.HIT.fill(0); run.B.fill(0); if (f % 4 === 0) (I[2] = 1), (I[5] = t); };
  // A chain of taps in reach, one as soon as it can: the combo climbs to its top.
  const seen = new Set();
  play(run, 120, (I, f) => { tap(R.T_CELL + 1)(I, f); seen.add(M[46]); });
  assert.deepEqual([...seen].filter((v) => v > 1).sort(), [1.25, 1.5, 1.6], "the ladder");
  assert.equal(M[46], 1.6);
  // Faster: punches in the same second at the top of the combo vs none.
  const count = (ev) => ev.filter((e) => e[0] === R.E_PUNCH).length;
  const fast = count(play(run, 60, tap(R.T_CELL + 2)));
  // A pause: dropped.
  play(run, 60);
  assert.equal(M[46], 1, "a pause drops it");
  const slow = count(play(run, 60, (I, f) => { tap(R.T_CELL + 2)(I, f); M[46] = 1; }));
  assert.ok(fast > slow, `faster at the top: ${fast} punches a second vs ${slow}`);
  // A whiff drops it.
  play(run, 60, tap(R.T_CELL + 1));
  assert.ok(M[46] > 1);
  let wf = -1;
  for (let f = 0; f < 30 && wf < 0; f++) if (play(run, 1, (I) => { if (f === 0) (I[2] = 1), (I[5] = R.T_MISS); }).some((e) => e[0] === R.E_WHIFF)) wf = f;
  assert.ok(wf >= 0 && wf < 0.6 * 60, `the whiff (frame ${wf}, before any pause counts)`);
  assert.equal(M[46], 1, "a whiff drops it");
  // Spam out of reach: ten taps, no speed.
  play(run, 60);
  play(run, 60, (I, f) => { if (f % 6 === 0) (I[2] = 1), (I[5] = R.T_MISS); });
  assert.equal(M[46], 1, "ten taps out of reach: x1");
  // The AI: at most x1.25.
  const ai = R.createRun(5);
  ai.reset(5, 0, 1);
  ai.S[0] = RUN;
  let top = 0;
  play(ai, 60 * 40, (I) => { for (let k = 1; k < R.NM; k++) top = Math.max(top, ai.MV[k][46]); });
  assert.ok(top <= 1.25, `the AI tops out at x${top}`);
});

test("spam does not pay: ten rapid taps on one window land no more than the fixed timing allows; a whiff costs a recovery", () => {
  const run = quiet(), M = run.M, b = 3;
  run.LIVE.fill(0);
  hangAt(run, M, b, -1, 3);
  play(run, 10);
  const i = cellOf(run, b, 3, 1);
  // Ten taps in half a second (one every three frames), then nothing.
  const ev = play(run, 30 + 40, (I, f) => { if (f < 30 && f % 3 === 0) (I[2] = 1), (I[5] = R.T_CELL + 1); });
  const punches = ev.filter((e) => e[0] === R.E_PUNCH).length, most = Math.floor(0.5 / R.PUNCH_CD) + 2;
  assert.ok(punches <= most && run.HIT[i] === punches, `${punches} punches, ${run.HIT[i]} hits (at most ${most}: one each ${R.PUNCH_CD} s, one queued)`);
  // A whiff: the next punch waits the swing and the recovery.
  play(run, 30);
  let next = -1;
  for (let f = 0; f < 60 && next < 0; f++) {
    const e = play(run, 1, (I) => { if (f === 0) (I[2] = 1), (I[5] = R.T_MISS); else if (f % 2 === 0) (I[2] = 1), (I[5] = R.T_CELL); });
    if (f > 0 && e.some((x) => x[0] === R.E_PUNCH)) next = f;
  }
  assert.ok(next >= Math.round((R.PUNCH_CD + R.WHIFF_T) * 60) - 1, `after a whiff the next punch starts at frame ${next}`);
});

test("the tapped target rides the input: the same inputs, the same run (and a save restores it)", () => {
  const a = R.createRun(9), b2 = R.createRun(9);
  for (const r of [a, b2]) r.reset(9, 0, 1);
  const input = (I, i) => { I[0] = Math.sin(i / 30); I[1] = Math.cos(i / 41); I[3] = i % 70 === 0 ? 1 : 0; if (i % 11 === 0) (I[2] = 1), (I[5] = 1 + (i % 7)); if (i % 17 === 0) (I[4] = 1), (I[5] = R.T_GRAB + (i % R.NG)); if (i % 53 === 0) (I[2] = 1), (I[5] = R.T_MISS); };
  play(a, 60 * 30, input);
  play(b2, 60 * 30, input);
  assert.equal(hash(a), hash(b2), "identical");
  const c = R.createRun(9);
  c.reset(9, 0, 1);
  play(c, 60 * 30, (I, i) => { input(I, i); if (i % 11 === 0) I[5] = 1 + ((i + 1) % 7); });
  assert.notEqual(hash(a), hash(c), "another target, another run");
});

test("a live part shocks: health, it lets go and drops", () => {
  const run = quiet(), M = run.M, BLD = run.BLD;
  let at = -1;
  for (let b = 0; b < run.nb() && at < 0; b++) for (let fl = 1; fl < BLD[b * 4 + 2] && at < 0; fl++) if (run.LIVE[cellOf(run, b, fl, 0)]) at = b * 100 + fl;
  assert.ok(at >= 0, "a live part on a left edge");
  const b = (at / 100) | 0, fl = at % 100;
  hangAt(run, M, b, -1, fl);
  const hp = M[7], ev = play(run, 20, (I, f) => (I[2] = f === 0 ? 1 : 0));
  assert.ok(ev.some((e) => e[0] === R.E_SHOCK), "zap");
  assert.equal(M[7], hp - R.SHOCK_HP);
  assert.notEqual(M[5], CLIMB, "it let go");
});

test("GRAB eats the person at the window next to the hand (health back); a hot pot burns", () => {
  const run = quiet(), M = run.M, i = cellOf(run, 3, 3, 0);
  hangAt(run, M, 3, -1, 3);
  M[7] = 40;
  run.occ[i] = 1;
  const ev = play(run, 1, (I) => (I[4] = 1));
  assert.ok(ev.some((e) => e[0] === R.E_NOM && e[1] === i), "nom");
  assert.deepEqual([M[7], run.occ[i], M[26], M[25]], [56, 0, 1, 100], "health back, eaten, counted, points");
  play(run, 30);
  run.occ[cellOf(run, 3, 3, 1)] = 3;
  const ev2 = play(run, 1, (I) => (I[4] = 1));
  assert.ok(ev2.some((e) => e[0] === R.E_BURN) && M[7] < 56, "a hot pot burns");
});

test("enough holes and it shakes, pancakes floor by floor (smoothly), and drops whoever hangs on it", () => {
  const run = quiet(), M = run.M, B = run.B, b = 1, f = run.BLD[b * 4 + 2];
  for (let k = 0; k < 60 && B[b * 6] === 0; k++) {
    hangAt(run, M, b, k & 1 ? 1 : -1, 1 + (k % 4));
    M[1] = Math.max(0.05, M[1]);
    play(run, Math.round(R.PUNCH_CD * 60) * 4, (I) => (I[2] = 1));
  }
  assert.ok(B[b * 6] >= SHAKE, `it shakes after ${B[b * 6 + 1]} holes`);
  let prev = run.top(b), jumps = 0;
  play(run, 60 * 6, () => { const t = run.top(b); if (prev - t > 0.25) jumps++; prev = t; });
  assert.equal(B[b * 6], RUBBLE, "rubble");
  assert.equal(jumps, 0, "the roof comes down smoothly");
  assert.equal(run.S[8], f, "every floor counted");
  assert.ok(M[5] !== CLIMB || M[12] !== b, "it dropped off");
});

test("out of health a monster shrinks and runs off; with no player left the run ends", () => {
  const run = quiet(), M = run.M;
  M[7] = 1;
  run.setCur(0);
  run.PB[0] = 1; run.PB[1] = M[0]; run.PB[2] = M[1] + 2; run.PB[3] = M[2];
  const ev = play(run, 60 * 6);
  assert.ok(ev.some((e) => e[0] === R.E_KO), "knocked out");
  assert.equal(M[24], OUT, "ran off the table");
  assert.equal(run.S[0], DONE, "the run is over");
  assert.equal(run.S[20], 0, "not won");
});

test("each city's feature: the gunboat on the water, the train bowls you over (and derails), the surge, the trucks, two helicopters", () => {
  // The harbour: the tank is a boat out on the water.
  const h = R.createRun(2);
  h.reset(2, 0, 0);
  h.S[0] = RUN;
  play(h, 60 * 12, (I) => (I[0] = 0.01));
  assert.equal(CITIES[0].feature, HARBOUR);
  assert.ok(h.TK[0] === 1 && h.TK[7] > 5.6, `the gunboat on the water (z ${h.TK[7]})`);
  // The rail yard: bells, then the train; on the street it knocks you flat; a punch derails it.
  const ci = CITIES.findIndex((c) => c.feature === RAIL), t = quiet(ci), M = t.M;
  t.FE[3] = 0.1;
  const ev = play(t, 60 * 7, (I) => (I[0] = 0.01));
  assert.ok(ev.some((e) => e[0] === R.E_BELLS) && ev.some((e) => e[0] === R.E_RAM), "bells, then rammed");
  assert.ok(M[7] < 100, "it hurts");
  const d = quiet(ci);
  d.FE[0] = 2; d.FE[1] = d.M[0] + 1.6; d.FE[2] = -1; d.FE[4] = 2.5; d.M[15] = 9;
  const ev2 = play(d, 20, (I, f) => (I[2] = f === 0 ? 1 : 0));
  assert.ok(ev2.some((e) => e[0] === R.E_TRAIN) && d.FE[0] === 3, "derailed");
  // The power plant: a surge shocks a climber beside a live part.
  const pi = CITIES.findIndex((c) => c.feature === PLANT), p = quiet(pi);
  let hit = -1;
  for (let b = 0; b < p.nb() && hit < 0; b++) for (let fl = 1; fl < p.BLD[b * 4 + 2] && hit < 0; fl++) if (p.LIVE[cellOf(p, b, fl, 0)]) hit = b * 100 + fl;
  hangAt(p, p.M, (hit / 100) | 0, -1, hit % 100);
  p.FE[8] = 0.05;
  const ev3 = play(p, 30);
  assert.ok(ev3.some((e) => e[0] === R.E_SURGE) && ev3.some((e) => e[0] === R.E_SHOCK), "a surge, and a shock");
  // The bridge: trucks drive the deck; landing on one stops it.
  const bi = CITIES.findIndex((c) => c.feature === BRIDGE), q = quiet(bi);
  q.FE[10] = 0.01;
  play(q, 3);
  assert.equal(q.TR[0], 1, "a truck on the deck");
  q.TR[3] = 0; q.TR[1] = 0;
  q.M[0] = q.TR[1]; q.M[5] = AIR; q.M[1] = 3; q.M[4] = -12; q.M[15] = 9;
  const ev4 = play(q, 30);
  assert.ok(ev4.some((e) => e[0] === R.E_TRUCK), "stomped");
  // The skyport: two helicopters up at once.
  const si = CITIES.findIndex((c) => c.feature === SKYPORT), s = R.createRun(4);
  s.reset(4, si, 0);
  s.S[0] = RUN;
  play(s, 60 * 16, (I) => (I[0] = 0.01));
  assert.ok(s.HE[0] > 0 && s.HE[12] > 0, "two helicopters");
});

test("city after city: flat → the card → the next city (score carried, the KO'd back, harder), to the end of the run", () => {
  const run = R.createRun(9);
  run.reset(9, 0, 1, 0, 0); // (EASY: the autopilot keeps going city after city)
  const ev = play(run, 60 * 60 * 6, "auto"), cities = ev.filter((e) => e[0] === R.E_CITY).map((e) => e[1]);
  const clears = ev.filter((e) => e[0] === R.E_CLEAR).map((e) => e[1]);
  assert.ok(clears.length >= 3, `the autopilot flattens cities: ${clears}`);
  assert.deepEqual(cities.slice(0, clears.length), clears.map((c) => c + 1).slice(0, cities.length), "each clear loads the next city");
  assert.ok(run.S[2] > 20000, `the score carries (${run.S[2]})`);
  // The card: a press skips it once it has been up a moment; else it times out.
  const c = quiet();
  for (let b = 0; b < c.nb(); b++) c.B[b * 6] = RUBBLE;
  c.S[4] = c.nb();
  play(c, 60 * 2);
  assert.equal(c.S[0], CLEAR, "the card");
  const s0 = c.S[2];
  play(c, 60 * 1.5, (I, f) => (I[2] = f === 80 ? 1 : 0));
  assert.equal(c.S[16], 1, "the next city");
  assert.equal(c.S[0], RUN);
  assert.equal(c.S[2], s0, "the score carried");
  // Harder: more soldiers at once, an armoured tank, faster helicopters further in.
  const soldiers = (ci) => {
    const r = R.createRun(3);
    r.reset(3, ci, 0);
    r.S[0] = RUN;
    let most = 0;
    play(r, 60 * 50, (I, f) => { I[0] = f % 2 ? 0.01 : -0.01; let n = 0; for (let k = 0; k < R.NS; k++) if (r.SO[k * 8] > 0) n++; most = Math.max(most, n); r.M[7] = 100; });
    return most;
  };
  assert.ok(soldiers(5) > soldiers(0), "more soldiers later");
  const late = R.createRun(3);
  late.reset(3, 4, 0);
  late.S[0] = RUN;
  play(late, 60 * 10, (I) => (I[0] = 0.01));
  assert.ok(late.TK[9] >= 2, `armour on the tank (${late.TK[9]})`);
});

test("the same seed and inputs give the same run; a run restores byte for byte from its bytes", () => {
  const a = R.createRun(77), b = R.createRun(77), c = R.createRun(78);
  for (const r of [a, b, c]) r.reset(r === c ? 78 : 77, 0, 1), r.join(1, 1);
  const input = (I, i) => { I[0] = Math.sin(i / 40); I[1] = Math.cos(i / 55); I[2] = i % 17 === 0 ? 1 : 0; I[3] = i % 90 === 0 ? 1 : 0; I[4] = i % 33 === 0 ? 1 : 0; I[6] = Math.sin(i / 23); I[8] = i % 13 === 0 ? 1 : 0; I[5] = i % 29 === 0 ? 1 + (i % 7) : i % 31 === 0 ? 8 + (i % 24) : 0; };
  play(a, 60 * 40, input);
  play(b, 60 * 40, input);
  play(c, 60 * 40, input);
  assert.equal(hash(a), hash(b), "same seed, same inputs, same bytes");
  assert.notEqual(hash(a), hash(c), "another seed, another run");
  // Save, run on wrong inputs, restore: no trace.
  const s = R.createRun(5), t = R.createRun(5);
  for (let f = 0; f < 60 * 30; f++) {
    if (f % 97 === 50) {
      const keep = s.bytes.map((v) => v.slice());
      play(s, 12, (I, i) => input(I, f + 500 + i));
      s.bytes.forEach((v, i) => v.set(keep[i]));
    }
    play(s, 1, (I) => input(I, f));
    play(t, 1, (I) => input(I, f));
  }
  assert.equal(hash(s), hash(t), "restored exactly");
});

test("players take the rivals from the AI (and give them back)", () => {
  const run = R.createRun(3);
  run.reset(3, 0, 0);
  assert.equal(run.MV[CRAB][24], OUT, "rivals off");
  run.join(CRAB, 1);
  play(run, 2, (I) => (I[6] = 1));
  assert.equal(run.MV[CRAB][24], IN, "P2 brings SHARDCLAW in");
  assert.equal(run.MV[CRAB][28], 1);
  const x = run.MV[CRAB][0];
  play(run, 30, (I) => (I[6] = -1));
  assert.ok(run.MV[CRAB][0] < x, "P2 drives it");
  run.join(CRAB, AI);
  assert.equal(run.MV[CRAB][28], AI, "back to the AI");
});

test("v10: a cast of any kinds: you play SHARDCLAW, the ape is the first AI rival; the kinds hold over a reset and a new city", () => {
  const run = R.createRun(3);
  [1, 0, 2, 3].forEach((k, s) => (run.MV[s][31] = k));
  run.reset(3, 0, 1);
  assert.deepEqual(run.MV.map((O) => O[31]), [1, 0, 2, 3], "kept over a reset");
  assert.equal(run.MV[0][28], 0, "slot 0 is yours");
  assert.equal(run.MV[1][24], R.WAIT, "the ape waits to come in as an AI rival");
  run.loadCity(4);
  assert.deepEqual(run.MV.map((O) => O[31]), [1, 0, 2, 3], "kept in a new city");
  play(run, 600, (I, f) => (I[0] = f < 10 ? 1 : 0));
  assert.equal(run.MV[1][24], IN, "the ape came in");
});

test("the run allocates nothing per step", async () => {
  const run = R.createRun(20261116), I = new Float64Array(24), A = new Float64Array(6);
  const go = (n) => {
    for (let i = 0; i < n; i++) {
      if (run.S[0] === DONE) run.reset(20261116, (i / 600) % NCITY | 0, 1);
      run.autopilot(A, 0);
      I.set(A, 0);
      run.step(1 / 60, I);
      run.clear();
    }
  };
  // The warm-up is the measured run itself, from the same seed, three times over: every branch the sampled steps
  // take (each city, its rare events) has run and V8 has tiered it up before the sampling starts. A warm-up on
  // other steps left first-seen branches to the sampled window: their one-off feedback and deopts (16 KB
  // blamed on whatever function, ~2 runs in 10 over the 40 KB line), not a per-step allocation.
  const same = () => (run.reset(20261116, 0, 1), go(60 * 180));
  go(60 * 600);
  for (let k = 0; k < 3; k++) same();
  const s = new Session();
  s.connect();
  await s.post("HeapProfiler.startSampling", { samplingInterval: 64 });
  same();
  const { profile } = await s.post("HeapProfiler.stopSampling");
  s.disconnect();
  const mine = [];
  let bytes = 0;
  const walk = (n) => {
    if (n.selfSize && /\/src\/(round|block|climber)\.ts/.test(n.callFrame.url)) (bytes += n.selfSize), mine.push(`${n.callFrame.functionName || "(anonymous)"}: ${n.selfSize} B`);
    for (const c of n.children) walk(c);
  };
  walk(profile.head);
  assert.ok(bytes < 40000, `no allocation per step: ${bytes} B in 180 s (${mine.join(", ")})`);
});
void [WALK, KO, ZW];
