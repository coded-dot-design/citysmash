// v15, the levels, headless (src/round.ts DIFF): the AI rivals never move or punch faster than a player's own body
// allows on any level (walk, climb, a jump's speed up and along, the punch's rate); they notice a player only after
// their level's reaction, never turn round on the spot, and rest between moves; the seeded survival batch of an
// average player (the autopilot played in bursts, tapping no faster than a person) comes out EASY > MEDIUM > HARD;
// knocking a rival out and flattening a city still fire (the unlocks) on every level; practice is EASY.
import test from "node:test";
import assert from "node:assert/strict";

const R = await import("../src/round.ts");
const { RUBBLE } = await import("../src/block.ts");
const { WALK, AIR, CLIMB, IN, AI, DONE, RUN, KO, DIFF, LEVELS, PUNCH_CD, COMBO, T_RIVAL, AI_TURN } = R;

/** Steps run n frames; `input(I, i)` fills the seats (null: the hero on the autopilot); `each(run, i)` after each. */
function play(run, n, input, each) {
  const I = new Float64Array(24), A = new Float64Array(R.NI), ev = [];
  for (let i = 0; i < n && run.S[0] !== DONE; i++) {
    I.fill(0);
    if (input) input(I, i);
    else run.autopilot(A, 0), I.set(A, 0);
    run.step(1 / 60, I);
    for (let k = 0; k < run.n; k++) ev.push([run.ev[k * 3], run.ev[k * 3 + 1], run.ev[k * 3 + 2], i]);
    run.clear();
    each?.(run, i);
  }
  return ev;
}

/** A player's own maxima, measured on the same body: the stick held full, a jump from a run, the punch held down. */
function playerCaps() {
  const run = R.createRun(5);
  run.reset(5, 0, 0, 0, 2);
  run.S[0] = RUN;
  const M = run.MV[0];
  let walk = 0, climb = 0, vy = 0, vx = 0, x0 = M[0], y0 = M[1], m0 = M[5];
  const look = () => {
    if (M[5] === WALK && m0 === WALK) walk = Math.max(walk, Math.abs(M[0] - x0) * 60);
    if (M[5] === CLIMB && m0 === CLIMB) climb = Math.max(climb, Math.abs(M[1] - y0) * 60);
    if (M[5] === AIR && m0 === WALK) (vy = Math.max(vy, M[4])), (vx = Math.max(vx, Math.abs(M[3])));
    (x0 = M[0]), (y0 = M[1]), (m0 = M[5]);
  };
  // Walk right, then jump at the first building's wall and climb it.
  play(run, 60, (I) => (I[0] = -1), look);
  play(run, 240, (I, i) => ((I[0] = 1), (I[1] = 1), (I[3] = i % 30 === 0 ? 1 : 0)), look);
  return { walk, climb, vy, vx, punch: PUNCH_CD / COMBO[COMBO.length - 1] };
}

test("v15: the AI rivals never exceed a player's own caps on any level (walk, climb, a jump up and along, the punch's rate), and at the level's speed", () => {
  const P = playerCaps();
  assert.ok(Math.abs(P.walk - 5.2) < 0.01 && Math.abs(P.climb - 3.4) < 0.01, `the player's walk ${P.walk}, climb ${P.climb}`);
  for (let lv = 0; lv < 3; lv++) {
    const spd = DIFF[lv][0], got = { walk: 0, climb: 0, vy: 0, vx: 0, gap: 9, punches: 0, t: 0 };
    assert.ok(spd <= 1, `${LEVELS[lv]}: never above a player's speed`);
    for (const [seed, ci] of [[11, 0], [12, 2], [13, 4], [14, 6]]) {
      const run = R.createRun(seed);
      run.reset(seed, ci, 1, 0, lv);
      const sx = run.bk.L[3], prev = run.MV.map((O) => [O[0], O[1], O[5], O[8]]), last = [-9, -9, -9, -9];
      play(run, 60 * 90, null, (r, i) => {
        for (let k = 1; k < R.NM; k++) {
          const O = r.MV[k], [px, py, pm, p8] = prev[k];
          prev[k] = [O[0], O[1], O[5], O[8]];
          if (O[24] !== IN || O[28] !== AI) continue;
          // (a knock, a stun, a pounce's crouch are not walking; the run-in from off the table's end is the entrance)
          const free = O[15] <= 0 && O[53] <= 0 && O[11] <= 0;
          if (free && O[5] === WALK && pm === WALK && Math.abs(O[0]) <= sx && Math.abs(px) <= sx) got.walk = Math.max(got.walk, Math.abs(O[0] - px) * 60);
          if (free && O[5] === CLIMB && pm === CLIMB) got.climb = Math.max(got.climb, Math.abs(O[1] - py) * 60);
          if (free && O[5] === AIR && pm === WALK) (got.vy = Math.max(got.vy, O[4])), (got.vx = Math.max(got.vx, Math.abs(O[3])));
          if (O[8] > p8 + 0.01) (got.gap = Math.min(got.gap, (i - last[k]) / 60)), (last[k] = i), got.punches++;
        }
        got.t += 1 / 60;
      });
    }
    const at = `${LEVELS[lv]}`;
    assert.ok(got.walk > 0 && got.climb > 0 && got.vy > 0, `${at}: the rivals walked, climbed and jumped`);
    assert.ok(got.walk <= P.walk * spd + 1e-6, `${at}: walk ${got.walk.toFixed(2)} ≤ ${(P.walk * spd).toFixed(2)}`);
    assert.ok(got.climb <= P.climb * spd + 1e-6, `${at}: climb ${got.climb.toFixed(2)} ≤ ${(P.climb * spd).toFixed(2)}`);
    assert.ok(got.vy <= P.vy + 1e-6, `${at}: a jump's speed up ${got.vy.toFixed(2)} ≤ the player's ${P.vy}`);
    assert.ok(got.vx <= P.vx * spd + 1e-6, `${at}: a jump's speed along ${got.vx.toFixed(2)} ≤ ${(P.vx * spd).toFixed(2)}`);
    assert.ok(got.gap >= P.punch - 1e-6, `${at}: punches at most at a player's best combo rate (${got.gap.toFixed(3)} s ≥ ${P.punch} s)`);
  }
});

/** A quiet street: no army, nobody at the windows; the rival SHARDCLAW (monster 1) on the AI, by the still player. */
function face(lv, gap = 2.4) {
  const run = R.createRun(3);
  run.reset(3, 0, 0, 0, lv);
  run.S[0] = RUN;
  for (let h = 0; h < R.NH; h++) run.HE[h * 12 + 8] = 1e9;
  run.TK[4] = 1e9; run.FE[3] = 1e9; run.FE[8] = 1e9; run.FE[10] = 1e9; run.T[0] = 1e9; run.T[1] = 1e9;
  run.SO.fill(0); run.occ.fill(0);
  run.join(1, AI);
  const M = run.MV[0], O = run.MV[1];
  O[24] = IN;
  for (const [Q, x, f] of [[M, -6, 1], [O, -6 + gap, -1]]) (Q[5] = WALK), (Q[0] = x), (Q[1] = 0), (Q[3] = Q[4] = 0), (Q[6] = f), (Q[7] = 100), (Q[12] = -1);
  return run;
}

test("v15: a rival notices a player only after its level's reaction (EASY slowest), rests a beat after a move, and never turns round on the spot", () => {
  const first = [];
  for (let lv = 0; lv < 3; lv++) {
    let at = -1;
    for (let tries = 0; tries < 6 && at < 0; tries++) {
      const run = face(lv);
      // (its odds of going for him: retried on a few seeds until it does)
      run.R[0] = 1 + tries * 977;
      const ev = play(run, 60 * 8, () => {});
      const w = ev.find((e) => e[0] === R.E_POWER && e[2] === 1);
      if (w) at = (w[3] + 1) / 60 - R.POWER_HIT;
    }
    assert.ok(at >= 0, `${LEVELS[lv]}: it goes for him in the end`);
    assert.ok(at >= DIFF[lv][1] - 1 / 60, `${LEVELS[lv]}: not before its reaction (${at.toFixed(2)} s ≥ ${DIFF[lv][1]} s)`);
    first.push(at);
  }
  assert.ok(first[0] > first[2], `EASY notices later than HARD (${first.map((t) => t.toFixed(2)).join(" / ")} s)`);
  // A whole city's play, every level: a walk one way and then the other always has a beat of standing between.
  for (let lv = 0; lv < 3; lv++) {
    const run = R.createRun(21);
    run.reset(21, 4, 1, 0, lv);
    const d = [0, 0, 0, 0], still = [0, 0, 0, 0], prev = [0, 0, 0, 0];
    let flips = 0, turns = 0;
    play(run, 60 * 120, null, (r) => {
      for (let k = 1; k < R.NM; k++) {
        const O = r.MV[k], was = prev[k];
        prev[k] = O[5];
        still[k] += 1 / 60;
        // (a walking frame: on the street a frame ago too, not knocked; the time since the last one counts whatever it did)
        if (O[24] !== IN || O[28] !== AI || O[5] !== WALK || was !== WALK || O[15] > 0 || O[11] > 0 || Math.abs(O[3]) < 0.05) continue;
        const v = Math.sign(O[3]);
        if (d[k] && v !== d[k]) (turns++, still[k] < AI_TURN + 1 / 60 - 1e-6 && flips++);
        (d[k] = v), (still[k] = 0);
      }
    });
    assert.ok(turns > 0, `${LEVELS[lv]}: the rivals turned round`);
    assert.equal(flips, 0, `${LEVELS[lv]}: never on the spot (a beat of ${AI_TURN} s first; ${turns} turns)`);
  }
});

/** The average player: the hero's autopilot played in bursts (1.5 s on, 1 s idle: standing or hanging), tapping no
 *  faster than every 0.45 s. One run on `seed` at level lv: the cities cleared, and the time in the first one. */
function average(seed, lv) {
  const run = R.createRun(seed);
  run.reset(seed, 0, 1, 0, lv);
  const I = new Float64Array(24), A = new Float64Array(R.NI), M = run.MV[0];
  let tap = -9, c1 = -1;
  for (let i = 0; i < 60 * 600 && run.S[0] !== DONE && !M[29] && M[5] !== KO; i++) {
    const t = i / 60;
    run.autopilot(A, 0);
    if (t % 2.5 > 1.5) A.fill(0);
    if (A[2] || A[4]) t - tap < 0.45 ? (A[2] = A[4] = A[5] = 0) : (tap = t);
    I.fill(0);
    I.set(A, 0);
    run.step(1 / 60, I);
    run.clear();
    if (run.S[18] >= 1 && c1 < 0) c1 = t;
  }
  return { cleared: run.S[18], c1: c1 < 0 ? run.S[19] : c1 };
}

test("v15: the seeded survival batch (50 seeds, an average player): EASY clears city 1 nearly always, MEDIUM most of the time, HARD sometimes; cities 1–3 EASY > MEDIUM > HARD", () => {
  const N = 50, out = [];
  for (let lv = 0; lv < 3; lv++) {
    const rs = Array.from({ length: N }, (_, s) => average((s + 1) * 7919, lv));
    const pct = (n) => (100 * rs.filter((r) => r.cleared >= n).length) / N;
    out.push({ c1: pct(1), c3: pct(3), t: rs.map((r) => r.c1).sort((a, b) => a - b)[N >> 1] });
  }
  const say = out.map((o, lv) => `${LEVELS[lv]} ${o.c1}% / ${o.c3}% (median ${o.t.toFixed(0)} s in city 1)`).join(" · ");
  assert.ok(out[0].c1 >= 95, `EASY clears city 1 nearly always: ${say}`);
  assert.ok(out[1].c1 >= 75, `MEDIUM most of the time: ${say}`);
  assert.ok(out[2].c1 >= 20 && out[2].c1 <= 80, `HARD sometimes: ${say}`);
  assert.ok(out[0].c3 > out[1].c3 && out[1].c3 > out[2].c3, `cities 1–3 in order: ${say}`);
  assert.ok(out[0].c1 >= out[1].c1 && out[1].c1 > out[2].c1, `city 1 in order: ${say}`);
});

test("v15: on every level a knocked-out rival and a flat city still fire (the unlocks); practice is EASY", () => {
  for (let lv = 0; lv < 3; lv++) {
    const run = face(lv, 2.4), O = run.MV[1];
    O[7] = 1;
    const ev = play(run, 90, (I, f) => f === 0 && ((I[2] = 1), (I[5] = T_RIVAL + 1)));
    assert.ok(ev.some((e) => e[0] === R.E_KO && e[2] === 1), `${LEVELS[lv]}: the rival is knocked out (it unlocks)`);
    for (let b = 0; b < run.nb(); b++) run.B[b * 6] = RUBBLE;
    run.S[4] = run.nb();
    const ev2 = play(run, 150, () => {});
    assert.ok(ev2.some((e) => e[0] === R.E_CLEAR), `${LEVELS[lv]}: the city clears (its parts unlock)`);
  }
  const p = R.createRun(1);
  p.reset(1, 0, 1, 1, 2);
  assert.equal(p.S[33], 0, "practice is EASY whatever the menu says");
});
