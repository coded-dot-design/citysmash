// Build-time only (never shipped to a page): keep the part of shop.css a game uses.
//
//   import { pickCss } from "./vendor/shop/shop-css.mjs";
//   const css = pickCss(readFileSync("vendor/shop/shop.css", "utf8"), builtJs /* the game's bundle, or its source */);
//
// A game's bundler already drops the kit functions it does not import; their class names go with them.
// pickCss keeps a rule only when every `shop-…` class its selector needs is still written in `js`
// (the game's own class hooks, such as "shop-btn-go", count: they are in its source). Rules keep their
// order, so the cascade is the full sheet's. Tokens, @media / @container blocks and the @keyframes a kept
// rule names are kept; a block left empty is dropped. No dependency; plain strings in, a string out.

/** Top-level pieces of a (minified or not) sheet: [{ head, body }] (body null for a statement such as @charset). */
function blocks(css) {
  const out = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    if (css.startsWith("/*", i)) { const e = css.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    if (/\s/.test(css[i])) { i++; continue; }
    let j = i, quote = "";
    for (; j < n; j++) {
      const c = css[j];
      if (quote) { if (c === "\\") j++; else if (c === quote) quote = ""; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === "{" || c === ";") break;
    }
    if (j >= n || css[j] === ";") { out.push({ head: css.slice(i, j).trim(), body: null }); i = j + 1; continue; }
    let depth = 1, k = j + 1;
    for (; k < n && depth; k++) {
      const c = css[k];
      if (quote) { if (c === "\\") k++; else if (c === quote) quote = ""; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    out.push({ head: css.slice(i, j).trim(), body: css.slice(j + 1, k - 1) });
    i = k;
  }
  return out;
}

/** Splits on commas outside brackets. */
function list(sel) {
  const out = [];
  let depth = 0, from = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && !depth) { out.push(sel.slice(from, i)); from = i + 1; }
  }
  out.push(sel.slice(from));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Can anything in the game match this selector? :not() never decides; :is / :where / :has need one branch. */
function alive(sel, used) {
  for (;;) {
    const m = /:(is|where|has|not)\(([^()]*)\)/.exec(sel);
    if (!m) break;
    if (m[1] !== "not" && !list(m[2]).some((s) => alive(s, used))) return false;
    sel = sel.slice(0, m.index) + sel.slice(m.index + m[0].length);
  }
  return (sel.match(/\.shop[\w-]*/g) ?? []).every((c) => used(c.slice(1)));
}

/** Every `shop…` class a sheet styles (a kit test holds each to a place in shop.js). */
export function classesOf(css) {
  return [...new Set(css.match(/\.shop[\w-]*/g) ?? [])].map((c) => c.slice(1)).sort();
}

/**
 * The rules of `css` a game uses. `js`: the game's built bundle (or all of its source) as text.
 * `keep`: extra class names (strings or RegExps) to keep whatever `js` says.
 */
export function pickCss(css, js, { keep = [] } = {}) {
  const kept = (c) => keep.some((k) => (typeof k === "string" ? k === c : k.test(c)));
  // "shop" and "shop-light" are the game's own wrapper classes; h1 to h4 are written as shop-h${level}.
  const used = (c) => c === "shop" || c === "shop-light" || kept(c) || (/^shop-h[1-4]$/.test(c) ? js.includes("shop-h") : js.includes(c));
  const walk = (text) => blocks(text).map((b) => {
    if (b.body === null) return b.head + ";";
    if (/^@(media|container|supports|layer)\b/.test(b.head)) { const inner = walk(b.body); return inner ? `${b.head}{${inner}}` : ""; }
    if (b.head.startsWith("@")) return `${b.head}{${b.body}}`; // @keyframes, @font-face: decided below
    const sels = list(b.head).filter((s) => alive(s, used));
    return sels.length ? `${sels.join(",")}{${b.body}}` : "";
  }).join("");
  let out = walk(css);
  // A @keyframes nobody names any more goes too.
  out = blocks(out).map((b) => {
    const m = /^@keyframes\s+([\w-]+)/.exec(b.head);
    const rest = b.body === null ? b.head + ";" : `${b.head}{${b.body}}`;
    return m && !new RegExp(`animation[^;}]*\\b${m[1]}\\b`).test(out.replace(rest, "")) ? "" : rest;
  }).join("");
  return out + "\n";
}
