// CitySmash v15 in Chromium (dist/citysmash.mjs), at 1440 and 390: the start menu's EASY / MEDIUM / HARD picker
// (MEDIUM on a fresh profile, one pressed at a time, keyboard reachable), the pick saved in the profile and back after
// a reload, the run on that level with it on the HUD's city chip; practice is EASY whatever the pick and its chip
// shows no level. SHOTS=<dir> saves the menu at each width. Waits on state.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const SHOTS = process.env.SHOTS || "";
const fixture = readFileSync("tests/fixtures/page.html", "utf8").replace("height:70vh", "height:90vh");
// (the profile lives in the page's localStorage: a reload keeps it)
const page = fixture.replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3 });</script></body>`);
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";
const keys = (p) => p.evaluate(`[...${sr}.querySelectorAll('.cs-levels [data-level]')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed'))`);
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const at = `${w}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w < 500 ? { hasTouch: true, isMobile: true } : {}) });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.engine.paused.includes("settled"), null, `${at}: the title settles`);
    assert.deepEqual(await keys(p), ["EASY:false", "MEDIUM:true", "HARD:false"], `${at}: three levels, MEDIUM on a fresh profile`);
    assert.equal(await p.evaluate(`${sr}.querySelector('.cs-levels').getAttribute('aria-label')`), "Difficulty", `${at}: the group is named`);
    // Every key is a real button, at least 44 px: a tap or a keyboard press picks it.
    const sizes = await p.evaluate(`[...${sr}.querySelectorAll('.cs-levels button')].map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); })`);
    assert.ok(sizes.every((s) => s >= 44), `${at}: 44 px keys (${sizes.join(", ")})`);
    await p.evaluate(`${sr}.querySelector('[data-level="2"]').click()`);
    await until(p, (sr) => eval(sr).querySelector('[data-level="2"]').getAttribute("aria-pressed") === "true", sr, `${at}: HARD picked`);
    assert.deepEqual(await keys(p), ["EASY:false", "MEDIUM:false", "HARD:true"], `${at}: one pressed at a time`);
    assert.match(await p.evaluate(`${sr}.querySelector('.cs-levels + .cs-explain').textContent`), /^Hard:/, `${at}: what it means, under it`);
    assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem("citysmash:profile"))).level, 2, `${at}: saved in the profile`);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await p.evaluate(`${sr}.querySelector('[data-level="1"]').click()`);
      await p.evaluate(`${sr}.querySelector('.cs-levels').scrollIntoView({ block: "center" })`);
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${SHOTS}/menu-levels-${w}.png` });
      await p.evaluate(`${sr}.querySelector('[data-level="2"]').click()`);
    }
    await p.reload();
    await until(p, () => window.game && game.engine.paused.includes("settled"), null, `${at}: the title again`);
    assert.deepEqual(await keys(p), ["EASY:false", "MEDIUM:false", "HARD:true"], `${at}: HARD after a reload`);
    // The run is on HARD, and says so on the city's chip.
    await p.evaluate(`${sr}.querySelector('[data-play]').click()`);
    await until(p, () => game.scene?.state.drawn, null, `${at}: the run`);
    assert.equal(await p.evaluate(() => game.scene.run.S[33]), 2, `${at}: the run is on HARD`);
    await until(p, (sr) => / · HARD$/.test(eval(sr).querySelector(".cs-city em").textContent), sr, `${at}: HARD on the city's chip`);
    // EASY by the keyboard (Enter on the focused key), then practice: EASY whatever the pick, no level on its chip.
    await p.evaluate(() => game.show("menu"));
    await until(p, (sr) => !!eval(sr).querySelector('[data-level="0"]'), sr, `${at}: the menu`);
    await p.evaluate(`${sr}.querySelector('[data-level="0"]').focus()`);
    await p.keyboard.press("Enter");
    await until(p, (sr) => eval(sr).querySelector('[data-level="0"]').getAttribute("aria-pressed") === "true", sr, `${at}: EASY by the keyboard`);
    assert.equal(await p.evaluate(`${sr}.activeElement?.dataset.level`), "0", `${at}: the focus stays on the key`);
    await p.evaluate(`${sr}.querySelector('[data-level="2"]').click()`);
    await p.evaluate(`${sr}.querySelector('[data-practice]').click()`);
    await until(p, () => game.scene?.state.drawn && game.scene.practice, null, `${at}: practice`);
    assert.equal(await p.evaluate(() => game.scene.run.S[33]), 0, `${at}: practice is EASY`);
    await until(p, (sr) => /^1\/7 · \w+$/.test(eval(sr).querySelector(".cs-city em").textContent), sr, `${at}: no level on practice's chip`);
    assert.deepEqual(errs, [], `${at}: no page errors`);
    await ctx.close();
  }
  console.log("CitySmash: levels green (EASY / MEDIUM / HARD on the menu, MEDIUM fresh, one pressed, 44 px, by the keyboard too; saved and back after a reload; the run on it with it on the city's chip; practice EASY with no level shown; at 1440 and 390).");
} finally {
  await browser.close();
  await server.close();
}
