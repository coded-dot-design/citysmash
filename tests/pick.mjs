// CitySmash's pick (Chromium, dist/citysmash.mjs): a tap or click lights what it picked until the action
// lands, in the colour of what it will do: green a punch (an empty window in reach), teal a grab (someone
// at a window in reach, the far punch's cell too: if he can punch it, he can grab it), red and TOO FAR out
// of reach (a person four windows in). The mouse's hover previews the same colours. At 1440 and 390.
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
      const step = (n) => { for (let i = 0; i < n; i++) sc.engine.advance(1 / 60); };
      r.S[0] = 1;
      for (let j = 0; j < 4; j++) (r.MV[j][24] = j === 0 ? 1 : 0), (r.MV[j][28] = 9);
      r.MV[0][28] = 0;
      r.SO.fill(0); r.CH.fill(0); r.occ.fill(0); r.LIVE.fill(0); r.cell.fill(2); r.HIT.fill(0);
      for (let k = 0; k < 2; k++) r.HE[k * 12] = 0, (r.HE[k * 12 + 8] = 1e9);
      const M = r.MV[0], b = 2, s = -1, fl = 2;
      M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[7] = 100;
      step(90);
      const dpr = cv.width / cv.getBoundingClientRect().width;
      // The colours: the dark and the light theme's tokens.
      const COL = { punch: [[0x39, 0xff, 0xb0], [0x06, 0xa7, 0x7d]], grab: [[0x22, 0xe6, 0xff], [0x11, 0x8a, 0xb2]], far: [[0xff, 0x2e, 0x55], [0xe6, 0x39, 0x46]] };
      /** Pixels of each colour in a box of half-size `hs` CSS px round screen point (x, y). */
      const hues = (x, y, hs) => {
        const x0 = Math.max(0, Math.round((x - hs) * dpr)), y0 = Math.max(0, Math.round((y - hs) * dpr)), d = cx.getImageData(x0, y0, Math.round(hs * 2 * dpr), Math.round(hs * 2 * dpr)).data, out = { punch: 0, grab: 0, far: 0 };
        for (let q = 0; q < d.length; q += 4) for (const k in COL) if (COL[k].some((c) => Math.abs(d[q] - c[0]) + Math.abs(d[q + 1] - c[1]) + Math.abs(d[q + 2] - c[2]) < 50)) out[k]++;
        return out;
      };
      const cellXY = (col) => sc.project(r.BLD[b * 4] + col + 0.5, r.yOff(b) + fl + 0.5, 0.05);
      const ev = (type, col) => { const q = cellXY(col), bx = cv.getBoundingClientRect(); playEl.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: bx.left + q[0], clientY: bx.top + q[1], pointerType: "mouse" })); return q; };
      const size = Math.abs(sc.project(r.BLD[b * 4] + 1, 0, 0.05)[0] - sc.project(r.BLD[b * 4], 0, 0.05)[0]);
      const out = {};
      const shot = (name, col, type, wait = 2) => {
        r.cell.fill(2); r.HIT.fill(0);
        const q = cellXY(col), before = hues(q[0], q[1], size * 0.75);
        ev(type, col);
        step(wait);
        const after = hues(q[0], q[1] - (type === "pointerdown" && col >= 3 ? size * 0.3 : 0), size * 0.75);
        out[name] = { before, after, hit: M[38], grab: M[10] };
        step(40);
        ev("pointermove", 6); // the pointer off the reach
        step(2);
      };
      // An empty window, close: a punch, green.
      shot("punch", 0, "pointerdown");
      // Someone at the far punch's window: a grab, teal.
      r.occ[r.reachCell(M, 2)] = 1;
      shot("grab", 2, "pointerdown");
      r.occ.fill(0);
      // Someone four windows in: out of reach, red, TOO FAR.
      r.occ[r.C0[b] + fl * r.BLD[b * 4 + 1] + 3] = 1;
      shot("far", 3, "pointerdown");
      // The hover's preview: the same colours, before any click.
      r.occ.fill(0);
      shot("hoverPunch", 1, "pointermove", 1);
      r.occ[r.reachCell(M, 1)] = 1;
      shot("hoverGrab", 1, "pointermove", 1);
      sc.engine.start();
      return out;
    });
    if (process.env.PICK_DEBUG) console.log(w, JSON.stringify(res));
    const gain = (o, k) => o.after[k] - o.before[k];
    for (const [name, k] of [["punch", "punch"], ["grab", "grab"], ["far", "far"], ["hoverPunch", "punch"], ["hoverGrab", "grab"]]) {
      const o = res[name], others = ["punch", "grab", "far"].filter((x) => x !== k);
      assert.ok(gain(o, k) > 20, `${w}: ${name}: lit ${k} (${JSON.stringify(o)})`);
      for (const x of others) assert.ok(gain(o, x) < gain(o, k) / 3, `${w}: ${name}: ${k}, not ${x} (${JSON.stringify(o)})`);
    }
    assert.ok(res.grab.grab > 0 || res.grab.hit === 0, `${w}: the tap on someone at the far cell grabs`);
    await p.close();
  }
  console.log("CitySmash: the pick green (green a punch, teal a grab, the far punch's cell grabbable, red TOO FAR out of reach, the hover previews; at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
