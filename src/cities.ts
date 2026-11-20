// CitySmash's cities: seven tabletop blocks of our own, played in order across a run, day into dusk
// into night. Each has its own skyline kit (wall colours, window cut, roof furniture, the far skyline's
// shape), one landmark building with its own crown, and one feature the round plays (./block.ts):
// a harbour with a gunboat, a rail yard with a freight train across the street, a stadium with live
// floodlights and a crowd, a power plant that surges, a bridge with trucks across it, a neon strip
// wired end to end, and a skyport with two helicopters up at once. Difficulty grows city by city
// (more soldiers, armour on the tank, faster helicopters). Clearing a city unlocks garage parts.

/** Features (one per city). */
export const HARBOUR = 0, RAIL = 1, STADIUM = 2, PLANT = 3, BRIDGE = 4, NEON = 5, SKYPORT = 6;
/** Time of day. */
export const DAY = 0, DUSK = 1, NIGHT = 2;
/** Roof furniture: a water tank, a live antenna, a dome, a billboard, vents. */
export const R_TANK = 0, R_ANT = 1, R_DOME = 2, R_BOARD = 3, R_VENT = 4;
/** Landmark crowns (./scene.ts builds each). */
export const C_LIGHT = 0, C_CLOCK = 1, C_BOWL = 2, C_COOL = 3, C_PYLON = 4, C_ARCADE = 5, C_SPIRE = 6;

export interface City {
  id: string;
  name: string;
  /** One line for the card and the site. */
  blurb: string;
  feature: number;
  featureName: string;
  /** What the feature does, in a line (the city card, the site). */
  featureText: string;
  tod: number;
  /** The buildings, left to right: [columns, floors]; the landmark among them. */
  b: [number, number][];
  landmark: number;
  landmarkName: string;
  crown: number;
  /** Wall colours (light, pastel; ./scene.ts darkens them for the dark theme), then the landmark's. */
  walls: string[];
  mark: string;
  /** Window cut: width, height (of a one-unit cell). */
  win: [number, number];
  /** Roof furniture, cycled building by building. */
  roofs: number[];
  /** Live parts on the edge windows (power boxes, neon signs). */
  live: number;
  /** The far skyline's shape: 0 blocks, 1 towers, 2 domes and stacks, 3 cranes. */
  far: number;
  /** Sky tint (light theme; the time of day mixes in). */
  sky: string;
  /** The street's tint. */
  street: string;
}

export const CITIES: City[] = [
  {
    id: "port-lumen", name: "PORT LUMEN", blurb: "A sleepy harbour town of pastel warehouses and a lighthouse on the quay.",
    feature: HARBOUR, featureName: "THE HARBOUR", featureText: "A gunboat patrols the water in front of the street and shells you from it. Punch it from the kerb when it comes close.",
    tod: DAY, b: [[4, 5], [5, 6], [3, 8], [4, 4], [4, 6]], landmark: 2, landmarkName: "THE LIGHTHOUSE", crown: C_LIGHT,
    walls: ["#ffd6a5", "#bde0fe", "#ffc8dd", "#caffbf", "#e9d8ff"], mark: "#f6f1e7", win: [0.58, 0.5], roofs: [R_TANK, R_VENT, R_ANT, R_TANK], live: 4, far: 3, sky: "#bfe6ff", street: "#6b7088",
  },
  {
    id: "coilworth", name: "COILWORTH", blurb: "Brick depots and a clock tower over the rail yard, where the freight never stops.",
    feature: RAIL, featureName: "THE RAIL YARD", featureText: "A freight train crosses the street: the bells ring, then it bowls over anything in the way. Punch the engine to derail it.",
    tod: DAY, b: [[5, 5], [4, 7], [3, 9], [5, 6], [4, 5], [3, 6]], landmark: 2, landmarkName: "THE CLOCK TOWER", crown: C_CLOCK,
    walls: ["#f4a98c", "#e8c39e", "#f7b2a0", "#d8b4a0", "#f1cfa8"], mark: "#e9e1d2", win: [0.46, 0.6], roofs: [R_VENT, R_TANK, R_ANT, R_VENT, R_BOARD], live: 5, far: 0, sky: "#cfe8ff", street: "#5f6377",
  },
  {
    id: "brightfield", name: "BRIGHTFIELD", blurb: "A sports town round its bowl: floodlights on every roof, a crowd in every window.",
    feature: STADIUM, featureName: "THE STADIUM", featureText: "Floodlights on every roof are live. The crowd is huge: more snacks at every window.",
    tod: DUSK, b: [[4, 6], [4, 5], [6, 4], [4, 7], [5, 5]], landmark: 2, landmarkName: "THE BOWL", crown: C_BOWL,
    walls: ["#c7f0db", "#ffe5a0", "#a9def9", "#fcd5ce", "#d0f4de"], mark: "#ffffff", win: [0.7, 0.44], roofs: [R_ANT], live: 4, far: 2, sky: "#ffd9b8", street: "#5a6a6e",
  },
  {
    id: "voltmoor", name: "VOLTMOOR", blurb: "Grey blocks in the hum of the power plant, its cooling tower steaming over all of it.",
    feature: PLANT, featureName: "THE POWER PLANT", featureText: "Every few seconds the grid surges: every live part arcs to the wall beside it. Get off the wall when the lights flicker.",
    tod: DUSK, b: [[4, 6], [5, 8], [4, 5], [5, 7], [3, 9], [4, 6]], landmark: 1, landmarkName: "THE COOLING TOWER", crown: C_COOL,
    walls: ["#cdd3e0", "#b8c4d6", "#d9d4e7", "#c2ccd0", "#d6dbe8"], mark: "#e4e8ee", win: [0.52, 0.52], roofs: [R_VENT, R_ANT, R_TANK, R_ANT], live: 9, far: 2, sky: "#f6c7a8", street: "#545a6c",
  },
  {
    id: "twin-span", name: "TWIN SPAN", blurb: "A river town where the main street is the bridge deck, pylons up either end.",
    feature: BRIDGE, featureName: "THE BRIDGE", featureText: "Trucks thunder across the deck both ways and knock you flat. Land on one, or punch it, to stop it.",
    tod: NIGHT, b: [[3, 9], [4, 6], [5, 5], [4, 7], [5, 6], [3, 8]], landmark: 0, landmarkName: "THE NORTH PYLON", crown: C_PYLON,
    walls: ["#b5c7ff", "#c9b8ff", "#a8e6ff", "#ffc2e2", "#b9f3e4"], mark: "#d7dcff", win: [0.6, 0.56], roofs: [R_DOME, R_TANK, R_BOARD, R_ANT], live: 6, far: 1, sky: "#9fb6ff", street: "#4a4f68",
  },
  {
    id: "glowgate", name: "GLOWGATE", blurb: "The neon strip: arcades, diners and signs that never switch off.",
    feature: NEON, featureName: "THE NEON STRIP", featureText: "Signs on every edge and every roof, all of them live. Pick your windows.",
    tod: NIGHT, b: [[4, 5], [5, 7], [4, 6], [6, 5], [4, 8], [4, 6]], landmark: 3, landmarkName: "THE MEGA ARCADE", crown: C_ARCADE,
    walls: ["#ffb3de", "#b3f0ff", "#d8b3ff", "#ffe0a3", "#b3ffd9"], mark: "#fff0fb", win: [0.64, 0.42], roofs: [R_BOARD, R_ANT], live: 12, far: 1, sky: "#c2a8ff", street: "#43405e",
  },
  {
    id: "skyreach", name: "SKYREACH", blurb: "Glass towers round the skyport spire: the army's last stand.",
    feature: SKYPORT, featureName: "THE SKYPORT", featureText: "Two helicopters up at once, faster and angrier. Swat them from the rooftops.",
    tod: NIGHT, b: [[4, 7], [5, 9], [3, 10], [5, 8], [4, 6], [4, 9], [3, 7]], landmark: 2, landmarkName: "THE SKYPORT SPIRE", crown: C_SPIRE,
    walls: ["#a6d8ff", "#c6c9ff", "#9fe8e0", "#d5c2ff", "#b5e3ff"], mark: "#e8f6ff", win: [0.7, 0.66], roofs: [R_ANT, R_DOME, R_VENT, R_TANK], live: 8, far: 1, sky: "#8fa7ff", street: "#3e4560",
  },
];
export const NCITY = CITIES.length;
