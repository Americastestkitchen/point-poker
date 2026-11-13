// The spinning character preview in the look editor. It keeps its own small
// renderer for now; the title screen (#4) moves it onto the main stage.
import * as THREE from "three";
import { wornIn, type Look } from "../../../shared/look.ts";
import { Avatar } from "../avatar.ts";

export function createTurntable(canvas: HTMLCanvasElement, look: Look, opts: { dealer: boolean; visible(): boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 1.25, 3.3);
  camera.lookAt(0, 1.0, 0);
  scene.add(new THREE.HemisphereLight("#ffd9c0", "#301020", 1.6));
  const key = new THREE.DirectionalLight("#fff0d8", 2.2);
  key.position.set(1.5, 3, 2);
  scene.add(key);
  const hat = (l: Look) => wornIn(l, "head") ?? "none";
  let avatar = new Avatar("preview", look.color, hat(look), opts.dealer, look.body);
  scene.add(avatar.group);

  const clock = new THREE.Clock();
  const loop = () => {
    if (!opts.visible()) { requestAnimationFrame(loop); return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * devicePixelRatio) || canvas.height !== Math.floor(h * devicePixelRatio)) {
      renderer.setPixelRatio(devicePixelRatio);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
    avatar.group.rotation.y = Math.sin(t * 0.6) * 0.7;
    avatar.setLook(Math.sin(t * 1.3) * 0.6, Math.sin(t * 0.9) * 0.3);
    avatar.update(dt, t);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();

  return {
    setLook(next: Look) {
      if (avatar.shape !== next.body) {
        scene.remove(avatar.group);
        avatar = new Avatar("preview", next.color, hat(next), opts.dealer, next.body);
        scene.add(avatar.group);
      }
      avatar.setStyle(next.color, hat(next));
    },
    wave() { avatar.playEmote("wave"); },
  };
}
