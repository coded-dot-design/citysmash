// CitySmash online: two to four screens, one run, over a fizlet-rooms room (@fzlt/core/presence's
// `join` for the room and its lobby, the room server the DOM VIRUS games share). The run is
// deterministic, so only inputs travel: each frame every seat's inputs packed in 32 bits. ./rollback.ts
// runs each frame at once with this screen's own input (1 to 3 frames ahead) and a guess for the
// others' (their last); a real input that differs takes the run back to that frame and runs it again,
// so every screen ends on the same state while your own monster answers at once. Every 30 final frames
// the state hashes are compared (a desync shows, it never drifts silently). Seat 0 is the ape (its
// look rides the first frames' spare bits), seats 1 to 3 the rivals; the host's pick (the first city,
// rivals on or off) rides the room's START as one byte. A seat that leaves plays GONE from the frame
// after its last input on every screen: its monster goes back to the AI, the run goes on.
import { join, hash32 } from "@fzlt/core/presence";
import type { Look } from "./monster.ts";

/** Input bits: the stick x and y (4 bits each, 8 the middle), punch (8), jump (9), grab (10), the seat
 *  left (11), the tapped target (12–18: ./round.ts T_*), six bits of the ape's look (24–29, the first
 *  frames only, from seat 0). */
export const B_PUNCH = 1 << 8, B_JUMP = 1 << 9, B_GRAB = 1 << 10, B_GONE = 1 << 11;
export const SEATS = 4, NAME = 8, LOOK_FRAMES = 5, NI = 6;
const q4 = (v: number) => Math.max(1, Math.min(15, Math.round(v * 7) + 8));

/** Pack one seat's numbers (mx, my, punch, jump, grab, target) into 32 bits. */
export function encode(I: Float64Array, o: number, flags = 0) {
  return (q4(I[o]!) | (q4(I[o + 1]!) << 4) | (I[o + 2] ? B_PUNCH : 0) | (I[o + 3] ? B_JUMP : 0) | (I[o + 4] ? B_GRAB : 0) | ((I[o + 5]! & 127) << 12) | flags) >>> 0;
}
/** Unpack seat s's bits into IN (NI a seat): every screen decodes the same bits the same way. */
export function decode(bits: number, s: number, IN: Float64Array) {
  const o = s * NI;
  IN[o] = bits & 15 ? ((bits & 15) - 8) / 7 : 0;
  IN[o + 1] = (bits >>> 4) & 15 ? (((bits >>> 4) & 15) - 8) / 7 : 0;
  IN[o + 2] = bits & B_PUNCH ? 1 : 0;
  IN[o + 3] = bits & B_JUMP ? 1 : 0;
  IN[o + 4] = bits & B_GRAB ? 1 : 0;
  IN[o + 5] = (bits >>> 12) & 127;
}
/** A seat that left plays these bits from the frame after its last input (every screen the same). */
export const GONE = B_GONE >>> 0;

/** The host's pick as one byte: the first city (bits 0–2), rivals on (3). */
export const packMode = (first: number, rivals: number) => (first & 7) | (rivals ? 8 : 0);
export const unpackMode = (m: number) => ({ first: m & 7, rivals: m & 8 ? 1 : 0 });

/** The ape's look in 26 bits (fur 4, trim 3, pattern 3, face 3, gear 8, hair 2, its colour 3), six a frame over LOOK_FRAMES frames. */
export const lookBits = (l: Look, f: number) => {
  const all = (l.fur & 15) | ((l.trim & 7) << 4) | ((l.pattern & 7) << 7) | ((l.face & 7) << 10) | ((l.gear & 255) << 13) | ((l.hair & 3) << 21) | ((l.hairc & 7) << 23);
  return f < LOOK_FRAMES ? ((all >>> (f * 6)) & 63) << 24 : 0;
};
/** Fold frame f's look bits into `acc` (start at 0); after LOOK_FRAMES frames, `lookOf(acc)`. */
export const takeLook = (acc: number, bits: number, f: number) => (f < LOOK_FRAMES ? acc | (((bits >>> 24) & 63) << (f * 6)) : acc);
export const lookOf = (a: number): Look => ({ fur: a & 15, trim: (a >> 4) & 7, pattern: (a >> 7) & 7, face: (a >> 10) & 7, gear: (a >> 13) & 255, hair: (a >> 21) & 3, hairc: (a >> 23) & 7 });

/** A hash of the run's state (its byte views), for the desync check. */
export function hashOf(bytes: Uint8Array[]) {
  let h = 2166136261;
  for (const b of bytes) h = hash32(b, h);
  return h >>> 0;
}
export { rollback, type Rollback } from "./rollback.ts";

/** The room: `url` (wss://…), room `room`, `size` seats, an invite code. `want` seats start it (the
 *  host's ask), `mode` is the host's pick. Resolves on the start with the transport, your seat, the
 *  seat count, the shared seed and the host's pick. `lobby` hears who is in while you wait; its `go()`
 *  (the host's) starts with the seats taken. */
export function joinRoom(
  url: string,
  room: number,
  size: number,
  code: string,
  o: { want: number; mode: number; signal?: AbortSignal; lobby?: (seat: number, seated: number, size: number, go: () => void) => void },
) {
  let asked = 0;
  return join(`${url}/room/${room}?players=${size}`, o.signal, ["fizlet-rooms", "invite." + code], {
    lobby(start, seat, seated, n) {
      if (seat === 0 && asked !== o.want && o.want > 1) (asked = o.want), start(o.want, o.mode & 255);
      o.lobby?.(seat, seated, n, () => seat === 0 && seated > 1 && start(0, o.mode & 255));
    },
  });
}
