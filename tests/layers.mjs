// CitySmash's rigs in depth order (Chromium, dist/citysmash.mjs): every part draws in the right order in
// every context. Each check paints one arm a flat magenta and counts how much of it shows with the rest of
// the scene drawn, against how much shows with the rest of its rig hidden: what is covered is what the rig
// draws over it. The garage turntable at eight turns: the arm on the camera's side shows whole (it draws
// over the torso), the far one is mostly behind the torso; facing the camera both arms draw over it. The
// street (walking, three quarters to the camera): the same. On a wall: the far arm is behind the body and
// the building, the smashing arm, out at its hit frame, in front of everything (but the hit's own spark).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const page = fixture.replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3, store: { get: () => null, set() {} } });</script></body>`);
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
// In the page: how much of arm i of `rig` on diorama `dio` (drawn on `cv`) is covered, 0..1.
const COVER = `window.cover = (dio, cv, rig, i, draw) => {
  const arm = rig.arms[i], all = [], mine = (o) => { for (let p = o; p; p = p.parent) if (p === arm) return true; return false; }, ofRig = (o) => { for (let p = o; p; p = p.parent) if (p === rig.root) return true; return false; };
  dio.recolor((o) => all.push(o));
  const cx = cv.getContext("2d"), count = () => { const d = cx.getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let q = 0; q < d.length; q += 4) if (d[q + 1] < 50 && d[q] > 100 && d[q + 2] > 100 && Math.abs(d[q] - d[q + 2]) < 40) n++; return n; };
  const was = arm.tint;
  arm.tint = "#ff00ff";
  draw();
  const shown = count(), rest = all.filter((o) => ofRig(o) && !mine(o) && o.shape !== "group"), a = rest.map((o) => o.alpha);
  for (const o of rest) o.alpha = 0;
  draw();
  const whole = count();
  rest.forEach((o, k) => (o.alpha = a[k]));
  arm.tint = was;
  draw();
  return whole ? +(1 - shown / whole).toFixed(3) : -1;
};`;
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(server.url + "/");
    await p.waitForFunction(() => window.game);
    await p.addScriptTag({ content: COVER });
    // The garage turntable.
    await p.evaluate(() => game.show("garage"));
    await p.waitForFunction(() => game.garage.rig());
    const turns = await p.evaluate(() => {
      const g = game.garage, out = [], cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-preview");
      for (let a = 0; a < 8; a++) {
        const t = (a * Math.PI) / 4;
        g.turn(t);
        const rig = g.rig(), draw = () => g.dio.draw();
        out.push({ t: a * 45, side: Math.cos(t), front: -Math.sin(t), L: cover(g.dio, cv, rig, 0, draw), R: cover(g.dio, cv, rig, 1, draw) });
      }
      return out;
    });
    for (const o of turns) {
      if (process.env.LAYERS_DEBUG) console.log(w, JSON.stringify(o));
      const at = `${w}: garage, turned ${o.t}°`;
      if (Math.abs(o.side) > 0.5) {
        const near = o.side > 0 ? o.R : o.L, far = o.side > 0 ? o.L : o.R;
        assert.ok(near >= 0 && near < 0.12, `${at}: the near arm draws over the torso (${near} covered)`);
        assert.ok(far > 0.3, `${at}: the far arm is behind the torso (${far} covered)`);
      } else if (o.front > 0.5) assert.ok(o.L < 0.12 && o.R < 0.12, `${at}: facing the camera, both arms draw over the torso (${o.L}, ${o.R} covered)`);
    }
    await p.evaluate(() => game.play(3));
    await p.waitForFunction(() => game.scene?.state.drawn);
    const run = await p.evaluate(() => {
      const sc = game.scene, r = sc.run, cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas"), out = {};
      sc.engine.stop();
      const step = (n) => { for (let i = 0; i < n; i++) sc.engine.advance(1 / 60); };
      r.S[0] = 1;
      for (let j = 0; j < 4; j++) (r.MV[j][24] = j === 0 ? 1 : 0), (r.MV[j][28] = 9);
      r.MV[0][28] = 0;
      const M = r.MV[0], rig = sc.rig(0), draw = () => sc.dio.draw();
      // The street: standing, three quarters to the camera, facing right (the right arm is the near one).
      M[5] = 0; M[6] = 1; M[0] = r.BLD[4] - 1.3; M[1] = 0; M[2] = 1.9; M[3] = 0; M[7] = 100;
      step(40);
      out.street = { near: cover(sc.dio, cv, rig, 1, draw), far: cover(sc.dio, cv, rig, 0, draw) };
      // A wall (the building's left side, facing right: the left arm is the far one), at rest and at a hit.
      r.cell.fill(2); r.B.fill(0); r.occ.fill(0);
      const b = 1, s = -1, fl = 3;
      M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[8] = 0; M[33] = 0; M[20] = 0; M[34] = 0;
      step(40);
      out.wall = { far: cover(sc.dio, cv, rig, 0, draw) };
      M[20] = 0.3; M[43] = 1;
      const i = r.reachCell(M, 0);
      let n = 0;
      while (!r.HIT[i] && n++ < 40) step(1);
      out.wall.hit = cover(sc.dio, cv, rig, 1, draw);
      sc.engine.start();
      return out;
    });
    if (process.env.LAYERS_DEBUG) console.log(w, JSON.stringify(run));
    assert.ok(run.street.near >= 0 && run.street.near < 0.12, `${w}: street: the near arm draws over the body (${run.street.near} covered)`);
    assert.ok(run.street.far > 0.2, `${w}: street: the far arm is behind the body (${run.street.far} covered)`);
    assert.ok(run.wall.far > 0.3, `${w}: wall: the far arm is behind the body and the building (${run.wall.far} covered)`);
    assert.ok(run.wall.hit >= 0 && run.wall.hit < 0.25, `${w}: wall: the smashing arm at its hit frame draws in front of everything but its own spark (${run.wall.hit} covered)`);
    await p.close();
  }
  console.log("CitySmash: depth order green (the garage turntable at eight turns, the street, a wall: the near arm over the torso, the far one behind; on a wall the far arm behind the body and building, the smashing arm in front; at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
