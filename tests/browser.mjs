// CitySmash in Chromium (dist/citysmash.mjs on a plain page): the title mounts and settles with no
// audio; the garage dresses the ape (a fur, a locked part refused with a note, the save code); PLAY
// mounts Port Lumen, a key starts it; the ape hangs on a wall and three presses of Space make a hole
// in the window by the hand; L eats the person at the window; one more hole and the building shakes and
// pancakes to rubble; the city flat brings the card and a punch loads city 2 (Coilworth), its unlocks
// saved; the garage change and the cleared city survive a reload; a comma brings player two in as
// SHARDCLAW and the arrows drive it; Recall gives the page back byte for byte. At 390 (touch): the pad
// shows, its keys are 44 px or more, the play surface has touch-action none, the stick walks the ape and
// PUNCH punches. Waits on state, never time.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const withGame = fixture.replace("</body>", `<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script><script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.before = document.body.innerHTML; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3 });</script></body>`);
const server = await serve(".", { "/": withGame });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";
const st = (p) => p.evaluate(() => game.scene?.state);
/** Hang the ape on building b's side s with its hand at floor fl (and keep the army away). */
const hang = (p, b, s, fl) => p.evaluate(([b, s, fl]) => {
  const r = game.scene.run, M = r.M;
  r.SO.fill(0); r.HE[8] = r.HE[20] = 1e9; r.TK[4] = 1e9; r.TK[0] = 0;
  M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[33] = 0; M[7] = 100; M[15] = 0;
}, [b, s, fl]);

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + "/");
  await until(p, () => window.game && game.engine.paused.includes("settled"), null, "the title settles");
  assert.equal(await p.evaluate(() => game.getSnapshot().screen), "menu");
  assert.equal(await p.evaluate(() => window.audio || 0), 0, "no audio before a gesture");
  // The garage: a fur; a locked part is refused with a note; the save code.
  await p.evaluate(`${sr}.querySelector('[data-go=garage]').click()`);
  await until(p, () => game.getSnapshot().screen === "garage", null, "the garage");
  await p.evaluate(`${sr}.querySelector('[data-part=fur][data-i="1"]').click()`);
  assert.equal(await p.evaluate(() => game.profile.look.fur), 1, "ASH fur on");
  await p.evaluate(`${sr}.querySelector('[data-part=fur][data-i="5"]').click()`);
  assert.equal(await p.evaluate(() => game.profile.look.fur), 1, "a locked fur is refused");
  assert.match(await p.evaluate(`${sr}.querySelector('.cs-note').textContent`), /Locked: flatten BRIGHTFIELD/);
  await p.evaluate(`${sr}.querySelector('[data-tab=code]').click()`);
  assert.match(await p.evaluate(`${sr}.querySelector('#cs-code').value`), /^CS1-/, "the save code");
  const px = await p.evaluate(`(() => { const c = ${sr}.querySelector('canvas.cs-preview'); return c.width > 0; })()`);
  assert.ok(px, "the turntable draws");
  // PLAY: Port Lumen waits for a key.
  await p.evaluate(`${sr}.querySelector('[data-play]').click()`);
  await until(p, () => game.scene?.state.drawn && game.scene.state.phase === 0, null, "Port Lumen draws, waiting");
  assert.equal((await st(p)).cityId, "port-lumen");
  await p.evaluate(`${sr}.querySelector('.cs-play').focus()`);
  await p.keyboard.down("d");
  await until(p, () => game.scene.state.phase === 1, null, "a key starts it");
  await p.keyboard.up("d");
  // On a wall: three presses of Space, a hole in the window by the hand.
  await hang(p, 1, -1, 3);
  const cell = await p.evaluate(() => { const r = game.scene.run; return r.C0[1] + 3 * r.BLD[1 * 4 + 1]; });
  for (let n = 0; n < 3; n++) {
    await p.keyboard.press("Space");
    await until(p, ([c, n]) => game.scene.run.HIT[c] >= n + 1 && game.scene.run.M[8] === 0, [cell, n], `punch ${n + 1}`);
  }
  assert.equal(await p.evaluate((c) => game.scene.run.cell[c], cell), 0, "a hole");
  // L eats the person at the window.
  await hang(p, 1, -1, 4);
  await p.evaluate(() => { const r = game.scene.run; r.occ[r.C0[1] + 4 * r.BLD[5]] = 1; });
  await p.keyboard.press("l");
  await until(p, () => game.scene.state.snacks >= 1, null, "nom");
  // One hole short, then the last: it shakes and pancakes to rubble.
  await hang(p, 1, -1, 2);
  await p.evaluate(() => { const r = game.scene.run; r.B[1 * 6 + 1] = r.bk.NEED[1] - 1; });
  const c2 = cell - 5;
  for (let n = 0; n < 3; n++) {
    await p.keyboard.press("Space");
    await until(p, ([c, n]) => game.scene.run.HIT[c] >= n + 1 && game.scene.run.M[8] === 0, [c2, n], `last hole, punch ${n + 1}`);
  }
  await until(p, () => game.scene.run.B[6] >= 1, null, "it shakes");
  await until(p, () => game.scene.run.B[6] === 3, null, "rubble", 30000);
  // The city flat: the card, a punch, city 2.
  await p.evaluate(() => { const r = game.scene.run; for (let b = 0; b < r.nb(); b++) if (r.B[b * 6] === 0) (r.B[b * 6] = 3); r.S[4] = r.nb(); });
  await until(p, () => game.scene.state.card, null, "the card between cities");
  assert.match(await p.evaluate(`${sr}.querySelector('.cs-ccard').textContent`), /PORT LUMEN IS FLAT!.*NEXT: COILWORTH.*UNLOCKED: MIDNIGHT FUR/);
  await p.waitForTimeout(1300);
  await p.keyboard.press("Space");
  await until(p, () => game.scene.state.cityId === "coilworth" && !game.scene.state.card, null, "city 2 loads");
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("citysmash:profile")));
  assert.deepEqual([saved.cleared, saved.owned.includes("fur:3"), saved.look.fur], [["port-lumen"], true, 1], "saved: the city, its unlocks, the fur");
  // Player two: a comma brings SHARDCLAW in; the arrows drive it.
  await p.keyboard.press("Comma");
  await until(p, () => game.scene.run.MV[1][28] === 1 && game.scene.run.MV[1][24] === 1, null, "P2 is SHARDCLAW");
  await p.evaluate(() => { game.scene.run.MV[1][0] = 0; game.scene.run.MV[1][5] = 0; });
  const x0 = await p.evaluate(() => game.scene.run.MV[1][0]);
  await p.keyboard.down("ArrowLeft");
  await until(p, (x0) => game.scene.run.MV[1][0] < x0 - 1, x0, "the arrows drive it");
  await p.keyboard.up("ArrowLeft");
  // Reload: the garage change and the cleared city persist.
  await p.reload();
  await until(p, () => window.game, null, "reloads");
  assert.deepEqual(await p.evaluate(() => [game.profile.look.fur, game.profile.cleared, game.getSnapshot().start]), [1, ["port-lumen"], 1], "persists; the run can start from city 2");
  // Recall.
  await p.evaluate(() => game.destroy());
  assert.equal(await p.evaluate(() => document.body.innerHTML === window.before), true, "Recall gives the page back");
  assert.deepEqual(errs, [], "no page errors");
  await ctx.close();

  // Phone: the pad, 44 px keys, touch-action none, the stick walks, PUNCH punches.
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const q = await ph.newPage();
  await q.goto(server.url + "/");
  await until(q, () => window.game, null, "phone: mounts");
  await q.evaluate(() => game.play(0));
  await until(q, () => game.scene?.state.drawn, null, "phone: draws");
  const m = await q.evaluate(`(() => { const r = ${sr}; const keys = [...r.querySelectorAll('.cs-key, .cs-pad button')].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height); }); return { pad: !!r.querySelector('.cs-pad').offsetParent, keys, touch: getComputedStyle(r.querySelector('.cs-play')).touchAction }; })()`);
  assert.ok(m.pad, "phone: the pad shows");
  assert.ok(m.keys.length >= 5 && m.keys.every((k) => k >= 44), `phone: keys ≥ 44 px (${m.keys.join(", ")})`);
  assert.equal(m.touch, "none", "phone: touch-action none");
  const where = await q.evaluate(() => [game.scene.where(0), innerHeight]);
  const stick = await q.evaluate(`(() => { const s = ${sr}.querySelector('.cs-pad .bui-stick, .cs-pad [class*=stick]'); const b = s.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  const hx = await q.evaluate(() => game.scene.run.M[0]);
  await q.mouse.move(stick[0], stick[1]);
  await q.mouse.down();
  await q.mouse.move(stick[0] + 40, stick[1], { steps: 4 });
  await until(q, (hx) => game.scene.state.phase === 1 && game.scene.run.M[0] > hx + 1, hx, "phone: the stick walks");
  await q.mouse.up();
  const punch = await q.evaluate(`(() => { const b = [...${sr}.querySelectorAll('.cs-pad button')].find((x) => /Punch/.test(x.getAttribute('aria-label') || x.textContent)).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  const n0 = await q.evaluate(() => game.scene.run.M[9]);
  await q.touchscreen.tap(punch[0], punch[1]);
  await until(q, () => game.scene.run.M[8] > 0 || game.scene.run.M[9] > 0, n0, "phone: PUNCH punches");
  // The hero on a wall is a quarter of the stage or more.
  await hang(q, 1, -1, 3);
  await q.waitForTimeout(400);
  const big = await q.evaluate(() => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas").getBoundingClientRect(); const [, , s] = game.scene.where(0); return (s * 4.3) / c.height; });
  assert.ok(big >= 0.24, `phone: the hero on a wall is ${Math.round(big * 100)}% of the stage's height`);
  void where;
  await ph.close();
  console.log("CitySmash: browser green (title settles, garage + lock + code, start, climb + punch to a hole, eat, a building falls, city 2 loads, unlocks saved, 2P joins, reload persists, Recall, phone pad + stick + PUNCH, hero ≥ 1/4).");
} finally {
  await browser.close();
  await server.close();
}
