// CitySmash online in Chromium (the built dist/citysmash.mjs): two screens, one run, through the game's
// own ONLINE card and @fzlt/core/presence's join() against a stand-in fizlet-rooms server
// (tests/room-server.mjs) with a phone's network between each seat and the room (60–120 ms round trips,
// jitter, spikes). A (1440) hosts a room for two; B (a 390 phone) opens the invite link and drops
// straight in. A is the ape, B takes SHARDCLAW; the ape's look reaches B's screen. Both play (each its
// own seat, on the autopilot): the runs stay identical (no desync; byte for byte on a frame both hold);
// then B closes its tab and SHARDCLAW goes back to the AI on A, which plays on. Waits on state.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";
import { CODE, roomServer } from "./room-server.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const page = fixture.replace("</body>", `<script type="module">import { createCitySmash } from "/dist/citysmash.mjs"; window.game = createCitySmash({ host: document.getElementById("board") });</script></body>`);
const LAG = { rtt: [60, 120], jitter: 20, spike: 200, spikeEvery: 5000, seed: 3 };
const site = await serve(".", { "/": page }), rooms = await roomServer({ max: 4, lag: LAG });
const browser = await chromium.launch(launchOptions());
const errors = [];
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 100 }).catch(() => assert.fail(`${what}: timed out`));
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";
const hashIn = (p) => p.evaluate(() => { let h = 2166136261; for (const v of game.scene.run.bytes) for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v[i], 16777619); return h >>> 0; });
try {
  const open = async (url, vp, touch, name, look) => {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
    if (look) await ctx.addInitScript((l) => localStorage.setItem("citysmash:profile", JSON.stringify({ v: 1, look: l, owned: ["fur:4", "trim:3", "gear:2"], cleared: [], best: 0, rivals: 1, stats: {} })), look);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
    await p.goto(url);
    await until(p, () => window.game, null, `${name} mounts`);
    return p;
  };
  const look = { fur: 4, trim: 3, pattern: 1, face: 1, gear: 5 };
  const A = await open(`${site.url}/?rooms=${encodeURIComponent(rooms.url)}`, { width: 1440, height: 900 }, false, "A", look);
  await A.evaluate(`${sr}.querySelector('[data-go=online]').click()`);
  const card = A.locator("[data-fizlet-host] .cs-online");
  await card.locator("input[name=code]").fill(CODE.toLowerCase());
  await card.locator("button[value=host]").click();
  await until(A, (sr) => !eval(sr).querySelector(".cs-online [data-for=host]").hidden, sr, "A picks the size");
  await card.locator("[data-size='2']").click();
  await until(A, (sr) => /waiting for 1 more/.test(eval(sr).querySelector(".cs-wait-say").textContent), sr, "A waits in its room");
  const room = Number(await A.evaluate(`${sr}.querySelector('.cs-t-room').textContent`));
  assert.equal(await A.evaluate(`${sr}.querySelector('.cs-t-code').textContent`), CODE, "the ticket shows the code");
  console.log(`✓ A hosts room ${room}`);
  // B opens the invite link: straight into the room.
  const B = await open(`${site.url}/?mode=online&room=${room}&rooms=${encodeURIComponent(rooms.url)}&code=${CODE}`, { width: 390, height: 844 }, true, "B");
  await until(A, () => game.getSnapshot().online, null, "A starts");
  await until(B, () => game.getSnapshot().online, null, "B starts");
  assert.deepEqual([await A.evaluate(() => game.getSnapshot().online.seat), await B.evaluate(() => game.getSnapshot().online.seat)], [0, 1], "A is the ape, B is SHARDCLAW");
  assert.equal(await B.evaluate(() => game.scene.run.MV[1][28]), 1, "SHARDCLAW is B's");
  await until(B, (l) => JSON.stringify(game.scene.look) === JSON.stringify(l), look, "the ape's look reaches B");
  console.log("✓ B joins by the link; the ape's look reached B");
  // Both play on the autopilot of their own seat.
  await A.evaluate(() => (game.scene.auto = true));
  await B.evaluate(() => (game.scene.auto = true));
  await until(A, () => game.getSnapshot().online.final > 1200, null, "A: 1,200 final frames", 60000);
  await until(B, () => game.getSnapshot().online.final > 1200, null, "B: 1,200 final frames", 60000);
  const at = Math.max(await A.evaluate(() => game.net.frame), await B.evaluate(() => game.net.frame)) + 10;
  await A.evaluate((f) => (game.net.hold = f), at);
  await B.evaluate((f) => (game.net.hold = f), at);
  await until(A, (f) => game.net.final === f, at, "A holds");
  await until(B, (f) => game.net.final === f, at, "B holds");
  const [ha, hb] = [await hashIn(A), await hashIn(B)];
  assert.equal(ha, hb, "byte for byte on the held frame");
  assert.deepEqual([await A.evaluate(() => game.net.desync), await B.evaluate(() => game.net.desync)], [-1, -1], "no desync");
  const sa = await A.evaluate(() => game.scene.state);
  assert.ok(sa.holes > 0 || sa.score > 0, `they smashed (score ${sa.score})`);
  console.log(`✓ ${at} frames identical on both screens (score ${sa.score}, corrections ${await A.evaluate(() => game.net.corrections)} / ${await B.evaluate(() => game.net.corrections)})`);
  await A.evaluate(() => (game.net.hold = -1));
  await B.evaluate(() => (game.net.hold = -1));
  // B closes its tab: SHARDCLAW goes back to the AI; A plays on.
  await B.context().close();
  await until(A, () => game.net.left & 2 && game.scene.run.MV[1][28] === 9, null, "SHARDCLAW back to the AI");
  const f0 = await A.evaluate(() => game.net.final);
  await until(A, (f0) => game.net.final > f0 + 120, f0, "A plays on");
  assert.deepEqual(errors, [], "no page errors");
  console.log("CitySmash online: green (host, link join, the look travels, identical runs, a leaver goes back to the AI).");
} finally {
  await browser.close();
  await site.close();
  rooms.close();
}
