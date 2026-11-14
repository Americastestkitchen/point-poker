// The Backlog Basement: a dim basement room with a swaying lamp, a neon sign,
// a telly behind the dealer, a rubber duck and plenty of sticky-note wisdom.
import * as THREE from "three";
import { NEON } from "../../../../shared/brand.ts";
import { toon } from "../../scene/art/materials.ts";
import { FONT, wrapText } from "../../scene/art/textures.ts";
import { flickeringNeonLogo } from "../kit/neon.ts";
import { rubberDuck } from "../kit/props/duck.ts";
import { statusCanvas, type PaintStatus } from "../kit/status.ts";
import type { EnvCtx, Environment, Sign, StatusScreen } from "../types.ts";
import { buildRoom, dustMotes, hangingLamp, woodTexMat, type Led } from "./room.ts";
import { feltTexture } from "./textures.ts";

export default {
  backdrop({ anchors, sound, onFrame }) {
    const object = new THREE.Group();
    object.add(new THREE.HemisphereLight("#6a5a8a", "#1a100c", 2.0));
    object.add(new THREE.AmbientLight("#ffffff", 0.3));
    const leds: Led[] = [];
    buildRoom(object, leds);
    const lamp = hangingLamp(anchors.lamp);
    const dust = dustMotes();
    object.add(lamp.object, dust.object);
    onFrame((dt, t) => {
      lamp.update(t);
      for (const l of leds) l.mat.color.set(Math.sin(t * l.rate + l.rate * 10) > 0 ? l.on : "#111");
      dust.update(dt, t);
    });
    // the lamp's mains hum, barely there
    sound.bed((c, out) => {
      const hum = c.createOscillator();
      hum.frequency.value = 60;
      const g = c.createGain();
      g.gain.value = 0.015;
      hum.connect(g).connect(out);
      hum.start();
      return () => hum.stop();
    });
    return { object, background: new THREE.Color("#07050a"), fog: new THREE.Fog("#07050a", 6, 16) };
  },
  tableMaterials: () => ({
    felt: new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: "#2a140c", roughness: 0.6 }),
    trim: new THREE.MeshStandardMaterial({ color: "#4a2412", roughness: 0.35, metalness: 0.1 }),
    base: new THREE.MeshStandardMaterial({ color: "#1d0e08", roughness: 0.5 }),
  }),
  props: { statusScreen: telly, sign: neonSign, squeaky: rubberDuck() },
} satisfies Environment;

/** The Point Poker neon sign, buzzing, its R dropping out now and then. */
function neonSign({ onFrame }: EnvCtx): Sign {
  const object = new THREE.Group();
  const logo = flickeringNeonLogo(2.2);
  const light = new THREE.PointLight(NEON.pink.tube, 3, 6, 1.5);
  light.position.z = 0.45; // just out from the wall
  object.add(logo.object, light);
  onFrame((_, t) => {
    light.intensity = logo.update(t) ? 3 : 2.4;
  });
  return { object };
}

/** A CRT telly on a shelf behind the dealer, with scanlines and a bit of flicker. */
function telly({ anchors, onFrame }: EnvCtx): StatusScreen {
  const object = new THREE.Group();
  const status = statusCanvas(512, 384, paintTelly);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), toon("#5a5048"));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.42),
    new THREE.MeshBasicMaterial({ map: status.texture }),
  );
  screen.position.z = 0.28;
  box.add(screen);
  // The shelf and the telly's glow sit square to the wall; only the telly is turned towards the table.
  const wall = new THREE.Group();
  wall.rotation.y = -anchors.statusScreen.yaw;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 1.6), woodTexMat());
  shelf.position.set(0.02, -0.3, -0.3);
  const light = new THREE.PointLight("#6fc3ff", 1.5, 3.5, 1.5);
  light.position.set(0.52, 0, 0);
  wall.add(shelf, light);
  object.add(box, wall);
  onFrame(() => {
    if (Math.random() < 0.02) status.draw(Math.random() * 0.08);
  });
  return status.screen(object);
}

const paintTelly: PaintStatus = (ctx, lines, noise) => {
  ctx.fillStyle = "#06121c";
  ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = "#7fe3ff";
  ctx.textAlign = "center";
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText(lines.title, 256, 130, 470);
  ctx.font = `34px ${FONT}`;
  wrapText(ctx, lines.subtitle, 460, 3).forEach((l, i) => ctx.fillText(l, 256, 200 + i * 42));
  ctx.fillStyle = "#ffd23f";
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText(lines.status, 256, 350, 470);
  for (let y = 0; y < 384; y += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, y, 512, 2);
  }
  if (noise) {
    ctx.fillStyle = `rgba(255,255,255,${noise})`;
    ctx.fillRect(0, 0, 512, 384);
  }
};
