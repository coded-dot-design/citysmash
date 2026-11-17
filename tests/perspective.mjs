// CitySmash on a wall against the held building's perspective (Chromium, dist/citysmash.mjs). The owner's case
// (screenshot 167, reported again and again): a building far left or right of the screen, its side wall seen
// strongly, the ape on that edge: the floors' depth and ledges drew across him and he read as inside the
// building. Here, in every city, on both edges of the two leftmost and the two rightmost buildings, at rest, mid-climb and at each of the seven punches' hit frames, at 1440, 390 portrait and 844
// landscape, with two framings: the game's own follow camera (settled on him) and the camera as far over to
// his side as the game's camera goes (him near the screen's edge, his side wall seen hardest: 167, where the
// camera followed a point away from him; a zoomed browser scales the same picture): at least 93% of his torso
// and head (the arms aside: the far arm may go behind the front corner) shows with every building drawn as
// with none. Every failure is listed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const page = fixture.replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3, store: { get: () => null, set() {} } });</script></body>`);
const { CITIES } = await import("../src/cities.ts");
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const LIMIT = 0.93, all = [];
try {
  for (const [w, h] of JSON.parse(process.env.PERSP_VP || "[[1440, 900], [390, 844], [844, 390]]")) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(server.url + "/");
    await p.waitForFunction(() => window.game);
    const bad = [];
    let n = 0, worst = 1, at = "";
    for (let ci = 0; ci < CITIES.length; ci++) {
      await p.evaluate((ci) => game.play(ci), ci);
      await p.waitForFunction(() => game.scene?.state.drawn);
      const res = await p.evaluate((frames) => {
        const sc = game.scene, r = sc.run, out = [], E = sc.engine;
        const cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas"), cx = cv.getContext("2d");
        // (counted in a box of 4 units round him: the whole canvas reads slowly)
        const count = () => {
          const M = r.MV[0], q0 = sc.project(M[0], M[1] + 1.5, M[2]), u = Math.abs(sc.project(M[0] + 1, M[1] + 1.5, M[2])[0] - q0[0]), k2 = cv.width / cv.getBoundingClientRect().width;
          const X = Math.max(0, Math.round((q0[0] - 4 * u) * k2)), Y = Math.max(0, Math.round((q0[1] - 4 * u) * k2)), W = Math.min(cv.width - X, Math.round(8 * u * k2)), H = Math.min(cv.height - Y, Math.round(8 * u * k2));
          const d = cx.getImageData(X, Y, Math.max(1, W), Math.max(1, H)).data; let k = 0; for (let q = 0; q < d.length; q += 4) if (d[q + 1] < 25 && d[q] > 90 && Math.abs(d[q] - d[q + 2]) < 16) k++; return k; };
        // The engine stopped, its clock held (the rig's breath reads engine.time).
        E.stop();
        const td = Object.getOwnPropertyDescriptor(E, "time");
        let t = 0;
        Object.defineProperty(E, "time", { get: () => t, configurable: true });
        // (the edge framing: the camera held as far to his side as the game's camera goes, before every frame)
        let camX = null;
        const C = sc.dio.cam, step = (k) => { for (let i = 0; i < k; i++) (camX === null || (C.tx = camX)), (t += 1 / 60), E.advance(1 / 60); };
        r.S[0] = 1;
        for (let j = 0; j < 4; j++) (r.MV[j][24] = j === 0 ? 1 : 0), (r.MV[j][28] = 9);
        r.MV[0][28] = 0;
        const live = r.LIVE.slice();
        r.LIVE.fill(0);
        const M = r.MV[0], rig = sc.rig(0), nb = r.nb(), slabs = [];
        sc.dio.recolor((o) => void (o.size[0] === 0.002 && slabs.push(o)));
        const hideAll = () => {
          const gs = [];
          for (let j = 0; j < nb; j++) for (const id of ["bg" + j, "bg" + j + "x"]) { const g = sc.dio.get(id); if (g) gs.push([g, g.alpha]), (g.alpha = 0); }
          for (const o of slabs) gs.push([o, o.alpha]), (o.alpha = 0);
          return () => gs.forEach(([g, a]) => (g.alpha = a));
        };
        // Torso and head magenta, the arms out of the count.
        const measure = () => {
          const arms = [...rig.arms].map((o) => [o, o.alpha]);
          for (const [o] of arms) o.alpha = 0;
          rig.tor.tint = "#ff00ff";
          sc.dio.draw();
          const a = count(), back = hideAll();
          sc.dio.draw();
          const b = count();
          back();
          rig.tor.tint = null;
          for (const [o, al] of arms) o.alpha = al;
          sc.dio.draw();
          return [a, b];
        };
        const pick = [...new Set([0, 1, nb - 2, nb - 1])].filter((b) => r.standing(b));
        const quiet = () => { r.SO.fill(0); r.PB.fill(0); r.HE[8] = r.HE[20] = 1e9; r.TK[0] = 0; r.TK[4] = 1e9; r.HE[0] = r.HE[12] = 0; M[11] = 0; };
        for (const frame of frames) for (const b of pick) for (const s of [-1, 1]) {
          camX = null;
          r.cell.fill(2); r.B.fill(0); r.occ.fill(0); r.HIT.fill(0); r.SO.fill(0); r.CH.fill(0);
          const fl = Math.min(2, r.BLD[b * 4 + 2] - 2);
          const hang = () => { quiet(); M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[3] = 0; M[4] = 0; M[7] = 100; M[8] = 0; M[33] = 0; M[20] = 0; M[34] = 0; M[9] = 0; M[10] = 0; M[11] = 0; M[15] = 0; M[19] = 0; M[23] = 0; };
          const look = (what) => { if (camX !== null) C.tx = camX; const [a, bare] = measure(); out.push({ b, s, what: frame + " camera, " + what, a, bare }); };
          hang();
          // The camera where the game's settles (on him, held inside the city), or the edge framing.
          const V8 = Math.tan(C.fov / 2) * C.dist * (sc.dio.width / sc.dio.height), lim = Math.max(0, r.SX + 1.5 - V8);
          camX = Math.max(-lim, Math.min(lim, M[0] + (frame === "edge" ? s * 0.8 * V8 : 0)));
          step(30);
          look("rest");
          M[33] = 1; M[13] = 0.7; step(1); M[33] = 1; look("mid-climb");
          for (let c = 0; c < 7; c++) {
            hang(); r.cell.fill(2); r.HIT.fill(0); step(8);
            M[20] = 0.3; M[43] = 1 + c;
            let k = 0;
            while (!(M[34] <= 0 && M[8] > 0 && M[38] === c + 1) && k++ < 40) step(1);
            if (M[38] === c + 1) look("punch " + c);
          }
        }
        r.LIVE.set(live);
        Object.defineProperty(E, "time", td);
        E.start();
        return out;
      }, ["follow", "edge"]);
      for (const o of res) {
        n++;
        const v = o.bare ? o.a / o.bare : 1;
        if (v < worst) (worst = v), (at = `city ${ci}, building ${o.b} ${o.s < 0 ? "left" : "right"} side, ${o.what}`);
        if (process.env.PERSP_DEBUG) console.log(w, h, ci, o.b, o.s, o.what, v.toFixed(3), o.bare);
        if (v < LIMIT) bad.push(`city ${ci}, building ${o.b} ${o.s < 0 ? "left" : "right"} side, ${o.what}: ${(v * 100).toFixed(0)}% of torso and head show`);
      }
    }
    all.push(...bad.map((b) => `${w}×${h}: ${b}`));
    assert.ok(n >= CITIES.length * 2 * 4 * 9, `${w}×${h}: ${n} poses checked`);
    console.log(`${w}×${h}: ${n} wall poses at the extremes, ${bad.length} under ${LIMIT * 100}%, the worst ${(worst * 100).toFixed(1)}% showing (${at})`);
    await p.close();
  }
  assert.deepEqual(all, [], `the held building never draws across his torso or head (${all.length} failures)`);
  console.log("CitySmash: perspective green (on a wall at the screen's edges he hangs outside the corner: torso and head ≥ 93% in view).");
} finally {
  await browser.close();
  await server.close();
}
