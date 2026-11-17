// CitySmash v12, the fight (Chromium, dist/citysmash.mjs): a tap (a real pointer event) on a rival in reach is the
// power punch: the pick rings it green, it lands (BOOM!, the hit-stop on this one screen, its health bar shows);
// out of reach: TOO FAR with MOVE CLOSER; a rival on a wall is knocked off it (KNOCKED OFF!); a jump onto one is a
// pounce (POUNCE!, stunned: the stars), and the next tap's power punch is the combo; on a wall the grab's range
// shows for a moment each time he lands on one or climbs a floor, then goes. At 1440 and 390.
// `VIDEO=<dir>` records the 390 run as a webm (the scripted fight, slowed to real time).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const page = fixture.replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3, store: { get: () => '{"v":4,"level":2}', set() {} } });</script></body>`);
// (v15: on HARD, where a player's toughness is 1: the rules' plain numbers)
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const VIDEO = process.env.VIDEO;
try {
  for (const [w, h] of VIDEO ? [[390, 844]] : [[1440, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(VIDEO ? { recordVideo: { dir: VIDEO, size: { width: w, height: h } } } : {}) });
    const p = await ctx.newPage();
    await p.goto(server.url + "/");
    await p.waitForFunction(() => window.game);
    await p.evaluate(() => game.play(0));
    await p.waitForFunction(() => game.scene?.state.drawn);
    await p.evaluate((slow) => {
      const sc = game.scene, r = sc.run, root = document.querySelector("[data-fizlet-host]").shadowRoot, cv = root.querySelector("canvas.cs-canvas"), playEl = root.querySelector(".cs-play");
      sc.engine.stop();
      sc.auto = false;
      window.T = { sc, r, root, cv, playEl, slow };
      // (VIDEO: real time, a frame a frame, so the recording shows the motion)
      T.step = async (n) => { for (let i = 0; i < n; i++) { sc.engine.advance(1 / 60); if (slow) await new Promise((f) => requestAnimationFrame(f)); } };
      r.S[0] = 1;
      const quiet = () => { r.SO.fill(0); r.CH.fill(0); r.PB.fill(0); r.occ.fill(0); r.LIVE.fill(0); r.TK[0] = 0; r.TK[4] = 1e9; r.FE[3] = r.FE[8] = r.FE[10] = 1e9; r.T[0] = r.T[1] = 1e9; for (let k = 0; k < 2; k++) (r.HE[k * 12] = 0), (r.HE[k * 12 + 8] = 1e9); };
      T.quiet = quiet;
      quiet();
      for (let j = 2; j < 4; j++) r.MV[j][24] = 0;
      // SHARDCLAW on seat two (so it stands still unless the test moves it; a pad's seat).
      const O = r.MV[1];
      O[24] = 1; O[28] = 1; O[29] = 0;
      T.st = (Q, x, f) => { Q[5] = 0; Q[0] = x; Q[1] = 0; Q[2] = 1.9; Q[3] = Q[4] = 0; Q[6] = f; Q[8] = Q[34] = Q[45] = Q[15] = Q[53] = Q[54] = Q[52] = 0; Q[12] = -1; Q[7] = 100; Q[11] = 0; };
      T.chest = (k) => { const Q = r.MV[k]; return sc.project(Q[0], Q[1] + sc.rig(k).height * 0.5, Q[2]); };
      T.tap = (q) => { const bx = cv.getBoundingClientRect(); playEl.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: bx.left + q[0], clientY: bx.top + q[1], pointerType: "touch" })); };
      // A spot on the street in the middle of a building's front (no side wall to catch in a jump).
      T.mid = r.BLD[2 * 4] + r.BLD[2 * 4 + 1] / 2;
    }, !!VIDEO);
    const run = (fn) => p.evaluate(fn);
    // 1. Out of reach: TOO FAR, MOVE CLOSER; nothing lands.
    const far = await run(async () => {
      const { r, st, chest, tap, sc, mid } = T, M = r.MV[0], O = r.MV[1];
      T.quiet(); st(M, mid - 3, 1); st(O, mid + 3.4, -1);
      await T.step(20);
      tap(chest(1));
      await T.step(36);
      return { t: sc.feedback.tap, hint: sc.feedback.hint, boom: sc.feedback.boom, hp: O[7] };
    });
    const at = `${w}: fight`;
    assert.equal(far.t, 56, `${at}: a tap on a rival out of reach is TOO FAR`);
    assert.equal(far.hint, "MOVE CLOSER", `${at}: with the hint`);
    assert.ok(far.boom === 0 && far.hp === 100, `${at}: nothing lands`);
    // 2. In reach: the power punch (green ring, BOOM!, a hit-stop here, its health bar).
    const pw = await run(async () => {
      const { r, st, chest, tap, sc, mid } = T, M = r.MV[0], O = r.MV[1];
      T.quiet(); st(M, mid - 1.3, 1); st(O, mid + 1.1, -1);
      await T.step(20);
      const stops = sc.feedback.stops, q = chest(1);
      tap(q);
      const t = sc.feedback.tap;
      let lit = 0, wind = 0;
      await T.step(1);
      // (the body comes in at the hit: the root ahead of where it stands)
      for (let i = 0; i < 40 && !sc.feedback.boom; i++) { await T.step(1); if (sc.feedback.tap === t) lit++; wind++; }
      const lunge = (sc.rig(0).root.pos[0] - M[0]) * M[6];
      await T.step(10);
      return { t, lit, wind, boom: sc.feedback.boom, stops: sc.feedback.stops - stops, hp: O[7], bar: O[54] > 0, lunge, pushed: O[0] - (mid + 1.1) };
    });
    assert.equal(pw.t, 79, `${at}: a tap on the rival in reach is the power punch at it`);
    assert.ok(pw.boom === 1 && pw.hp === 84, `${at}: it lands: BOOM!, its damage (${pw.boom}, ${pw.hp})`);
    assert.ok(pw.wind >= 18, `${at}: the wind-up is the long one (${pw.wind} frames)`);
    assert.ok(pw.stops >= 1, `${at}: the hit-stop on one screen`);
    assert.ok(pw.bar, `${at}: its health bar shows`);
    assert.ok(pw.lunge > 0.3, `${at}: the body comes forward into the hit (${pw.lunge.toFixed(2)})`);
    assert.ok(pw.pushed > 0.5, `${at}: knocked back (${pw.pushed.toFixed(2)})`);
    // 3. A pounce, then the combo.
    const po = await run(async () => {
      const { r, st, chest, tap, sc, mid } = T, M = r.MV[0], O = r.MV[1];
      T.quiet(); st(O, mid, -1); st(M, mid - 1, 1);
      await T.step(20);
      // the jump: up, then down onto its back
      M[5] = 1; M[4] = 11; M[3] = 2;
      let n = 0;
      while (!sc.feedback.pounced && n++ < 90) (M[3] = M[5] === 1 && M[4] < 11 && !sc.feedback.pounced ? 2 : M[3]), await T.step(1);
      const stunned = O[53] > 0;
      const dbg = JSON.stringify({ n, M: [M[0], M[1], M[4], M[5], M[15]], O: [O[0], O[1], O[5], O[53], O[24]] });
      while (M[5] !== 0 && n++ < 200) await T.step(1);
      st(M, O[0] - 1.6, 1);
      await T.step(2);
      tap(chest(1));
      let combo = false;
      for (let i = 0; i < 40; i++) { const h0 = O[7]; await T.step(1); if (h0 - O[7] >= 28) combo = true; }
      await T.step(20);
      return { pounced: sc.feedback.pounced, stunned, combo, dbg };
    });
    assert.ok(po.pounced === 1 && po.stunned, `${at}: a jump onto it is a pounce: POUNCE!, stunned ${po.dbg}`);
    assert.ok(po.combo, `${at}: the next tap's power punch is the combo (+12)`);
    // 4. On a wall: power punched off it (KNOCKED OFF!); then the grab's outline shows on landing on a wall, then goes.
    const ko = await run(async () => {
      const { r, st, chest, tap, sc } = T, M = r.MV[0], O = r.MV[1], b = 2, s = -1;
      T.quiet();
      O[5] = 2; O[12] = b; O[22] = s; O[0] = r.wallX(b, s); O[2] = -0.55; O[6] = -s; O[1] = 1.2; O[7] = 100; O[53] = O[54] = 0;
      st(M, O[0] - 1.7, 1);
      await T.step(20);
      tap(chest(1));
      let n = 0;
      while (!sc.feedback.knocked && n++ < 60) await T.step(1);
      const off = O[5] !== 2;
      await T.step(70);
      const fell = O[1] === 0;
      // the hero onto the wall: the outline for a moment
      M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = 1.6;
      await T.step(3);
      const show = sc.feedback.wallShow;
      await T.step(100);
      return { knocked: sc.feedback.knocked, off, fell, show, after: sc.feedback.wallShow };
    });
    assert.ok(ko.knocked === 1 && ko.off && ko.fell, `${at}: a rival on a wall is knocked off it and falls: KNOCKED OFF!`);
    assert.ok(ko.show > 1.3 && ko.after === 0, `${at}: on landing on a wall the grab outline shows ~1.5 s, then goes (${ko.show}, ${ko.after})`);
    // 5. The tank (owner: "I don't seem to be able to kill the tanks"): a tap on it at his feet and 1, 2, 3 body widths
    // in front is a smash, two of them blow it up; far across the street TOO FAR.
    const tk = await run(async () => {
      const { r, st, tap, sc } = T, M = r.MV[0], O = r.MV[1], out = [];
      O[24] = 0;
      const put = (x, hits) => { const K = r.TK; K.fill(0); K[0] = 1; K[1] = x; K[2] = -1; K[3] = 1e9; K[4] = 1e9; K[7] = 0.9 + 3.1; K[9] = hits; };
      for (const k of [0.3, 1, 2, 3]) {
        T.quiet(); st(M, -9, 1); put(-9 + k * 2.6, 2);
        await T.step(3);
        const q = sc.project(r.TK[1], 0.8, r.TK[7]), t = sc.tapAt(q[0], q[1]);
        tap(q); await T.step(45); tap(sc.project(r.TK[1], 0.8, r.TK[7])); await T.step(45);
        out.push([k, t, r.TK[0]]);
      }
      T.quiet(); st(M, -12, 1); put(7, 2);
      await T.step(3);
      const q = sc.project(r.TK[1], 0.8, r.TK[7]);
      out.push(["far", sc.tapAt(q[0], q[1]), r.TK[0]]);
      r.TK[0] = 0;
      return out;
    });
    for (const [k, t, st] of tk.slice(0, 4)) assert.ok(t === 82 && st === 2, `${at}: a tank ${k} body widths in front: a smash (${t}), two blow it up (${st})`);
    assert.equal(tk[4][1], 56, `${at}: a tank far across the street is TOO FAR`);
    if (VIDEO) await p.waitForTimeout(400);
    await ctx.close();
  }
  console.log("CitySmash: the fight green (a tap on a rival: the power punch, its long wind-up, the body into the hit, BOOM!, the hit-stop, the health bar, the knockback; TOO FAR out of reach; a pounce stuns, the next punch is the combo; KNOCKED OFF! a wall; a tank at his feet and 1, 2, 3 body widths in front smashed by taps, far across the street TOO FAR; the wall's grab outline on landing; at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
