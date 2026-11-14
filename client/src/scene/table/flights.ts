// Things flying through the air on an arc: chips into the pot, out to winners, at heads.
import * as THREE from "three";

export interface Flight {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3 | (() => THREE.Vector3);
  /** Seconds in; negative waits before taking off. */
  t: number;
  dur: number;
  arc: number;
  spin: number;
  /** Flies nose (+z) first, pointing the way it's going, instead of tumbling. */
  nose?: boolean;
  /** A loop-the-loop this tall in the middle of the flight. */
  loop?: number;
  done?: () => void;
}

/** How far through the flight the loop starts, and how long it takes. */
const LOOP = { from: 0.3, span: 0.4 };
const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** Where flight `f` is when it's `p` (0..1) of the way there. */
function along(f: Flight, p: number, out: THREE.Vector3): THREE.Vector3 {
  const to = typeof f.to === "function" ? f.to() : f.to;
  out.lerpVectors(f.from, to, p);
  out.y += Math.sin(p * Math.PI) * f.arc;
  if (f.loop) {
    // a circle on top of the way forward: ahead and up, over the top, back and down
    const a = smooth((p - LOOP.from) / LOOP.span) * Math.PI * 2;
    const r = f.loop / 2;
    const ahead = Math.sin(a) * r;
    const flat = Math.hypot(to.x - f.from.x, to.z - f.from.z) || 1;
    out.x += ((to.x - f.from.x) / flat) * ahead;
    out.z += ((to.z - f.from.z) / flat) * ahead;
    out.y += (1 - Math.cos(a)) * r;
  }
  return out;
}

export function createFlights() {
  const flights: Flight[] = [];
  const next = new THREE.Vector3();
  return {
    add(f: Flight) {
      flights.push(f);
    },
    update(dt: number) {
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i];
        if (!f) throw new Error("Flight disappeared during update");
        f.t += dt;
        if (f.t < 0) continue;
        const p = Math.min(1, f.t / f.dur);
        along(f, p, f.obj.position);
        if (f.nose) {
          // a little ahead of itself (or, at the very end, from a little behind)
          const ahead = p < 0.98;
          along(f, ahead ? p + 0.02 : p - 0.02, next);
          if (!ahead) next.subVectors(f.obj.position, next).add(f.obj.position);
          f.obj.lookAt(next);
        } else f.obj.rotation.x += f.spin * dt;
        if (p >= 1) {
          if (f.spin && !f.nose) f.obj.rotation.set(0, f.obj.rotation.y, 0);
          flights.splice(i, 1);
          f.done?.();
        }
      }
    },
  };
}

export type Flights = ReturnType<typeof createFlights>;
