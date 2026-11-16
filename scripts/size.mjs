// The size of every build, gzip, against the budget. Board games have no fixed cap (the size ledger
// tracks them); this budget is the first measured build plus room, raised only with a measured reason.
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
// 0.1.0: the first measured build (see dist/build.json) plus about 10% room. Raised to 82,000 for the reach
// (tap targeting, the reach and grab tables, seven punch motions, the outline): 76,839 → 80,019 B (CHANGELOG).
// Raised to 84,000 for v9 (the depth twins for the street's points, the grab-on-the-wall table, the pick highlight and
// TOO FAR, the combo): 81,914 → 83,412 B (CHANGELOG).
const BUDGET = 84_000;
let failed = false;
for (const file of readdirSync("dist").filter((f) => /\.m?js$/.test(f)).sort().map((f) => `dist/${f}`)) {
  const gz = gzipSync(readFileSync(file)).length, ok = gz <= BUDGET;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${file} ${gz.toLocaleString("en-US")} / ${BUDGET.toLocaleString("en-US")} bytes gzip`);
}
if (failed) process.exit(1);
