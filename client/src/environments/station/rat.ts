// The squeaky: a rubber rat in a conductor's cap. Rats squeak anyway. Click it
// and it eeks twice, hops, wiggles its tail and its cap pops off its head.
import * as THREE from "three";
import { toon } from "../../scene/art/materials.ts";
import { arc, oneShot } from "../kit/animate.ts";
import type { EnvCtx, Squeaky } from "../types.ts";

export function rubberRat({ sound, onFrame }: EnvCtx): Squeaky {
  const object = new THREE.Group();
  const { rat, cap, tail } = ratModel();
  object.add(rat);
  const hop = oneShot(1 / 1.8);
  onFrame((dt, t) => {
    tail.rotation.y = Math.sin(t * 2.1) * 0.15 + (hop.left > 0 ? Math.sin(hop.left * 30) * 0.5 : 0);
    const left = hop.step(dt);
    if (left === null) return;
    const up = arc(left);
    rat.position.y = up * 0.1;
    rat.rotation.z = Math.sin(left * 25) * 0.2 * up;
    rat.scale.set(1 - up * 0.1, 1 + up * 0.2, 1 - up * 0.1);
    // the cap goes up further and comes down a beat later
    const lag = Math.max(0, arc(Math.min(1, left * 1.2)));
    cap.position.y = 0.128 + lag * 0.08;
    cap.rotation.y = (1 - left) * Math.PI * 2;
  });
  return {
    object,
    squeak() {
      sound.tone(2300, 0.07, "square", 0.05, 3300);
      sound.tone(2700, 0.1, "square", 0.05, 3800, 0.11);
      hop.kick();
    },
  };
}

function ratModel() {
  const rat = new THREE.Group();
  const fur = toon("#6f7179");
  const pink = toon("#f2a5b5");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), fur);
  body.scale.set(0.85, 0.75, 1.25);
  body.position.y = 0.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), fur);
  head.scale.set(1, 0.95, 1.2);
  head.position.set(0, 0.085, 0.07);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.05, 10), fur);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.075, 0.12);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), pink);
  nose.position.set(0, 0.075, 0.146);
  rat.add(body, head, snout, nose);
  const black = new THREE.MeshBasicMaterial({ color: "#111" });
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 12), fur);
    ear.rotation.set(Math.PI / 2 - 0.2, 0, s * 0.5);
    ear.position.set(s * 0.032, 0.12, 0.055);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 10), pink);
    inner.position.y = 0.003;
    ear.add(inner);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), black);
    eye.position.set(s * 0.02, 0.098, 0.105);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), pink);
    foot.scale.set(1, 0.5, 1.4);
    foot.position.set(s * 0.035, 0.006, 0.05);
    const back = foot.clone();
    back.position.z = -0.05;
    rat.add(ear, eye, foot, back);
  }
  // the tail, curling up behind
  const tail = new THREE.Group();
  tail.position.set(0, 0.04, -0.07);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.02, -0.02, -0.06),
    new THREE.Vector3(0.05, 0.0, -0.1),
    new THREE.Vector3(0.06, 0.05, -0.11),
  ]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.006, 5), pink));
  rat.add(tail);
  // the conductor's cap
  const cap = new THREE.Group();
  cap.position.set(0, 0.128, 0.06);
  cap.rotation.x = -0.15;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.03, 14), toon("#1d2f6b"));
  crown.position.y = 0.012;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0305, 0.0305, 0.008, 14), black);
  band.position.y = 0.0;
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.004, 12, 1, false, -Math.PI / 2, Math.PI),
    black,
  );
  brim.position.set(0, -0.003, 0.022);
  const badge = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), toon("#ffd34d"));
  badge.position.set(0, 0.014, 0.034);
  cap.add(crown, band, brim, badge);
  rat.add(cap);
  rat.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { rat, cap, tail };
}
