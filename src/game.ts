// CitySmash, the shell: the title (play from any city you have reached, the players on this screen,
// rivals on or off), the garage (the ape on a live turntable: fur, trim, pattern, face, gear, the parts
// each city unlocks, the save code), the run (./scene.ts) and online rooms (./net.ts: host or join with
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
import { buildMonster, heroName, shade, FURS, TRIMS, PATTERNS, FACES, GEAR, RIVALS, RIVAL_WHAT, type Look, type RigInk } from "./monster.ts";
import { AI, NM, DONE } from "./round.ts";
import { load, save, local, fresh, clearCity, startable, endRun, setPart, partName, unlockedBy, exportCode, importCode, type Profile, type Store, type Part } from "./profile.ts";
import { encode, decode, NI, packMode, unpackMode, joinRoom, rollback, lookBits, takeLook, lookOf, GONE, B_GONE, SEATS, LOOK_FRAMES, type Rollback } from "./net.ts";

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
const TABS: [Part, string, number][] = [["fur", "FUR", FURS.length], ["trim", "TRIM", TRIMS.length], ["pattern", "PATTERN", PATTERNS.length], ["face", "FACE", FACES.length], ["gear", "GEAR", GEAR.length]];
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
  let screen: Screen = "menu", scene: Scene | null = null, start = 0, players = 1, tab: Part | "code" = "fur", note = "";
  start = Math.max(...startable(profile));

  // ---- the garage turntable: the ape on a plinth, drawn on change; it turns a while after each change, and drags round ----
  const pv = document.createElement("canvas");
  pv.className = "cs-preview";
  pv.setAttribute("aria-hidden", "true");
  const pdio = diorama(pv, { light: [-0.4, 1, 0.7], ambient: 0.56, background: () => (pageTheme() === "dark" ? "#161236" : "#efe8ff") });
  const PM = new Float64Array(40);
  PM[6] = 1; PM[7] = 100; PM[24] = 1;
  let pvKey = "", pvMon: ReturnType<typeof buildMonster> | null = null, turn = -0.5, spinTo = 0;
  function preview() {
    if (!pv.isConnected) return;
    const r = pv.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (w < 10 || h < 10) return;
    const key = JSON.stringify([w, h, profile.look, pageTheme()]);
    if (key !== pvKey) {
      pvKey = key;
      pdio.resize(w, h, Math.min(2, devicePixelRatio || 1));
      pdio.clear();
      const night = pageTheme() === "dark";
      pdio.add({ shape: "cyl", sides: 10, size: [5.4, 0.3, 5.4], pos: [0, -0.3, 0], color: night ? "#2a2552" : "#d8ccf4", pick: false });
      pdio.add({ shape: "cyl", sides: 10, size: [5.6, 0.08, 5.6], pos: [0, -0.36, 0], color: night ? "#22e6ff" : "#ff4fa8", emissive: night, pick: false });
      const ink: RigInk = night ? { ink: "#0b0a14", eye: "#fff6c9", pupil: "#0b0a14", teeth: "#f6f3ff", night: true, metal: "#9aa3c8" } : { ink: "#1b1420", eye: "#ffffff", pupil: "#1b1420", teeth: "#ffffff", night: false, metal: "#b8bfd8" };
      pvMon = buildMonster(pdio, 0, profile.look, ink, "pv");
      Object.assign(pdio.cam, { yaw: 0, pitch: 0.14, dist: 14, tx: 0, ty: 2.3, tz: 0, ox: 0, oy: 0, fov: 0.5 });
    }
    if (pvMon) {
      pvMon.pose(PM, engine.time, 1, turn);
      pdio.draw();
    }
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
    },
  });
  const spin = () => ((spinTo = engine.time + (matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 2.4)), engine.busy(2.5), engine.wake());

  // ---- the cards ----
  const owns = (k: Part, i: number) => profile.owned.includes(`${k}:${i}`);
  const head = () => `<header class="cs-bar"><b class="cs-logo">CITY<i>SMASH</i></b><span class="cs-chip">${esc(heroName(profile.look.fur, profile.look.face))}</span><span class="cs-chip">BEST ${num(profile.best)}</span><span class="cs-chip">CITIES ${profile.cleared.length}/${NCITY}</span></header>`;
  function menuCard() {
    const can = startable(profile);
    const cities = CITIES.map((c, i) => {
      const open = can.includes(i), done = profile.cleared.includes(c.id);
      return `<li><button type="button" class="bui-key cs-cityk${i === start ? " cs-on" : ""}" data-start="${i}" aria-pressed="${i === start}"${open ? "" : " disabled"}><small>${i + 1} · ${TOD[c.tod]}</small><b>${esc(c.name)}</b><span>${open ? esc(c.featureName) : "LOCKED"}${done ? " · ★" : ""}</span></button></li>`;
    }).join("");
    const who = [0, 1, 2, 3].map((s) => `<li class="${s < players ? "cs-in" : ""}" style="--seat:${SEAT_C[s]}"><i>P${s + 1}</i><b>${s === 0 ? esc(heroName(profile.look.fur, profile.look.face)) : RIVALS[s - 1]}</b><small>${s === 0 ? "WASD · SPACE · K · L" : s === 1 ? "ARROWS · , . /" : "GAMEPAD " + (s + 1)}</small></li>`).join("");
    return `<section class="cs-screen cs-menu" aria-label="CitySmash">${head()}<div class="cs-mbody"><div class="cs-story"><h2>Climb it. Smash it. Eat the snacks.</h2><p>You are a giant cyber ape. Jump at a building's side and hang on: your inside arm grips, your outside arm smashes the windows by your climb. Three hits a window. Enough holes and the whole thing pancakes. Seven cities, day into night.</p><div class="cs-actions"><button type="button" class="bui-key bui-go cs-big" data-play>▶ SMASH ${esc(CITIES[start]!.name)}</button><button type="button" class="bui-key" data-go="garage">GARAGE</button><button type="button" class="bui-key" data-go="online">ONLINE</button></div><p class="cs-sub">PLAYERS ON THIS SCREEN</p><p class="cs-sizes" role="group" aria-label="Players on this screen">${[1, 2, 3, 4].map((n) => `<button type="button" class="bui-key" data-players="${n}" aria-pressed="${n === players}">${n}P</button>`).join("")}<button type="button" class="bui-key cs-riv" data-rivals aria-pressed="${!!profile.rivals}">RIVALS ${profile.rivals ? "ON" : "OFF"}</button></p><ol class="cs-who">${who}</ol>${note ? `<p class="cs-note">${esc(note)}</p>` : ""}</div><ol class="cs-cities" aria-label="Start from">${cities}</ol></div></section>`;
  }
  function garageCard() {
    const lk = profile.look;
    let side = "";
    if (tab === "code") side = `<div class="cs-code"><label for="cs-code">Your save code: copy it to move this ape to another device.</label><textarea id="cs-code" rows="4" readonly>${exportCode(profile)}</textarea><label for="cs-in">Paste a code to load it:</label><textarea id="cs-in" rows="3"></textarea><button type="button" class="bui-key" data-import>LOAD CODE</button></div>`;
    else {
      const [k, , n] = TABS.find((t) => t[0] === tab)!;
      const items = Array.from({ length: n }, (_, i) => {
        const own = owns(k, i), on = k === "gear" ? (lk.gear & (1 << i)) > 0 : lk[k] === i, by = unlockedBy(`${k}:${i}`);
        const sw = k === "fur" ? FURS[i]!.c : k === "trim" ? TRIMS[i]!.c : "";
        const name = k === "fur" ? FURS[i]!.name : k === "trim" ? TRIMS[i]!.name : k === "pattern" ? PATTERNS[i]!.name : k === "face" ? FACES[i]!.name : GEAR[i]!.name;
        return `<li><button type="button" class="bui-key cs-opt${sw ? " cs-sw" : ""}" data-part="${k}" data-i="${i}" aria-pressed="${on}"${own ? "" : ` data-locked aria-label="${esc(name)}: flatten ${esc(CITIES[by]?.name ?? "")} to unlock"`}${sw ? ` style="--c:${sw}"` : ""}>${sw ? `<i></i><span>${esc(name.toUpperCase())}</span>` : esc(name.toUpperCase())}${own ? "" : `<small>🔒 ${esc(CITIES[by]?.name ?? "")}</small>`}</button></li>`;
      }).join("");
      side = `<ul class="cs-opts cs-${k}">${items}</ul>`;
    }
    return `<section class="cs-screen cs-garage" aria-label="Garage">${head()}<div class="cs-gbody"><div class="cs-gview"><div class="cs-pvwrap"></div><b class="cs-mname">${esc(heroName(lk.fur, lk.face))}</b></div><div class="cs-gside"><p class="cs-gtabs" role="group" aria-label="Garage tabs">${TABS.map(([k, label]) => `<button type="button" class="bui-key" data-tab="${k}" aria-pressed="${tab === k}">${label}</button>`).join("")}<button type="button" class="bui-key" data-tab="code" aria-pressed="${tab === "code"}">SAVE CODE</button></p>${side}${note ? `<p class="cs-note">${esc(note)}</p>` : ""}<p class="cs-actions"><button type="button" class="bui-key" data-go="menu">◂ BACK</button><button type="button" class="bui-key" data-random>RANDOM</button><button type="button" class="bui-key bui-go" data-play>▶ SMASH</button></p></div></div></section>`;
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
  function playRun(from: number, n = players) {
    netEnd();
    scene?.destroy();
    sceneEl.textContent = "";
    screen = "play";
    note = "";
    paint();
    const drivers = [0, AI, AI, AI];
    for (let s = 1; s < n && s < NM; s++) drivers[s] = s;
    scene = mountScene(sceneEl, {
      look: profile.look, seed: (o.seed ?? 1) * 7919 + profile.stats.runs * 31 + 20261116, first: from, rivals: profile.rivals, drivers, theme: pageTheme, sound: o.sound, attract: o.attract,
      unlocks: (ci) => {
        const t = cityUnlocks[ci];
        return t && t.length ? `UNLOCKED: ${t.map(partName).join(" · ")}` : "";
      },
      on: onScene,
    });
    if (o.attract) scene.auto = true;
    say(o.attract ? "" : `${CITIES[from]!.name}: walk or punch to start`);
    return scene;
  }
  const cityUnlocks: string[][] = [];
  function onScene(what: "clear" | "end" | "menu" | "join", v: number) {
    if (o.attract) return;
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
    const signal = net.abort.signal, mine = packMode(start, profile.rivals);
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
    scene = mountScene(sceneEl, { look: net.seat === 0 ? profile.look : { fur: 0, trim: 0, pattern: 0, face: 0, gear: 0 }, seed: s.seed >>> 0, first: m.first, rivals: m.rivals, drivers, theme: pageTheme, sound: o.sound, net: { seat: net.seat }, on: onScene });
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
    if (d.go) return (note = ""), show(d.go as Screen);
    if (d.start) return (start = +d.start), paint();
    if (d.players) return (players = +d.players), (note = players > 2 ? "Players three and four play on gamepads (a press joins)." : ""), paint();
    if ("rivals" in d) return (profile = { ...profile, rivals: profile.rivals ? 0 : 1 }), keep(), paint();
    if (d.tab) return (tab = d.tab as Part | "code"), (note = ""), paint();
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
      profile = { ...profile, look: { fur: pickOwned("fur", FURS.length), trim: pickOwned("trim", TRIMS.length), pattern: pickOwned("pattern", PATTERNS.length), face: pickOwned("face", FACES.length), gear } };
      keep();
      paint();
      return spin();
    }
    if ("import" in d) {
      const p = importCode((cards.querySelector("#cs-in") as HTMLTextAreaElement).value);
      note = p ? "Profile loaded." : "That code does not read: check it was copied whole.";
      if (p) (profile = p), (start = Math.max(...startable(profile))), keep();
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
    getSnapshot: () => ({ screen, start, players, best: profile.best, cleared: profile.cleared.slice(), look: { ...profile.look }, scene: scene ? scene.state : null, online: net.link ? { seat: net.seat, players: net.players, frame: net.link.frame, final: net.link.final, desync: net.link.desync } : null }),
    play: (from = start, n = players) => playRun(from, n),
    show,
    /** Set a garage part (as a click would). */
    setPart: (k: Part, i: number) => ((profile = setPart(profile, k, i)), keep(), screen === "garage" && paint(), profile.look),
    exportCode: () => exportCode(profile),
    /** The garage's turntable (tests turn it and check the rig's depth order): its diorama, its rig, a turn. */
    garage: { dio: pdio, rig: () => pvMon, turn: (t: number) => ((turn = t), (spinTo = 0), preview()) },
    destroy: () => engine.destroy(),
  };
}
export type CitySmash = ReturnType<typeof createCitySmash>;
void [shade, RIVAL_WHAT, DONE];
