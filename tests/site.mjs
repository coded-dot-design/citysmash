// The built site (artifacts/pages, `npm run site:build` first) in Chromium, at 1440 and 390, dark and
// light: the landing hero is the game's attract run (drawn, the ape smashing, its HUD hidden) with the
// title, the hook and a PLAY link to /play/; the sections (how to play, the seven cities, the garage,
// the reach diagram (7 punch windows; grab: 13 on a wall, 15 in front on the street), the monsters, play together online, built on Fizlet with the measured size, by Chris Cooley); no
// sideways scroll. Reduced motion: the still poster, no game. /play/ mounts the game on its title.
// SHOTS=<dir> saves a screenshot of each.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const BASE = (process.env.SITE_BASE || "/").replace(/\/$/, "");
// The not-found page (site/src/pages/404.astro): 404.html at the root, noindex, a key home.
{ const nf = readFileSync("artifacts/pages/404.html", "utf8"); assert.ok(/<meta name="robots" content="noindex/.test(nf) && nf.includes(`href="${BASE}/"`), "404.html is noindex and links home"); }
const server = await serve("artifacts/pages", {}, BASE);
const browser = await chromium.launch(launchOptions());
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const gz = JSON.parse(readFileSync("dist/build.json", "utf8")).gzip["citysmash.mjs"];

try {
  for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]])
    for (const theme of ["dark", "light"]) {
      const at = `${w} ${theme}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      await ctx.addInitScript((t) => localStorage.setItem("dom-virus:theme", t), theme);
      const p = await ctx.newPage(), errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.goto(`${server.url}${BASE}/`);
      await until(p, () => window.hero?.scene && hero.scene.state.phase === 1 && hero.scene.state.drawn, null, `${at}: the hero plays`);
      const m = await p.evaluate(() => {
        const root = document.querySelector("#dt-hero [data-fizlet-host]").shadowRoot, cv = root.querySelector("canvas.cs-canvas"), px = cv.getContext("2d").getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data;
        const play = document.querySelector(".start-key");
        return {
          theme: document.documentElement.dataset.theme,
          drawn: px[3] === 255,
          hud: root.querySelector(".cs-hud").hidden && root.querySelector(".cs-pad").hidden,
          h1: document.querySelector("h1").textContent.trim(),
          play: play.getAttribute("href"),
          playSize: Math.min(play.getBoundingClientRect().width, play.getBoundingClientRect().height) >= 44,
          sections: ["how", "cities", "garage", "monsters", "online", "fizlet"].every((id) => document.getElementById(id)),
          worlds: document.querySelectorAll("#cities li.panel").length,
          size: document.getElementById("fizlet").textContent.replace(/\s+/g, " "),
          by: /by Chris Cooley/i.test(document.body.textContent),
          sideways: document.documentElement.scrollWidth > innerWidth,
          // The reach diagram (from the game's tables): 7 punch windows; grab on a wall: 13 from the free hand (8 take helicopters too); on the street: 15 in front of him (3 in his own column, by his head); a key.
          reach: [...document.querySelectorAll("#reach .reach-grid")].map((g) => ["punch", "grab", "heli", "ape"].map((k) => g.querySelectorAll(`[data-cell="${k}"]`).length)),
          reachKey: document.querySelectorAll("#reach .reach-key li").length,
          reachSeen: [...document.querySelectorAll("#reach .reach-grid")].every((g) => g.getBoundingClientRect().width > 200),
        };
      });
      assert.equal(m.theme, theme, `${at}: the theme`);
      assert.ok(m.drawn && m.hud, `${at}: the hero draws the city, no HUD over the copy`);
      assert.equal(m.h1, "CitySmash.Climb it. Smash it. Eat the snacks.", `${at}: the title and hook`);
      assert.match(m.play, /\/play\/$/, `${at}: PLAY links to /play/`);
      assert.ok(m.playSize && m.sections && m.worlds === 7 && m.by, `${at}: PLAY ≥ 44 px, six sections, seven cities, by Chris Cooley`);
      assert.ok(m.size.includes(`${gz.toLocaleString("en-US")} bytes gzip`), `${at}: the measured size (${gz} B)`);
      assert.equal(m.sideways, false, `${at}: no sideways scroll`);
      assert.deepEqual(m.reach, [[7, 0, 0, 1], [0, 5, 8, 1], [0, 15, 0, 2]], `${at}: the reach diagram: 7 punch windows; grab on a wall: 13 from the free hand (8 with helicopters); on the street: 15 in front of him`);
      assert.ok(m.reachKey === 6 && m.reachSeen, `${at}: the diagram's key and size`);
      // The monsters: four turntables, none started before they scroll into view; in view they draw and spin;
      // a drag turns one; scrolled away they pause.
      assert.ok(await p.evaluate(() => window.mons.length === 4 && window.mons.every((c) => !c.tt && !c.seen)), `${at}: the turntables wait off-screen`);
      await p.evaluate(() => document.getElementById("monsters").scrollIntoView({ block: "start" }));
      await until(p, () => window.mons.filter((c) => c.cv.dataset.drawn).length >= (innerWidth < 600 ? 1 : 4), null, `${at}: the monsters in view draw`);
      await p.evaluate(() => document.querySelector(".mons").scrollIntoView({ block: "start" }));
      const mm = await p.evaluate(async () => {
        const c = window.mons[0], cv = c.cv, b = cv.getBoundingClientRect(), t0 = c.turn;
        await new Promise((r) => setTimeout(r, 400));
        const spun = c.turn !== t0;
        const px = cv.getContext("2d").getImageData(cv.width >> 1, (cv.height * 0.45) | 0, 1, 1).data;
        return { spun, px: [...px], w: b.width, label: cv.getAttribute("aria-label"), ta: getComputedStyle(cv).touchAction, labels: window.mons.map((m) => m.cv.getAttribute("aria-label")) };
      });
      assert.ok(mm.spun, `${at}: the turntable spins slowly`);
      assert.ok(mm.w > 150 && mm.ta === "pan-y", `${at}: a turntable ${mm.w} px wide, touch-action pan-y`);
      assert.deepEqual(mm.labels, ["THE APE, a giant cyber ape: drag to turn", "SHARDCLAW, a crystal crab-beast: drag to turn", "GLOOPMAW, a tentacle blob: drag to turn", "VOLTWING, a storm moth: drag to turn"], `${at}: each has its label`);
      const box = await p.evaluate(() => { const b = window.mons[0].cv.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
      const before = await p.evaluate(() => window.mons[0].turn);
      await p.mouse.move(box[0], box[1]);
      await p.mouse.down();
      await p.mouse.move(box[0] + 80, box[1], { steps: 4 });
      const during = await p.evaluate(() => window.mons[0].turn);
      await p.mouse.up();
      assert.ok(during - before > 0.6, `${at}: a drag turns it (${(during - before).toFixed(2)})`);
      if (SHOTS) await p.evaluate(() => document.getElementById("monsters").scrollIntoView({ block: "start" })), await p.waitForTimeout(300), await p.screenshot({ path: `${SHOTS}/monsters-${w}-${theme}.png`, fullPage: false });
      await p.evaluate(() => scrollTo(0, 0));
      await until(p, () => window.mons.every((c) => !c.seen), null, `${at}: scrolled away, they pause`);
      const tp = await p.evaluate(async () => { const t = window.mons.map((c) => c.turn); await new Promise((r) => setTimeout(r, 300)); return window.mons.every((c, i) => c.turn === t[i]); });
      assert.ok(tp, `${at}: paused off-screen`);
      if (SHOTS) {
        await p.screenshot({ path: `${SHOTS}/landing-${w}-${theme}.png` });
        if (!touch) await p.screenshot({ path: `${SHOTS}/landing-${w}-${theme}-full.png`, fullPage: true });
      }
      await p.goto(`${server.url}${BASE}/play/`);
      await until(p, () => window.game && game.getSnapshot().screen === "menu", null, `${at}: /play/ mounts on the title`);
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/play-${w}-${theme}.png` });
      assert.deepEqual(errs, [], `${at}: no page errors`);
      await ctx.close();
    }
  const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const r = await rm.newPage();
  await r.goto(`${server.url}${BASE}/`);
  await until(r, () => !document.querySelector(".dt-poster").hidden, null, "reduced motion: the poster");
  assert.equal(await r.evaluate(() => !!window.hero), false, "reduced motion: no game");
  await r.evaluate(() => document.getElementById("monsters").scrollIntoView({ block: "start" }));
  await until(r, () => window.mons.every((c) => c.cv.dataset.drawn), null, "reduced motion: the monsters draw");
  const still = await r.evaluate(async () => { const t = window.mons.map((c) => c.turn); await new Promise((q) => setTimeout(q, 500)); return window.mons.every((c, i) => c.turn === t[i]); });
  assert.ok(still, "reduced motion: a still pose, no spin");
  const rb = await r.evaluate(() => { const b = window.mons[1].cv.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
  const r0 = await r.evaluate(() => window.mons[1].turn);
  await r.mouse.move(rb[0], rb[1]);
  await r.mouse.down();
  await r.mouse.move(rb[0] - 60, rb[1], { steps: 3 });
  await r.mouse.up();
  assert.ok((await r.evaluate(() => window.mons[1].turn)) < r0 - 0.4, "reduced motion: a drag still turns it");
  await rm.close();
  console.log("CitySmash site: green at 1440 and 390, dark and light (the four monster turntables: lazy, spin, drag, pause off-screen); reduced motion shows the poster and still monsters that still drag.");
} finally {
  await browser.close();
  await server.close();
}
