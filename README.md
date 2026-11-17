# CitySmash

A giant cyber ape climbs and smashes his way across seven tabletop cities, day into night. A game by [Chris Cooley](https://coded.design/), built on [Fizlet](https://fizlet.com/). Play at <https://citysmash.domvirus.com>.

## The game

- **Climb and smash.** Jump at a building's side wall: the jump grabs it. He climbs the side wall, set back behind the front corner, so the windows in reach stay in view. Hanging there, your inside arm grips and climbs; your outside arm smashes the window you tap or click, if it is in reach: three windows in on your floor (close, mid, far: a jab, a hook, a full swing), two in on the floors above and below; only the building you hold, never past the third window in, so the far side means climbing its other edge. Out of reach, he swings at air and loses a moment. Three hits a window: a chip, a crack, a hole. Enough holes and the building shakes, then pancakes floor by floor. Live power boxes, neon signs and roof antennas shock you off the wall. People at the windows are snacks, and one rule says what he can grab on the wall: if he can punch a window, he can grab what's in it (the 7 punch windows of the building he holds, plus 8 spaces off the building: the gap, the air, up and down his own column; off a wall, the 12 spaces round him). Tap one to eat it, health back; soldiers, parachutes and food too, and a helicopter right next to him gets swatted. The tapped target lights until the action lands: green, a punch; teal, a grab; out of reach it flashes red with TOO FAR. Quick, accurate taps chain a combo (×1 → ×1.25 → ×1.5 → ×1.6, shown by the score): the wind-up and the recovery run faster; a whiff or a 0.6 s pause drops it (the AI rivals only reach ×1.25). Soldiers, snipers, helicopters and tanks fight back; out of health, a monster shrinks to a tiny figure and runs off the table.
- **Seven cities** in a run, each with its own skyline, a landmark and a feature: Port Lumen (the harbour: a gunboat), Coilworth (the rail yard: a freight train), Brightfield (the stadium: live floodlights, a crowd), Voltmoor (the power plant: surges), Twin Span (the bridge: trucks), Glowgate (the neon strip) and Skyreach (the skyport: two helicopters). Day, then dusk, then night; the score carries over; a city ends when it is flat; the army grows city by city.
- **Garage.** Your monster on a live turntable. The ape: fur, pattern, face, hair (a mohawk, spikes or a crest, in a neon colour), gear (a cyber arm on the smashing arm, a visor, a chest plate, tail spikes and more) and a neon trim. A rival you have beaten: its colour and trim. Every city you flatten unlocks parts. One profile, saved on this device (version 3; older saves and `CS1-…` codes load with only the ape playable), plus a save code to move it.
- **Practice.** PRACTICE on the start menu (or `?mode=practice`): nothing hurts, no army, buildings come back, and a card ticks off each move (seven dots for the seven punches). It never touches your profile.
- **Rivals and friends.** SHARDCLAW (a crystal crab-beast), GLOOPMAW (a tentacle blob) and VOLTWING (a storm moth) wreck the same cities. **Beat them to play them:** knock a rival out in a city, playing alone, and it is yours: pick it in the garage (the ape is always yours), in its own colours or a fur colour and neon trim you own; play it and the ape joins the computer rivals. CPU RIVALS: ON/OFF on the start menu (the monsters nobody picked join as AI). One person a device: to play together, PLAY WITH FRIENDS (online: the host opens a room and sends the link; the host is the ape, friends take the rivals). On one screen, extra players come only with gamepads: each connected pad shows a slot on the start menu (press any button to join, pick its monster: all four are open there). A shared score and one each; you can still punch each other off the walls.

Phone: the stick moves and climbs, JUMP jumps, tap to smash and grab. Computer: A/D walk · W/S climb · Space or K jumps · click to smash and grab · M mutes · Escape for the menu. Without a pointer (keys only, gamepads, players two to four): J punches the window by the hand (W or S held: up or down; a flick of the stick in or out steps it close, mid, far; past holes it goes further in), L grabs the nearest snack. The arrows walk and climb too. The reach and grab tables are one const each (`src/round.ts` `REACH`, `GRAB_WALL` (the 7 reach cells first, then the off-building cells), `GRAB`, `GRAB_HELI`; the combo ladder `COMBO`); the landing page draws its diagram from them.

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
npm run test:browser   # start, the garage, click and tap to smash (in reach, out of reach), eat, a building falls, city 2, 2P, the phone pad, full height at 390; the wall pose per reach cell and the reach kept clear of the monster; the rigs' depth order (turntable, street, wall); depth against the city (no neighbour or side wall over the ape on a wall, every city, both edges, the camera off to each side; the street's points behind or in front by where they are); practice; online rooms
npm run site:build && npm run test:site
```

Source: `src/block.ts` (the destructible buildings), `src/climber.ts` (the wall climber), `src/round.ts` (the run, headless: monsters, army, features, cities), `src/cities.ts` (the seven cities), `src/monster.ts` (the rigs), `src/fx.ts` (the particle kit), `src/paint.ts` (the people, the soldiers, the cracks and holes), `src/scene.ts` (a city on screen), `src/profile.ts` (the save), `src/net.ts` and `src/rollback.ts` (online), `src/game.ts` (title, garage, rooms).

MIT © Chris Cooley.
