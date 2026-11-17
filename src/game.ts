// CitySmash, the shell: the title (play from any city you have reached, computer rivals on or off, a
// player for each connected gamepad: one person a device, friends play online), the garage (your monster
// on a live turntable: the ape's fur, trim, pattern, face, gear, the parts each city unlocks; a rival you
// have beaten, in a colour and trim of your pick; the save code), the run (./scene.ts) and online rooms (./net.ts: host or join with
// an invite code, a lobby, the run over the rollback). It owns the profile (./profile.ts): a cleared
// city's unlocks and the run's best land in it and it is saved at once. Board UI stickers in a shadow
// root, so the page and the game never touch each other's styles; every page write goes through the
// kernel's ledger, so Recall gives the page back.
import { createEngine } from "@fzlt/core/kernel";
import { mount as buiMount } from "@fzlt/core/ui";
import { diorama } from "@fzlt/core/diorama";
import { lockTouch } from "@fzlt/core/touch";
import type { Transport } from "@fzlt/core/presence";
import { mountScene, SEAT_C, type Scene } from "./scene.ts";
import { CITIES, NCITY } from "./cities.ts";
import { heroName, shade, monName, rivalDress, FURS, TRIMS, PATTERNS, FACES, GEAR, HAIRS, RIVALS, RIVAL_WHAT, RIVAL_C } from "./monster.ts";
import { turntable } from "./turntable.ts";
import { AI, NM, DONE, LEVELS } from "./round.ts";
import { load, save, local, fresh, clearCity, startable, endRun, setPart, partName, unlockedBy, exportCode, importCode, beat, setMon, setRival, cast, type Profile, type Store, type Part } from "./profile.ts";
import { encode, decode, NI, packMode, unpackMode, joinRoom, rollback, lookBits, takeLook, lookOf, GONE, B_GONE, SEATS, LOOK_FRAMES, type Rollback } from "./net.ts";

/** v14: the controls card on the menu (keys only, or keys and the mouse: both always work). */
const CONTROLS = `<section class="cs-ctrls" aria-label="Controls"><p class="cs-sub">CONTROLS · KEYS ONLY OR KEYS + MOUSE</p><ul><li><kbd>WASD</kbd> / arrows move and climb</li><li><kbd>Space</kbd> jump · on a wall: leap to the next building · twice: let go</li><li><kbd>J</kbd> punch the aimed window (hold W/S: up, down)</li><li><kbd>K</kbd> (or <kbd>L</kbd>) grab and eat</li><li><kbd>Q</kbd> <kbd>E</kbd> or <kbd>Tab</kbd> move the aim · or click what to smash</li><li>Gamepad: A jump · X punch · B grab · LB/RB aim</li></ul></section>`;
export interface CitySmashOptions {
  host?: HTMLElement | null;
  /** The landing hero: the ape on the autopilot, the cities looping, no menus, no saving. */
  attract?: boolean;
  seed?: number;
  store?: Store;
  sound?: boolean;
  theme?: "dark" | "light";
  /** The fizlet-rooms server for online play (wss://…); `?rooms=` on the page overrides it. */
  rooms?: string;
}
type Screen = "menu" | "garage" | "play" | "online";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const num = (n: number) => n.toLocaleString("en-US");
type Tab = Part | "code" | "rc" | "rt";
const TABS: [Part, string, number][] = [["fur", "FUR", FURS.length], ["trim", "TRIM", TRIMS.length], ["pattern", "PATTERN", PATTERNS.length], ["face", "FACE", FACES.length], ["hair", "HAIR", HAIRS.length], ["gear", "GEAR", GEAR.length]];
const TOD = ["DAY", "DUSK", "NIGHT"];
const ROOM_N = 16;

export function createCitySmash(o: CitySmashOptions = {}) {
  const dropIn = !o.host, store = o.store ?? local;
  const wrap = document.createElement("div");
  wrap.setAttribute("data-fizlet-host", "citysmash");
  wrap.style.cssText = dropIn ? "position:fixed;inset:0;z-index:2147483000" : "position:absolute;inset:0";
  const engine = createEngine({ root: wrap, settle: 0.5, seed: o.seed ?? 1 });
  const L = engine.ledger, sig = { signal: engine.signal };
  L.add(wrap);
  (o.host ?? document.body).append(wrap);
  const release = lockTouch(document);
  const pageTheme = () => o.theme ?? (document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const root = buiMount(wrap, __KIT_CSS__ + __GAME_CSS__, { theme: pageTheme() });
  const stage = document.createElement("div");
  stage.className = "cs";
  root.append(stage);
  const paintTheme = () => (root.dataset.theme = pageTheme());
  paintTheme();
  const mo = new MutationObserver(() => (paintTheme(), scene?.retheme(), (pvKey = ""), preview()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  engine.signal.addEventListener("abort", () => (mo.disconnect(), netEnd(), scene?.destroy(), release()), { once: true });
  const qs = new URLSearchParams(typeof location === "object" ? location.search : "");
  const ROOMS_URL = qs.get("rooms") ?? o.rooms ?? "";

  const loaded = o.attract ? { profile: fresh(), newer: false } : load(store);
  let profile: Profile = loaded.profile;
  const newer = loaded.newer;
  const keep = () => !o.attract && save(profile, store, newer);

  const sceneEl = document.createElement("div");
  sceneEl.className = "cs-scene-host";
  const cards = document.createElement("div");
  cards.className = "cs-cards";
  const live = document.createElement("p");
  live.className = "cs-live";
  live.setAttribute("aria-live", "polite");
  stage.append(sceneEl, cards, live);
  L.add(cards);
  const say = (s: string) => (live.textContent = s === live.textContent ? s + " " : s);
  let screen: Screen = "menu", scene: Scene | null = null, start = 0, players = 1, tab: Tab = "fur", note = "";
  /** The gamepads on this screen (up to three extra players): joined, and the monster each plays. */
  const pads = [0, 1, 2].map((i) => ({ on: false, mon: i + 1, held: true })), PADS = { n: 0, poll: 0 };
  const monOf = () => monName(profile.mon, profile.look);
  start = Math.max(...startable(profile));

  // ---- the garage turntable: the ape on a plinth, drawn on change; it turns a while after each change, and drags round ----
  const pv = document.createElement("canvas");
  pv.className = "cs-preview";
  pv.setAttribute("aria-hidden", "true");
  const tt = turntable(pv, pageTheme), pdio = tt.dio;
  let pvKey = "", turn = -0.5, spinTo = 0;
  function preview() {
    if (!pv.isConnected) return;
    if (pvKey === "") tt.invalidate(), (pvKey = "x");
    tt.draw(profile.mon, profile.look, profile.mon ? rivalDress(profile.mon, profile.rlook) : null, turn, engine.time);
  }
  const pro = new ResizeObserver(() => ((pvKey = ""), preview()));
  pro.observe(pv);
  engine.signal.addEventListener("abort", () => pro.disconnect(), { once: true });
  let drag = -1;
  pv.addEventListener("pointerdown", (e) => ((drag = e.clientX), pv.setPointerCapture?.(e.pointerId), (spinTo = 0)), sig);
  pv.addEventListener("pointermove", (e) => {
    if (drag < 0) return;
    turn += (e.clientX - drag) * 0.012;
    drag = e.clientX;
    preview();
  }, sig);
  pv.addEventListener("pointerup", () => (drag = -1), sig);
  engine.add({
    step(e, dt) {
      if (screen === "garage" && spinTo > e.time) (turn += dt * 1.6), e.busy(), preview();
      // The menu watches the gamepads (only once one has shown up): each connected pad is a slot; a press joins it.
      if (screen === "menu" && PADS.poll) {
        e.busy();
        const all = [...(navigator.getGamepads?.() ?? [])].filter((g): g is Gamepad => !!g && g.connected).slice(0, 3);
        let ch = all.length !== PADS.n;
        all.forEach((g, i) => {
          const q = pads[i]!, down = g.buttons.some((b) => b.pressed);
          if (down && !q.held && !q.on) (q.on = true), (ch = true), say(`Gamepad ${i + 1} joined as ${monName(q.mon, profile.look)}`);
          q.held = down;
        });
        for (let i = all.length; i < 3; i++) pads[i]!.on = false;
        PADS.n = all.length;
        if (!PADS.n) PADS.poll = 0;
        if (ch) paint();
      }
    },
  });
  const padsOn = () => ((PADS.poll = 1), engine.wake());
  addEventListener("gamepadconnected", padsOn, sig);
  addEventListener("gamepaddisconnected", padsOn, sig);
  try {
    if ([...(navigator.getGamepads?.() ?? [])].some((g) => g && g.connected)) PADS.poll = 1;
  } catch {}
  const spin = () => ((spinTo = engine.time + (matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 2.4)), engine.busy(2.5), engine.wake());

  // ---- the cards ----
  const owns = (k: Part, i: number) => profile.owned.includes(`${k}:${i}`);
  const head = () => `<header class="cs-bar"><b class="cs-logo">CITY<i>SMASH</i></b><span class="cs-chip">${esc(monOf())}</span><span class="cs-chip">BEST ${num(profile.best)}</span><span class="cs-chip">CITIES ${profile.cleared.length}/${NCITY}</span></header>`;
  /** v15: what each level means, under its picker. */
  const LEVEL_SAY = ["Easy: slower rivals that mostly smash, a small army, snacks heal more.", "Medium: rivals pick fights now and then, the army grows city by city.", "Hard: rivals as quick as you and out for you, the full army."];
  function menuCard() {
    const can = startable(profile);
    const cities = CITIES.map((c, i) => {
      const open = can.includes(i), done = profile.cleared.includes(c.id);
      return `<li><button type="button" class="bui-key cs-cityk${i === start ? " cs-on" : ""}" data-start="${i}" aria-pressed="${i === start}"${open ? "" : " disabled"}><small>${i + 1} · ${TOD[c.tod]}</small><b>${esc(c.name)}</b><span>${open ? esc(c.featureName) : "LOCKED"}${done ? " · ★" : ""}</span></button></li>`;
    }).join("");
    // One person a device (keys and mouse, or touch); each connected gamepad adds a player (the panel shows only then).
    // Each pad shows a monster nobody else on this screen plays.
    for (let i = 0, used = [profile.mon]; i < PADS.n; i++) {
      const q = pads[i]!;
      for (let t = 0; t < 4 && used.includes(q.mon); t++) q.mon = (q.mon + 1) % 4;
      used.push(q.mon);
    }
    const padRows = pads.slice(0, PADS.n).map((q, i) => `<li class="${q.on ? "cs-in" : ""}" style="--seat:${SEAT_C[i + 1]}"><i>P${i + 2}</i><b>GAMEPAD ${i + 1}</b><button type="button" class="bui-key cs-padmon" data-padmon="${i}" aria-label="Gamepad ${i + 1} plays ${esc(monName(q.mon, profile.look))}: change">${esc(monName(q.mon, profile.look))} ▸</button><small>${q.on ? "READY · stick move · A jump · X punch · B grab · LB/RB aim" : "Press any button to join"}</small></li>`).join("");
    const who = PADS.n ? `<section class="cs-pads" aria-label="Players on this screen"><p class="cs-sub">PLAYERS ON THIS SCREEN</p><p class="cs-explain">Same screen: you, plus one player for each gamepad. Nobody joined on a pad: ${profile.rivals ? "the computer plays that monster." : "it sits out."}</p><ol class="cs-who"><li class="cs-in" style="--seat:${SEAT_C[0]}"><i>P1</i><b>${esc(monOf())}</b><small>READY · Keys: WASD move · Space jump · J punch · K grab · Q/E aim · or mouse/tap</small></li>${padRows}</ol></section>` : "";
    return `<section class="cs-screen cs-menu" aria-label="CitySmash">${head()}<div class="cs-mbody"><div class="cs-story"><h2>Climb it. Smash it. Eat the snacks.</h2><p>You are a giant cyber ape. Jump at a building's side and hang on: your inside arm grips, your outside arm smashes the windows by your climb. Three hits a window. Enough holes and the whole thing pancakes. Seven cities, day into night. Beat a rival monster and it is yours to play.</p><div class="cs-actions"><button type="button" class="bui-key bui-go cs-big" data-play>▶ SMASH ${esc(CITIES[start]!.name)}</button><button type="button" class="bui-key" data-practice>PRACTICE</button><button type="button" class="bui-key" data-go="garage">GARAGE</button><button type="button" class="bui-key cs-friends" data-go="online"><b>PLAY WITH FRIENDS</b><small>ONLINE · EACH ON THEIR OWN DEVICE</small></button></div><p class="cs-sizes"><button type="button" class="bui-key cs-riv" data-rivals aria-pressed="${!!profile.rivals}">CPU RIVALS: ${profile.rivals ? "ON" : "OFF"}</button></p><p class="cs-explain">Computer rivals: the monsters nobody picked join as AI.</p><p class="cs-sizes cs-levels" role="group" aria-label="Difficulty">${LEVELS.map((l, i) => `<button type="button" class="bui-key" data-level="${i}" aria-pressed="${profile.level === i}">${l}</button>`).join("")}</p><p class="cs-explain">${LEVEL_SAY[profile.level]}</p>${CONTROLS}${who}${note ? `<p class="cs-note">${esc(note)}</p>` : ""}</div><ol class="cs-cities" aria-label="Start from">${cities}</ol></div></section>`;
  }
  function garageCard() {
    const lk = profile.look, mon = profile.mon;
    if (mon === 0 ? tab === "rc" || tab === "rt" : tab !== "code" && tab !== "rc" && tab !== "rt") tab = mon ? "rc" : "fur";
    // Your monster: the ape always; a rival once you have beaten it in a one-player run (a silhouette till then).
    const mons = [0, 1, 2, 3].map((k) => {
      const own = owns("mon", k), c = k ? RIVAL_C[k - 1]! : [FURS[lk.fur]!.c, TRIMS[lk.trim]!.c];
      return `<li><button type="button" class="bui-key cs-opt cs-sw cs-monk${own ? "" : " cs-sil"}" data-mon="${k}" aria-pressed="${mon === k}"${own ? "" : ` data-locked aria-label="${RIVALS[k - 1]}, locked: beat it in a city to unlock"`} style="--c:${own ? c[0] : "#0b0a14"};--t:${own ? c[1] : "#4a4466"}"><i></i><span>${k ? RIVALS[k - 1] : "THE APE"}</span>${own ? "" : "<small>🔒 Beat it in a city to unlock</small>"}</button></li>`;
    }).join("");
    let side = "";
    if (tab === "code") side = `<div class="cs-code"><label for="cs-code">Your save code: copy it to move your monsters to another device.</label><textarea id="cs-code" rows="4" readonly>${exportCode(profile)}</textarea><label for="cs-in">Paste a code to load it:</label><textarea id="cs-in" rows="3"></textarea><button type="button" class="bui-key" data-import>LOAD CODE</button></div>`;
    else if (tab === "rc" || tab === "rt") {
      // A rival's colour (its own, or a fur you own) and its trim (its own, or a neon you own).
      const j = tab === "rt" ? 1 : 0, P = j ? TRIMS : FURS, cur = profile.rlook[(mon - 1) * 2 + j]!, k = j ? "trim" : "fur";
      side = `<ul class="cs-opts cs-${k}">${[-1, ...P.map((_, i) => i)].map((i) => {
        const own = i < 0 || owns(k, i), sw = i < 0 ? RIVAL_C[mon - 1]![j]! : P[i]!.c, name = i < 0 ? "ITS OWN" : P[i]!.name.toUpperCase(), by = unlockedBy(`${k}:${i}`);
        return `<li><button type="button" class="bui-key cs-opt cs-sw" data-rpart="${j}" data-i="${i}" aria-pressed="${cur === i}"${own ? "" : ` data-locked aria-label="${esc(name)}: flatten ${esc(CITIES[by]?.name ?? "")} to unlock"`} style="--c:${sw}"><i></i><span>${esc(name)}</span>${own ? "" : `<small>🔒 ${esc(CITIES[by]?.name ?? "")}</small>`}</button></li>`;
      }).join("")}</ul>`;
    } else {
      const [k, , n] = TABS.find((t) => t[0] === tab)!;
      const list = (k: Part, n: number) => `<ul class="cs-opts cs-${k}">${Array.from({ length: n }, (_, i) => {
        const own = owns(k, i), on = k === "gear" ? (lk.gear & (1 << i)) > 0 : lk[k as "fur"] === i, by = unlockedBy(`${k}:${i}`);
        const sw = k === "fur" ? FURS[i]!.c : k === "trim" || k === "hairc" ? TRIMS[i]!.c : "";
        const name = k === "fur" ? FURS[i]!.name : k === "trim" || k === "hairc" ? TRIMS[i]!.name : k === "pattern" ? PATTERNS[i]!.name : k === "face" ? FACES[i]!.name : k === "hair" ? HAIRS[i]!.name : GEAR[i]!.name;
        return `<li><button type="button" class="bui-key cs-opt${sw ? " cs-sw" : ""}" data-part="${k}" data-i="${i}" aria-pressed="${on}"${own ? "" : ` data-locked aria-label="${esc(name)}: flatten ${esc(CITIES[by]?.name ?? "")} to unlock"`}${sw ? ` style="--c:${sw}"` : ""}>${sw ? `<i></i><span>${esc(name.toUpperCase())}</span>` : esc(name.toUpperCase())}${own ? "" : `<small>🔒 ${esc(CITIES[by]?.name ?? "")}</small>`}</button></li>`;
      }).join("")}</ul>`;
      // The hair tab: the style, then one colour for it (the neon palette).
      side = list(k, n) + (k === "hair" ? `<p class="cs-sub">HAIR COLOUR</p>${list("hairc", TRIMS.length)}` : "");
    }
    const tabs: [Tab, string][] = mon ? [["rc", "COLOUR"], ["rt", "TRIM"]] : TABS.map(([k, l]) => [k, l]);
    return `<section class="cs-screen cs-garage" aria-label="Garage">${head()}<div class="cs-gbody"><div class="cs-gview"><div class="cs-pvwrap"></div><b class="cs-mname">${esc(monOf())}</b></div><div class="cs-gside"><p class="cs-sub">YOUR MONSTER · BEAT THEM TO PLAY THEM</p><ul class="cs-opts cs-mons" aria-label="Your monster">${mons}</ul><p class="cs-gtabs" role="group" aria-label="Garage tabs">${tabs.map(([k, label]) => `<button type="button" class="bui-key" data-tab="${k}" aria-pressed="${tab === k}">${label}</button>`).join("")}<button type="button" class="bui-key" data-tab="code" aria-pressed="${tab === "code"}">SAVE CODE</button></p>${side}${note ? `<p class="cs-note">${esc(note)}</p>` : ""}<p class="cs-actions"><button type="button" class="bui-key" data-go="menu">◂ BACK</button>${mon ? "" : `<button type="button" class="bui-key" data-random>RANDOM</button>`}<button type="button" class="bui-key bui-go" data-play>▶ SMASH</button></p></div></div></section>`;
  }
  function onlineCard() {
    return `<section class="cs-screen cs-online" aria-label="Online" data-step="pick">${head()}<div class="cs-obody"><h2>Play together online.</h2><p class="cs-sub">UP TO FOUR SCREENS · ONE RUN · THE HOST IS THE APE, THE OTHERS TAKE THE RIVALS</p>`
      + `<form class="cs-pick" data-for="pick" novalidate><label class="cs-field">INVITE CODE<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" placeholder="SMASH-XXXX-XXXX" /></label><p class="cs-hostjoin"><button type="submit" class="bui-key bui-go" value="host"><b>HOST</b><small>OPEN A ROOM, SEND THE LINK</small></button><button type="submit" class="bui-key" value="join"><b>JOIN</b><small>A ROOM SOMEONE OPENED</small></button></p><p class="cs-say" role="alert"></p></form>`
      + `<div data-for="host" hidden><p class="cs-big2">HOW MANY PLAYERS?</p><p class="cs-sizes" role="group" aria-label="Players">${[2, 3, 4].map((n) => `<button type="button" class="bui-key" data-size="${n}">${n}</button>`).join("")}</p></div>`
      + `<form data-for="join" hidden novalidate><p class="cs-big2">WHICH ROOM?</p><p class="cs-rooms"><button type="button" class="bui-key" data-room="-1" aria-label="Previous room">−</button><output name="roomShow" aria-live="polite">${net.room}</output><button type="button" class="bui-key" data-room="1" aria-label="Next room">+</button></p><p class="cs-sub">The room number is on the host's screen (and in their link).</p><p class="cs-row"><button type="submit" class="bui-key bui-go">JOIN ROOM</button></p><p class="cs-say" role="alert"></p></form>`
      + `<div data-for="wait" hidden><p class="cs-ticket"><span><small>ROOM</small><b class="cs-t-room">0</b></span><span><small>CODE</small><b class="cs-t-code"></b></span></p><ol class="cs-seats" aria-label="Seats"></ol><p class="cs-big2 cs-wait-say" aria-live="polite">Waiting for players.</p><p class="cs-row"><button type="button" class="bui-key bui-go cs-share">SEND LINK</button><button type="button" class="bui-key cs-gonow" hidden>START NOW</button><button type="button" class="bui-key cs-cancel">CANCEL</button></p></div>`
      + `<div data-for="gone" hidden><p class="cs-big2 cs-gone-say"></p><p class="cs-row"><button type="button" class="bui-key bui-go cs-again2">TRY AGAIN</button></p></div>`
      + `<p class="cs-actions"><button type="button" class="bui-key" data-go="menu">◂ BACK</button></p></div></section>`;
  }
  function paint() {
    cards.hidden = screen === "play";
    sceneEl.hidden = screen !== "play";
    if (screen === "play") return void (cards.innerHTML = "");
    cards.innerHTML = screen === "menu" ? menuCard() : screen === "garage" ? garageCard() : onlineCard();
    if (screen === "garage") {
      cards.querySelector(".cs-pvwrap")!.append(pv);
      pvKey = "";
      requestAnimationFrame(preview);
    }
    if (screen === "online") {
      roomStep(net.step);
      if (!ROOMS_URL) roomSay("Online play needs a room server: this build has none set.");
    }
    engine.wake();
  }

  // ---- the run ----
  function playRun(from: number, n = players, practice = false) {
    netEnd();
    scene?.destroy();
    sceneEl.textContent = "";
    screen = "play";
    note = "";
    paint();
    // The cast: slot 0 is yours (the monster you play); a joined gamepad i drives slot i + 1, in the monster it picked;
    // the rest in roster order (the ape first among them when you play a rival). `n` (the tests) seats players 2…n.
    const drivers = [0, AI, AI, AI], taken = [profile.mon, -1, -1, -1];
    for (let s = 1; s < NM; s++) if (!o.attract && !practice && (pads[s - 1]!.on || s < n)) (drivers[s] = s), !taken.includes(pads[s - 1]!.mon) && (taken[s] = pads[s - 1]!.mon);
    const kinds = taken.slice();
    for (let s = 1; s < NM; s++) if (kinds[s]! < 0) kinds[s] = cast(profile.mon, kinds.filter((k) => k >= 0)).find((k) => !kinds.includes(k))!;
    const mon = o.attract ? 0 : profile.mon;
    scene = mountScene(sceneEl, {
      look: profile.look, seed: (o.seed ?? 1) * 7919 + profile.stats.runs * 31 + 20261116, first: from, rivals: profile.rivals, level: profile.level, drivers, theme: pageTheme, sound: o.sound, attract: o.attract, practice,
      kinds: o.attract ? undefined : kinds, dress: mon ? rivalDress(mon, profile.rlook) : null,
      beat: (k) => {
        // Beaten in a one-player run: that rival is yours to play.
        if (o.attract || !scene || scene.run.humans() > 1) return "";
        const r = beat(profile, k);
        if (!r.fresh) return "";
        profile = r.profile;
        keep();
        return `${RIVALS[k - 1]} UNLOCKED! PLAY IT FROM THE GARAGE`;
      },
      unlocks: (ci) => {
        const t = cityUnlocks[ci];
        return t && t.length ? `UNLOCKED: ${t.map(partName).join(" · ")}` : "";
      },
      on: onScene,
    });
    if (o.attract) scene.auto = true;
    say(o.attract ? "" : practice ? "Practice: nothing hurts here. Tick off the steps; the menu key leaves." : `${CITIES[from]!.name}: walk or punch to start`);
    return scene;
  }
  const cityUnlocks: string[][] = [];
  function onScene(what: "clear" | "end" | "menu" | "join", v: number) {
    if (o.attract) return;
    // Practice never touches the score, the progress or the unlocks.
    if (scene?.practice && what !== "menu") return;
    if (what === "clear") {
      const r = clearCity(profile, v);
      profile = r.profile;
      cityUnlocks[v] = r.fresh;
      keep();
      if (r.fresh.length) say(`${CITIES[v]!.name} is flat. Unlocked: ${r.fresh.map(partName).join(", ")}`);
    } else if (what === "end" && scene) {
      const S = scene.run.S;
      let flat = 0;
      for (let k = 0; k < NM; k++) if (scene.run.MV[k]![28] !== AI) flat += scene.run.MV[k]![36]!;
      profile = endRun(profile, S[2]!, { buildings: flat, snacks: S[6]!, helis: S[5]! });
      keep();
    } else if (what === "menu") {
      if (net.link) netEnd();
      show("menu");
    }
  }
  function show(s: Screen) {
    if (s !== "play") {
      if (s !== "online") netEnd();
      scene?.destroy();
      scene = null;
      sceneEl.textContent = "";
    }
    screen = s;
    paint();
  }

  // ---- online ----
  const net = {
    step: "pick" as "pick" | "host" | "join" | "wait" | "gone",
    room: Math.min(ROOM_N - 1, Math.max(0, Number(qs.get("room")) | 0)),
    code: "",
    size: SEATS,
    seat: 0,
    players: 2,
    link: null as Rollback | null,
    abort: null as AbortController | null,
    go: null as (() => void) | null,
    look: 0,
  };
  const NIN = new Float64Array(SEATS * NI), MYIN = new Float64Array(SEATS * NI);
  function netEnd() {
    net.abort?.abort();
    net.abort = null;
    net.go = null;
    try {
      net.link?.destroy();
    } catch {}
    net.link = null;
  }
  const $o = <T extends HTMLElement>(s: string) => cards.querySelector(s) as T;
  function roomStep(s: typeof net.step) {
    net.step = s;
    const sec = cards.querySelector(".cs-online") as HTMLElement | null;
    if (!sec) return;
    sec.dataset.step = s;
    for (const el of sec.querySelectorAll<HTMLElement>("[data-for]")) el.hidden = el.dataset.for !== s;
  }
  const roomSay = (t: string) => cards.querySelectorAll(".cs-say").forEach((el) => (el.textContent = t));
  async function checkCode(code: string): Promise<{ ok: boolean; players: number } | "slow" | null> {
    const r = await fetch(`${ROOMS_URL.replace(/^ws/, "http")}/invite`, { method: "POST", body: code, referrerPolicy: "no-referrer" }).catch(() => null);
    if (!r) return null;
    if (r.status === 429) return "slow";
    const j = await r.json().catch(() => ({ ok: false }));
    return { ok: !!j.ok, players: Math.max(2, Math.min(SEATS, Number(j.players) || SEATS)) };
  }
  async function pickGo(how: string) {
    if (!ROOMS_URL) return roomSay("Online play needs a room server: this build has none set.");
    const code = (cards.querySelector('[name="code"]') as HTMLInputElement | null)?.value.trim().toUpperCase() || net.code;
    if (code.length < 6) return roomSay("Enter the invite code you were sent.");
    roomSay("Checking the code…");
    const ok = await checkCode(code);
    if (ok === null) return roomSay("Can't reach the game server. Check your connection and try again.");
    if (ok === "slow") return roomSay("Too many tries. Wait a minute, then try again.");
    if (!ok.ok) return roomSay("That invite code isn't on the list.");
    roomSay("");
    net.code = code;
    net.size = ok.players;
    if (how === "join") return roomStep("join");
    for (const b of cards.querySelectorAll<HTMLButtonElement>("[data-size]")) b.hidden = Number(b.dataset.size) > net.size;
    roomStep("host");
  }
  function paintSeats(seat: number, seated: number, n: number) {
    let h = "";
    for (let i = 0; i < n; i++) h += `<li class="${i === seat ? "cs-me" : i < seated ? "cs-in" : ""}" style="--seat:${SEAT_C[i]}"><i></i><b>${i === 0 ? "THE APE" : RIVALS[i - 1]}</b><small>${i === seat ? (seat === 0 ? "YOU · HOST" : "YOU") : i < seated ? (i === 0 ? "HOST" : "IN") : "OPEN"}</small></li>`;
    $o(".cs-seats").innerHTML = h;
  }
  async function enterRoom(host: boolean, wantN: number) {
    roomStep("wait");
    $o(".cs-t-code").textContent = net.code;
    $o(".cs-wait-say").textContent = host ? "Opening a room…" : `Joining room ${net.room}…`;
    $o(".cs-gonow").hidden = true;
    net.abort = new AbortController();
    const signal = net.abort.signal, mine = packMode(start, profile.rivals, profile.level);
    for (let tries = 0; ; tries++) {
      if (!cards.querySelector(".cs-t-room")) return;
      $o(".cs-t-room").textContent = "" + net.room;
      const one = new AbortController(), stop = () => one.abort();
      signal.addEventListener("abort", stop, { once: true });
      let busy = false;
      try {
        const s = await joinRoom(ROOMS_URL, net.room, net.size, net.code, {
          want: wantN, mode: mine, signal: one.signal,
          lobby(seat, seated, n, go) {
            if (host && seat !== 0) return void ((busy = true), one.abort());
            net.go = seat === 0 ? go : null;
            if (!cards.querySelector(".cs-seats")) return;
            paintSeats(seat, seated, seat === 0 ? Math.min(n, wantN) : n);
            const left = Math.max(0, (seat === 0 ? wantN : n) - seated);
            $o(".cs-wait-say").textContent = seat === 0 ? (left ? `Room ${net.room}: waiting for ${left} more…` : "Starting…") : "You're in. The host starts the run.";
            $o(".cs-gonow").hidden = !(seat === 0 && seated > 1 && left > 0);
          },
        });
        signal.removeEventListener("abort", stop);
        if (signal.aborted) return s.transport.close();
        net.abort = null;
        return begin(s);
      } catch {
        signal.removeEventListener("abort", stop);
        if (signal.aborted) return;
        net.go = null;
        if (host && tries < ROOM_N) {
          net.room = (net.room + 1) % ROOM_N;
          if (!busy) await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        if (tries >= 2) return roomStep("gone"), ($o(".cs-gone-say").textContent = host ? "Every room is busy right now. Try again in a minute." : `Room ${net.room} is full, mid-run or closed. Check the number with the host.`);
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }
  /** The match starts on this seat: the same run on every screen, stepped through the rollback. */
  function begin(s: { transport: Transport; slot: number; players: number; seed: number; mode: number }) {
    const m = unpackMode(s.mode);
    net.seat = s.slot;
    net.players = Math.max(2, Math.min(SEATS, s.players));
    net.look = 0;
    scene?.destroy();
    sceneEl.textContent = "";
    screen = "play";
    paint();
    const drivers = [0, AI, AI, AI];
    for (let k = 1; k < net.players; k++) drivers[k] = k;
    scene = mountScene(sceneEl, { look: net.seat === 0 ? profile.look : { fur: 0, trim: 0, pattern: 0, face: 0, gear: 0, hair: 0, hairc: 0 }, seed: s.seed >>> 0, first: m.first, rivals: m.rivals, level: m.level, drivers, theme: pageTheme, sound: o.sound, net: { seat: net.seat }, on: onScene });
    const sc = scene, me = net.seat;
    net.link = rollback(sc.engine, {
      transport: s.transport, slot: me, players: net.players, gone: GONE, bytes: sc.run.bytes,
      input: (f) => {
        sc.readSeats(MYIN);
        return encode(MYIN, 0, me === 0 ? lookBits(profile.look, f) : 0);
      },
      step: (inputs, f, liveRun) => {
        NIN.fill(0);
        for (let p = 0; p < net.players; p++) {
          const b = inputs[p]!;
          // A seat that left: its monster goes back to the AI (on every screen, the same frame).
          if (b & B_GONE) {
            if (sc.run.MV[p]![28] !== AI && p > 0) sc.run.join(p, AI);
            continue;
          }
          decode(b, p, NIN);
        }
        sc.stepNet(NIN, liveRun);
        void f;
      },
      confirm: (inputs, f) => {
        if (f < LOOK_FRAMES) {
          net.look = takeLook(net.look, inputs[0]!, f);
          if (f === LOOK_FRAMES - 1 && me !== 0) sc.setLook(lookOf(net.look));
        }
      },
    });
    say(`Online, room ${net.room}: you are ${me === 0 ? "the ape" : RIVALS[me - 1]}`);
  }

  // ---- clicks on the cards ----
  cards.addEventListener("click", (e) => {
    const b = (e.target as Element).closest?.("button") as HTMLButtonElement | null;
    if (!b) return;
    const d = b.dataset;
    if ("play" in d) return void playRun(start);
    if ("practice" in d) return void playRun(0, 1, true);
    if (d.mon) {
      const k = +d.mon;
      if ("locked" in d) return (note = `${RIVALS[k - 1]} is locked: beat it in a city (playing alone) to unlock it.`), paint();
      profile = setMon(profile, k);
      (note = ""), keep(), paint(), spin();
      return void (cards.querySelector(`[data-mon="${k}"]`) as HTMLElement | null)?.focus();
    }
    if (d.rpart) {
      const j = +d.rpart, i = +d.i!;
      if ("locked" in d) return (note = `Locked: flatten ${CITIES[unlockedBy(`${j ? "trim" : "fur"}:${i}`)]?.name ?? "a city"} to unlock it.`), paint();
      profile = setRival(profile, profile.mon, j, i);
      (note = ""), keep(), paint(), spin();
      return void (cards.querySelector(`[data-rpart="${j}"][data-i="${i}"]`) as HTMLElement | null)?.focus();
    }
    if (d.padmon) {
      // A gamepad's monster: the next one nobody else on this screen plays (all four are open on one screen).
      const q = pads[+d.padmon]!, used = [profile.mon, ...pads.filter((x) => x !== q && x.on).map((x) => x.mon)];
      for (let t = 1; t <= 4; t++) if (!used.includes((q.mon + t) % 4)) return (q.mon = (q.mon + t) % 4), paint(), void (cards.querySelector(`[data-padmon="${d.padmon}"]`) as HTMLElement | null)?.focus();
      return;
    }
    if (d.go) return (note = ""), show(d.go as Screen);
    if (d.start) return (start = +d.start), paint();
    if ("rivals" in d) return (profile = { ...profile, rivals: profile.rivals ? 0 : 1 }), keep(), paint();
    if (d.level) return (profile = { ...profile, level: +d.level }), keep(), paint(), void (cards.querySelector(`[data-level="${d.level}"]`) as HTMLElement | null)?.focus();
    if (d.tab) return (tab = d.tab as Tab), (note = ""), paint();
    if (d.part) {
      const k = d.part as Part, i = +d.i!;
      if ("locked" in d) {
        note = `Locked: flatten ${CITIES[unlockedBy(`${k}:${i}`)]?.name ?? "a city"} to unlock ${partName(`${k}:${i}`)}.`;
        return paint();
      }
      profile = setPart(profile, k, i);
      note = "";
      keep();
      paint();
      spin();
      return void (cards.querySelector(`[data-part="${k}"][data-i="${i}"]`) as HTMLElement | null)?.focus();
    }
    if ("random" in d) {
      const r = engine.random, pickOwned = (k: Part, n: number) => { const ok = Array.from({ length: n }, (_, i) => i).filter((i) => owns(k, i)); return ok[(r() * ok.length) | 0]!; };
      let gear = 0;
      for (let g = 0; g < GEAR.length; g++) if (owns("gear", g) && r() < 0.5) gear |= 1 << g;
      profile = { ...profile, look: { fur: pickOwned("fur", FURS.length), trim: pickOwned("trim", TRIMS.length), pattern: pickOwned("pattern", PATTERNS.length), face: pickOwned("face", FACES.length), gear, hair: pickOwned("hair", HAIRS.length), hairc: pickOwned("hairc", TRIMS.length) } };
      keep();
      paint();
      return spin();
    }
    if ("import" in d) {
      const p = importCode((cards.querySelector("#cs-in") as HTMLTextAreaElement).value);
      note = p ? "Profile loaded." : "That code does not read: check it was copied whole.";
      if (p) (profile = p), (start = Math.max(...startable(profile))), keep(), (pvKey = "");
      return paint();
    }
    if (d.size) return void ((net.room = (Math.random() * ROOM_N) | 0), enterRoom(true, +d.size));
    if (d.room) {
      net.room = (net.room + Number(d.room) + ROOM_N) % ROOM_N;
      return void ((cards.querySelector('[name="roomShow"]') as HTMLOutputElement).value = String(net.room));
    }
    if (b.classList.contains("cs-cancel")) return void (net.abort?.abort(), (net.go = null), roomStep("pick"));
    if (b.classList.contains("cs-gonow")) return void net.go?.();
    if (b.classList.contains("cs-again2")) return void roomStep("pick");
    if (b.classList.contains("cs-share")) {
      const url = `${location.origin}${location.pathname}?mode=online&room=${net.room}${qs.get("rooms") ? `&rooms=${encodeURIComponent(ROOMS_URL)}` : ""}&code=${encodeURIComponent(net.code)}`;
      void (navigator.share ? navigator.share({ title: "CitySmash · online", text: `Smash a city with me: room ${net.room}.`, url }).catch(() => {}) : navigator.clipboard?.writeText(url).then(() => ($o(".cs-wait-say").textContent = "Link copied: send it.")).catch(() => {}));
    }
  }, sig);
  cards.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement, sub = (e as SubmitEvent).submitter as HTMLButtonElement | null;
    if (f.dataset.for === "pick") void pickGo(sub?.value === "join" ? "join" : "host");
    else if (f.dataset.for === "join") void enterRoom(false, net.size);
  }, sig);

  engine.start();
  if (o.attract) playRun(0, 1);
  else if (qs.get("mode") === "practice") playRun(0, 1, true);
  else {
    paint();
    // A link with a room and a code drops the player straight into that room.
    const code = qs.get("code");
    if (qs.get("mode") === "online" && code && ROOMS_URL) {
      net.code = code.toUpperCase();
      show("online");
      void checkCode(net.code).then((ok) => {
        if (ok && ok !== "slow" && ok.ok) (net.size = ok.players), void enterRoom(false, net.size);
      });
    }
  }
  return {
    engine,
    get scene() {
      return scene;
    },
    get profile() {
      return profile;
    },
    get net() {
      return net.link;
    },
    getSnapshot: () => ({ screen, start, players, mon: profile.mon, owned: profile.owned.filter((t) => t.startsWith("mon:")), best: profile.best, cleared: profile.cleared.slice(), look: { ...profile.look }, scene: scene ? scene.state : null, online: net.link ? { seat: net.seat, players: net.players, frame: net.link.frame, final: net.link.final, desync: net.link.desync } : null }),
    play: (from = start, n = players) => playRun(from, n),
    /** Play monster k (as the garage's pick: refused while locked). */
    setMon: (k: number) => ((profile = setMon(profile, k)), keep(), screen !== "play" && paint(), profile.mon),
    /** The gamepads on this screen (the menu's panel): joined, and each one's monster. */
    pads,
    /** Practice: the controls without the danger. */
    practice: () => playRun(0, 1, true),
    show,
    /** Set a garage part (as a click would). */
    setPart: (k: Part, i: number) => ((profile = setPart(profile, k, i)), keep(), screen === "garage" && paint(), profile.look),
    exportCode: () => exportCode(profile),
    /** The garage's turntable (tests turn it and check the rig's depth order): its diorama, its rig, a turn. */
    garage: { dio: pdio, rig: () => tt.rig, turn: (t: number) => ((turn = t), (spinTo = 0), preview()) },
    destroy: () => engine.destroy(),
  };
}
export type CitySmash = ReturnType<typeof createCitySmash>;
void [shade, RIVAL_WHAT, DONE];
