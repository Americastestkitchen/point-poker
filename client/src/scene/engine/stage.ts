// The one WebGL renderer: scene, camera, the frame loop and picking.
import * as THREE from "three";
import type { Audio } from "../../audio/sfx.ts";
import { createDelays } from "./delays.ts";
import { createPicking, type Picking } from "./picking.ts";

export interface Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly picking: Picking;
  readonly audio: Audio;
  readonly canvas: HTMLCanvasElement;
  /** Runs `fn` every frame, before rendering. Returns a function that stops it. */
  onFrame(fn: (dt: number, t: number) => void): () => void;
  /** Runs `fn` once, after `seconds` of frame time. The world waits with this, never setTimeout. */
  after(seconds: number, fn: () => void): void;
  start(): void;
}

export function createStage(canvas: HTMLCanvasElement, deps: { audio: Audio }): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.03, 60);
  scene.add(camera);
  const picking = createPicking(camera, () => ({ width: innerWidth, height: innerHeight }));
  const delays = createDelays();
  const frames = new Set<(dt: number, t: number) => void>([delays.update]);

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 85 : 70;
    camera.updateProjectionMatrix();
  };

  let started = false;
  return {
    renderer, scene, camera, picking, audio: deps.audio, canvas,
    onFrame(fn) {
      frames.add(fn);
      return () => frames.delete(fn);
    },
    after: delays.after,
    start() {
      if (started) return;
      started = true;
      resize();
      addEventListener("resize", resize);
      const clock = new THREE.Clock();
      const loop = () => {
        const dt = Math.min(clock.getDelta(), 0.1);
        for (const fn of frames) fn(dt, clock.elapsedTime);
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      };
      loop();
    },
  };
}
