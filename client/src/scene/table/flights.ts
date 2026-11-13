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
  done?: () => void;
}

export function createFlights() {
  const flights: Flight[] = [];
  return {
    add(f: Flight) { flights.push(f); },
    update(dt: number) {
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i];
        f.t += dt;
        if (f.t < 0) continue;
        const p = Math.min(1, f.t / f.dur);
        const to = typeof f.to === "function" ? f.to() : f.to;
        f.obj.position.lerpVectors(f.from, to, p);
        f.obj.position.y += Math.sin(p * Math.PI) * f.arc;
        f.obj.rotation.x += f.spin * dt;
        if (p >= 1) {
          if (f.spin) f.obj.rotation.set(0, f.obj.rotation.y, 0);
          flights.splice(i, 1);
          f.done?.();
        }
      }
    },
  };
}

export type Flights = ReturnType<typeof createFlights>;
