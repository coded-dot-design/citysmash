// v14 in Chromium at 1440, keys only (owner: "add keyboard commands for punching so you don't have to use the
// mouse"): on a wall the aim starts on the nearest unbroken window (level, close), Q/E and Tab/Shift+Tab cycle
// the 7 reach cells, J punches the aimed cell to a hole (the aim moves on past it), K grabs whoever is at the aimed
// window, a mouse click on a reach cell moves the aim; Space leaps to the next building, a double Space lets go
// and drops to the street; a gamepad's LB/RB move its own aim and X punches it; the menu's CONTROLS card and the
// phone's pad's keys (v18: PUNCH, GRAB, JUMP; tests/touch.mjs plays them) name their keys. VIDEO=<dir> records the run as a webm (slower, for a look).
// Waits on state, never time (the pauses only pace the video).
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const VIDEO = process.env.VIDEO || "";
const fixture = readFileSync("tests/fixtures/page.html", "utf8").replace("height:70vh", "height:90vh").replace("max-width:760px", "max-width:1400px");
const page = fixture.replace("</body>", `<script>window.pads = []; navigator.getGamepads = () => window.pads;</script><script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3 });</script></body>`);
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";
const pace = (p, ms) => (VIDEO ? p.waitForTimeout(ms) : Promise.resolve());
const fb = (p) => p.evaluate(() => game.scene.feedback);
/** Hang monster k on building b's side s with its hand at floor fl; the army away, no live windows, nobody home,
 *  and the CPU rivals kept waiting off the table. (They come in on the city's clock, the first 1.5 s in, and the
 *  engine sleeps while nothing moves, so here about 0.4 s of game time was left at the K press: on a slower machine
 *  more of the clock runs between the keys, a rival walks in and fights for the same wall, punching the aimed
 *  window to a hole, eating whoever is at it or knocking him off. Not what this checks.) */
const hang = (p, b, s, fl, k = 0) => p.evaluate(([b, s, fl, k]) => {
  const r = game.scene.run, M = r.MV[k];
  r.SO.fill(0); r.HE[8] = r.HE[20] = 1e9; r.TK[4] = 1e9; r.TK[0] = 0; r.LIVE.fill(0); r.occ.fill(0);
  for (const O of r.MV) if (O !== M && O[28] === 9) (O[24] = O[24] === 1 ? 2 : O[24]), (O[30] = 1e9), (O[0] = 18.4 * Math.sign(O[0] || 1));
  M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[33] = 0; M[7] = 100; M[15] = 0;
}, [b, s, fl, k]);
const reach = (p, c, k = 0) => p.evaluate(([c, k]) => game.scene.run.reachCell(game.scene.run.MV[k], c), [c, k]);

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(VIDEO ? { recordVideo: { dir: (mkdirSync(VIDEO, { recursive: true }), VIDEO), size: { width: 1440, height: 900 } } } : {}) });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + "/");
  await until(p, () => window.game && game.engine.paused.includes("settled"), null, "the title settles");
  const ctl = await p.evaluate(`${sr}.querySelector('.cs-ctrls')?.textContent || ''`);
  assert.match(ctl, /Space.*leap.*twice: let go.*J.*punch.*K.*grab.*Q.*E.*Tab.*aim/, "the menu's CONTROLS card");
  await pace(p, 1500);
  await p.evaluate(`${sr}.querySelector('[data-play]').click()`);
  await until(p, () => game.scene?.state.drawn && game.scene.state.phase === 0, null, "Port Lumen draws");
  assert.match(await p.evaluate(`${sr}.querySelector('.cs-hint').textContent`), /J punch · K grab · Space jump.*Tab\/Q-E aim/, "the first-run hint says the keys");
  await p.evaluate(`${sr}.querySelector('.cs-play').focus()`);
  await p.keyboard.down("d");
  await until(p, () => game.scene.state.phase === 1, null, "a key starts it");
  await p.keyboard.up("d");
  await pace(p, 800);

  // On a wall: the aim starts on the level close window; E (and Tab) cycles all 7 cells and comes back round.
  await hang(p, 1, -1, 3);
  await until(p, () => game.scene.feedback.aim >= 0, null, "an aim on the wall");
  assert.equal((await fb(p)).aim, 0, "the aim starts on the nearest window (level, close)");
  const seen = [];
  for (let n = 0; n < 7; n++) {
    await p.keyboard.press(n % 2 ? "Tab" : "e");
    seen.push((await fb(p)).aim);
    await pace(p, 350);
  }
  assert.deepEqual([...new Set(seen)].sort(), [0, 1, 2, 3, 4, 5, 6], `E / Tab cycle the 7 reach cells (${seen.join(" ")})`);
  assert.equal(seen[6], 0, "and come back round");
  await p.keyboard.press("q");
  assert.equal((await fb(p)).aim, seen[5], "Q steps back");
  await p.keyboard.press("Shift+Tab");
  assert.equal((await fb(p)).aim, seen[4], "Shift+Tab steps back");
  // Aim at the far window (level, three in) and J it to a hole: the aim moves on past the hole.
  while ((await fb(p)).aim !== 2) await p.keyboard.press("e");
  const far = await reach(p, 2);
  for (let n = 0; n < 3; n++) {
    await p.keyboard.press("j");
    await until(p, ([c, n]) => game.scene.run.HIT[c] >= n + 1 || game.scene.run.cell[c] === 0, [far, n], `J punch ${n + 1} at the aimed far window`);
    await until(p, () => game.scene.run.M[8] === 0, null, "the punch ends");
    await pace(p, 250);
  }
  assert.equal(await p.evaluate((c) => game.scene.run.cell[c], far), 0, "the aimed window is a hole");
  await until(p, () => game.scene.feedback.aim !== 2, null, "the aim moves on past the hole");
  // K grabs whoever is at the aimed window (aim up close: someone there).
  while ((await fb(p)).aim !== 3) await p.keyboard.press("e");
  const up = await reach(p, 3), sn = await p.evaluate(() => game.scene.state.snacks);
  await p.evaluate((c) => (game.scene.run.occ[c] = 1), up);
  await pace(p, 500);
  await p.evaluate((c) => (game.scene.run.occ[c] = 1), up);
  await p.keyboard.press("k");
  await until(p, (n) => game.scene.state.snacks > n, sn, "K grabs the person at the aimed window");
  assert.equal(await p.evaluate((c) => game.scene.run.occ[c], up), 0, "eaten from that window");
  await pace(p, 600);
  // Keys and the mouse mix: a click on a reach cell moves the aim there.
  const xy = await p.evaluate((c) => {
    const sc = game.scene, r = sc.run, cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas").getBoundingClientRect();
    let b = 0;
    while (b + 1 < r.nb() && r.C0[b + 1] <= c) b++;
    const w = r.BLD[b * 4 + 1], k = c - r.C0[b], fl = Math.floor(k / w), col = k % w, q = sc.project(r.BLD[b * 4] + col + 0.5, r.yOff(b) + fl + 0.5, 0.05);
    return [cv.left + q[0], cv.top + q[1]];
  }, await reach(p, 6));
  await p.mouse.click(xy[0], xy[1]);
  await until(p, () => game.scene.feedback.aim === 6, null, "a click moves the aim to the clicked cell");
  await until(p, () => game.scene.run.M[8] === 0, null, "the click's punch ends");
  await pace(p, 600);

  // Space on a wall: a leap to the next building (building 0's near wall, across the gap).
  const l0 = (await fb(p)).leaps;
  await p.keyboard.press("Space");
  await until(p, () => { const M = game.scene.run.M; return M[5] === 2 && M[12] === 0 && M[22] === 1; }, null, "Space leaps to the next building");
  assert.equal((await fb(p)).leaps[3], l0[3] + 1, "LEAP! (caught the wall across)");
  await pace(p, 900);
  // Space twice quickly: let go, down to the street. (The second press must land inside the leap's double-tap
  // window, LEAP_TAP = 0.3 s of game time. A fixed real-time pause between two keyboard round trips overran it on a
  // loaded machine, and a second key sent before the first one's keyup lands is no new press. So both presses go
  // from the page, through the same key handler: the second on the first frame the leap is under way, at most a
  // frame, 4 steps, of game time later. The real Space key's leap is checked just above.)
  const left = await p.evaluate(() => new Promise((ok) => {
    const st = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".cs-play");
    const key = () => { for (const type of ["keydown", "keyup"]) st.dispatchEvent(new KeyboardEvent(type, { code: "Space", key: " ", bubbles: true, composed: true })); };
    const tick = () => {
      if (game.scene.run.M[59] !== 1) return void requestAnimationFrame(tick);
      ok(game.scene.run.M[58]);
      key();
    };
    key();
    requestAnimationFrame(tick);
  }));
  assert.ok(left > 0, `the second Space lands inside the double-tap window (${left} s left)`);
  await until(p, () => game.scene.run.M[5] === 0, null, "a double Space lets go: on the street");
  assert.equal((await fb(p)).leaps[2], l0[2] + 1, "LET GO!");
  await pace(p, 1200);

  // (the recorded run ends with the keys: the pad's part is checked in the plain run)
  if (VIDEO) {
    await ctx.close();
    console.log("CitySmash: keys run recorded to " + VIDEO);
    process.exit(0);
  }
  // A gamepad (player two): it joins on a press; on a wall its LB/RB move its own aim and X punches the aimed cell.
  await p.evaluate(() => {
    window.pads[0] = { index: 0, id: "test pad", connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    dispatchEvent(new Event("gamepadconnected"));
  });
  const btn = (b, on) => p.evaluate(([b, on]) => (window.pads[0].buttons[b] = { pressed: on, value: +on }), [b, on]);
  const tap = async (b) => (await btn(b, true), await p.waitForTimeout(150), await btn(b, false), await p.waitForTimeout(150));
  await tap(3);
  await until(p, () => game.scene.state.seats & 2, null, "the pad joins as player two");
  const k2 = await p.evaluate(() => game.scene.run.MV.findIndex((M) => M[28] === 1));
  assert.ok(k2 > 0, "the pad drives a monster");
  await p.evaluate((k) => { const M = game.scene.run.MV[k]; M[24] = 1; M[30] = 0; }, k2);
  await hang(p, 3, -1, 3, k2);
  await until(p, (k) => game.scene.feedback.aims[1] === 0 && game.scene.run.MV[k][5] === 2, k2, "the pad's aim on its wall");
  await tap(5);
  await until(p, () => game.scene.feedback.aims[1] > 0, null, "RB steps the pad's aim");
  const a1 = (await fb(p)).aims[1];
  await tap(4);
  await until(p, () => game.scene.feedback.aims[1] === 0, null, "LB steps it back");
  await tap(5);
  await until(p, (a) => game.scene.feedback.aims[1] === a, a1, "RB again");
  const c1 = await reach(p, a1, k2);
  await tap(2);
  await until(p, (c) => game.scene.run.HIT[c] >= 1, c1, "X punches the pad's aimed cell");
  await pace(p, 800);
  assert.deepEqual(errs, [], "no page errors");
  await ctx.close();

  // The phone's pad (v18): the stick, PUNCH, GRAB and JUMP, labelled with their keys (J, K, Space).
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const q = await ph.newPage();
  await q.goto(server.url + "/");
  await until(q, () => window.game && game.engine.paused.includes("settled"), null, "phone: the title");
  assert.equal(await q.evaluate(`getComputedStyle(${sr}.querySelector('.cs-ctrls')).display`), "none", "phone: no keys card");
  await q.evaluate(`${sr}.querySelector('[data-play]').click()`);
  await until(q, () => game.scene?.state.drawn, null, "phone: the run");
  const acts = await q.evaluate(`[...${sr}.querySelectorAll('.cs-pad button')].filter((b) => b.offsetParent).map((b) => b.getAttribute('aria-label') || b.textContent)`);
  assert.equal(acts.length, 3, `phone: three action keys (v18: ${acts.join(", ")})`);
  assert.match(acts.join(" | "), /Punch.*\(J\).*Grab.*\(K\).*Jump \(Space\)/);
  await ph.close();
  console.log("CitySmash: keys green (keys only at 1440: the aim starts level close, E/Tab cycle the 7 cells and Q/Shift+Tab step back, J punches the aimed window to a hole and the aim moves on, K grabs at the aimed window, a click moves the aim, Space leaps to the next building, a double Space lets go to the street; a gamepad's LB/RB aim and X punch; the CONTROLS card; the phone's pad's three keys name theirs).");
} finally {
  await browser.close();
  await server.close();
}
