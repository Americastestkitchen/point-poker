// What floats over a bean: their name tag, a speech bubble ("✓", "…") and
// the emoji of the emote they're playing.
import * as THREE from "three";
import { FONT, canvasTex } from "../../scene/art/textures.ts";
import type { Pose } from "../animator.ts";
import { anchorsFor } from "../bodies/anchors.ts";
import type { BodyShape } from "../bodies/body.ts";

export interface Labels {
  /** Moves the tag and bubble to suit a body shape. */
  fit(shape: BodyShape): void;
  /** Returns whether anything changed. */
  setTag(name: string, line2: string, color: string): boolean;
  /** "" hides it; otherwise a short text or emoji. */
  setBubble(text: string): void;
  showEmoji(emoji: string): void;
  apply(emote: Pose["emote"]): void;
}

export function createLabels(parent: THREE.Object3D): Labels {
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  tag.scale.set(0.9, 0.28, 1);
  tag.visible = false;
  tag.renderOrder = 10;
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  bubble.scale.set(0.24, 0.24, 1);
  bubble.renderOrder = 10;
  bubble.visible = false;
  parent.add(tag, bubble);
  let tagKey = "";
  let bubbleText = "";
  let emoji: THREE.Sprite | null = null;

  return {
    fit(shape) {
      const A = anchorsFor(shape);
      tag.position.y = A.tag.y;
      bubble.position.set(A.bubble.x, A.bubble.y, A.bubble.z);
    },
    setTag(name, line2, color) {
      const key = name + line2 + color;
      if (key === tagKey) return false;
      tagKey = key;
      tag.material.map?.dispose();
      tag.material.map = tagTexture(name, line2, color);
      tag.material.needsUpdate = true;
      tag.visible = true;
      return true;
    },
    setBubble(text) {
      if (text === bubbleText) return;
      bubbleText = text;
      bubble.visible = !!text;
      if (text) {
        bubble.material.map?.dispose();
        bubble.material.map = bubbleTexture(text);
        bubble.material.needsUpdate = true;
      }
    },
    showEmoji(text) {
      if (emoji) parent.remove(emoji);
      emoji = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: bubbleTexture(text), depthTest: false, transparent: true }),
      );
      emoji.scale.set(0.4, 0.4, 1);
      emoji.position.y = 1.6;
      emoji.renderOrder = 11;
      parent.add(emoji);
    },
    apply(emote) {
      if (!emoji) return;
      if (emote) {
        emoji.position.y = 1.6 + emote.t * 0.25;
        emoji.material.opacity = Math.max(0, 1 - Math.max(0, emote.t - 1.4) * 2);
      } else {
        parent.remove(emoji);
        emoji.material.map?.dispose();
        emoji = null;
      }
    },
  };
}

function tagTexture(name: string, line2: string, color: string) {
  return canvasTex(512, 160, (g) => {
    g.font = `bold 56px ${FONT}`;
    const w = Math.min(500, Math.max(g.measureText(name).width, 200) + 60);
    g.fillStyle = "rgba(10,6,12,0.72)";
    g.beginPath();
    g.roundRect(256 - w / 2, 8, w, 144, 30);
    g.fill();
    g.fillStyle = color;
    g.fillRect(256 - w / 2 + 20, 18, w - 40, 6);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.fillText(name, 256, 64, 480);
    g.font = `40px ${FONT}`;
    g.fillStyle = "#e6be5a";
    g.fillText(line2, 256, 118);
  });
}

function bubbleTexture(text: string) {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.beginPath();
    g.arc(64, 58, 50, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(40, 96);
    g.lineTo(30, 124);
    g.lineTo(66, 104);
    g.fill();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font =
      text.length > 1 && !/\p{Extended_Pictographic}/u.test(text)
        ? `bold 48px ${FONT}`
        : `60px "Noto Color Emoji", sans-serif`;
    g.fillStyle = "#2a1d17";
    g.fillText(text, 64, 62);
  });
}
