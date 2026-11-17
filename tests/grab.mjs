// CitySmash v11, the grab you can see (Chromium, dist/citysmash.mjs): the reach is the facing hand's, never
// behind him or under his body. On the street a tap on someone at a window in front lights teal at once,
// the arm reaches there and NOM! pops; someone behind: he turns, then grabs (the pop too); a tap on his own
// body is never a grab, even with someone at the window behind it; out of reach: TOO FAR and a hint
// (MOVE CLOSER). On a wall: a tap on someone across the gap behind him is TOO FAR; a grab on the front pops.
// At 1440 and 390.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const page = fixture.replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3, store: { get: () => null, set() {} } });</script></body>`);
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(server.url + "/");
    await p.waitForFunction(() => window.game);
    await p.evaluate(() => game.play(0));
    await p.waitForFunction(() => game.scene?.state.drawn);
    const res = await p.evaluate(() => {
      const sc = game.scene, r = sc.run, root = document.querySelector("[data-fizlet-host]").shadowRoot, cv = root.querySelector("canvas.cs-canvas"), cx = cv.getContext("2d"), playEl = root.querySelector(".cs-play");
      sc.engine.stop();
      sc.auto = false;
      const step = (n) => { for (let i = 0; i < n; i++) sc.engine.advance(1 / 60); };
      r.S[0] = 1;
      for (let j = 0; j < 4; j++) (r.MV[j][24] = j === 0 ? 1 : 0), (r.MV[j][28] = 9);
      r.MV[0][28] = 0;
      const quiet = () => { r.SO.fill(0); r.CH.fill(0); r.occ.fill(0); r.LIVE.fill(0); r.cell.fill(2); r.HIT.fill(0); r.TK[0] = 0; r.TK[4] = 1e9; for (let k = 0; k < 2; k++) (r.HE[k * 12] = 0), (r.HE[k * 12 + 8] = 1e9); };
      quiet();
      const M = r.MV[0], b = 2, x0 = r.BLD[b * 4], wd = r.BLD[b * 4 + 1], dpr = cv.width / cv.getBoundingClientRect().width;
      const win = (bb, fl, col) => r.C0[bb] + fl * r.BLD[bb * 4 + 1] + col;
      const at = (wx, wy) => sc.project(wx, wy, 0.05);
      const tap = (q, type = "pointerdown") => { const bx = cv.getBoundingClientRect(); playEl.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: bx.left + q[0], clientY: bx.top + q[1], pointerType: "mouse" })); };
      const teal = (q, hs) => {
        const x0 = Math.max(0, Math.round((q[0] - hs) * dpr)), y0 = Math.max(0, Math.round((q[1] - hs) * dpr)), d = cx.getImageData(x0, y0, Math.round(hs * 2 * dpr), Math.round(hs * 2 * dpr)).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if ([[0x22, 0xe6, 0xff], [0x11, 0x8a, 0xb2]].some((c) => Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) < 50)) n++;
        return n;
      };
      const stand = (x, f) => { quiet(); M[5] = 0; M[0] = x; M[1] = 0; M[2] = 1.9; M[3] = 0; M[6] = f; M[7] = 100; M[14] = 0; M[45] = 0; M[49] = 0; M[12] = -1; step(40); for (let q = sc.project(x0, 3, 0)[0], n = 0; n++ < 600; ) { step(1); const v = sc.project(x0, 3, 0)[0]; if (Math.abs(v - q) < 0.005) break; q = v; } };
      const size = Math.abs(at(x0 + 1, 0)[0] - at(x0, 0)[0]);
      const out = {};
      // 1. In front: the window one floor up, the hand's column; the ape facing it.
      stand(x0 + 0.5 - 1.9, 1);
      let i = win(b, 1, 0), q = at(x0 + 0.5, r.yOff(b) + 1.5);
      r.occ[i] = 1;
      step(1);
      const t0 = sc.feedback.pops, before = teal(q, size * 0.6);
      tap(q);
      step(1);
      const lit = teal(q, size * 0.6) - before;
      let n = 0;
      while (r.occ[i] && n++ < 60) step(1);
      step(2);
      out.front = { lit, eaten: !r.occ[i], pops: sc.feedback.pops - t0, reach: [M[50], M[51]], want: [x0 + 0.5, r.yOff(b) + 1.5] };
      // 2. Behind: the same window, the ape past it facing away from it.
      stand(x0 + 0.5 + 1.9, 1);
      r.occ[i] = 1;
      step(1);
      q = at(x0 + 0.5, r.yOff(b) + 1.5);
      const t1 = sc.feedback.pops, f0 = M[6];
      tap(q);
      n = 0;
      while (r.occ[i] && n++ < 60) step(1);
      step(2);
      out.behind = { turned: M[6] === -f0, eaten: !r.occ[i], pops: sc.feedback.pops - t1, code: sc.feedback.tap };
      // 3. His own body: someone at the window behind his torso is not his to grab.
      stand(x0 + 1.5, 1);
      const j = win(b, 1, 1), tor = sc.torso(0), tq = sc.project(tor[0], tor[1], tor[2]);
      r.occ[j] = 1;
      step(1);
      out.body = { code: sc.tapAt(tq[0], tq[1]) };
      // 4. Out of reach: someone five windows off.
      stand(x0 - 4.5, 1);
      const k = win(b, 2, wd - 1), fq = at(x0 + wd - 0.5, r.yOff(b) + 2.5);
      r.occ[k] = 1;
      step(1);
      tap(fq);
      step(2);
      out.far = { code: sc.feedback.tap, hint: sc.feedback.hint, miss: sc.feedback.miss, still: r.occ[k] === 1 };
      // 5. On a wall (the building's left edge): someone across the gap behind him is not in reach; one at a
      // window above the reach on the front is, and pops.
      quiet();
      const fl = 3;
      M[5] = 2; M[12] = b; M[22] = -1; M[0] = r.wallX(b, -1); M[2] = -0.55; M[6] = 1; M[1] = fl + 0.5 - 1.9; M[3] = M[4] = 0;
      step(60);
      const nb = b - 1, nw = r.BLD[nb * 4 + 1], bk = win(nb, fl, nw - 1), bq = at(r.BLD[nb * 4] + nw - 0.5, r.yOff(nb) + fl + 0.5);
      r.occ[bk] = 1;
      step(1);
      out.wallBehind = { code: sc.tapAt(bq[0], bq[1]) };
      r.occ.fill(0);
      const up = win(b, fl + 2, 0), uq = at(x0 + 0.5, r.yOff(b) + fl + 2.5);
      r.occ[up] = 1;
      step(1);
      const t2 = sc.feedback.pops;
      tap(uq);
      n = 0;
      while (r.occ[up] && n++ < 60) step(1);
      step(2);
      out.wallUp = { eaten: !r.occ[up], pops: sc.feedback.pops - t2 };
      sc.engine.start();
      return out;
    });
    if (process.env.GRAB_DEBUG) console.log(w, JSON.stringify(res));
    assert.ok(res.front.lit > 20, `${w}: a tap in front lights teal at once (${res.front.lit} px)`);
    assert.ok(res.front.eaten && res.front.pops === 1, `${w}: in front: eaten, NOM! pops (${JSON.stringify(res.front)})`);
    assert.ok(Math.abs(res.front.reach[0] - res.front.want[0]) < 0.6 && Math.abs(res.front.reach[1] - res.front.want[1]) < 0.6, `${w}: the arm reaches for that spot (${JSON.stringify(res.front)})`);
    assert.ok(res.behind.turned && res.behind.eaten && res.behind.pops === 1, `${w}: behind: he turns, then grabs, NOM! pops (${JSON.stringify(res.behind)})`);
    assert.ok(res.body.code < 8 || (res.body.code >= 23 && res.body.code < 57) || res.body.code >= 72, `${w}: a tap on his own body is not a grab (${res.body.code})`);
    assert.ok(res.far.code === 56 && res.far.miss && res.far.hint === "MOVE CLOSER" && res.far.still, `${w}: out of reach: TOO FAR and the hint (${JSON.stringify(res.far)})`);
    assert.equal(res.wallBehind.code, 56, `${w}: on a wall, someone across the gap behind him is out of reach`);
    assert.ok(res.wallUp.eaten && res.wallUp.pops === 1, `${w}: on a wall, two floors up on the front: grabbed, with the pop (${JSON.stringify(res.wallUp)})`);
    await p.close();
  }
  console.log("CitySmash: the grab green (from the facing hand: in front teal at once, the arm to the spot, NOM!; behind he turns then grabs; never his own body; TOO FAR with MOVE CLOSER; on a wall nothing behind him; at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
