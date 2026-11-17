// CitySmash: a giant cyber ape climbs and smashes his way across seven tabletop cities, day into
// night. Built on Fizlet, by Chris Cooley.
//   createCitySmash({ host })                 mount in an element (the play page)
//   createCitySmash({ host, attract: true })  the landing hero: the ape on the autopilot
//   createCitySmash()                         a layer over the whole page; destroy() gives it back
export { createCitySmash, type CitySmash, type CitySmashOptions } from "./game.ts";
export { CITIES } from "./cities.ts";
// The landing page's monster cards: the garage's turntable (already in the bundle) and the ape's default look.
export { turntable } from "./turntable.ts";
export { LOOK0 } from "./monster.ts";
