// The size of every build, gzip, against the budget. Board games have no fixed cap (the size ledger
// tracks them); this budget is the first measured build plus room, raised only with a measured reason.
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
// 0.1.0: the first measured build (see dist/build.json) plus about 10% room. Raised to 82,000 for the reach
// (tap targeting, the reach and grab tables, seven punch motions, the outline): 76,839 → 80,019 B (CHANGELOG).
// Raised to 84,000 for v9 (the depth twins for the street's points, the grab-on-the-wall table, the pick highlight and
// TOO FAR, the combo): 81,914 → 83,412 B (CHANGELOG). Raised to 86,000 for v10 (the playable rivals: the cast per
// slot, the unlock, the rival's garage, the gamepad join panel, the turntable export for the landing page's monster
// cards): 83,412 → 85,325 B (CHANGELOG). Raised to 88,000 for v11 (the grab from the facing hand: the turn for
// something behind, the front fan, the bottom floor from the street, the reach outline only where it helps, the
// pop and TOO FAR's hint and arrow; the ledge lips): citysmash.mjs 85,170 → 86,659 B, citysmash.js 85,409 → 86,873 B (CHANGELOG).
// Raised to 90,000 for v12 (the fight: the power punch at a rival and its haymaker pose on its own clock, the pounce
// and the stun, the AI's moves and their tells, the fight's health bars, stars and pops, practice's sparring dummy, the
// wall's grab outline on landing): citysmash.mjs 86,659 → 89,662 B, citysmash.js 86,873 → 89,888 B (CHANGELOG).
// Raised to 92,000 for v14 (keyboard play: the aim on a wall and its keys, the pads' LB/RB, the leap across the gap and
// the double-tap let-go, their pops, the controls card, two practice steps): citysmash.mjs 89,662 → 91,117 B,
// citysmash.js 89,888 → 91,354 B (CHANGELOG).
// Raised to 94,000 for v15 (EASY / MEDIUM / HARD: the level's table, the rivals' reaction, rests, taunts and turn beat,
// the menu's picker and the HUD chip, the profile's level and its migration, the level in the room's mode):
// citysmash.mjs 91,117 → 92,078 B, citysmash.js 91,354 → 92,304 B (CHANGELOG).
// Raised to 106,000 for the garage as a store on the shop kit (vendor/shop/ 0.2.0, the kit HOLESHOT's garage is built
// on): citysmash.mjs 92,947 → 104,604 B, citysmash.js 93,161 → 104,813 B. Of the 11,657 B: the kit's stylesheet, which
// ships whole (43,435 B minified, 8,218 B gzip on its own), the kit pieces the store uses (6,318 B minified) and the
// store's own layout (src/store.css, 1,544 B gzip on its own), less the hand-built garage they replace.
// Lowered to 101,000 with kit 0.3.0: the build now ships only the kit rules whose classes the bundle writes
// (vendor/shop/shop-css.mjs pickCss, scripts/build.mjs): citysmash.mjs 104,908 → 99,217 B, citysmash.js 105,120 → 99,435 B.
const BUDGET = 101_000;
let failed = false;
for (const file of readdirSync("dist").filter((f) => /\.m?js$/.test(f)).sort().map((f) => `dist/${f}`)) {
  const gz = gzipSync(readFileSync(file)).length, ok = gz <= BUDGET;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${file} ${gz.toLocaleString("en-US")} / ${BUDGET.toLocaleString("en-US")} bytes gzip`);
}
if (failed) process.exit(1);
