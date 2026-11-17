// CitySmash v10 in Chromium (dist/citysmash.mjs): play as any monster, one person a device.
// A fresh profile plays the ape only: a rival's garage card is a locked silhouette and is refused with a note.
// Knocking out an AI rival in a one-player run unlocks it ("SHARDCLAW UNLOCKED!"), saved across a reload;
// played, it is your monster in slot 0 and the ape joins the AI cast. In practice each of the four monsters
// punches the seven reach cells and grabs a snack. The title has no players panel without a gamepad; a
// connected gamepad shows a slot ("press any button to join"), a press joins it, its monster can be changed
// and the run seats it in that monster. The title's explainers and hints pass WCAG AA. Waits on state.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const page = fixture.replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3 });</script></body>`);
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";
// The fake gamepads: window.pads (an array the test fills), navigator.getGamepads reads it.
const fakePads = () => {
  window.pads = [];
  navigator.getGamepads = () => window.pads;
  window.padOn = (i) => ((window.pads[i] = { index: i, id: "test pad", connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }), dispatchEvent(new Event("gamepadconnected")));
  window.padPress = (i, on) => (window.pads[i].buttons[0] = { pressed: on, value: +on });
};
/** WCAG contrast of an element's text on the first solid background behind it. */
const contrast = (p, sel) => p.evaluate(([sr, sel]) => {
  const el = eval(sr).querySelector(sel);
  if (!el) return 0;
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  let bg = null;
  for (let e = el; e && e.nodeType === 1; e = e.parentNode instanceof ShadowRoot ? e.parentNode.host : e.parentElement) {
    const c = rgb(getComputedStyle(e).backgroundColor);
    if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) { bg = c; break; }
  }
  const fg = rgb(getComputedStyle(el).color), a = lum(fg), b = lum(bg ?? [255, 255, 255]);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}, [sr, sel]);

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(fakePads);
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + "/");
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await until(p, () => window.game && game.getSnapshot().screen === "menu", null, "the title");
  // The title: CPU rivals explained, no players panel without a gamepad, PLAY WITH FRIENDS is the way to play together.
  const t = await p.evaluate(`(() => { const r = ${sr}; return { riv: r.querySelector('[data-rivals]').textContent, explain: r.querySelector('.cs-explain').textContent, pads: !!r.querySelector('.cs-pads'), friends: r.querySelector('.cs-friends').textContent, sizes: r.querySelectorAll('[data-players]').length }; })()`);
  assert.equal(t.riv, "CPU RIVALS: ON");
  assert.match(t.explain, /Computer rivals: the monsters nobody picked join as AI/);
  assert.ok(!t.pads && t.sizes === 0, "no gamepad: no players panel, no 1P–4P keys");
  assert.match(t.friends, /PLAY WITH FRIENDS/);
  assert.ok((await contrast(p, ".cs-explain")) >= 4.5, "the explainer passes AA");
  // The garage: the rivals are locked silhouettes; a click is refused with a note (AA on its yellow).
  await p.evaluate(`${sr}.querySelector('[data-go=garage]').click()`);
  await until(p, () => game.getSnapshot().screen === "garage", null, "the garage");
  const g = await p.evaluate(`(() => { const r = ${sr}; return [0, 1, 2, 3].map((k) => { const b = r.querySelector('[data-mon="' + k + '"]'); return [b.hasAttribute('data-locked'), b.classList.contains('cs-sil')]; }); })()`);
  assert.deepEqual(g, [[false, false], [true, true], [true, true], [true, true]], "the ape open; the rivals locked silhouettes");
  await p.evaluate(`${sr}.querySelector('[data-mon="1"]').click()`);
  assert.equal(await p.evaluate(() => game.profile.mon), 0, "a locked rival is refused");
  assert.match(await p.evaluate(`${sr}.querySelector('.cs-note').textContent`), /SHARDCLAW is locked: beat it/);
  const cn = await contrast(p, ".cs-note");
  assert.ok(cn >= 4.5, `the note passes AA (${cn.toFixed(1)})`);
  assert.equal(await p.evaluate(() => game.setMon(2)), 0, "the API refuses it too");
  // A one-player run: SHARDCLAW (the first AI rival) shrinks: unlocked, the toast says so, saved.
  await p.evaluate(() => game.play(0));
  await until(p, () => game.scene?.state.drawn, null, "the run draws");
  await p.evaluate(() => {
    const r = game.scene.run, O = r.MV[1];
    r.S[0] = 1;
    O[24] = 1; O[5] = 0; O[7] = 1; O[15] = 0; O[0] = 2;
    // A shell at its chest.
    r.PB[0] = 2; r.PB[1] = O[0]; r.PB[2] = O[1] + 2; r.PB[3] = O[2]; r.PB[4] = r.PB[5] = r.PB[6] = 0; r.PB[7] = 2;
  });
  await until(p, () => game.profile.owned.includes("mon:1"), null, "knocking SHARDCLAW out unlocks it");
  assert.match(await p.evaluate(`${sr}.querySelector('.cs-toast').textContent`), /SHARDCLAW UNLOCKED/);
  await p.reload();
  await until(p, () => window.game, null, "reloads");
  assert.ok(await p.evaluate(() => game.profile.owned.includes("mon:1") && !game.profile.owned.includes("mon:2")), "the unlock persists");
  // Play it: the garage picks it, the run seats it in slot 0 and the ape joins the AI.
  await p.evaluate(`${sr}.querySelector('[data-go=garage]').click()`);
  await p.evaluate(`${sr}.querySelector('[data-mon="1"]').click()`);
  assert.equal(await p.evaluate(() => game.profile.mon), 1);
  assert.equal(await p.evaluate(`${sr}.querySelector('.cs-mname').textContent`), "SHARDCLAW");
  assert.ok(await p.evaluate(`!!${sr}.querySelector('[data-tab=rc]') && !${sr}.querySelector('[data-tab=face]')`), "a rival's garage: colour and trim");
  await p.evaluate(`${sr}.querySelector('[data-rpart="0"][data-i="1"]').click()`);
  assert.deepEqual(await p.evaluate(() => game.profile.rlook.slice(0, 2)), [1, -1], "its colour picked");
  await p.evaluate(() => game.play(0));
  await until(p, () => game.scene?.state.drawn, null, "the run as SHARDCLAW");
  const cast = await p.evaluate(() => ({ kinds: game.scene.run.MV.map((O) => O[31]), drivers: game.scene.run.MV.map((O) => O[28]), name: game.scene.state.name }));
  assert.deepEqual(cast.kinds, [1, 0, 2, 3], "you are SHARDCLAW; the ape is the first AI rival");
  assert.deepEqual(cast.drivers, [0, 9, 9, 9]);
  assert.equal(cast.name, "SHARDCLAW");

  // Practice as each monster: the seven reach cells punched, a snack grabbed.
  await p.evaluate(() => localStorage.setItem("citysmash:profile", JSON.stringify({ ...game.profile, owned: [...game.profile.owned, "mon:2", "mon:3"] })));
  await p.reload();
  await until(p, () => window.game, null, "reloads with every monster");
  for (let k = 0; k < 4; k++) {
    await p.evaluate((k) => (game.setMon(k), game.practice()), k);
    await until(p, () => game.scene?.state.drawn, null, `practice as ${k}`);
    const r = await p.evaluate(() => {
      const sc = game.scene, r = sc.run, M = r.MV[0];
      sc.engine.stop();
      const step = (n) => { for (let i = 0; i < n; i++) sc.engine.advance(1 / 60); };
      const b = 1, s = -1, fl = 3, put = () => { M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = fl + 0.5 - 1.9; M[8] = M[34] = M[45] = M[23] = M[20] = M[43] = M[21] = M[14] = 0; };
      r.S[0] = 1;
      r.B.fill(0); r.cell.fill(2); r.occ.fill(0); r.LIVE.fill(0);
      put(); step(10); r.S[30] = 0;
      for (let d = 0; d < 7; d++) {
        put();
        M[20] = 0.3; M[43] = 1 + d;
        let n = 0;
        while (!(r.S[30] & (1 << d)) && n++ < 40) step(1);
        step(2);
      }
      // A grab: a person at the window by the hand.
      put(); step(20);
      const snacks = r.S[6];
      r.occ[r.reachCell(M, 0)] = 1;
      M[21] = 0.3; M[44] = 0;
      for (let n = 0; n < 60 && r.S[6] === snacks; n++) step(1);
      sc.engine.start();
      return { kind: M[31], reach: r.S[30], snack: r.S[6] > snacks };
    });
    assert.deepEqual(r, { kind: k, reach: 127, snack: true }, `practice as monster ${k}: the seven reach cells and a grab`);
  }

  // A gamepad: a slot to join; a press joins it; its monster changes; the run seats it.
  await p.evaluate(() => (game.setMon(0), game.show("menu")));
  await p.evaluate(() => window.padOn(0));
  await until(p, () => !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".cs-pads"), null, "a gamepad: the players panel");
  assert.match(await p.evaluate(`${sr}.querySelector('.cs-pads').textContent`), /GAMEPAD 1.*Press any button to join/);
  assert.match(await p.evaluate(`${sr}.querySelector('.cs-pads li').textContent`), /Keys: WASD move · Space jump · J punch · K grab · Q\/E aim · or mouse\/tap/);
  const hc = await contrast(p, ".cs-who li:not(.cs-in) small");
  assert.ok(hc >= 4.5, `the join hint passes AA (${hc.toFixed(1)})`);
  await p.evaluate(() => window.padPress(0, true));
  await until(p, () => game.pads[0].on, null, "a press joins");
  await p.evaluate(() => window.padPress(0, false));
  await until(p, () => /READY/.test(document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll(".cs-who li")[1].textContent), null, "the slot reads ready");
  await p.evaluate(`${sr}.querySelector('[data-padmon="0"]').click()`);
  assert.equal(await p.evaluate(() => game.pads[0].mon), 2, "its monster: the next one free");
  await p.evaluate(`${sr}.querySelector('[data-play]').click()`);
  await until(p, () => game.scene?.state.drawn, null, "the run with a pad");
  assert.deepEqual(await p.evaluate(() => [game.scene.run.MV[1][28], game.scene.run.MV[1][31], game.scene.run.MV[0][31]]), [1, 2, 0], "the pad drives slot 2 as GLOOPMAW; you the ape");
  // Unplugged: the panel goes.
  await p.evaluate(() => { window.pads = []; dispatchEvent(new Event("gamepaddisconnected")); game.show("menu"); });
  await until(p, () => !document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".cs-pads"), null, "no gamepad: no panel");
  assert.deepEqual(errs, [], "no page errors");
  await ctx.close();
  console.log("CitySmash: rivals green (a locked rival refused, a knock-out unlocks it and it persists, played in slot 0 with the ape in the AI cast and its own colour, practice punches and grabs as each of the four, no players panel without a gamepad, a pad joins and plays its pick, AA hints).");
} finally {
  await browser.close();
  await server.close();
}
