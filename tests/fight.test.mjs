// CitySmash v12, the fight (src/round.ts, headless): a tap on a rival in reach is the power punch (a fixed wind-up,
// damage, a knockback; on a wall it knocks it off; out of the shoulder's reach a whiff); a jump onto a rival is a
// pounce (it is stunned, the next power punch adds the combo's bonus); the AI rivals fight back with the same moves
// and readable, fixed tells; the same inputs give the same run and a save restores it mid-fight; a parachute behind
// counts once toward the combo; the fight allocates nothing per step.
import test from "node:test";
import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";

const R = await import("../src/round.ts");
const { HAND, ZW, ZS } = await import("../src/climber.ts");
const { STREET0 } = await import("../src/block.ts");
const { RUN, DONE, WALK, AIR, CLIMB, IN, AI, T_TANK, T_FOE, TANK_HITS, BODY_X, T_RIVAL, POWER_HIT, POWER_HP, COMBO_HP, POUNCE_HP, STUN_T, POUNCE_TELL } = R;

function play(run, n, input) {
  const I = new Float64Array(24), ev = [];
  for (let i = 0; i < n && run.S[0] !== DONE; i++) {
    I.fill(0);
    if (input) input(I, i);
    run.step(1 / 60, I);
    for (let k = 0; k < run.n; k++) ev.push([run.ev[k * 3], run.ev[k * 3 + 1], run.ev[k * 3 + 2], i]);
    run.clear();
  }
  return ev;
}
/** A quiet run (no army, nobody at the windows) with the rival SHARDCLAW (monster 1) on seat two (so it does only what the test says). */
function arena(ci = 0) {
  const run = R.createRun(20261116);
  run.reset(20261116, ci, 0);
  run.S[0] = RUN;
  for (let h = 0; h < R.NH; h++) run.HE[h * 12 + 8] = 1e9;
  run.TK[4] = 1e9; run.FE[3] = 1e9; run.FE[8] = 1e9; run.FE[10] = 1e9;
  run.SO.fill(0); run.occ.fill(0); run.LIVE.fill(0);
  run.join(1, 1);
  play(run, 2);
  return run;
}
const street = (O, x, f) => { O[5] = WALK; O[0] = x; O[1] = 0; O[2] = ZS; O[3] = O[4] = 0; O[6] = f; O[8] = O[34] = O[45] = O[15] = O[53] = O[54] = 0; O[12] = -1; O[7] = 100; };
const tap = (t) => (I, f) => { if (f === 0) (I[2] = 1), (I[5] = t); };
const has = (ev, t) => ev.filter((e) => e[0] === t);
const hash = (run) => {
  let h = 2166136261;
  for (const v of run.bytes) for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v[i], 16777619);
  return h >>> 0;
};

test("v12: a tap on a rival in reach is the power punch: a fixed wind-up, damage, a knockback; behind him he turns; out of reach a whiff", () => {
  const run = arena(), M = run.MV[0], O = run.MV[1], x = -6;
  street(M, x, 1); street(O, x + 2.4, -1);
  assert.ok(run.powerReach(M, 1), "in reach from the shoulder");
  const ev = play(run, 60, tap(T_RIVAL + 1));
  const p = has(ev, R.E_PUNCH)[0], hit = has(ev, R.E_POWER)[0];
  assert.ok(p && hit, "the punch starts and lands");
  assert.equal(hit[1], 1, "on the rival");
  assert.ok(Math.abs((hit[3] - p[3]) / 60 - POWER_HIT) < 1.5 / 60, `the wind-up is POWER_HIT (${(hit[3] - p[3]) / 60} s)`);
  assert.equal(O[7], 100 - POWER_HP, "its damage");
  assert.ok(O[0] > x + 2.4 + 1, `knocked back (${O[0].toFixed(2)})`);
  assert.ok(O[54] > 0 && M[54] > 0, "the fight's health bars show");
  // Behind him: he turns in the wind-up, then it lands.
  street(M, x, -1); street(O, x + 2.4, -1);
  const ev2 = play(run, 60, tap(T_RIVAL + 1));
  assert.equal(M[6], 1, "he turned to face it");
  assert.equal(has(ev2, R.E_POWER).length, 1, "behind: lands after the turn");
  // Out of reach: a whiff, no damage.
  street(M, x, 1); street(O, x + 5.5, -1);
  assert.ok(!run.powerReach(M, 1), "out of reach");
  const ev3 = play(run, 60, tap(T_RIVAL + 1));
  assert.equal(has(ev3, R.E_POWER).length, 0);
  assert.ok(has(ev3, R.E_WHIFF).length >= 1, "a whiff");
  assert.equal(O[7], 100);
  // A dodge: the rival steps clear during the wind-up: a whiff.
  street(M, x, 1); street(O, x + 2.4, -1);
  const ev4 = play(run, 60, (I, f) => { tap(T_RIVAL + 1)(I, f); I[R.NI] = 1; });
  assert.equal(has(ev4, R.E_POWER).length, 0, "stepped clear in the wind-up: missed");
  // Itself: never.
  street(M, x, 1);
  assert.ok(!run.powerReach(M, 0));
});

test("v12: on a wall a power punch knocks the rival off it (KNOCKED OFF): it falls to the street", () => {
  const run = arena(1), M = run.MV[0], O = run.MV[1], b = 2, s = -1;
  // The rival hangs on building b's left wall; the hero on the street under it, facing it.
  O[5] = CLIMB; O[12] = b; O[22] = s; O[0] = run.wallX(b, s); O[2] = ZW; O[6] = -s; O[1] = 1.2; O[7] = 100;
  street(M, O[0] - 1.6, 1);
  assert.ok(run.powerReach(M, 1), "in reach");
  const ev = play(run, 30, tap(T_RIVAL + 1));
  assert.equal(has(ev, R.E_POWER).length, 1);
  assert.equal(has(ev, R.E_KNOCKOFF).length, 1, "KNOCKED OFF");
  assert.notEqual(O[5], CLIMB, "off the wall");
  play(run, 120);
  assert.equal(O[1], 0, "fell to the street");
  assert.equal(O[5], WALK);
});

test("v12: a jump onto a rival is a pounce: damage, stunned (no moves) for STUN_T; the next power punch adds the combo's bonus", () => {
  const run = arena(), M = run.MV[0], O = run.MV[1], x = -6;
  street(O, x, -1);
  // The hero comes down on its back from above.
  street(M, x + 0.3, -1);
  M[5] = AIR; M[1] = 3.4; M[4] = -3;
  const ev = play(run, 2);
  assert.equal(has(ev, R.E_POUNCE).length, 1, "a pounce");
  assert.equal(O[7], 100 - POUNCE_HP);
  assert.ok(Math.abs(O[53] - (STUN_T - 2 / 60)) < 1e-9 || O[53] > STUN_T - 0.1, `stunned (${O[53]})`);
  assert.ok(M[4] > 0, "he bounces up off it");
  // Stunned: its stick does nothing.
  const ox = O[0];
  play(run, 20, (I) => (I[R.NI] = 1));
  assert.equal(O[0], ox, "a stunned rival can't move");
  // Land and power punch it while it is stunned: the bonus.
  play(run, 30);
  street(M, x - 2.2, 1);
  assert.ok(O[53] > 0, "still stunned");
  const ev2 = play(run, 40, tap(T_RIVAL + 1));
  assert.equal(has(ev2, R.E_COMBO_HIT).length, 1, "the combo");
  assert.equal(O[7], 100 - POUNCE_HP - POWER_HP - COMBO_HP, "POWER_HP + COMBO_HP");
  assert.equal(O[53], 0, "the punch ends the stun");
  // A rising jump past it is not a pounce.
  street(O, x, -1); street(M, x + 0.3, -1); M[5] = AIR; M[1] = 2; M[4] = 6;
  assert.equal(has(play(run, 2), R.E_POUNCE).length, 0, "going up past it: no pounce");
});

test("v12: the AI rivals fight back: a power punch at a player in reach with the same fixed wind-up, a pounce after a fixed crouch (the tell); a player can dodge", () => {
  const run = arena(), M = run.MV[0], O = run.MV[1], x = -6;
  run.join(1, AI);
  O[24] = IN;
  // The AI's combo never shortens its power punch's wind-up.
  street(M, x, 1); street(O, x + 2.4, -1); O[46] = 1.25;
  const ev = play(run, 90);
  const p = has(ev, R.E_PUNCH).find((e) => e[2] === 1), hit = has(ev, R.E_POWER).find((e) => e[2] === 1);
  assert.ok(p && hit, "the AI power punches the player in reach");
  assert.ok(Math.abs((hit[3] - p[3]) / 60 - POWER_HIT) < 1.5 / 60, `its wind-up is POWER_HIT: ${(hit[3] - p[3]) / 60} s`);
  // Not again at once: an AI's rate.
  assert.equal(has(ev, R.E_POWER).filter((e) => e[2] === 1).length, 1, "one in 1.5 s");
  // A pounce: the tell (a crouch of POUNCE_TELL), then the jump at where the player was.
  const run2 = arena(), M2 = run2.MV[0], O2 = run2.MV[1];
  run2.join(1, AI); O2[24] = IN;
  street(M2, x, 1); street(O2, x + 2.8, -1);
  run2.AS[8 + 6] = 1e9; // (power punch off: the pounce alone)
  const evp = play(run2, 120);
  const tell = has(evp, R.E_TELL)[0], pn = has(evp, R.E_POUNCE)[0];
  assert.ok(tell, "the tell");
  assert.ok(pn && pn[1] === 0, "the pounce lands on the player who stood still");
  assert.ok((pn[3] - tell[3]) / 60 >= POUNCE_TELL, `the crouch first (${(pn[3] - tell[3]) / 60} s)`);
  // Dodged: the player walks away during the tell.
  const run3 = arena(), M3 = run3.MV[0], O3 = run3.MV[1];
  run3.join(1, AI); O3[24] = IN;
  street(M3, x, 1); street(O3, x + 2.8, -1);
  run3.AS[8 + 6] = 1e9;
  let told = -1;
  const evd = play(run3, 120, (I, f) => { if (told < 0 && O3[55] > 0) told = f; if (told >= 0) I[0] = -1; });
  assert.ok(told >= 0, "it crouched");
  assert.equal(has(evd, R.E_POUNCE).length, 0, "walked clear of the pounce");
});

test("v12: the fight is deterministic: the same inputs give the same run, and a save mid-fight restores byte for byte", () => {
  const go = () => {
    const run = arena(), M = run.MV[0], O = run.MV[1];
    run.join(1, AI); O[24] = IN;
    street(M, -6, 1); street(O, -3.6, -1);
    play(run, 400, (I, f) => { if (f % 37 === 0) (I[2] = 1), (I[5] = T_RIVAL + 1); if (f % 90 === 40) I[3] = 1; I[0] = Math.sin(f * 0.05); });
    return run;
  };
  const a = go(), b = go();
  assert.equal(hash(a), hash(b), "the same run");
  const saved = a.bytes.map((v) => v.slice());
  const input = (I, f) => { if (f % 23 === 0) (I[2] = 1), (I[5] = T_RIVAL + 1); I[0] = f % 50 < 25 ? 1 : -1; };
  play(a, 200, input);
  const h1 = hash(a);
  a.bytes.forEach((v, i) => v.set(saved[i]));
  play(a, 200, input);
  assert.equal(hash(a), h1, "restored and replayed: identical");
});

test("v12 (owner: \"I don't seem to be able to kill the tanks\"): a tap on the tank smashes it: 1, 2 and 3 body widths in front and at his feet it lands (two hits, three when armoured), behind he turns, far across the street TOO FAR; a jump onto it crushes it; soldiers the same", () => {
  const tank = (run, x, hits) => { const T = run.TK; T.fill(0); T[0] = 1; T[1] = x; T[2] = -1; T[3] = 1e9; T[4] = 1e9; T[7] = STREET0 + 3.1; T[9] = hits; };
  const smash = (run) => has(play(run, 50, tap(T_TANK)), R.E_TANK).length + has([], 0).length;
  for (const k of [0.3, 1, 2, 3]) {
    const run = arena(), M = run.MV[0], x = -8;
    run.MV[1][24] = 0;
    street(M, x, 1);
    tank(run, x + k * 2 * BODY_X, TANK_HITS);
    assert.ok(run.tankReach(M), `${k} body widths: in reach`);
    let blown = 0, hits = 0;
    for (let i = 0; i < 4 && !blown; i++) (hits++, (blown = smash(run)));
    assert.ok(blown, `${k} body widths in front: smashed`);
    assert.equal(hits, TANK_HITS, `${k}: it takes ${TANK_HITS} hits`);
  }
  // Armoured (a later city): three.
  const run = arena(4), M = run.MV[0];
  run.MV[1][24] = 0;
  street(M, -8, 1);
  tank(run, -4, TANK_HITS + 1);
  let n = 0;
  while (!smash(run) && n < 5) n++;
  assert.equal(n + 1, 3, "armoured: three hits");
  // Behind him: he turns, then smashes.
  street(M, -8, -1); tank(run, -5, 1);
  assert.equal(smash(run), 1, "behind: turned and smashed");
  assert.equal(M[6], 1);
  // Far across the street: TOO FAR (a whiff, the tank untouched).
  street(M, -12, 1); tank(run, 6, 2);
  assert.ok(!run.tankReach(M));
  const ev = play(run, 50, tap(T_TANK));
  assert.ok(has(ev, R.E_WHIFF).length && run.TK[9] === 2, "far: a whiff");
  // A jump onto it: crushed.
  street(M, -6, 1); tank(run, -5.4, 3);
  M[5] = AIR; M[1] = 1.8; M[4] = -2;
  assert.equal(has(play(run, 3), R.E_TANK).length, 1, "a pounce crushes it");
  // A soldier on the street out of the grab's fan: a tap smashes it.
  street(M, -10, 1);
  run.SO.fill(0); run.SO[0] = 1; run.SO[1] = -4; run.SO[2] = STREET0 + 2; run.SO[5] = 1e9; run.SO[6] = 1;
  assert.equal(has(play(run, 50, tap(T_FOE)), R.E_FLING).length, 1, "a soldier smashed");
});

test("v12 (v11 leftover): a parachute behind him counts toward the combo once", () => {
  const run = arena(), M = run.M;
  run.MV[1][24] = 0;
  street(M, -6, 1);
  const o = 0;
  run.CH[o] = 1; run.CH[o + 1] = -6 - 2.2; run.CH[o + 2] = 2; run.CH[o + 3] = ZS; run.CH[o + 4] = 0; run.CH[o + 5] = 0; run.CH[o + 6] = 1; run.CH[o + 7] = 0;
  M[46] = 1; M[47] = 0;
  let nom = 0;
  for (let f = 0; f < 40; f++) {
    run.CH[o + 1] = -8.2; run.CH[o + 2] = 2; run.CH[o + 5] = 0;
    const ev = play(run, 1, (I) => { if (f === 0) (I[4] = 1), (I[5] = R.T_CHUTE); });
    nom += has(ev, R.E_NOM).length;
    if (nom) break;
  }
  assert.equal(nom, 1, "eaten after the turn");
  assert.equal(M[46], 1.25, `one step up the combo, not two (×${M[46]})`);
});

test("v12: the fight allocates nothing per step", async () => {
  const run = arena(), I = new Float64Array(24), M = run.MV[0], O = run.MV[1];
  run.join(1, AI); O[24] = IN;
  const go = (n) => {
    for (let i = 0; i < n; i++) {
      if (i % 300 === 0) street(M, -6, 1), street(O, -3.6, -1), (M[7] = O[7] = 100);
      I.fill(0);
      if (i % 31 === 0) (I[2] = 1), (I[5] = T_RIVAL + 1);
      if (i % 97 === 0) I[3] = 1;
      run.step(1 / 60, I);
      run.clear();
    }
  };
  go(60 * 600);
  const s = new Session();
  s.connect();
  await s.post("HeapProfiler.startSampling", { samplingInterval: 64 });
  go(60 * 120);
  const { profile } = await s.post("HeapProfiler.stopSampling");
  s.disconnect();
  let bytes = 0;
  const walk = (n) => {
    if (n.selfSize && /\/src\/(round|block|climber)\.ts/.test(n.callFrame.url)) bytes += n.selfSize;
    for (const c of n.children) walk(c);
  };
  const mine = [];
  const walk2 = (n) => { if (n.selfSize && /\/src\//.test(n.callFrame.url)) mine.push(`${n.callFrame.functionName}@${n.callFrame.lineNumber}: ${n.selfSize}`); for (const c of n.children) walk2(c); };
  walk(profile.head); walk2(profile.head);
  assert.ok(bytes < 40000, `no allocation per step: ${bytes} B in 120 s (${mine.join(", ")})`);
  void HAND;
});
