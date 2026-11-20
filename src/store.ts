// The garage as a store, on the shop kit (../vendor/shop/, the one HOLESHOT's garage is built on): the
// monster on its turntable (the kit's frame, ‹ › through the monsters you own), your monsters as one
// rail, the ape's parts (or a rival's colour and trim) as tabs of the kit's item cards with its price tags, the save code. Every item
// and every rule is the game's own (./monster.ts, ./profile.ts): CitySmash has no currency, so a part's
// price is the city you flatten to unlock it (a rival's: beating it), and that price stays on its card
// once it is yours. A card is one key: press it to wear the part; the worn one is ringed in the go
// colour; a gear bit you wear also has a quiet remove key in its corner. Strings in, a string out:
// ./game.ts paints it and owns the clicks.
import { btn, card, cardGrid, cornerPop, esc, heading, icon, itemCard, keyTile, num, pill, stages, swatch, tabs, turntable } from "../vendor/shop/shop.js";
import { CITIES, NCITY } from "./cities.ts";
import { monName, FURS, TRIMS, PATTERNS, FACES, GEAR, HAIRS, RIVALS, RIVAL_C } from "./monster.ts";
import { exportCode, unlockedBy, type Part, type Profile } from "./profile.ts";

export type Tab = Part | "code" | "rc" | "rt";
/** The ape's tabs: the part, its label, how many there are, its icon (the kit's set). */
const TABS: [Part, string, number, string][] = [["fur", "FUR", FURS.length, "paint"], ["trim", "TRIM", TRIMS.length, "graphics"], ["pattern", "PATTERN", PATTERNS.length, "pattern"], ["face", "FACE", FACES.length, "visor"], ["hair", "HAIR", HAIRS.length, "feather"], ["gear", "GEAR", GEAR.length, "helmet"]];
/** A rival's tabs: its colour and its trim. */
const RIVAL_TABS: [Tab, string, string][] = [["rc", "COLOUR", "paint"], ["rt", "TRIM", "graphics"]];
const ICON_OF: Record<string, string> = { pattern: "pattern", face: "visor", hair: "feather", gear: "helmet" };

/** The tab that shows for monster `mon`: the ape has its parts, a rival its colour and trim; the save code is both's. */
export const tabFor = (mon: number, tab: Tab): Tab => ((mon === 0 ? tab === "rc" || tab === "rt" : tab !== "code" && tab !== "rc" && tab !== "rt") ? (mon ? "rc" : "fur") : tab);
/** The monsters you own, in roster order (the turntable's ‹ › step through them). */
export const ownedMons = (p: Profile) => [0, 1, 2, 3].filter((k) => p.owned.includes("mon:" + k));

/** A part's price, always on its card: the city that unlocks it (locked: a lock; yours: a tick), or STARTER. */
const cost = (word: string, own: boolean) => `<small class="cs-cost"${own ? "" : " data-locked"}>${icon(own ? "check" : "lock")}${esc(word)}</small>`;
const cityOf = (tag: string) => CITIES[unlockedBy(tag)]?.name ?? "";
/** One card: the whole card is the key. */
function tile(o: { attrs: string; name: string; art: string; cost: string; own: boolean; on: boolean; label?: string; cls?: string; corner?: string }) {
  return `<div class="cs-cell" role="listitem">${keyTile({ body: `${o.art}<b>${esc(o.name)}</b>${o.cost}`, attrs: o.attrs + (o.own ? "" : " data-locked"), label: o.own ? undefined : o.label, down: o.on, pick: o.on, pressed: o.on, cls: "cs-tile" + (o.cls ? " " + o.cls : "") })}${o.corner ?? ""}</div>`;
}
/** A part's card (the kit's itemCard: one key, ringed in the go colour when worn) with its price tag: the city
 *  that unlocks it under a lock, and the same city (or STARTER) once it is yours, worn or not. */
const part = (o: { attrs: string; name: string; art: string; word: string; own: boolean; on: boolean; corner?: string }) =>
  itemCard({ name: o.name, art: o.art, on: o.on, attrs: o.attrs, locked: !o.own, label: o.own ? undefined : `${o.name}: flatten ${o.word} to unlock`, price: { state: o.own ? (o.on ? "equipped" : "owned") : "locked", words: { owned: o.word, equipped: o.word, locked: o.word } } }) + (o.corner ?? "");

/** The garage screen for profile `p` on `tab`, with `note` (why a press was refused, or a code's result). */
export function storeCard(p: Profile, tab: Tab, note: string): string {
  const lk = p.look, mon = p.mon, owns = (k: Part, i: number) => p.owned.includes(`${k}:${i}`);
  // Your monsters: the ape always; a rival once you have beaten it in a one-player run (a silhouette till then).
  const mons = [0, 1, 2, 3].map((k) => {
    const own = owns("mon", k), c = k ? RIVAL_C[k - 1]! : [FURS[lk.fur]!.c, TRIMS[lk.trim]!.c], name = k ? RIVALS[k - 1]! : "THE APE";
    return tile({ attrs: `data-mon="${k}"`, name, art: swatch(own ? c[0]! : "#0b0a14", own ? c[1]! : "#4a4466"), cost: cost(k ? (own ? "BEATEN" : "BEAT IT") : "STARTER", own), own, on: mon === k, label: `${name}, locked: beat it in a city to unlock`, cls: own ? "" : "cs-sil" });
  });
  /** The ape's parts of one kind. */
  const parts = (k: Part, n: number) => cardGrid(Array.from({ length: n }, (_, i) => {
    const tag = `${k}:${i}`, own = owns(k, i), on = k === "gear" ? (lk.gear & (1 << i)) > 0 : lk[k as "fur"] === i;
    const sw = k === "fur" ? FURS[i]!.c : k === "trim" || k === "hairc" ? TRIMS[i]!.c : "";
    const name = (k === "fur" ? FURS[i]!.name : k === "trim" || k === "hairc" ? TRIMS[i]!.name : k === "pattern" ? PATTERNS[i]!.name : k === "face" ? FACES[i]!.name : k === "hair" ? HAIRS[i]!.name : GEAR[i]!.name).toUpperCase();
    return part({
      attrs: `data-part="${k}" data-i="${i}"`, name, art: sw ? swatch(sw) : icon(ICON_OF[k] ?? "paint"), word: cityOf(tag) || "STARTER", own, on,
      // Gear is worn bit by bit: a worn bit has its remove key in the card's corner (the card itself takes it off too).
      corner: k === "gear" && on ? cornerPop({ label: `Remove ${name}`, attrs: `data-part="gear" data-i="${i}" data-off`, glyph: "×", small: true }) : "",
    });
  }), k === "hairc" ? "Hair colour" : k, { min: 118 });
  let side: string;
  if (tab === "code") side = card(`<div class="cs-code"><label for="cs-code">Your save code: copy it to move your monsters to another device.</label><textarea id="cs-code" rows="4" readonly>${exportCode(p)}</textarea><label for="cs-in">Paste a code to load it:</label><textarea id="cs-in" rows="3"></textarea>${btn("LOAD CODE", "data-import")}</div>`);
  else if (tab === "rc" || tab === "rt") {
    // A rival's colour (its own, or a fur you own) and its trim (its own, or a neon you own).
    const j = tab === "rt" ? 1 : 0, P = j ? TRIMS : FURS, cur = p.rlook[(mon - 1) * 2 + j]!, k = j ? "trim" : "fur";
    side = cardGrid([-1, ...P.map((_, i) => i)].map((i) => {
      const own = i < 0 || owns(k, i), name = i < 0 ? "ITS OWN" : P[i]!.name.toUpperCase();
      return part({ attrs: `data-rpart="${j}" data-i="${i}"`, name, art: swatch(i < 0 ? RIVAL_C[mon - 1]![j]! : P[i]!.c), word: (i < 0 ? "" : cityOf(`${k}:${i}`)) || "STARTER", own, on: cur === i });
    }), j ? "Trim" : "Colour", { min: 118 });
  } else {
    const [k, , n] = TABS.find((t) => t[0] === tab)!;
    // The hair tab: the style, then one colour for it (the neon palette).
    side = parts(k, n) + (k === "hair" ? heading("HAIR COLOUR", undefined, 3) + parts("hairc", TRIMS.length) : "");
  }
  const name = monName(mon, lk), done = p.cleared.length;
  return `<section class="cs-garage" aria-label="Garage">`
    + `<header class="cs-sbar"><div>${btn("Back", 'data-go="menu"', undefined, "", "back")}<h2 class="shop-h3">GARAGE</h2></div>`
    + `<p class="cs-prog">${stages(done, NCITY, false, "City")}<small class="shop-meta"><span>CITIES </span>${done}/${NCITY} · BEST ${num(p.best)}</small></p>`
    + `<div>${btn("Save code", 'data-tab="code"', tab === "code", "cs-codek", "log")}${btn("▶ SMASH", "data-play", undefined, "shop-btn-go")}</div></header>`
    + `<div class="cs-gbody"><div class="cs-gview">${turntable('<div class="cs-pvwrap"></div>', "data-turn", "monster", ownedMons(p).length > 1, pill(name, "plain", "cs-mname"))}<div class="cs-grid cs-rail" role="list" aria-label="Your monsters">${mons.join("")}</div></div>`
    + `<div class="cs-gside">${tabs(mon ? RIVAL_TABS : TABS.map(([k, l, , ic]) => [k, l, ic] as const), tab, "tab", "Garage tabs")}<div class="cs-panel">${side}</div>`
    + `<p class="cs-foot">${note ? `<span class="cs-note" role="status">${esc(note)}</span>` : ""}${mon ? "" : btn("Random", "data-random")}</p></div></div></section>`;
}
