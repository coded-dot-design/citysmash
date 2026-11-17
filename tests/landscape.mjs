// /play/ on a phone held sideways (844×390, 932×430, 667×375, touch), built from the site's own sources
// (the Base layout's header, site.css over the kit's board-ui.css, the play page's stage and script) so
// it runs before the site is built: the header steps aside, the page does not scroll, and in every city
// the street line and the tallest roof (its crown) sit inside the visible viewport and under the HUD,
// with the pad's keys clear of the street's middle. SHOTS=<dir> saves each size in the tallest city.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const base = readFileSync("site/src/layouts/Base.astro", "utf8"), play = readFileSync("site/src/pages/play/index.astro", "utf8");
const css = readFileSync("node_modules/@fzlt/core/dist/ui/board-ui.css", "utf8") + readFileSync("site/src/styles/site.css", "utf8");
const astro = (s) => s.replace(/=\{[^}]*\}/g, '="#"').replace(/\{[^}]*\}/g, "");
const header = astro(base.match(/<header class="site-head">[\s\S]*?<\/header>/)[0]);
const stage = astro(play.match(/<section class="play-stage"[\s\S]*?<\/section>/)[0]);
const script = play.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/from "[^"]*citysmash\.mjs"/, 'from "/dist/citysmash.mjs"').replace("host.dataset.rooms", "undefined").replace(/\)!;/, ");").replace(/\(window as [^)]*\)/, "window");
const page = `<!doctype html><html lang="en" class="bui" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"><title>Play CitySmash</title><style>${css}</style></head><body data-page="play" data-app="">${header}<main id="main">${stage}</main><script type="module">${script}</script></body></html>`;
const server = await serve(".", { "/play/": page });
const browser = await chromium.launch(launchOptions());
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));

try {
  for (const [w, h] of [[844, 390], [932, 430], [667, 375]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/play/");
    await until(p, () => window.game && game.getSnapshot().screen === "menu", null, `${w}×${h}: mounts on the title`);
    await p.evaluate(() => game.play(0));
    await until(p, () => game.scene?.state.drawn, null, `${w}×${h}: draws`);
    const pg = await p.evaluate(() => ({ head: !!document.querySelector(".site-head").offsetParent, scroll: document.scrollingElement.scrollHeight, vh: visualViewport.height }));
    assert.ok(!pg.head, `${w}×${h}: the header steps aside`);
    assert.ok(pg.scroll <= Math.ceil(pg.vh), `${w}×${h}: the page fits, no scroll (${pg.scroll} ≤ ${pg.vh})`);
    for (let ci = 0; ci < 7; ci++) {
      await p.evaluate((ci) => game.scene.run.loadCity(ci), ci);
      await until(p, (ci) => game.scene.state.city === ci && game.scene.state.drawn, ci, `${w}×${h}: city ${ci} draws`);
      await p.waitForTimeout(150);
      const f = await p.evaluate(() => {
        const sc = game.scene, r = sc.run, root = document.querySelector("[data-fizlet-host]").shadowRoot, cv = root.querySelector("canvas.cs-canvas").getBoundingClientRect(), hud = root.querySelector(".cs-hud").firstElementChild.getBoundingClientRect();
        let b = 0;
        for (let k = 0; k < r.nb(); k++) if (r.BLD[k * 4 + 2] > r.BLD[b * 4 + 2]) b = k;
        const x = r.BLD[b * 4] + r.BLD[b * 4 + 1] / 2, top = sc.project(x, r.top(b) + (r.city().crown === 6 && b === r.city().landmark ? 4 : 0), -3), street = sc.project(x, 0, 5.6);
        const mid = cv.left + cv.width / 2, keys = [...root.querySelectorAll(".cs-pad button, .cs-pad [class*=stick]")].filter((k) => k.offsetParent).map((k) => k.getBoundingClientRect());
        const midY = cv.top + street[1], covered = keys.some((k) => mid >= k.left && mid <= k.right && midY >= k.top && midY <= k.bottom);
        return { top: cv.top + top[1], street: midY, hud: hud.bottom, bottom: Math.min(cv.bottom, visualViewport.height), city: r.city().name, covered, keys: keys.length };
      });
      assert.ok(f.top >= Math.max(0, f.hud - 2), `${w}×${h} ${f.city}: the tallest roof (${f.top.toFixed(0)}) is under the HUD (${f.hud.toFixed(0)})`);
      assert.ok(f.street <= f.bottom - 1, `${w}×${h} ${f.city}: the street (${f.street.toFixed(0)}) is inside the viewport (${f.bottom.toFixed(0)})`);
      assert.ok(f.keys >= 2 && !f.covered, `${w}×${h} ${f.city}: the pad's keys clear the street's middle`);
    }
    if (SHOTS) {
      await p.evaluate(() => game.scene.run.loadCity(6));
      await until(p, () => game.scene.state.city === 6 && game.scene.state.drawn, null, `${w}×${h}: Skyreach again`);
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${SHOTS}/landscape-${w}x${h}.png` });
    }
    assert.deepEqual(errs, [], `${w}×${h}: no page errors`);
    await ctx.close();
  }
  console.log("CitySmash landscape: green at 844×390, 932×430 and 667×375 (header aside, no scroll; every city's tallest roof under the HUD and the street in the viewport, the pad clear of the street's middle).");
} finally {
  await browser.close();
  await server.close();
}
