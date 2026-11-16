// CitySmash's particle kit: a pool of diorama points with velocity and life (dust, glass, chunks of
// wall, sparks, smoke), from the Fizlet gallery's Bikes series (a brick candidate), and the wreckage
// burst every hole, crash and collapse throws. Scene-side only: it never touches the run's state.
import type { Diorama, DioramaPoints } from "@fzlt/core/diorama";

const TAU = 6.283185307179586;

/** A pool of `cap` points with velocity and life: `puff` adds (the oldest makes room), `step` moves them. */
export function pool(d: Diorama, cap: number, color: string, layer: number) {
  const P: DioramaPoints = d.points({ cap, color, layer }), V = new Float64Array(cap * 5);
  function puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number, a: number) {
    let j = P.n < cap ? P.n++ : -1;
    if (j < 0) {
      let lo = Infinity;
      for (let i = 0; i < cap; i++) if (V[i * 5 + 3]! < lo) (lo = V[i * 5 + 3]!), (j = i);
    }
    P.x[j] = x; P.y[j] = y; P.z[j] = z; P.r[j] = r; P.a[j] = a;
    V[j * 5] = vx; V[j * 5 + 1] = vy; V[j * 5 + 2] = vz; V[j * 5 + 3] = life; V[j * 5 + 4] = life;
  }
  /** Move them dt; `grav` pulls down, `grow` swells them, `a0` is the alpha at birth. True while any live. */
  function step(dt: number, grav: number, grow: number, a0: number, drag = 1.6) {
    let live = 0;
    for (let i = 0; i < P.n; i++) {
      const l = V[i * 5 + 3]!;
      if (l <= 0) continue;
      const nl = l - dt;
      V[i * 5 + 3] = nl;
      V[i * 5 + 1] = V[i * 5 + 1]! - grav * dt;
      P.x[i] = P.x[i]! + V[i * 5]! * dt;
      P.y[i] = P.y[i]! + V[i * 5 + 1]! * dt;
      P.z[i] = P.z[i]! + V[i * 5 + 2]! * dt;
      V[i * 5] = V[i * 5]! * (1 - drag * dt);
      V[i * 5 + 2] = V[i * 5 + 2]! * (1 - drag * dt);
      P.r[i] = P.r[i]! + grow * dt;
      P.a[i] = nl > 0 ? a0 * (nl / V[i * 5 + 4]!) : 0;
      if (nl > 0) live++;
    }
    if (!live) P.n = 0;
    return live > 0;
  }
  /** A ring of `n` puffs at (x, y, z), thrown out at `sp` (a landing, a crash). */
  function ring(rnd: () => number, x: number, y: number, z: number, n: number, sp: number, up: number, life: number, r: number, a: number) {
    for (let k = 0; k < n; k++) {
      const t = rnd() * TAU, u = 0.5 + rnd() * 0.7;
      puff(x + Math.cos(t) * 0.3, y, z + Math.sin(t) * 0.3, Math.cos(t) * sp * u, up * (0.5 + rnd()), Math.sin(t) * sp * u, life * (0.7 + rnd() * 0.6), r, a);
    }
  }
  return { P, puff, step, ring, clear: () => void (P.n = 0) };
}
export type Pool = ReturnType<typeof pool>;

/** The wreckage pools together: glass, chunks of wall, sparks, smoke, dust. */
export function wreckage(d: Diorama, c: { dust: string; smoke: string; chunk: string; shard: string; spark: string }) {
  const dust = pool(d, 160, c.dust, 6), smoke = pool(d, 60, c.smoke, 6), chunk = pool(d, 70, c.chunk, 6), shard = pool(d, 80, c.shard, 6), spark = pool(d, 70, c.spark, 6);
  /** A burst at (x, y, z): glass, chunks of wall in `wall`, sparks and smoke; `big` scales it. */
  function burst(rnd: () => number, x: number, y: number, z: number, big: number, wall: string) {
    chunk.P.colorAll = wall;
    for (let n = 0; n < 8 * big; n++) shard.puff(x + (rnd() - 0.5) * 0.5, y, z, (rnd() - 0.5) * 5, 1 + rnd() * 3.5, 1.5 + rnd() * 3, 0.8, 0.07, 1);
    for (let n = 0; n < 5 * big; n++) chunk.puff(x + (rnd() - 0.5) * 0.4, y, z, (rnd() - 0.5) * 4.5, 1.5 + rnd() * 3, 1 + rnd() * 3, 1, 0.13 + rnd() * 0.1, 1);
    for (let n = 0; n < 7 * big; n++) spark.puff(x, y, z + 0.1, (rnd() - 0.5) * 7, (rnd() - 0.3) * 6, 1 + rnd() * 3, 0.35, 0.05, 1);
    smoke.puff(x, y, z + 0.2, (rnd() - 0.5) * 0.6, 0.8, 0.5, 1.1 * big, 0.3, 0.5);
  }
  function step(dt: number) {
    let any = dust.step(dt, -0.25, 0.5, 0.55, 1.2);
    if (shard.step(dt, 16, -0.05, 1, 0.6)) any = true;
    if (chunk.step(dt, 18, 0, 1, 0.4)) any = true;
    if (spark.step(dt, 10, -0.08, 1, 1.5)) any = true;
    if (smoke.step(dt, -0.4, 0.45, 0.6, 1)) any = true;
    return any;
  }
  const clear = () => (dust.clear(), smoke.clear(), chunk.clear(), shard.clear(), spark.clear());
  return { dust, smoke, chunk, shard, spark, burst, step, clear };
}
export type Wreckage = ReturnType<typeof wreckage>;
