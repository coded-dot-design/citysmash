// CitySmash's settle guard (Chromium, dist/citysmash.mjs): the title and the garage sleep (no frames,
// no audio before a gesture; the turntable turns a moment after a change, then stops); a city waiting
// for the first press sleeps; playing it never does, the clock keeping pace with the wall clock; scrolled
// off screen it pauses; the run's card settles; after Recall no frame runs. Waits on state.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8").replace("<p>After it.</p>", '<p>After it.</p><div style="height:3000px"></div>');
const page = fixture.replace("</body>", `<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script><script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 4, store: { get: () => null, set() {} } });</script></body>`);
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const frames = (p, n = 12) => p.evaluate(async (n) => { const f = () => game.engine.stats().frames + (game.scene ? game.scene.engine.stats().frames : 0), a = f(); for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); return f() - a; }, n);

try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(server.url + "/");
  await until(p, () => window.game && game.engine.paused.includes("settled"), null, "the title settles");
  assert.equal(await frames(p), 0, "title: no frames");
  assert.equal(await p.evaluate(() => window.audio || 0), 0, "no audio before a gesture");
  await p.evaluate(() => game.show("garage"));
  await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector('[data-part="fur"][data-i="1"]').click());
  await until(p, () => !game.engine.paused.includes("settled"), null, "the turntable turns after a change");
  await until(p, () => game.engine.paused.includes("settled"), null, "then the garage settles");
  assert.equal(await frames(p), 0, "garage: no frames");
  await p.evaluate(() => game.play(0));
  await until(p, () => game.scene?.state.phase === 0 && game.scene.state.drawn && game.scene.engine.paused.includes("settled") && game.engine.paused.includes("settled"), null, "waiting for the first press it settles");
  assert.equal(await frames(p), 0, "ready: no frames");
  await p.evaluate(() => (game.scene.auto = true));
  await until(p, () => game.scene.state.phase === 1, null, "plays");
  const a = await p.evaluate(() => ({ t: game.scene.run.S[19], w: performance.now() }));
  await until(p, (a) => performance.now() - a.w > 2000, a, "two seconds pass");
  const b = await p.evaluate(() => ({ t: game.scene.run.S[19], w: performance.now(), paused: game.scene.engine.paused.slice() }));
  const rate = (b.t - a.t) / ((b.w - a.w) / 1000);
  assert.ok(rate > 0.3, `playing keeps pace: ${rate.toFixed(2)}×`);
  assert.deepEqual(b.paused, [], "never asleep while playing");
  await p.evaluate(() => scrollTo(0, 3000));
  await until(p, () => game.scene.engine.paused.includes("offscreen"), null, "off screen it pauses");
  assert.equal(await frames(p), 0, "off screen: no frames");
  await p.evaluate(() => scrollTo(0, 0));
  await p.evaluate(() => { game.scene.auto = false; for (const O of game.scene.run.MV) O[7] = 0.5; game.scene.run.M[7] = 0.5; const r = game.scene.run; r.PB[0] = 1; r.PB[1] = r.M[0]; r.PB[2] = r.M[1] + 2; r.PB[3] = r.M[2]; });
  await until(p, () => game.scene.state.end, null, "the run's card");
  await until(p, () => game.scene.engine.paused.includes("settled"), null, "the card settles");
  assert.equal(await frames(p), 0, "card: no frames");
  await p.evaluate(() => game.destroy());
  assert.equal(await p.evaluate(async () => { const a = performance.now(); await new Promise((r) => setTimeout(r, 200)); return document.querySelector("[data-fizlet-host]") ? 1 : 0; }), 0, "the game is gone");
  console.log("CitySmash: settle guard green (title, garage, a waiting city and the card sleep; playing never does; off screen pauses; quiet after Recall).");
} finally {
  await browser.close();
  await server.close();
}
