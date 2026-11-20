// The garage as a store on the shop kit (src/store.ts, vendor/shop/), in Chromium at 1440×900 and
// 390×844, dark and light: it opens from the title and fits the stage (no page scroll, nothing wider
// than 1440); the turntable sits at one place and one size on every tab and after every press; a card
// is one key (press it: the part is worn, the card ringed in the go colour, the others not); a part's
// price (the city that unlocks it) is on every card, owned or not; a locked part is refused with a
// note and nothing moves; a flattened city pays for its parts (a save code with the city cleared:
// then the same press wears it); the monsters are one rail and ‹ › step through the ones you own; a
// worn gear bit has its quiet remove key in the card's corner; the pick survives a reload; text
// passes AA; the keys work from the keyboard and by touch; reduced motion: the keys do not ease.
// SHOTS=<dir> saves a screenshot of each (docs/shots/store/ holds the committed set).
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CitySmash</title><style>html,body{margin:0;height:100%}#board{position:fixed;inset:0}</style></head><body><div id="board"></div><script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3 });</script></body></html>`;
const fixture = readFileSync("tests/fixtures/page.html", "utf8").replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board"), seed: 3 });</script></body>`);
const server = await serve(".", { "/dark": page("dark"), "/light": page("light"), "/box": fixture });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
/** Run `fn(root, arg)` on the game's shadow root. */
const on = (p, fn, arg) => p.evaluate(([f, a]) => new Function("r", "a", `return (${f})(r, a)`)(document.querySelector("[data-fizlet-host]").shadowRoot, a), [fn.toString(), arg]);
const click = (p, sel) => on(p, (r, s) => r.querySelector(s).click(), sel);
const rect = (p, sel) => on(p, (r, s) => { const b = r.querySelector(s).getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10); }, sel);
/** WCAG contrast of each matching element's text on the first solid background behind it: the lowest. */
const contrast = (p, sel) => on(p, (r, sel) => {
  const rgb = (c) => { const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data]; };
  const lum = ([R, G, B]) => [R, G, B].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  let low = 99, n = 0;
  for (const el of r.querySelectorAll(sel)) {
    let bg = null;
    for (let e = el; e && e.nodeType === 1; e = e.parentNode instanceof ShadowRoot ? e.parentNode.host : e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      if (c[3] > 230) { bg = c; break; }
    }
    const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg ?? [255, 255, 255]);
    low = Math.min(low, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
    n++;
  }
  return n ? low : 0;
}, sel);
/** A save code (src/profile.ts: CS1-<base64 json>-<checksum>) for profile `p`. */
const codeOf = (p) => {
  const body = Buffer.from(JSON.stringify(p)).toString("base64");
  let h = 7;
  for (let i = 0; i < body.length; i++) h = (Math.imul(h, 31) + body.charCodeAt(i)) >>> 0;
  return `CS1-${body}-${(h % 46656).toString(36).padStart(3, "0")}`;
};
const open = async (ctx, path) => {
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + path);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await until(p, () => window.game && game.getSnapshot().screen === "menu", null, "the title");
  await click(p, "[data-go=garage]");
  await until(p, () => game.getSnapshot().screen === "garage" && game.garage.rig(), null, "the garage opens");
  return [p, errs];
};

try {
  for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]])
    for (const theme of ["dark", "light"]) {
      const at = `${w} ${theme}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      const [p, errs] = await open(ctx, "/" + theme);
      const shot = (name) => SHOTS && p.screenshot({ path: `${SHOTS}/${w}-${theme}-${name}.png` });
      /** The stage holds the whole store: no page scroll, the list not scrolled, nothing past the edges or 1440. */
      const fits = (what) => on(p, (r) => {
        const c = r.querySelector(".cs-cards"), g = r.querySelector(".cs-garage").getBoundingClientRect(), pn = r.querySelector(".cs-panel");
        const out = [...r.querySelectorAll(".cs-garage button, .cs-garage canvas")].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.left < -0.5 || b.right > innerWidth + 0.5 || b.top < -0.5 || b.bottom > innerHeight + 0.5); }).length;
        return { page: document.documentElement.scrollHeight <= innerHeight && c.scrollHeight <= c.clientHeight && c.scrollTop === 0, list: pn.scrollHeight <= pn.clientHeight, wide: g.width <= 1440, out };
      }).then((f) => assert.deepEqual(f, { page: true, list: true, wide: true, out: 0 }, `${at}: ${what} fits the stage`));
      assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), theme);
      assert.equal(await on(p, (r) => r.querySelector(".cs-cards").classList.contains("shop") && !!r.querySelector(".cs-garage .shop-turn canvas.cs-preview")), true, `${at}: the kit's root and its turntable frame`);
      await fits("the store");
      await shot("fur");

      // Browse the tabs: the turntable never moves or changes size; every tab fits; every card carries its price.
      const pv0 = await rect(p, ".shop-turn");
      assert.ok(pv0[1] < h * 0.15 && pv0[3] >= 110, `${at}: the turntable is at the top (${pv0})`);
      for (const t of ["trim", "pattern", "face", "hair", "gear", "code", "fur"]) {
        await click(p, `[data-tab=${t}]`);
        assert.equal(await on(p, (r, t) => r.querySelector(`[data-tab=${t}]`).getAttribute("aria-pressed"), t), "true", `${at}: the ${t} tab`);
        assert.deepEqual(await rect(p, ".shop-turn"), pv0, `${at}: the turntable stays put on ${t}`);
        await fits(`the ${t} tab`);
        if (t !== "code") assert.equal(await on(p, (r) => [...r.querySelectorAll(".cs-tile")].every((b) => b.querySelector(".cs-cost")?.textContent.trim().length > 2)), true, `${at}: a price on every ${t} card`);
        if (t !== "fur") await shot(t);
      }
      const n = await on(p, (r) => ({ fur: r.querySelectorAll("[data-part=fur]").length, locked: r.querySelectorAll("[data-part=fur][data-locked]").length, mons: r.querySelectorAll(".cs-rail [data-mon]").length, min: Math.min(...[...r.querySelectorAll(".cs-garage button")].map((b) => { const q = b.getBoundingClientRect(); return b.classList.contains("shop-corner-k") ? 44 : Math.min(q.width, q.height); })) }));
      assert.deepEqual([n.fur, n.locked, n.mons], [12, 9, 4], `${at}: the game's twelve furs (nine locked on a fresh save), the four monsters in one rail`);
      assert.ok(n.min >= 44, `${at}: every key is 44 px or more (${n.min})`);

      // Select: the card is the key. Worn: pressed, ringed in the go colour, alone.
      await click(p, '[data-part=fur][data-i="1"]');
      const sel = await on(p, (r) => {
        const b = r.querySelector('[data-part=fur][data-i="1"]'), go = getComputedStyle(r.querySelector(".cs-garage")).getPropertyValue("--shop-go").trim(), probe = document.createElement("i");
        probe.style.color = go; r.querySelector(".cs-garage").append(probe);
        const want = getComputedStyle(probe).color; probe.remove();
        return { fur: game.profile.look.fur, pressed: b.getAttribute("aria-pressed"), pick: b.hasAttribute("data-pick"), border: getComputedStyle(b).borderTopColor === want, picks: r.querySelectorAll("[data-part=fur][data-pick]").length, focus: r.activeElement === b, cost: b.querySelector(".cs-cost").textContent.trim(), list: r.querySelector(".cs-panel").scrollTop, cards: r.querySelector(".cs-cards").scrollTop };
      });
      assert.deepEqual(sel, { fur: 1, pressed: "true", pick: true, border: true, picks: 1, focus: true, cost: "STARTER", list: 0, cards: 0 }, `${at}: ASH worn, its card ringed in the go colour, its price still on it, the focus kept, nothing scrolled`);
      assert.deepEqual(await rect(p, ".shop-turn"), pv0, `${at}: nothing jumps on a select`);

      // Cannot buy without: a locked part is refused with a note; the layout does not move.
      const r5 = await rect(p, '[data-part=fur][data-i="5"]');
      await click(p, '[data-part=fur][data-i="5"]');
      assert.equal(await p.evaluate(() => game.profile.look.fur), 1, `${at}: a locked fur is refused`);
      assert.match(await on(p, (r) => r.querySelector(".cs-note").textContent), /Locked: flatten BRIGHTFIELD to unlock DUNE FUR/);
      assert.equal(await on(p, (r) => r.querySelector('[data-part=fur][data-i="5"] .cs-cost').textContent.trim()), "BRIGHTFIELD", `${at}: its price is the city`);
      assert.deepEqual([await rect(p, ".shop-turn"), await rect(p, '[data-part=fur][data-i="5"]')], [pv0, r5], `${at}: the note moves nothing`);
      await fits("the note");
      await shot("locked");
      for (const s of [".cs-note", ".cs-cost", ".cs-tile b", ".shop-tab", ".shop-btn", ".cs-mname", ".shop-meta"]) {
        const c = await contrast(p, `.cs-garage ${s}`);
        assert.ok(c >= 4.5, `${at}: ${s} passes AA (${c.toFixed(2)})`);
      }

      // Buy with what the game takes: a flattened city. A save with Port Lumen and Brightfield cleared (their unlocks
      // owned, SHARDCLAW beaten), loaded through the save code: the same press now wears DUNE.
      const base = await p.evaluate(() => JSON.parse(JSON.stringify(game.profile)));
      await click(p, "[data-tab=code]");
      await on(p, (r, code) => (r.querySelector("#cs-in").value = code), codeOf({ ...base, cleared: ["port-lumen", "coilworth", "brightfield"], owned: [...base.owned, "fur:3", "trim:3", "gear:2", "fur:4", "pattern:2", "gear:3", "fur:5", "trim:4", "face:2", "mon:1"] }));
      await click(p, "[data-import]");
      assert.match(await on(p, (r) => r.querySelector(".cs-note").textContent), /Profile loaded/);
      assert.equal(await on(p, (r) => r.querySelector(".cs-prog .shop-stages").getAttribute("aria-label") + " " + r.querySelectorAll(".cs-prog .shop-stages [data-on]").length), "City 3 of 7 3", `${at}: three cities flat, as three diamonds`);
      await click(p, "[data-tab=code]");
      assert.equal(await on(p, (r) => r.querySelector("[data-tab=fur]").getAttribute("aria-pressed")), "true", `${at}: SAVE CODE again closes the code`);
      await click(p, '[data-part=fur][data-i="5"]');
      assert.deepEqual(await on(p, (r) => { const b = r.querySelector('[data-part=fur][data-i="5"]'); return [game.profile.look.fur, b.hasAttribute("data-locked"), b.hasAttribute("data-pick"), b.querySelector(".cs-cost").textContent.trim(), r.querySelectorAll("[data-part=fur][data-locked]").length]; }), [5, false, true, "BRIGHTFIELD", 6], `${at}: DUNE is paid for and worn; its price stays on the card`);

      // Gear: worn bit by bit; a worn bit's quiet remove key sits in the card's corner.
      await click(p, "[data-tab=gear]");
      await click(p, '.cs-tile[data-part=gear][data-i="2"]');
      const gear = await on(p, (r) => { const c = r.querySelector('.cs-tile[data-part=gear][data-i="2"]').parentElement, k = c.querySelector(".shop-corner-k"), a = c.getBoundingClientRect(), b = k.getBoundingClientRect(); return { on: (game.profile.look.gear & 4) > 0, label: k.getAttribute("aria-label"), corner: b.right <= a.right && b.top >= a.top && b.left > a.left + a.width / 2 && b.bottom < a.top + a.height / 2 + 12 }; });
      assert.equal(gear.on && gear.corner, true, `${at}: the gear is worn, its remove key in the card's top right corner`);
      assert.match(gear.label, /^Remove /);
      await shot("gear-worn");
      await click(p, '.shop-corner-k[data-part=gear][data-i="2"]');
      assert.deepEqual(await on(p, (r) => [(game.profile.look.gear & 4) > 0, !!r.querySelector('.shop-corner-k[data-i="2"]'), r.activeElement === r.querySelector('.cs-tile[data-part=gear][data-i="2"]')]), [false, false, true], `${at}: removed from the corner; the focus goes to its card`);

      // The monsters: one rail; a rival you own is a press away, and ‹ › step through the ones you own.
      assert.deepEqual(await on(p, (r) => [0, 1, 2, 3].map((k) => r.querySelector(`.cs-rail [data-mon="${k}"]`).hasAttribute("data-locked"))), [false, false, true, true]);
      await click(p, '[data-mon="2"]');
      assert.equal(await p.evaluate(() => game.profile.mon), 0, `${at}: a locked rival is refused`);
      assert.match(await on(p, (r) => r.querySelector(".cs-note").textContent), /GLOOPMAW is locked: beat it/);
      await click(p, "[data-turn='1']");
      assert.deepEqual(await on(p, (r) => [game.profile.mon, r.querySelector(".cs-mname").textContent, r.querySelector('[data-mon="1"]').hasAttribute("data-pick"), !!r.querySelector("[data-tab=rc]") && !r.querySelector("[data-tab=face]"), r.activeElement === r.querySelector("[data-turn='1']")]), [1, "SHARDCLAW", true, true, true], `${at}: › turns to SHARDCLAW (its colour and trim tabs)`);
      assert.deepEqual(await rect(p, ".shop-turn"), pv0, `${at}: the turntable stays put on a rival`);
      await fits("a rival's colours");
      await click(p, '[data-rpart="0"][data-i="1"]');
      assert.deepEqual(await p.evaluate(() => game.profile.rlook.slice(0, 2)), [1, -1]);
      await shot("rival");
      await click(p, "[data-tab=rt]");
      await fits("a rival's trims");
      await click(p, "[data-turn='-1']");
      assert.equal(await p.evaluate(() => game.profile.mon), 0, `${at}: ‹ turns back to the ape`);

      // Keyboard (and a tap on a phone): Tab reaches a card, Enter wears it.
      await on(p, (r) => r.querySelector('[data-part=fur][data-i="0"]').focus());
      await p.keyboard.press("Enter");
      assert.equal(await p.evaluate(() => game.profile.look.fur), 0, `${at}: Enter on a card wears it`);
      await p.keyboard.press("Tab");
      assert.equal(await on(p, (r) => r.activeElement?.matches('[data-part=fur][data-i="1"]')), true, `${at}: Tab goes to the next card`);
      if (touch) {
        const b = await rect(p, '[data-part=fur][data-i="2"]');
        await p.touchscreen.tap(b[0] + b[2] / 2, b[1] + b[3] / 2);
        await until(p, () => game.profile.look.fur === 2, null, `${at}: a tap wears MOSS`);
        assert.equal(await on(p, (r) => r.querySelector(".cs-cards").scrollTop + r.querySelector(".cs-panel").scrollTop), 0, `${at}: no scroll on a tap`);
      } else await click(p, '[data-part=fur][data-i="2"]');

      // Persistence: the pick, the cleared cities and the rival's colour survive a reload.
      await p.reload();
      await until(p, () => window.game && game.getSnapshot().screen === "menu", null, "reloads");
      assert.deepEqual(await p.evaluate(() => [game.profile.look.fur, game.profile.cleared.length, game.profile.rlook[0], game.profile.owned.includes("mon:1")]), [2, 3, 1, true], `${at}: the store's changes persist`);
      await click(p, "[data-go=garage]");
      assert.equal(await on(p, (r) => r.querySelector('[data-part=fur][data-i="2"]').hasAttribute("data-pick")), true, `${at}: MOSS is still the ringed card`);
      await click(p, "[data-go=menu]");
      assert.deepEqual(await on(p, (r) => [game.getSnapshot().screen, r.querySelector(".cs-cards").classList.contains("shop")]), ["menu", false], `${at}: BACK is the title`);
      assert.deepEqual(errs, [], `${at}: no page errors`);
      await ctx.close();
    }

  // A phone on its side and the game in a box on a page (the stage, not the window, sizes the store): no page scroll.
  for (const [w, h, path, what] of [[844, 390, "/dark", "a phone on its side"], [1280, 800, "/box", "a box on a page"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const [p, errs] = await open(ctx, path);
    for (const t of ["fur", "hair", "gear", "code"]) {
      await click(p, `[data-tab=${t}]`);
      assert.deepEqual(await on(p, (r) => { const c = r.querySelector(".cs-cards"), g = r.querySelector(".cs-garage").getBoundingClientRect(), b = c.getBoundingClientRect(), v = r.querySelector(".shop-turn").getBoundingClientRect(); return [c.scrollHeight <= c.clientHeight, g.bottom <= b.bottom + 0.5 && g.right <= b.right + 0.5, v.height >= 100 && v.width >= 100]; }), [true, true, true], `${what}: the ${t} tab stays inside the stage, the turntable in view`);
    }
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${w}x${h}-${path.slice(1)}.png` });
    assert.deepEqual(errs, []);
    await ctx.close();
  }

  // Reduced motion: the kit's keys do not ease (the turntable's own rule, no spin after a pick, is the game's from before).
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const [p] = await open(ctx, "/dark");
    await until(p, () => game.engine.paused.includes("settled"), null, "the garage settles");
    assert.equal(await on(p, (r) => getComputedStyle(r.querySelector(".cs-tile")).transitionDuration), "0s", "reduced motion: the keys do not ease");
    await ctx.close();
  }
  console.log("CitySmash: store green (on the shop kit; 1440 and 390, dark and light: fits the stage, the turntable fixed across tabs and presses, a card is the key, the worn card ringed in the go colour, a price on every card, a locked part refused, a flattened city pays, gear's corner remove, the monsters' rail and ‹ ›, keyboard and touch, AA, reload persists; a phone on its side and a box on a page; reduced motion).");
} finally {
  await browser.close();
  await server.close();
}
