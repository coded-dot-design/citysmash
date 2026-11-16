# CitySmash

A giant cyber ape climbs and smashes his way across seven tabletop cities, day into night. A game by [Chris Cooley](https://coded.design/), built on [Fizlet](https://fizlet.com/). Play at <https://citysmash.domvirus.com>.

## The game

- **Climb and smash.** Jump at a building's side wall: the jump grabs it. Hanging there, your inside arm grips and climbs; your outside arm smashes the window next to you (level with you, or the one above or below by the way you just climbed). Three hits a window: a chip, a crack, a hole. Enough holes and the building shakes, then pancakes floor by floor. Live power boxes, neon signs and roof antennas shock you off the wall. People at the windows are snacks (GRAB: health back). Soldiers, snipers, helicopters and tanks fight back; out of health, a monster shrinks to a tiny figure and runs off the table.
- **Seven cities** in a run, each with its own skyline, a landmark and a feature: Port Lumen (the harbour: a gunboat), Coilworth (the rail yard: a freight train), Brightfield (the stadium: live floodlights, a crowd), Voltmoor (the power plant: surges), Twin Span (the bridge: trucks), Glowgate (the neon strip) and Skyreach (the skyport: two helicopters). Day, then dusk, then night; the score carries over; a city ends when it is flat; the army grows city by city.
- **Garage.** Fur, pattern, face, gear (a cyber arm on the smashing arm, a visor, a chest plate, tail spikes and more) and a neon trim, on a live turntable. Every city you flatten unlocks parts. One profile, saved on this device, plus a save code (`CS1-…`) to move it.
- **Rivals and friends.** SHARDCLAW (a crystal crab-beast), GLOOPMAW (a tentacle blob) and VOLTWING (a storm moth) wreck the same cities. One to four players on one screen (WASD and the arrows, gamepads for three and four), or online: the host opens a room and sends the link; the host is the ape, friends take the rivals. A shared score and one each; you can still punch each other off the walls.

Keys: A/D walk · W/S climb · K jumps · Space or J punches (hold W or S: up or down) · L grabs · M mutes · Escape for the menu. Player two: the arrows, `,` punches, `.` jumps, `/` grabs. Phone: a stick on the left; PUNCH, JUMP and GRAB on the right.

## Use it

```js
import { createCitySmash } from "./dist/citysmash.mjs";
const game = createCitySmash({ host: document.getElementById("game"), rooms: "wss://…" });
```

`dist/citysmash.js` is the same as one script (global `citysmash`). No runtime dependencies: the Fizlet bricks it uses are bundled. `game.destroy()` gives the page back exactly as it was.

Online play talks to a fizlet-rooms server (`rooms`, or `?rooms=` on the page; the site's default is in `site/src/site.ts`, `PUBLIC_ROOMS_URL` overrides it at build). The server must allow this site's origin, `https://citysmash.domvirus.com`.

## Develop

```sh
npm ci
npm run check          # typecheck, build dist/, size budget
npm test               # headless: the rules, every city, progression, determinism, the profile, rollback sync, zero allocation
npm run test:settle    # it sleeps when nothing moves
npm run test:browser   # start, the garage, climb and punch, eat, a building falls, city 2, 2P, the phone pad; online rooms
npm run site:build && npm run test:site
```

Source: `src/block.ts` (the destructible buildings), `src/climber.ts` (the wall climber), `src/round.ts` (the run, headless: monsters, army, features, cities), `src/cities.ts` (the seven cities), `src/monster.ts` (the rigs), `src/fx.ts` (the particle kit), `src/scene.ts` (a city on screen), `src/profile.ts` (the save), `src/net.ts` and `src/rollback.ts` (online), `src/game.ts` (title, garage, rooms).

MIT © Chris Cooley.
