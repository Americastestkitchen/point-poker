// Stars circling a bean's head after the hammer lands on it.
import * as THREE from "three";
import { canvasTex } from "../../scene/art/textures.ts";

const COUNT = 4;
let texture: THREE.CanvasTexture | null = null;

function starTexture() {
  texture ??= canvasTex(64, 64, (g) => {
    g.translate(32, 34);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 12 : 28;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = "#ffd23f";
    g.strokeStyle = "#7a4d0c";
    g.lineWidth = 4;
    g.lineJoin = "round";
    g.fill();
    g.stroke();
  });
  return texture;
}

export interface Stars {
  /** Stands them over a head whose top is at `y` when the bean sits up straight. */
  fit(y: number): void;
  /** `dizzy` is the seconds of stars left (0 hides them); `t` is the running clock. */
  apply(dizzy: number, t: number): void;
}

export function createStars(parent: THREE.Object3D): Stars {
  // built the first time someone's bonked: most beans never see stars
  let ring: THREE.Group | null = null;
  let top = 1.36;
  return {
    fit(y) {
      top = y;
    },
    apply(dizzy, t) {
      if (dizzy <= 0) {
        if (ring) ring.visible = false;
        return;
      }
      if (!ring) {
        ring = new THREE.Group();
        for (let i = 0; i < COUNT; i++) {
          const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true }));
          star.scale.setScalar(0.13);
          ring.add(star);
        }
        parent.add(ring);
      }
      ring.visible = true;
      ring.position.y = top + 0.1;
      // they fade out over the last half second
      const fade = Math.min(1, dizzy * 2);
      for (const [i, star] of ring.children.entries()) {
        const a = t * 5 + (i / COUNT) * Math.PI * 2;
        star.position.set(Math.cos(a) * 0.3, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.3);
        if (star instanceof THREE.Sprite) star.material.opacity = fade;
      }
    },
  };
}
