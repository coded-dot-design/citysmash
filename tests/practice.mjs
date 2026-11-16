// CitySmash's practice (Chromium, dist/citysmash.mjs): the controls without the danger. It can't lose
// health (a shock from a live window, a minute on the autopilot), the seven-dot tracker fills as each reach
// cell is punched (and its step ticks off on the card), and it never touches the profile.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const page = fixture.replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; const box = {}; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3, store: { get: (k) => box[k] ?? null, set(k, v) { box[k] = v; } } });</script></body>`);
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(server.url + "/");
    await p.waitForFunction(() => window.game);
    const before = await p.evaluate(() => JSON.stringify(game.profile));
    await p.evaluate(() => game.practice());
    await p.waitForFunction(() => game.scene?.state.drawn);
    const res = await p.evaluate(() => {
      const sc = game.scene, r = sc.run, root = document.querySelector("[data-fizlet-host]").shadowRoot;
      sc.engine.stop();
      const step = (n) => { for (let i = 0; i < n; i++) sc.engine.advance(1 / 60); };
      const M = r.MV[0], out = { practice: sc.practice, rivals: r.MV.slice(1).some((O) => O[24] !== 0) };
      // A minute on the autopilot: no health lost, no end.
      sc.auto = true;
      let lo = 100, done = false;
      for (let i = 0; i < 3600; i++) (step(1), (lo = Math.min(lo, M[7])), (done ||= r.S[0] === 3));
      sc.auto = false;
      out.lo = lo; out.done = done;
      // On a wall: punch each reach cell, one a live window (it shocks: still no health lost).
      const b = 1, s = -1, fl = 3, put = () => { M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[8] = M[34] = M[45] = M[23] = M[20] = M[43] = M[21] = 0; };
      r.B.fill(0); r.cell.fill(2); r.occ.fill(0); r.LIVE.fill(0); r.S[30] = 0;
      put(); step(10); r.S[30] = 0;
      const shocks = r.S[12];
      r.LIVE[r.reachCell(M, 0)] = 1;
      out.dots = [];
      for (let d = 0; d < 7; d++) {
        put();
        M[20] = 0.3; M[43] = 1 + d;
        let n = 0;
        while (!(r.S[30] & (1 << d)) && n++ < 40) step(1);
        step(2);
        out.dots.push(root.querySelectorAll(".cs-dots i.cs-done").length);
      }
      out.shocked = r.S[12] > shocks; out.hp = M[7];
      out.reach = r.S[30]; out.steps = r.S[29];
      out.ticked = root.querySelectorAll(".cs-prac li.cs-done").length;
      out.card = !root.querySelector(".cs-prac").hidden;
      sc.engine.start();
      return out;
    });
    const at = `${w}: practice`;
    assert.ok(res.practice && !res.rivals, `${at}: a practice run, no rivals`);
    assert.equal(res.lo, 100, `${at}: a minute on the autopilot loses no health`);
    assert.ok(!res.done, `${at}: it never ends`);
    assert.ok(res.shocked && res.hp === 100, `${at}: a live window shocks but takes no health (${res.hp})`);
    assert.equal(res.reach, 127, `${at}: all seven reach cells punched`);
    assert.deepEqual(res.dots, [1, 2, 3, 4, 5, 6, 7], `${at}: the seven-dot tracker fills a dot a cell`);
    assert.ok(res.card && res.ticked >= 3 && (res.steps & 8), `${at}: the card ticks off its steps (${res.ticked}, bits ${res.steps})`);
    await p.evaluate(() => game.show("menu"));
    assert.equal(await p.evaluate(() => JSON.stringify(game.profile)), before, `${at}: the profile is untouched`);
    await p.close();
  }
  console.log("CitySmash: practice green (no health lost to a shock or a minute's play, it never ends, the seven-dot tracker fills, the steps tick off, the profile untouched; at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
