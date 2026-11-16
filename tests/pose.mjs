// CitySmash's rig on a wall (Chromium, dist/citysmash.mjs), at 1440 and 390, for the ape and each rival,
// on both edges of a building (its left side and its right): the grip hand (the one by the building)
// clamps the side edge at the front corner and never lets go through a punch; the other hand smashes: at
// each punch's hit frame (down, level, up) its fist sits on the very window the round hits (inside that
// window's cell on the front face, in front of the facade, never behind the body) and on screen. The feet
// stay by the edge. Waits on state; steps the engine frame by frame.
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
    await p.evaluate(() => game.play(3));
    await p.waitForFunction(() => game.scene?.state.drawn);
    const res = await p.evaluate(() => {
      const sc = game.scene, r = sc.run, out = [];
      sc.engine.stop();
      const step = (n) => { for (let i = 0; i < n; i++) sc.engine.advance(1 / 60); };
      r.S[0] = 1;
      for (let k = 0; k < 4; k++) {
        // Only monster k in play, nothing shooting.
        for (let j = 0; j < 4; j++) (r.MV[j][24] = j === k ? 1 : 0), (r.MV[j][28] = 9);
        r.MV[k][28] = 0;
        const b = 1, x0 = r.BLD[b * 4], wd = r.BLD[b * 4 + 1];
        for (const s of [-1, 1]) for (const d of [-1, 0, 1]) {
          r.SO.fill(0); r.PB.fill(0); r.HE[8] = r.HE[20] = 1e9; r.TK[0] = 0; r.TK[4] = 1e9; r.HE[0] = r.HE[12] = 0;
          r.cell.fill(2); r.HIT.fill(0); r.B.fill(0); r.LIVE.fill(0);
          const M = r.MV[k], fl = 3;
          M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[8] = 0; M[33] = 0; M[7] = 100; M[15] = 0; M[23] = 0; M[20] = 0; M[34] = 0; M[11] = 0;
          step(30);
          const edge = s < 0 ? x0 : x0 + wd, g = sc.gripHand(k, -s);
          const c0 = sc.contacts(k), grip0 = c0.slice(g * 3, g * 3 + 3);
          // The punch, by the climb a moment ago: up, level, down.
          M[33] = d * 0.35; M[20] = 0.3;
          r.setCur(k);
          const i = r.sideTarget(d);
          r.setCur(0);
          let n = 0;
          while (!r.HIT[i] && n++ < 40) step(1);
          const c = sc.contacts(k), hit = c.slice((1 - g) * 3, (1 - g) * 3 + 3), grip = c.slice(g * 3, g * 3 + 3);
          const rel = i - r.C0[b], row = (rel / wd) | 0, col = rel - row * wd, cx = x0 + col + 0.5, cy = r.yOff(b) + row + 0.5;
          const [px, py] = sc.where(k), cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas").getBoundingClientRect();
          out.push({
            k, s, d, hitFrame: r.HIT[i] === 1, cell: col === (s < 0 ? 0 : wd - 1), row: row - fl === d,
            onWindow: Math.abs(hit[0] - cx) < 0.55 && Math.abs(hit[1] - cy) < 0.55, inFront: hit[2] > 0,
            grip: Math.abs(grip[0] - edge) < 0.6 && grip[2] < 0.6 && grip[2] > -1.6,
            held: Math.hypot(grip[0] - grip0[0], grip[1] - grip0[1]) < 0.9,
            seen: px > -4 && px < cv.width + 4 && py > -4 && py < cv.height + 4,
            at: hit.map((v) => +v.toFixed(2)), win: [cx, cy].map((v) => +v.toFixed(2)), g: grip.map((v) => +v.toFixed(2)), edge,
          });
          step(20);
        }
      }
      sc.engine.start();
      return out;
    });
    for (const o of res) {
      const at = `${w}: monster ${o.k}, side ${o.s}, punch ${o.d}`;
      assert.ok(o.hitFrame && o.cell && o.row, `${at}: the round hits the window by the climb ${JSON.stringify(o)}`);
      assert.ok(o.onWindow, `${at}: the fist is on that window (fist ${o.at}, window ${o.win})`);
      assert.ok(o.inFront, `${at}: the fist is in front of the facade (z ${o.at[2]})`);
      assert.ok(o.grip && o.held, `${at}: the other hand grips the edge and holds (hand ${o.g}, edge ${o.edge})`);
      assert.ok(o.seen, `${at}: on screen`);
    }
    await p.close();
  }
  console.log("CitySmash: the rig green (four monsters, both edges, down/level/up: the grip hand on the edge, the fist on the window the round hits, in front, at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
