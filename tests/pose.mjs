// CitySmash's rig on a wall (Chromium, dist/citysmash.mjs), at 1440 and 390, for the ape and each rival,
// on both edges of a building (its left side and its right). It climbs the side wall: side-on, chest to the
// wall, set back behind the front corner in the gap (never out in front of the facade); the far hand and both
// feet are on the side wall; the near foot holds still while it punches; the free near arm smashes: at each
// punch's hit frame (the seven reach cells: level close, medium, far, up and down close and medium) its fist
// sits on the very window the round hits, in front of the facade, and on screen. The reach stays clear: at
// rest and mid-climb, no part of the monster shows over any of the seven reach cells (each cell's pixels
// with the monster drawn and without it), and a click at each cell's centre punches that window. Waits on
// state; steps the engine frame by frame.
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
      // Every part (for a part's screen box: its eight corners projected) and whether it hangs off another.
      const parts = [];
      sc.dio.recolor((o) => void parts.push(o));
      const under = (o, g) => { for (let q = o; q; q = q.parent) if (q === g) return true; return false; };
      const box = (os) => {
        const b = [1e9, 1e9, -1e9, -1e9];
        for (const o of os) for (let q = 0; q < 8; q++) {
          const M = o.M, x = (q & 1 ? 0.5 : -0.5) * o.size[0], y = (q & 2 ? 0.5 : -0.5) * o.size[1], z = (q & 4 ? 0.5 : -0.5) * o.size[2];
          const v = sc.project(M[9] + M[0] * x + M[1] * y + M[2] * z, M[10] + M[3] * x + M[4] * y + M[5] * z, M[11] + M[6] * x + M[7] * y + M[8] * z);
          (b[0] = Math.min(b[0], v[0])), (b[1] = Math.min(b[1], v[1])), (b[2] = Math.max(b[2], v[0])), (b[3] = Math.max(b[3], v[1]));
        }
        return b;
      };
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
          const neckO = sc.dio.get(m.root.id + "-neck"), c0 = sc.contacts(k), nf0 = c0.slice((n2 + 1 - g) * 3, (n2 + 1 - g) * 3 + 3);
          // The body: side-on, its front faces the wall, out in the gap and set back behind the front.
          const T = sc.torso(k), fh = Math.hypot(T[3], T[5]), faces = (T[3] / fh) * -s, nk = sc.dio.get(m.root.id + "-neck").M;
          const fh3 = c0.slice(g * 3, g * 3 + 3), ff3 = c0.slice((n2 + g) * 3, (n2 + g) * 3 + 3);
          // The punch at reach cell d (a tap's target): level close, medium, far; up close, medium; down close, medium.
          M[20] = 0.3; M[43] = 1 + d;
          const i = r.reachCell(M, d), RC = [0, 1, 0, 2, 0, 3, 1, 1, 1, 2, -1, 1, -1, 2];
          // The far punch's wind-up (its last frame before the hit): the body part-way round the corner, towards the
          // camera; the fist cocked back, away from the window (farther than at rest and at the hit), clear of the head.
          let wnd = null;
          if (d === 2) {
            step(4);
            const cw = sc.contacts(k), fw = cw.slice((1 - g) * 3, (1 - g) * 3 + 3), hd = box(parts.filter((o) => o.shape !== "group" && under(o, neckO))), fb = box([m.hands[1 - g]]);
            wnd = { T: sc.torso(k), f: fw, lap: Math.max(0, Math.min(hd[2], fb[2]) - Math.max(hd[0], fb[0])) * Math.max(0, Math.min(hd[3], fb[3]) - Math.max(hd[1], fb[1])), still: M[34] > 0 };
          }
          let n = 0;
          while (!r.HIT[i] && n++ < 40) step(1);
          const c = sc.contacts(k), hit = c.slice((1 - g) * 3, (1 - g) * 3 + 3), fh1 = c.slice(g * 3, g * 3 + 3), nf = c.slice((n2 + 1 - g) * 3, (n2 + 1 - g) * 3 + 3);
          const rel = i - r.C0[b], row = (rel / wd) | 0, col = rel - row * wd, cx = x0 + col + 0.5, cy = r.yOff(b) + row + 0.5;
          // The far punch brings the body round the front corner, towards the camera: the torso at the hit against
          // at rest, its depth from the camera, how far across the screen it moves towards the window (in window
          // widths), and the head against the corner edge on screen (past it: over the front face).
          const T1 = sc.torso(k), P = (q) => sc.project(q[0], q[1], q[2]), u = Math.abs(P([cx + 1, cy, 0])[0] - P([cx, cy, 0])[0]);
          const nearer = P(T)[2] - P(T1)[2], across = ((P(T1)[0] - P(T)[0]) * -s) / u, past = ((P([nk[9], nk[10], nk[11]])[0] - P([edge, nk[10], 0])[0]) * -s) / u;
          const [px, py] = sc.where(k), cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas").getBoundingClientRect();
          const onSide = (q) => (q[0] - edge) * s > -0.3 && (q[0] - edge) * s < 1.2 && q[2] < 0 && q[2] > -2.6;
          const Cs = P([cx, cy, 0]), far2 = (q) => Math.hypot(P(q)[0] - Cs[0], P(q)[1] - Cs[1]);
          const wind = wnd && { part: +((P(T)[2] - P(wnd.T)[2]) / (P(T)[2] - P(T1)[2])).toFixed(2), still: wnd.still, lap: +wnd.lap.toFixed(1), fist: [far2(c0.slice((1 - g) * 3, (1 - g) * 3 + 3)), far2(wnd.f), far2(hit)].map((v) => +v.toFixed(1)) };
          out.push({
            k, s, d, wind, lunge: sc.wall[k].lunge, nearer: +nearer.toFixed(2), across: +across.toFixed(2), past: +past.toFixed(2), hitFrame: r.HIT[i] === 1, cell: col === (s < 0 ? RC[d * 2 + 1] - 1 : wd - RC[d * 2 + 1]), row: row - fl === RC[d * 2],
            onWindow: Math.abs(hit[0] - cx) < 0.55 && Math.abs(hit[1] - cy) < 0.55, inFront: hit[2] > 0,
            faces: +faces.toFixed(2), front: +T[2].toFixed(2), front1: +T1[2].toFixed(2), tx: +((T[0] - edge) * s).toFixed(2),
            farHand: onSide(fh3) && onSide(fh1), farFoot: k === 2 || onSide(ff3),
            nearFoot: k === 2 || (onSide(nf) && Math.hypot(nf[0] - nf0[0], nf[1] - nf0[1]) < 0.3),
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
      assert.ok(o.faces > 0.8, `${at}: side-on, the torso's front faces the wall (${o.faces})`);
      // The far swing (cell 2) brings the body round the front corner, towards the camera, by design (src/monster.ts
      // WALL lunge, come): the far hand and the near foot may leave the side wall.
      const lunge = o.d === 2 && o.lunge > 0;
      assert.ok(o.front < -0.3 && o.front > -2.6 && o.tx > 0.3 && o.tx < 2.4, `${at}: the body is on the side wall, out in the gap and behind the front at rest (z ${o.front}, out ${o.tx})`);
      assert.ok(o.farHand || lunge, `${at}: the far hand is on the side wall behind the body (${o.fh}, edge ${o.edge})`);
      assert.ok(o.farFoot, `${at}: the far foot is on the side wall (${o.ff}, edge ${o.edge})`);
      assert.ok(o.nearFoot || lunge, `${at}: the near foot is on the side wall and holds (${o.nf}, edge ${o.edge})`);
      assert.ok(o.seen, `${at}: on screen`);
      if (o.d === 2) {
        assert.ok(o.nearer > 1, `${at}: the far punch brings the torso towards the camera (${o.nearer} nearer than at rest)`);
        assert.ok(o.front1 > 0, `${at}: at the far hit the torso is in front of the facade (z ${o.front1})`);
        assert.ok(o.across > 0.4, `${at}: the far punch moves the torso across the screen towards the window (${o.across} window widths)`);
        assert.ok(o.past > 0.2, `${at}: at the far hit the head is past the front corner, over the front face (${o.past} window widths)`);
        const W = o.wind;
        assert.ok(W.still, `${at}: the far wind-up is measured before the hit frame`);
        assert.ok(W.part > 0.3 && W.part < 0.8, `${at}: at the far wind-up the torso is already part-way towards the camera (${W.part} of the way to the hit)`);
        assert.ok(W.fist[1] > W.fist[0] && W.fist[1] > W.fist[2], `${at}: the far wind-up cocks the fist back, farther from the window than at rest and at the hit (px from the window: rest, wind-up, hit ${W.fist})`);
        assert.ok(W.lap === 0, `${at}: the cocked fist is clear of the head on screen (${W.lap} px² overlap)`);
      }
    }
    // The reach stays clear: at rest and mid-climb, each reach cell's pixels with the monster and without it
    // (a margin of 5% for edge anti-aliasing and the city's own flicker; an arm out over a cell covers 60% or more).
    const clear = await p.evaluate(() => {
      const sc = game.scene, r = sc.run, out = [];
      sc.engine.stop();
      const step = (n) => { for (let i = 0; i < n; i++) sc.engine.advance(1 / 60); };
      const cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas"), cx = cv.getContext("2d"), dpr = cv.width / cv.getBoundingClientRect().width;
      for (let k = 0; k < 4; k++) {
        for (let j = 0; j < 4; j++) (r.MV[j][24] = j === k ? 1 : 0), (r.MV[j][28] = 9);
        r.MV[k][28] = 0;
        const b = 1, x0 = r.BLD[b * 4], wd = r.BLD[b * 4 + 1], m = sc.rig(k);
        for (const s of [-1, 1]) for (const climb of [0, 0.35, 0.7]) {
          r.SO.fill(0); r.PB.fill(0); r.HE[8] = r.HE[20] = 1e9; r.TK[0] = 0; r.TK[4] = 1e9; r.HE[0] = r.HE[12] = 0;
          r.cell.fill(2); r.HIT.fill(0); r.B.fill(0); r.LIVE.fill(0); r.occ.fill(0);
          const M = r.MV[k], fl = 3;
          M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[8] = 0; M[33] = 0; M[7] = 100; M[15] = 0; M[23] = 0; M[20] = 0; M[34] = 0; M[11] = 0;
          step(30);
          // The camera (it follows the monster in play, easing) settles first: a pan of half a pixel between the
          // frames below shifts every window edge and would read as cover.
          for (let q = sc.project(x0, 5, 0)[0], n = 0; n++ < 600; ) { step(1); const v = sc.project(x0, 5, 0)[0]; if (Math.abs(v - q) < 0.005) break; q = v; }
          // Mid-climb: the shimmy at a point of its cycle (held still: only the pose moves).
          if (climb) for (let i = 0; i < 12; i++) (M[33] = 1), (M[13] = climb + i * 0.05), (M[1] = fl + 0.5 - 1.9), step(1);
          const shot = () => {
            const px = [];
            for (let d = 0; d < 7; d++) {
              const i = r.reachCell(M, d), rel = i - r.C0[b], row = (rel / wd) | 0, col = rel - row * wd, wx = x0 + col, wy = r.yOff(b) + row;
              const a = sc.project(wx + 0.12, wy + 0.88, 0.05), c = sc.project(wx + 0.88, wy + 0.12, 0.05);
              const X = Math.round(a[0] * dpr), Y = Math.round(a[1] * dpr), W = Math.max(1, Math.round((c[0] - a[0]) * dpr)), H = Math.max(1, Math.round((c[1] - a[1]) * dpr));
              px.push(cx.getImageData(X, Y, W, H).data);
            }
            return px;
          };
          step(1);
          const on = shot();
          // Without it: its body group faded out (the camera, which follows the monsters in play, stays put).
          const body = m.tor.id.endsWith("-tor") ? m.tor.parent : m.tor;
          body.alpha = 0;
          step(1);
          const off = shot();
          body.alpha = 1;
          step(1);
          const on2 = shot();
          // A click at each cell's centre punches that window (the ape's, at rest: the screen's own monster).
          if (k === 0 && !climb) for (let d = 6; d >= 0; d--) {
            // (the earlier punches can flatten the city: its cards would hold the input; so it starts over each time)
            r.S[0] = 1; r.HIT.fill(0); r.cell.fill(2); r.B.fill(0); M[8] = 0; M[45] = 0; M[34] = 0; M[1] = fl + 0.5 - 1.9; M[0] = r.wallX(b, s);
            step(10);
            for (const c of cv.getRootNode().querySelectorAll(".cs-end, .cs-ccard")) c.hidden = true;
            r.occ.fill(0); r.CH.fill(0); r.SO.fill(0); r.HE[0] = r.HE[12] = 0;
            r.S[0] = 1; M[5] = 2; M[12] = b; M[22] = s; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[0] = r.wallX(b, s); M[8] = 0;
            const i = r.reachCell(M, d), rel = i - r.C0[b], row = (rel / wd) | 0, col = rel - row * wd, q = sc.project(x0 + col + 0.5, r.yOff(b) + row + 0.5, 0.05), bx = cv.getBoundingClientRect();
            cv.parentNode.querySelector(".cs-play").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: bx.left + q[0], clientY: bx.top + q[1], pointerType: "mouse" }));
            let n = 0;
            while (!r.HIT[i] && n++ < 60) (r.S[0] = 1), step(1);
            out.push({ k, s, climb, d, click: r.HIT[i] > 0, want: i, tapped: M[38] - 1 });
            step(20);
          }
          for (let d = 0; d < 7; d++) {
            // A pixel the monster covers: the same in the frames before and after (it is not the city's own
            // animation), different in the frame between, without the monster.
            const A = on[d], B = off[d], C = on2[d], dd = (X, Y, q) => Math.abs(X[q] - Y[q]) + Math.abs(X[q + 1] - Y[q + 1]) + Math.abs(X[q + 2] - Y[q + 2]);
            let diff = 0;
            for (let q = 0; q < A.length; q += 4) if (dd(A, C, q) <= 24 && dd(A, B, q) > 24) diff++;
            out.push({ k, s, climb, d, cover: +(diff / (A.length / 4)).toFixed(3) });
          }
        }
      }
      sc.engine.start();
      return out;
    });
    for (const o of clear) if ("click" in o) assert.ok(o.click, `${w}: side ${o.s}: a click on reach cell ${o.d}'s centre punches that window (${JSON.stringify(o)})`);
    if (process.env.POSE_DEBUG) console.log(JSON.stringify(clear.filter((o) => !("click" in o)).map((o) => o.cover)));
    for (const o of clear) if (!("click" in o)) assert.ok(o.cover <= 0.05, `${w}: monster ${o.k}, side ${o.s}, ${o.climb ? "mid-climb" : "at rest"}: reach cell ${o.d} is clear of the monster (${(o.cover * 100).toFixed(1)}% of it covered)`);
    await p.close();
  }
  console.log("CitySmash: the rig green (four monsters, both edges, the seven reach cells: side-on on the side wall behind the front, chest to the wall, far hand and feet on the side wall, the fist on the window the round hits, in front; the far punch brings the body towards the camera and round the front corner; the reach clear of the monster at rest and mid-climb, a click on each cell punches it; at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
