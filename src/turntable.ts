// A monster on a plinth, on a canvas of its own: the garage's turntable and the landing page's monster
// cards share it. It rebuilds only when the monster, its dress, the canvas size or the theme change; a
// draw poses it (at rest, turned by `turn`) and paints. Posing allocates nothing.
import { diorama } from "@fzlt/core/diorama";
import { buildMonster, type Look, type RigInk } from "./monster.ts";

export function turntable(cv: HTMLCanvasElement, theme: () => "dark" | "light") {
  const dio = diorama(cv, { light: [-0.4, 1, 0.7], ambient: 0.56, background: () => (theme() === "dark" ? "#161236" : "#efe8ff") });
  // A pose at rest: facing +x, full health, in play.
  const PM = new Float64Array(48);
  PM[6] = 1; PM[7] = 100; PM[24] = 1;
  let key = "", rig: ReturnType<typeof buildMonster> | null = null;
  return {
    dio,
    get rig() {
      return rig;
    },
    /** Rebuild on the next draw (the canvas resized). */
    invalidate() {
      key = "";
    },
    /** Draw monster `kind` (0 the ape, dressed by `look`; a rival in `dress` or its own), turned by `turn`. */
    draw(kind: number, look: Look, dress: (string | undefined)[] | null, turn: number, time: number) {
      const r = cv.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
      if (w < 10 || h < 10) return false;
      const night = theme() === "dark", k = JSON.stringify([w, h, kind, look, dress, night]);
      if (k !== key) {
        key = k;
        dio.resize(w, h, Math.min(2, devicePixelRatio || 1));
        dio.clear();
        // The plinth draws first (under the monster at every turn: the depth sort would put it over the far leg).
        dio.cluster("pl", { fixed: 0 });
        dio.add({ shape: "cyl", sides: 10, size: [5.4, 0.3, 5.4], pos: [0, -0.3, 0], color: night ? "#2a2552" : "#d8ccf4", pick: false, cluster: "pl" });
        dio.add({ shape: "cyl", sides: 10, size: [5.6, 0.08, 5.6], pos: [0, -0.36, 0], color: night ? "#22e6ff" : "#ff4fa8", emissive: night, pick: false, cluster: "pl" });
        const ink: RigInk = night ? { ink: "#0b0a14", eye: "#fff6c9", pupil: "#0b0a14", teeth: "#f6f3ff", night: true, metal: "#9aa3c8" } : { ink: "#1b1420", eye: "#ffffff", pupil: "#1b1420", teeth: "#ffffff", night: false, metal: "#b8bfd8" };
        rig = buildMonster(dio, kind, look, ink, "pv", dress);
        Object.assign(dio.cam, { yaw: 0, pitch: 0.14, dist: 14, tx: 0, ty: 2.3, tz: 0, ox: 0, oy: 0, fov: 0.5 });
      }
      rig!.pose(PM, time, 1, turn);
      dio.draw();
      return true;
    },
  };
}
