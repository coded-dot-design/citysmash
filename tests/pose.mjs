// CitySmash's rig on a wall (Chromium, dist/citysmash.mjs), at 1440 and 390, for the ape and each rival,
// on both edges of a building (its left side and its right). Mounted on the building: the torso's front is
// pressed to the front corner (it faces the wall, the body overlaps the edge, never floating in the gap);
// the far hand and far foot are on the side wall (round the corner, behind the facade) and most of the far
// limbs are covered by the building (they sort behind it); the near foot clamps the corner and stays put;
// the free near arm smashes: at each punch's hit frame (the seven reach cells: level close, medium, far, up and
// down close and medium) its fist sits on the very window the round hits, in front of the facade, and on screen. Waits on state; steps the engine frame by frame.
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
      // Is world point q inside building b's outline on screen (the hull of its eight corners)?
      function covered(b, q) {
        const x0 = r.BLD[b * 4], x1 = x0 + r.BLD[b * 4 + 1], y0 = r.yOff(b), y1 = r.top(b), pts = [];
        for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [-3, 0]) pts.push(sc.project(x, y, z));
        pts.sort((a, c) => a[0] - c[0] || a[1] - c[1]);
        const cr = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]), lo = [], hi = [];
        for (const pt of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], pt) <= 0) lo.pop(); lo.push(pt); }
        for (const pt of pts.slice().reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], pt) <= 0) hi.pop(); hi.push(pt); }
        const hull = lo.slice(0, -1).concat(hi.slice(0, -1)), s = sc.project(q[0], q[1], q[2]);
        return hull.every((a, i) => cr(a, hull[(i + 1) % hull.length], s) >= 0);
      }
      const at = (o) => [o.M[9], o.M[10], o.M[11]];
      r.S[0] = 1;
      for (let k = 0; k < 4; k++) {
        // Only monster k in play, nothing shooting.
        for (let j = 0; j < 4; j++) (r.MV[j][24] = j === k ? 1 : 0), (r.MV[j][28] = 9);
        r.MV[k][28] = 0;
        const b = 1, x0 = r.BLD[b * 4], wd = r.BLD[b * 4 + 1], m = sc.rig(k);
        for (const s of [-1, 1]) for (let d = 0; d < 7; d++) {
          r.SO.fill(0); r.PB.fill(0); r.HE[8] = r.HE[20] = 1e9; r.TK[0] = 0; r.TK[4] = 1e9; r.HE[0] = r.HE[12] = 0;
          r.cell.fill(2); r.HIT.fill(0); r.B.fill(0); r.LIVE.fill(0);
          const M = r.MV[k], fl = 3;
          M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[8] = 0; M[33] = 0; M[7] = 100; M[15] = 0; M[23] = 0; M[20] = 0; M[34] = 0; M[11] = 0;
          step(30);
          const edge = s < 0 ? x0 : x0 + wd, g = sc.gripHand(k, -s), n2 = m.hands.length;
          const c0 = sc.contacts(k), nf0 = c0.slice((n2 + 1 - g) * 3, (n2 + 1 - g) * 3 + 3);
          // The body: its front faces the wall (into the corner), its centre by the corner, in front of the side wall.
          const T = sc.torso(k), fh = Math.hypot(T[3], T[5]), faces = ((T[3] / fh) * -s + (T[5] / fh) * -1) / Math.SQRT2;
          const corner = Math.hypot(T[0] - edge, T[2]);
          // The far limbs: the far hand and foot on the side wall, round the corner (behind the facade's plane); the
          // far arm sorts behind the building and most of its forearm is covered by it (the leg is behind the body).
          const fh3 = c0.slice(g * 3, g * 3 + 3), ff3 = c0.slice((n2 + g) * 3, (n2 + g) * 3 + 3), el = at(m.fore[g]);
          let cov = 0, all = 0;
          for (const [a, c] of [[el, fh3]]) for (let q = 1; q <= 4; q++) {
            const u = q / 4;
            all++;
            if (covered(b, [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, a[2] + (c[2] - a[2]) * u])) cov++;
          }
          // The punch at reach cell d (a tap's target): level close, medium, far; up close, medium; down close, medium.
          M[20] = 0.3; M[43] = 1 + d;
          const i = r.reachCell(M, d), RC = [0, 1, 0, 2, 0, 3, 1, 1, 1, 2, -1, 1, -1, 2];
          let n = 0;
          while (!r.HIT[i] && n++ < 40) step(1);
          const c = sc.contacts(k), hit = c.slice((1 - g) * 3, (1 - g) * 3 + 3), fh1 = c.slice(g * 3, g * 3 + 3), nf = c.slice((n2 + 1 - g) * 3, (n2 + 1 - g) * 3 + 3);
          const rel = i - r.C0[b], row = (rel / wd) | 0, col = rel - row * wd, cx = x0 + col + 0.5, cy = r.yOff(b) + row + 0.5;
          const [px, py] = sc.where(k), cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas").getBoundingClientRect();
          const onSide = (q) => Math.abs(q[0] - edge) < 0.7 && q[2] < 0 && q[2] > -2.5;
          out.push({
            k, s, d, lunge: sc.wall[k].lunge, hitFrame: r.HIT[i] === 1, cell: col === (s < 0 ? RC[d * 2 + 1] - 1 : wd - RC[d * 2 + 1]), row: row - fl === RC[d * 2],
            onWindow: Math.abs(hit[0] - cx) < 0.55 && Math.abs(hit[1] - cy) < 0.55, inFront: hit[2] > 0,
            faces: +faces.toFixed(2), corner: +corner.toFixed(2), front: +T[2].toFixed(2), tx: +((T[0] - edge) * -s).toFixed(2),
            farHand: onSide(fh3) && onSide(fh1), farFoot: k === 2 || onSide(ff3), cov: cov / all,
            nearFoot: k === 2 || (Math.abs(nf[0] - edge) < 0.75 && nf[2] > -0.3 && nf[2] < 1.2 && Math.hypot(nf[0] - nf0[0], nf[1] - nf0[1]) < 0.3),
            seen: px > -4 && px < cv.width + 4 && py > -4 && py < cv.height + 4,
            at: hit.map((v) => +v.toFixed(2)), win: [cx, cy].map((v) => +v.toFixed(2)), fh: fh3.map((v) => +v.toFixed(2)), ff: ff3.map((v) => +v.toFixed(2)), nf: nf.map((v) => +v.toFixed(2)), edge,
          });
          step(20);
        }
      }
      sc.engine.start();
      return out;
    });
    for (const o of res) {
      const at = `${w}: monster ${o.k}, side ${o.s}, reach cell ${o.d}`;
      if (process.env.POSE_DEBUG) console.log(JSON.stringify(o));
      assert.ok(o.hitFrame && o.cell && o.row, `${at}: the round hits the reach cell's window ${JSON.stringify(o)}`);
      assert.ok(o.onWindow, `${at}: the fist is on that window (fist ${o.at}, window ${o.win})`);
      assert.ok(o.inFront, `${at}: the fist is in front of the facade (z ${o.at[2]})`);
      assert.ok(o.faces > 0.6, `${at}: the torso's front faces the wall (${o.faces})`);
      assert.ok(o.corner < 1.4 && o.front > -0.3 && o.tx > -1.3, `${at}: the body is on the building's corner, not in the gap (from the corner ${o.corner}, z ${o.front}, x ${o.tx})`);
      // The far swing (cell 2) leans a short-armed rival's body in off the corner, by design (src/monster.ts WALL lunge).
      const lunge = o.d === 2 && o.lunge > 0;
      assert.ok(o.farHand || lunge, `${at}: the far hand is on the side wall round the corner (${o.fh}, edge ${o.edge})`);
      assert.ok(o.farFoot, `${at}: the far foot is on the side wall round the corner (${o.ff}, edge ${o.edge})`);
      assert.ok(o.cov >= 0.5, `${at}: the far arm is mostly behind the building (${o.cov} covered)`);
      assert.ok(o.nearFoot || lunge, `${at}: the near foot clamps the front corner and holds (${o.nf}, edge ${o.edge})`);
      assert.ok(o.seen, `${at}: on screen`);
    }
    await p.close();
  }
  console.log("CitySmash: the rig green (four monsters, both edges, the seven reach cells: mounted on the corner, chest to the wall, far limbs round the side and behind the building, near foot on the corner, the fist on the window the round hits, in front, at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
