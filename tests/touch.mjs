// v18 in Chromium on a phone (touch, /play/ built from the site's sources as tests/landscape.mjs does), at 390×844
// portrait and 844×390 landscape (owner: "the MAIN (big) button goes back to PUNCH and the 2 smaller offset ones are
// GRAB and JUMP, and the stick moves the smash box target around like the arrow keys on desktop"): the right thumb's
// cluster is three icon keys with names (PUNCH ≥ 72 px, GRAB and JUMP ≥ 48 px), clear of the street's middle and the
// seven reach cells at rest; on a wall a flick of the stick steps the aim box one cell that way (all seven reachable)
// and the monster stays put; held, the stick climbs; PUNCH chips the aimed window to a hole in three presses; GRAB eats
// the person at the aimed window (not the nearer one); JUMP leaps to the next building; a tap on a window in reach
// still punches it; the first wall shows the aim's hint. VIDEO=<dir> records the 390 run as a webm with a dot where
// each finger touches (slower, for a look). Waits on state, never time (the pauses only pace the video).
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const VIDEO = process.env.VIDEO || "";
const base = readFileSync("site/src/layouts/Base.astro", "utf8"), play = readFileSync("site/src/pages/play/index.astro", "utf8");
const css = readFileSync("node_modules/@fzlt/core/dist/ui/board-ui.css", "utf8") + readFileSync("site/src/styles/site.css", "utf8");
const astro = (s) => s.replace(/=\{[^}]*\}/g, '="#"').replace(/\{[^}]*\}/g, "");
const header = astro(base.match(/<header class="site-head">[\s\S]*?<\/header>/)[0]);
const stage = astro(play.match(/<section class="play-stage"[\s\S]*?<\/section>/)[0]);
const script = play.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/from "[^"]*citysmash\.mjs"/, 'from "/dist/citysmash.mjs"').replace("host.dataset.rooms", "undefined").replace(/\)!;/, ");").replace(/\(window as [^)]*\)/, "window");
// (the video's touch dots: a ring wherever a finger or the test's pointer is down, over everything, never in the way)
const dots = VIDEO ? `<script>{const d=document.createElement("i");d.style.cssText="position:fixed;z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #fff;background:rgba(255,46,136,.45);box-shadow:0 0 0 2px #000;pointer-events:none;display:none";addEventListener("DOMContentLoaded",()=>document.body.append(d));for(const t of["pointerdown","pointermove"])addEventListener(t,(e)=>{if(t==="pointermove"&&!e.buttons)return;d.style.display="block";d.style.left=e.clientX+"px";d.style.top=e.clientY+"px"},true);for(const t of["pointerup","pointercancel"])addEventListener(t,()=>setTimeout(()=>d.style.display="none",160),true);}</script>` : "";
const page = `<!doctype html><html lang="en" class="bui" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"><title>Play CitySmash</title><style>${css}</style>${dots}</head><body data-page="play" data-app="">${header}<main id="main">${stage}</main><script type="module">${script}</script></body></html>`;
const server = await serve(".", { "/play/": page });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";
const pace = (p, ms) => (VIDEO ? p.waitForTimeout(ms) : Promise.resolve());
const fb = (p) => p.evaluate(() => game.scene.feedback);
/** Hang the player on building b's side s, hand at floor fl; the army away, no live windows, nobody home, rivals off the table. */
const hang = (p, b, s, fl) => p.evaluate(([b, s, fl]) => {
  const r = game.scene.run, M = r.MV[0];
  r.SO.fill(0); r.HE[8] = r.HE[20] = 1e9; r.TK[4] = 1e9; r.TK[0] = 0; r.LIVE.fill(0); r.occ.fill(0);
  for (const O of r.MV) if (O !== M && O[28] === 9) (O[24] = O[24] === 1 ? 2 : O[24]), (O[30] = 1e9), (O[0] = 18.4 * Math.sign(O[0] || 1));
  M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[33] = 0; M[7] = 100; M[15] = 0; M[8] = 0;
}, [b, s, fl]);
/** Where reach cell c's window is on the page. */
const cellXY = (p, c) => p.evaluate((c) => {
  const sc = game.scene, r = sc.run, i = r.reachCell(r.MV[0], c), cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas").getBoundingClientRect();
  let b = 0;
  while (b + 1 < r.nb() && r.C0[b + 1] <= i) b++;
  const w = r.BLD[b * 4 + 1], k = i - r.C0[b], q = sc.project(r.BLD[b * 4] + (k % w) + 0.5, r.yOff(b) + Math.floor(k / w) + 0.5, 0.05);
  return [cv.left + q[0], cv.top + q[1]];
}, c);
const keyXY = (p, i) => p.evaluate(`(() => { const b = ${sr}.querySelector('.cs-pad .bui-pad-keys [data-i="${i}"]').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
const PUNCH = 0, GRAB = 1, JUMP = 2;

try {
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const rec = VIDEO && w === 390;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, ...(rec ? { recordVideo: { dir: (mkdirSync(VIDEO, { recursive: true }), VIDEO), size: { width: w, height: h } } } : {}) });
    const p = await ctx.newPage(), errs = [], at = `${w}×${h}`;
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/play/");
    await until(p, () => window.game && game.getSnapshot().screen === "menu", null, `${at}: the title`);
    await pace(p, 800);
    await p.evaluate(() => game.play(0));
    await until(p, () => game.scene?.state.drawn, null, `${at}: draws`);

    // The keys: three, icons only (no caption), named; PUNCH the big one, GRAB and JUMP the smaller ones round it.
    const ks = await p.evaluate(`[...${sr}.querySelectorAll('.cs-pad .bui-pad-keys button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { name: b.getAttribute('aria-label'), icon: !!b.querySelector('svg'), caption: b.querySelector('small')?.textContent ?? '', w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom }; })`);
    assert.equal(ks.length, 3, `${at}: three action keys`);
    assert.match(ks[PUNCH].name, /^Punch/); assert.match(ks[GRAB].name, /^Grab/); assert.match(ks[JUMP].name, /^Jump/);
    assert.ok(ks.every((k) => k.icon && !k.caption), `${at}: icons only`);
    assert.ok(Math.min(ks[PUNCH].w, ks[PUNCH].h) >= 72, `${at}: PUNCH ≥ 72 px (${ks[PUNCH].w})`);
    assert.ok([GRAB, JUMP].every((i) => Math.min(ks[i].w, ks[i].h) >= 48), `${at}: GRAB and JUMP ≥ 48 px (${ks[GRAB].w}, ${ks[JUMP].w})`);
    const cx = (k) => (k.l + k.r) / 2, cy = (k) => (k.t + k.b) / 2;
    assert.ok(cx(ks[GRAB]) < cx(ks[PUNCH]) && cy(ks[GRAB]) < cy(ks[PUNCH]), `${at}: GRAB above-left of PUNCH`);
    assert.ok(cy(ks[JUMP]) < cy(ks[GRAB]) && cx(ks[JUMP]) > cx(ks[GRAB]), `${at}: JUMP above, between GRAB and PUNCH (the arc)`);
    assert.ok(ks[PUNCH].r <= w && ks[PUNCH].b <= h, `${at}: inside the screen`);
    const over = (x, y) => p.evaluate(([x, y]) => [...document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll(".cs-pad .bui-pad-keys button, .cs-pad .bui-stick")].some((k) => { const r = k.getBoundingClientRect(); return x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2; }), [x, y]);
    const street = await p.evaluate(() => { const cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas").getBoundingClientRect(), q = game.scene.project(game.scene.run.MV[0][0], 0, 5.6); return [cv.left + cv.width / 2, cv.top + q[1]]; });
    assert.ok(!(await over(street[0], street[1])), `${at}: the keys clear the street's middle at rest`);

    // The run starts on the stick (it walks).
    const stick = await p.evaluate(`(() => { const b = ${sr}.querySelector('.cs-pad .bui-stick').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2, b.width / 2]; })()`);
    const [sx, sy, sr0] = stick;
    await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx + sr0 * 0.6, sy, { steps: 3 });
    await until(p, () => game.scene.state.phase === 1, null, `${at}: the stick starts the run`);
    await pace(p, 500);
    await p.mouse.move(sx, sy, { steps: 2 }); await p.mouse.up();
    await pace(p, 300);

    // On a wall: the seven reach cells are clear of the keys; the aim's hint shows the first time.
    await hang(p, 1, -1, 3);
    await until(p, () => game.scene.feedback.aim === 0, null, `${at}: the aim on the wall (level, close)`);
    for (let c = 0; c < 7; c++) {
      const xy = await cellXY(p, c);
      assert.ok(!(await over(xy[0], xy[1])), `${at}: reach cell ${c} clear of the pad`);
    }
    await until(p, `/Flick the stick/.test(${sr}.querySelector('.cs-hint').textContent)`, null, `${at}: the aim's hint on the first wall`);
    await pace(p, 1200);

    // A flick steps the aim one cell that way, on the screen's grid (this wall's cells run right): every cell,
    // and the monster stays put. (The flick runs on a held clock: press, three steps, let go, so it is one flick
    // on any machine; the video's pace runs between them.)
    const flick = async (dx, dy) => {
      await p.evaluate(() => game.scene.engine.stop());
      await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx + dx * sr0 * 0.8, sy + dy * sr0 * 0.8, { steps: 2 });
      await p.evaluate(() => { for (let i = 0; i < 3; i++) game.scene.engine.advance(1 / 60); });
      await p.mouse.move(sx, sy); await p.mouse.up();
      await p.evaluate(() => { for (let i = 0; i < 2; i++) game.scene.engine.advance(1 / 60); game.scene.engine.start(); });
      await pace(p, 450);
      return (await fb(p)).aim;
    };
    const y0 = await p.evaluate(() => game.scene.run.M[1]), x0 = (await cellXY(p, 0))[0];
    const seen = [0];
    for (const [dx, dy] of [[1, 0], [1, 0], [0, -1], [-1, 0], [0, 1], [0, 1], [1, 0]]) seen.push(await flick(dx, dy));
    assert.deepEqual(seen, [0, 1, 2, 4, 3, 0, 5, 6], `${at}: right, right, up, left, down, down, right walk the aim through every cell (${seen.join(" ")})`);
    assert.ok((await cellXY(p, 1))[0] > x0, `${at}: right on the stick is right on the screen`);
    assert.equal(await p.evaluate(() => game.scene.run.M[1]), y0, `${at}: flicks never climb`);

    // PUNCH punches the aimed cell: three presses, a hole.
    assert.equal(await flick(0, -1), 1, `${at}: up from the bottom row's far cell: the level row's middle`);
    const mid = await p.evaluate(() => game.scene.run.reachCell(game.scene.run.M, 1)), pk = await keyXY(p, PUNCH);
    for (let n = 0; n < 3; n++) {
      await p.touchscreen.tap(pk[0], pk[1]);
      await until(p, ([c, n]) => game.scene.run.HIT[c] >= n + 1 || game.scene.run.cell[c] === 0, [mid, n], `${at}: PUNCH ${n + 1} at the aimed window`);
      await until(p, () => game.scene.run.M[8] === 0, null, `${at}: the punch ends`);
      await pace(p, 300);
    }
    assert.equal(await p.evaluate((c) => game.scene.run.cell[c], mid), 0, `${at}: the aimed window is a hole`);

    // GRAB eats the person at the aimed window, not the one nearer the hand.
    await until(p, () => game.scene.feedback.aim !== 1, null, `${at}: the aim moves on past the hole`);
    assert.equal((await fb(p)).aim, 2, `${at}: on to the far window`);
    assert.equal(await flick(0, -1), 4, `${at}: up from the far window: the top row's far cell`);
    assert.equal(await flick(-1, 0), 3, `${at}: left: the top row's close cell`);
    const [up, near] = await p.evaluate(() => [game.scene.run.reachCell(game.scene.run.M, 3), game.scene.run.reachCell(game.scene.run.M, 0)]);
    const sn = await p.evaluate(() => game.scene.state.snacks);
    await p.evaluate(([a, b]) => (game.scene.run.occ[a] = 1, game.scene.run.occ[b] = 1), [up, near]);
    await pace(p, 500);
    await p.evaluate(([a, b]) => (game.scene.run.occ[a] = 1, game.scene.run.occ[b] = 1), [up, near]);
    const gk = await keyXY(p, GRAB);
    await p.touchscreen.tap(gk[0], gk[1]);
    await until(p, (n) => game.scene.state.snacks > n, sn, `${at}: GRAB eats`);
    assert.deepEqual(await p.evaluate(([a, b]) => [game.scene.run.occ[a], game.scene.run.occ[b]], [up, near]), [0, 1], `${at}: the aimed one, not the nearer one`);
    await pace(p, 700);

    // A tap on a window in reach still punches it.
    await until(p, () => game.scene.run.M[8] === 0 && game.scene.run.M[34] === 0, null, `${at}: the grab ends`);
    const far = await p.evaluate(() => game.scene.run.reachCell(game.scene.run.M, 2)), fxy = await cellXY(p, 2), h0 = await p.evaluate((c) => game.scene.run.HIT[c], far);
    await p.touchscreen.tap(fxy[0], fxy[1]);
    await until(p, ([c, h]) => game.scene.run.HIT[c] > h, [far, h0], `${at}: a tap on a window in reach punches it`);
    await until(p, () => game.scene.feedback.aim === 2, null, `${at}: and moves the aim there`);
    await until(p, () => game.scene.run.M[8] === 0, null, `${at}: the tap's punch ends`);
    await pace(p, 600);

    // Held, the stick climbs (and the aim box stays where it was).
    const yb = await p.evaluate(() => game.scene.run.M[1]);
    await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx, sy - sr0 * 0.9, { steps: 3 });
    await until(p, (y) => game.scene.run.M[1] > y + 0.9, yb, `${at}: holding the stick up climbs`);
    await p.mouse.move(sx, sy, { steps: 2 }); await p.mouse.up();
    await pace(p, 600);

    // JUMP on a wall: a leap to the next building across the gap.
    const l0 = (await fb(p)).leaps, jk = await keyXY(p, JUMP);
    await p.touchscreen.tap(jk[0], jk[1]);
    await until(p, () => { const M = game.scene.run.M; return M[5] === 2 && M[12] === 0 && M[22] === 1; }, null, `${at}: JUMP leaps to the next building`);
    assert.equal((await fb(p)).leaps[3], l0[3] + 1, `${at}: LEAP!`);
    // The next wall runs its cells left: right on the stick is still right on the screen.
    await until(p, () => game.scene.feedback.aim >= 0, null, `${at}: an aim on the new wall`);
    await p.evaluate(() => { const r = game.scene.run; r.cell.fill(2); r.LIVE.fill(0); });
    assert.equal((await fb(p)).aim, 0, `${at}: the new wall's aim starts level, close`);
    const ax0 = (await cellXY(p, 0))[0];
    assert.equal(await flick(-1, 0), 1, `${at}: left on this wall steps the aim away from the monster`);
    assert.ok((await cellXY(p, 1))[0] < ax0, `${at}: left on the stick is left on the screen`);
    await pace(p, 1200);
    assert.deepEqual(errs, [], `${at}: no page errors`);
    await ctx.close();
  }
  console.log(`CitySmash touch: green at 390×844 and 844×390 (PUNCH ≥ 72 px with GRAB and JUMP ≥ 48 px in an arc, icons and names, clear of the street and the reach; a flick steps the aim through all 7 cells and never climbs, held it climbs; PUNCH holes the aimed window in 3, GRAB eats at the aim, JUMP leaps, a tap still punches; the hint)${VIDEO ? "; the 390 run recorded to " + VIDEO : ""}.`);
} finally {
  await browser.close();
  await server.close();
}
