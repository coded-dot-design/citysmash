// dist/citysmash.mjs (module) and dist/citysmash.js (one script for any page, global citysmash):
// the game, the Fizlet bricks it uses (@fzlt/core, bundled: no runtime dependencies), the Board UI
// kit's CSS, and the shop kit the garage is built on (vendor/shop/: its pieces and its CSS).
import { build, transform } from "esbuild";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { pickCss } from "../vendor/shop/shop-css.mjs";

const require = createRequire(import.meta.url);
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const core = JSON.parse(readFileSync(require.resolve("@fzlt/core/package.json"), "utf8")).version;
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
const css = async (file) => (await transform(readFileSync(file, "utf8"), { loader: "css", minify: true })).code.trim();
const kit = await css(require.resolve("@fzlt/core/ui/board-ui.css"));
const base = {
  bundle: true, minify: true, target: "es2022", legalComments: "none", logLevel: "warning",
  banner: { js: `/* CitySmash ${version} · © Chris Cooley, all rights reserved · built on Fizlet ${core} */` },
};
// The shop kit's stylesheet, only the part the game uses: a first build without the styles says which of the
// kit's classes the bundle still writes (the bundler has dropped the kit pieces nothing imports); pickCss keeps
// the rules for those, in the sheet's own order.
const probe = await build({ ...base, define: { __KIT_CSS__: '""', __GAME_CSS__: '""' }, entryPoints: ["src/index.ts"], format: "esm", write: false });
const shop = pickCss(readFileSync("vendor/shop/shop.css", "utf8"), probe.outputFiles[0].text + readFileSync("src/store.css", "utf8"));
const min = async (text) => (await transform(text, { loader: "css", minify: true })).code.trim();
const game = (await css("src/game.css")) + (await min(shop)) + (await css("src/store.css"));
const common = { ...base, define: { __KIT_CSS__: JSON.stringify(kit), __GAME_CSS__: JSON.stringify(game) } };
await build({ ...common, entryPoints: ["src/index.ts"], format: "esm", outfile: "dist/citysmash.mjs" });
await build({ ...common, entryPoints: ["src/index.ts"], format: "iife", globalName: "citysmash", outfile: "dist/citysmash.js" });
const size = (f) => gzipSync(readFileSync(f)).length;
writeFileSync("dist/build.json", JSON.stringify({ version, fizlet: core, gzip: { "citysmash.mjs": size("dist/citysmash.mjs"), "citysmash.js": size("dist/citysmash.js") } }, null, 2) + "\n");
console.log(`Built CitySmash ${version} on @fzlt/core ${core}: dist/citysmash.mjs, dist/citysmash.js`);
