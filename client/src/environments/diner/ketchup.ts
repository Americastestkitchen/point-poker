// The diner's squeaky: a ketchup bottle on the formica. Click it and it
// squashes, splorts a blob out of its nozzle, and the blob splats on the table.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import type { EnvCtx, Squeaky } from "../types.ts";
import { arc, oneShot } from "../kit/animate.ts";
import { cylinder, put, sphere } from "../kit/build.ts";

/** A little over life size, so it reads from across the table. */
const SIZE = 1.15;
const HEIGHT = 0.2; // the body; the cap and nozzle go on top
/** The tip of the nozzle, where the ketchup comes out. */
const NOZZLE = HEIGHT + 0.09;

export function ketchupBottle({ sound, onFrame }: EnvCtx): Squeaky {
  const object = new THREE.Group();
  const bottle = new THREE.Group();
  const red = toon("#b81c1c");
  const white = toon("#f4f1ea");
  const body = put(cylinder(0.048, 0.052, HEIGHT, red, 16), 0, HEIGHT / 2, 0);
  const domeGeo = new THREE.SphereGeometry(0.048, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const shoulder = put(new THREE.Mesh(domeGeo, red), 0, HEIGHT, 0);
  shoulder.scale.y = 0.5;
  const cap = put(cylinder(0.026, 0.03, 0.04, white, 12), 0, HEIGHT + 0.035, 0);
  const nozzle = put(new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.035, 8), white), 0, NOZZLE - 0.0175, 0);
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0505, 0.0515, 0.07, 16, 1, true),
    toon("#ffffff", {
      map: canvasTex(256, 64, (g) => {
        g.fillStyle = "#fff8e8";
        g.fillRect(0, 0, 256, 64);
        g.fillStyle = "#d42a2a";
        g.font = `bold 30px ${FONT}`;
        g.textAlign = "center";
        g.fillText("SQUEEZE", 64, 44);
        g.fillText("SQUEEZE", 192, 44);
      }),
    }),
  );
  label.position.y = HEIGHT * 0.45;
  bottle.add(body, shoulder, cap, nozzle, label);
  bottle.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });

  // the blob flies out of the nozzle and lands as a splat beside the bottle
  const blobMat = toon("#b0141c", { transparent: true });
  const blob = sphere(0.022, blobMat, 10, 8);
  const REST = new THREE.Vector3(0, NOZZLE - 0.04, 0); // tucked inside the cap until it flies
  blob.position.copy(REST);
  blob.visible = false;
  object.add(bottle, blob);
  object.scale.setScalar(SIZE);

  const LAND = new THREE.Vector3(0.11, 0.004, 0.05);
  const squash = oneShot(1 / 3);
  let flight = -1; // seconds since the splort, or -1 when there's no blob about
  onFrame((dt) => {
    const left = squash.step(dt);
    if (left !== null) {
      const k = arc(left);
      // squeezed flat, then a springy hop
      const sq = left > 0.5 ? k * 0.3 : -k * 0.12;
      bottle.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
      bottle.position.y = left < 0.5 ? k * 0.05 : 0;
    }
    if (flight < 0) return;
    flight += dt;
    const f = Math.min(1, flight / 0.45);
    if (f < 1) {
      blob.position.set(LAND.x * f, NOZZLE + 0.1 * Math.sin(f * Math.PI) - (NOZZLE - LAND.y) * f, LAND.z * f);
      blob.scale.set(1, 1.3, 1);
    } else {
      blob.position.copy(LAND);
      blob.scale.set(1.8, 0.15, 1.6);
    }
    // the splat soaks in after a bit
    blobMat.opacity = flight < 2 ? 1 : Math.max(0, 1 - (flight - 2));
    if (flight > 3) {
      flight = -1;
      blob.visible = false;
      blob.position.copy(REST);
      blob.scale.setScalar(1);
    }
  });
  return {
    object,
    squeak() {
      // splort: a wet burst and a rude little squelch
      sound.noise(0.16, 380, 0.35);
      sound.tone(240, 0.18, "square", 0.05, 70);
      sound.noise(0.06, 1400, 0.12, 0.42);
      squash.kick();
      flight = 0;
      blobMat.opacity = 1;
      blob.visible = true;
    },
  };
}
