// CitySmash's depth against the city (Chromium, dist/citysmash.mjs). On a wall the rig sorts behind the
// building it holds only: in every city, on both edges of two buildings, at rest, mid-climb and at each of
// the seven punches' hit frames, at least 70% of the torso's pixels that show without the neighbouring
// buildings and side walls still show with them, with the camera in front and off to either side (a
// neighbour never draws over him, nor the side wall he hangs on). The street's little things sort by
// where they are: a parachute or a soldier behind the ape draws behind him, one in front draws over him.
// The magenta-tint coverage of tests/layers.mjs: paint the part flat magenta, count its pixels.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const page = fixture.replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3, store: { get: () => null, set() {} } });</script></body>`);
const { CITIES, R_TANK } = await import("../src/cities.ts");
/** City ci's buildings with the rooftop water tank (the deep-ledge, wide-roof kit of owner screenshots 163 and 166). */
const tankKit = (ci) => CITIES[ci].b.map((_, b) => b).filter((b) => b !== CITIES[ci].landmark && CITIES[ci].roofs[(b + ci) % CITIES[ci].roofs.length] === R_TANK);
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const KIT = `window.kit = (sc) => {
  const cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas"), cx = cv.getContext("2d");
  const count = () => { const d = cx.getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let q = 0; q < d.length; q += 4) if (d[q + 1] < 25 && d[q] > 90 && Math.abs(d[q] - d[q + 2]) < 16) n++; return n; };
  /** Pixels of part o (tinted magenta): [with the scene, with fn() undone after]. */
  const px = (o, hide) => { const was = o.tint; o.tint = "#ff00ff"; sc.dio.draw(); const a = count(); const back = hide(); sc.dio.draw(); const b = count(); back(); o.tint = was; sc.dio.draw(); return [a, b]; };
  /** The engine stopped and its clock held: step(n) runs n frames of 1/60 s from time 0, done() gives the clock back.
   *  The rig's breath and a shock's shake and flicker read engine.time, which otherwise holds however long the page
   *  ran before the test stopped it (the 76-78% runs of v11 and v12 were a shocked pose at a chance phase). */
  const hold = () => {
    sc.engine.stop();
    const d = Object.getOwnPropertyDescriptor(sc.engine, "time");
    let t = 0;
    Object.defineProperty(sc.engine, "time", { get: () => t, configurable: true });
    return { step: (n) => { for (let i = 0; i < n; i++) (t += 1 / 60), sc.engine.advance(1 / 60); }, done: () => (Object.defineProperty(sc.engine, "time", d), sc.engine.start()) };
  };
  return { count, px, hold };
};`;
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(server.url + "/");
    await p.waitForFunction(() => window.game);
    await p.addScriptTag({ content: KIT });
    const bad = [];
    let n = 0, worst = 1;
    for (let ci = 0; ci < (w === 1440 ? 7 : 2); ci++) {
      await p.evaluate((ci) => game.play(ci), ci);
      await p.waitForFunction(() => game.scene?.state.drawn);
      const res = await p.evaluate((tanks) => {
        const sc = game.scene, r = sc.run, K = kit(sc), out = [], { step, done } = K.hold();
        // No live windows: each of the seven punches lands as a punch. A live one shocks him off the wall (and the
        // next punches, re-hung, measured a shocked ape: arms up, rolling, no punch at all).
        const live = r.LIVE.slice();
        r.LIVE.fill(0);
        r.S[0] = 1;
        for (let j = 0; j < 4; j++) (r.MV[j][24] = j === 0 ? 1 : 0), (r.MV[j][28] = 9);
        r.MV[0][28] = 0;
        const M = r.MV[0], rig = sc.rig(0), nb = r.nb();
        // Every other building (its floors, its roof, its rubble) hidden, then back.
        const slabs = [];
        sc.dio.recolor((o) => void (o.size[0] === 0.002 && slabs.push(o)));
        const others = (b) => () => {
          const gs = [];
          for (let j = 0; j < nb; j++) if (j !== b || b < 0) for (const id of ["bg" + j, "bg" + j + "x"]) { const g = sc.dio.get(id); if (g) gs.push([g, g.alpha]), (g.alpha = 0); }
          for (const o of slabs) gs.push([o, o.alpha]), (o.alpha = 0);
          return () => gs.forEach(([g, a]) => (g.alpha = a));
        };
        for (const b of [...new Set([1, nb - 2, ...tanks])]) for (const s of [-1, 1]) {
          r.cell.fill(2); r.B.fill(0); r.occ.fill(0); r.HIT.fill(0); r.SO.fill(0); r.CH.fill(0);
          // (v15: the army held off too: a shot or a shock in the 90 steps flinches him, a pose of its own)
          r.PB.fill(0); r.HE[0] = r.HE[12] = 0; r.HE[8] = r.HE[20] = 1e9; r.TK[0] = 0; r.TK[4] = 1e9; r.FE[8] = 1e9; r.FE[9] = 0;
          const fl = Math.min(2, r.BLD[b * 4 + 2] - 2);
          const hang = () => { M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[3] = 0; M[4] = 0; M[7] = 100; M[8] = 0; M[33] = 0; M[20] = 0; M[34] = 0; M[9] = 0; M[10] = 0; M[11] = 0; M[15] = 0; M[19] = 0; M[23] = 0; };
          hang();
          step(90);
          // From straight in front and with the camera off to either side (two players apart, the street's ends):
          // the angle that shows a side wall.
          const at = (what) => {
            const tx = sc.dio.cam.tx;
            for (const off of [0, -7, 7]) {
              sc.dio.cam.tx = M[0] + off;
              const [a, b2] = K.px(rig.tor, others(b)), [, b3] = K.px(rig.tor, others(-1));
              out.push({ b, s, what: what + (off ? ` (camera ${off > 0 ? "right" : "left"})` : ""), shown: a, alone: b2, bare: b3 });
            }
            sc.dio.cam.tx = tx;
          };
          at("rest");
          M[33] = 1; M[13] = 0.7; step(1); M[33] = 1; at("mid-climb");
          for (let c = 0; c < 7; c++) {
            hang(); r.cell.fill(2); r.HIT.fill(0); step(20);
            M[20] = 0.3; M[43] = 1 + c;
            let k = 0;
            while (!(M[34] <= 0 && M[8] > 0 && M[38] === c + 1) && k++ < 40) step(1);
            if (M[38] === c + 1) at("punch " + c);
          }
        }
        r.LIVE.set(live);
        done();
        return out;
      }, tankKit(ci));
      for (const o of res) {
        o.tank = tankKit(ci).includes(o.b);
        n++;
        const vis = o.alone ? o.shown / o.alone : 1;
        worst = Math.min(worst, vis);
        if (process.env.DEPTH_DEBUG) console.log(w, ci, o.b, o.s, o.what, vis.toFixed(3), (o.bare ? o.shown / o.bare : 1).toFixed(3));
        if (vis < 0.7) bad.push(`city ${ci}, building ${o.b} ${o.s < 0 ? "left" : "right"} side, ${o.what}: ${(vis * 100).toFixed(0)}% of the torso shows`);
        // With the camera on the gap's side the side wall he hangs on faces the camera: it must not cover him
        // (only the front corner may, in perspective). Before v9 it drew over him (down to 50% showing).
        const gap = (o.s < 0 && o.what.includes("camera left")) || (o.s > 0 && o.what.includes("camera right")), held = o.bare ? o.shown / o.bare : 1;
        // v11 (owner screenshots 163, 166): the deep-ledge building with the rooftop tank. Its held front's ledge
        // slabs ran the building's whole depth, so with the camera on his side they sliced through him; the
        // ledges are lips on the front now, the roof slab and its furniture sort with the side walls.
        if (gap && o.tank && held < 0.8) bad.push(`city ${ci}, the tank-roof building ${o.b} ${o.s < 0 ? "left" : "right"} side, ${o.what}: its front leaves ${(held * 100).toFixed(0)}% of the torso`);
        if (gap && held < 0.65) bad.push(`city ${ci}, building ${o.b} ${o.s < 0 ? "left" : "right"} side, ${o.what}: the building he holds leaves ${(held * 100).toFixed(0)}% of the torso`);
      }
    }
    assert.deepEqual(bad, [], `${w}: no neighbouring building covers the ape on a wall`);
    assert.ok(n >= (w === 1440 ? 7 * 4 * 9 * 3 : 2 * 4 * 9 * 3), `${w}: ${n} poses checked`);
    // The street's little things against the ape on the street: a parachute behind him (nearer the buildings)
    // draws behind his torso, one in front of him over it; a soldier at his feet behind him, behind his legs.
    const st = await p.evaluate(() => {
      const sc = game.scene, r = sc.run, K = kit(sc), { step, done } = K.hold();
      const M = r.MV[0], rig = sc.rig(0), x = r.BLD[4] - 1.3;
      M[5] = 0; M[6] = 1; M[0] = x; M[1] = 0; M[2] = 1.9; M[3] = 0; M[7] = 100;
      r.SO.fill(0); r.CH.fill(0);
      step(60);
      const chute = (z) => { r.CH.fill(0); r.CH.set([1, x + 0.2, 2.2, z, 0, 0, 1, 0, 1], 0); step(1); const v = K.px(rig.tor, () => { const c = r.CH[0]; r.CH[0] = 0; step(1); return () => ((r.CH[0] = c), step(1)); }); r.CH.fill(0); return v; };
      const soldier = (z) => { r.SO.fill(0); r.SO.set([1, x + 0.3, z, 1, 0, 0, 0, 0], 0); step(1); const v = K.px(rig.root, () => { const c = r.SO[0]; r.SO[0] = 0; step(1); return () => ((r.SO[0] = c), step(1)); }); r.SO.fill(0); return v; };
      const out = { behind: chute(0.3), front: chute(3.4), soldierBehind: soldier(1.2) };
      done();
      return out;
    });
    if (process.env.DEPTH_DEBUG) console.log(w, JSON.stringify(st));
    const cov = ([a, b]) => (b ? 1 - a / b : 0);
    assert.ok(cov(st.behind) < 0.02, `${w}: a parachute behind the ape draws behind him (${cov(st.behind).toFixed(3)} of the torso covered)`);
    assert.ok(cov(st.front) > 0.02, `${w}: a parachute in front draws over him (${cov(st.front).toFixed(3)} covered)`);
    assert.ok(cov(st.soldierBehind) < 0.003, `${w}: a soldier behind his feet draws behind him (${cov(st.soldierBehind).toFixed(3)} covered)`);
    console.log(`${w}: ${n} wall poses, the worst ${(worst * 100).toFixed(0)}% of the torso showing past the neighbours`);
    await p.close();
  }
  console.log("CitySmash: depth against the city green (on a wall only the held building covers him; the street's points sort by where they are; at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
