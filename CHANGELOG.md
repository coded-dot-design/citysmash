# Changelog

## Unreleased

- The wall pose, mounted (owner feedback): the monster climbs the building's front corner, chest pressed to it and its back three quarters to the camera. The far arm and far leg wrap round onto the side wall and are drawn behind the building, so only their tips show; the near leg clamps the corner; the near arm is the free one and smashes across the front face, the fist landing in the very window the round hits (down, level or up), in front of the facade. Climbing is a shimmy: the far arm reaches up, the hips push in, the body pulls up, the legs follow. The head turns to the windows. Same for the three rivals and on both edges. Measured per monster and checked on both edges at 1440 and 390 (`tests/pose.mjs`: chest to the wall, body on the corner, far hand and foot round the side, far arm mostly hidden, near foot on the corner, fist in the window).
- People at the windows: office workers with ties, ladies with bags, kids in caps, chefs; faces that scream when a monster is near, arms that wave or go up. Snipers and soldiers: helmets, uniforms, rifles, an aim. Comic, no gore.
- Damage: holes are big jagged dark bites across the window frames (a rim of bare wall, an inner shadow, the floor slab and rebar inside) that merge with the holes beside them into gashes; crisp cracks branch out over the wall; bits and dust fall from the edges. The rules are unchanged (three hits a window, one target, fixed timing, no drift).

## 0.1.0

- First cut of the full game, grown from the Fizlet gallery daily DOM Kaiju (#124): the same climb-and-smash rules (the inside arm grips and climbs, the outside arm smashes the window by the climb: middle, up or down; three hits a window, a chip, a crack, a hole; one target, fixed timing, no drift), the same tabletop look and camera.
- Seven original cities in a run, day into dusk into night, each with its own skyline kit, a landmark and one feature: Port Lumen (a gunboat on the harbour), Coilworth (a freight train across the street), Brightfield (live floodlights and a crowd), Voltmoor (power surges), Twin Span (trucks on the bridge deck), Glowgate (the neon strip) and Skyreach (two helicopters). The score carries from city to city; the army grows (more soldiers, armour on the tank, faster helicopters).
- The hero ape and three rival giants of our own: SHARDCLAW (a crystal crab-beast), GLOOPMAW (a tentacle blob), VOLTWING (a storm moth).
- Garage: twelve furs, five patterns, five faces, eight pieces of gear, eight neon trims on a live turntable; cities unlock parts; one profile saved on the device (versioned) with a `CS1-` save code.
- One to four players on one screen (keyboard halves and gamepads) and online rooms (rollback over fizlet-rooms, invite codes, the host is the ape); a shared score and one each.
- The daily's climb and damage pass (fizlet 777505d8) synced in: on a wall the monster faces it, the inside arm grips the corner, the feet plant with bent knees, a punch leans out; every hit shows a growing scar, spreading cracks, dents, facade bits that stay as rubble, a lean towards the damage; a punch flash, a camera nudge and (on one screen) a 3-frame hit-stop.
- Site: landing page with the game as the hero, /play/.
