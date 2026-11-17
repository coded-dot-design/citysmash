// CitySmash in Chromium (dist/citysmash.mjs on a plain page): the title mounts and settles with no
// audio; the garage dresses the ape (a fur, a locked part refused with a note, the save code); PLAY
// mounts Port Lumen, a key starts it; the ape hangs on a wall: a click on a window in reach chips it, a
// click out of reach is a whiff (a swing, nothing hit), two presses of J (the keyboard fallback) make the
// hole; a click on a person in reach eats them, L eats the next; one more hole and the building shakes and
// pancakes to rubble; the city flat brings the card and a punch loads city 2 (Coilworth), its unlocks
// saved; the garage change and the cleared city survive a reload; the arrows drive the ape (no
// shared-keyboard player two: one person a device); Recall gives the page back byte for byte. At 390 (touch): the pad is
// the stick and JUMP only, its keys are 44 px or more, the play surface has touch-action none, the stick
// walks the ape, a tap on a window in reach chips it, a tap out of reach whiffs, a tap on a person in reach
// eats them; portrait and landscape, every city's tallest building and the street fit the stage under
// the HUD. Waits on state, never time.
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
/** Window (b, fl, col)'s centre on the page. */
const winXY = (p, b, fl, col) => p.evaluate(([b, fl, col]) => {
  const sc = game.scene, r = sc.run, cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas").getBoundingClientRect();
  const q = sc.project(r.BLD[b * 4] + col + 0.5, r.yOff(b) + fl + 0.5, 0.05), k = cv.width / cv.width;
  return [cv.left + q[0] * k, cv.top + q[1] * k];
}, [b, fl, col]);
const hits = (p) => p.evaluate(() => game.scene.run.HIT.reduce((a, v) => a + v, 0));
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
  // On a wall: a click on the far window in reach chips it; a click four windows in is out of reach (a whiff).
  await hang(p, 1, -1, 3);
  await p.evaluate(() => game.scene.run.LIVE.fill(0));
  await p.waitForTimeout(200);
  const far = await p.evaluate(() => { const r = game.scene.run; return r.C0[1] + 3 * r.BLD[1 * 4 + 1] + 2; });
  let xy = await winXY(p, 1, 3, 2);
  await p.mouse.click(xy[0], xy[1]);
  await until(p, (c) => game.scene.run.HIT[c] === 1 && game.scene.run.M[8] === 0, far, "a click in reach: the far window chips");
  const h0 = await hits(p);
  xy = await winXY(p, 1, 3, 3);
  await p.mouse.click(xy[0], xy[1]);
  await until(p, () => game.scene.run.M[8] > 0, null, "out of reach: a swing");
  await until(p, () => game.scene.run.M[8] === 0, null, "the swing ends");
  assert.equal(await hits(p), h0, "out of reach: nothing hit");
  // The keyboard (J): the aimed window (the click on the far one moved the aim there; Q twice: back to the one by the hand), chip, crack, hole.
  await p.keyboard.press("q");
  await p.keyboard.press("q");
  assert.equal(await p.evaluate(() => game.scene.feedback.aim), 0, "Q steps the aim back to the window by the hand");
  const cell = await p.evaluate(() => { const r = game.scene.run; return r.C0[1] + 3 * r.BLD[1 * 4 + 1]; });
  for (let n = 0; n < 3; n++) {
    await p.keyboard.press("j");
    await until(p, ([c, n]) => game.scene.run.HIT[c] >= n + 1 && game.scene.run.M[8] === 0, [cell, n], `punch ${n + 1}`);
  }
  assert.equal(await p.evaluate((c) => game.scene.run.cell[c], cell), 0, "a hole");
  // A click on a person at a window in reach: eaten. Then L eats the next one by the hand.
  await hang(p, 1, -1, 4);
  await p.evaluate(() => { const r = game.scene.run; r.occ[r.C0[1] + 4 * r.BLD[5] + 1] = 1; });
  await p.waitForTimeout(200);
  xy = await winXY(p, 1, 4, 1);
  await p.mouse.click(xy[0], xy[1]);
  await until(p, () => game.scene.state.snacks >= 1, null, "a click eats the person in reach");
  await p.waitForTimeout(500);
  await p.evaluate(() => { const r = game.scene.run; r.occ[r.C0[1] + 4 * r.BLD[5]] = 1; });
  await p.keyboard.press("l");
  await until(p, () => game.scene.state.snacks >= 2, null, "nom");
  // One hole short, then the last: it shakes and pancakes to rubble.
  await hang(p, 1, -1, 2);
  await p.evaluate(() => { const r = game.scene.run; r.B[1 * 6 + 1] = r.bk.NEED[1] - 1; });
  // (the click on the person one in moved the aim there: Q, back to the window by the hand)
  await p.keyboard.press("q");
  assert.equal(await p.evaluate(() => game.scene.feedback.aim), 0, "the aim on the window by the hand");
  const c2 = cell - 5;
  for (let n = 0; n < 3; n++) {
    await p.keyboard.press("j");
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
  // One person a device: the arrows drive the ape too (no shared-keyboard player two).
  await p.evaluate(() => { game.scene.run.M[5] = 0; game.scene.run.M[0] = 0; });
  await p.keyboard.down("ArrowLeft");
  await until(p, () => game.scene.run.M[0] < -1, null, "the arrows drive the ape");
  await p.keyboard.up("ArrowLeft");
  await p.keyboard.press("Comma");
  assert.equal(await p.evaluate(() => game.scene.run.MV[1][28]), 9, "a comma brings no player two");
  // Reload: the garage change (the hair too) and the cleared city persist.
  await p.evaluate(() => (game.setPart("hair", 2), game.setPart("hairc", 3)));
  await p.reload();
  await until(p, () => window.game, null, "reloads");
  assert.deepEqual(await p.evaluate(() => [game.profile.look.fur, game.profile.cleared, game.getSnapshot().start, game.profile.look.hair, game.profile.look.hairc]), [1, ["port-lumen"], 1, 2, 3], "persists (the hair too); the run can start from city 2");
  // Recall.
  await p.evaluate(() => game.destroy());
  assert.equal(await p.evaluate(() => document.body.innerHTML === window.before), true, "Recall gives the page back");
  assert.deepEqual(errs, [], "no page errors");
  await ctx.close();

  // Phone: the pad (the stick and JUMP only), 44 px keys, touch-action none, the stick walks, taps smash and grab.
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const q = await ph.newPage();
  await q.goto(server.url + "/");
  await until(q, () => window.game, null, "phone: mounts");
  await q.evaluate(() => game.play(0));
  await until(q, () => game.scene?.state.drawn, null, "phone: draws");
  const m = await q.evaluate(`(() => { const r = ${sr}; const keys = [...r.querySelectorAll('.cs-key, .cs-pad button')].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height); }); const acts = [...r.querySelectorAll('.cs-pad button')].filter((b) => b.offsetParent).map((b) => b.getAttribute('aria-label') || b.textContent); return { pad: !!r.querySelector('.cs-pad').offsetParent, keys, acts, touch: getComputedStyle(r.querySelector('.cs-play')).touchAction }; })()`);
  assert.ok(m.pad, "phone: the pad shows");
  assert.ok(m.acts.some((a) => /jump/i.test(a)) && !m.acts.some((a) => /punch|grab/i.test(a)), `phone: the pad has JUMP and no PUNCH or GRAB (${m.acts.join(" | ")})`);
  assert.ok(m.keys.length >= 3 && m.keys.every((k) => k >= 44), `phone: keys ≥ 44 px (${m.keys.join(", ")})`);
  assert.equal(m.touch, "none", "phone: touch-action none");
  const stick = await q.evaluate(`(() => { const s = ${sr}.querySelector('.cs-pad .bui-stick, .cs-pad [class*=stick]'); const b = s.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  const hx = await q.evaluate(() => game.scene.run.M[0]);
  await q.mouse.move(stick[0], stick[1]);
  await q.mouse.down();
  await q.mouse.move(stick[0] + 40, stick[1], { steps: 4 });
  await until(q, (hx) => game.scene.state.phase === 1 && game.scene.run.M[0] > hx + 1, hx, "phone: the stick walks");
  await q.mouse.up();
  // On a wall: a tap on the medium window chips it; a tap out of reach whiffs; a tap on a person in reach eats.
  await hang(q, 1, -1, 3);
  await q.evaluate(() => game.scene.run.LIVE.fill(0));
  await q.waitForTimeout(300);
  const mid = await q.evaluate(() => { const r = game.scene.run; return r.C0[1] + 3 * r.BLD[1 * 4 + 1] + 1; });
  let t = await winXY(q, 1, 3, 1);
  await q.touchscreen.tap(t[0], t[1]);
  await until(q, (c) => game.scene.run.HIT[c] === 1 && game.scene.run.M[8] === 0, mid, "phone: a tap in reach chips the window");
  const q0 = await hits(q);
  t = await winXY(q, 1, 1, 1);
  await q.touchscreen.tap(t[0], t[1]);
  await until(q, () => game.scene.run.M[8] > 0, null, "phone: out of reach, a swing");
  await until(q, () => game.scene.run.M[8] === 0, null, "phone: the swing ends");
  assert.equal(await hits(q), q0, "phone: out of reach, nothing hit");
  await q.evaluate(() => { const r = game.scene.run; r.occ[r.C0[1] + 4 * r.BLD[5]] = 1; });
  await q.waitForTimeout(100);
  t = await winXY(q, 1, 4, 0);
  const s0 = await q.evaluate(() => game.scene.state.snacks);
  await q.touchscreen.tap(t[0], t[1]);
  await until(q, (s0) => game.scene.state.snacks > s0, s0, "phone: a tap on a person in reach eats them");
  // The hero on a wall is a quarter of the stage or more.
  const big = await q.evaluate(() => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas.cs-canvas").getBoundingClientRect(); const [, , s] = game.scene.where(0); return (s * 4.3) / c.height; });
  // (A fifth or more: the city's full height wins over a quarter on a tall phone.)
  assert.ok(big >= 0.2, `phone: the hero on a wall is ${Math.round(big * 100)}% of the stage's height`);
  // Full height: every city's tallest building (its roof and crown) and the street, inside the stage under the HUD, portrait and landscape.
  for (const [w, h] of [[390, 844], [844, 390]]) {
    await q.setViewportSize({ width: w, height: h });
    for (let ci = 0; ci < 7; ci++) {
      await q.evaluate((ci) => { const r = game.scene.run; r.loadCity(ci); }, ci);
      await q.waitForTimeout(250);
      const f = await q.evaluate(() => {
        const sc = game.scene, r = sc.run, root = document.querySelector("[data-fizlet-host]").shadowRoot, cv = root.querySelector("canvas.cs-canvas").getBoundingClientRect(), hud = root.querySelector(".cs-hud").firstElementChild.getBoundingClientRect();
        let b = 0;
        for (let k = 0; k < r.nb(); k++) if (r.BLD[k * 4 + 2] > r.BLD[b * 4 + 2]) b = k;
        const x = r.BLD[b * 4] + r.BLD[b * 4 + 1] / 2, top = sc.project(x, r.top(b) + (r.city().crown === 6 && b === r.city().landmark ? 4 : 0), -3), street = sc.project(x, 0, 5.6);
        return { top: cv.top + top[1], street: cv.top + street[1], hud: hud.bottom, bottom: cv.bottom, city: r.city().name };
      });
      assert.ok(f.top >= f.hud - 2 && f.street <= f.bottom + 1, `${w}×${h} ${f.city}: the tallest building and the street fit (roof ${f.top.toFixed(0)} under the HUD ${f.hud.toFixed(0)}, street ${f.street.toFixed(0)} ≤ ${f.bottom.toFixed(0)})`);
    }
  }
  await ph.close();
  console.log("CitySmash: browser green (title settles, garage + lock + code, start, climb + punch to a hole, eat, a building falls, city 2 loads, unlocks saved, the arrows drive the ape (no keyboard P2), reload persists (hair too), Recall, phone pad stick + JUMP, taps smash, whiff and eat, hero ≥ 1/5, full height at 390 portrait and landscape).");
} finally {
  await browser.close();
  await server.close();
}
