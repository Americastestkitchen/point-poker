// Name tags and speech bubbles, drawn on canvases.
import { FONT, canvasTex } from "../scene/textures.ts";

export function tagTexture(name: string, line2: string, color: string) {
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

export function bubbleTexture(text: string) {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.beginPath();
    g.arc(64, 58, 50, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(40, 96); g.lineTo(30, 124); g.lineTo(66, 104);
    g.fill();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = text.length > 1 && !/\p{Extended_Pictographic}/u.test(text) ? `bold 48px ${FONT}` : `60px "Noto Color Emoji", sans-serif`;
    g.fillStyle = "#2a1d17";
    g.fillText(text, 64, 62);
  });
}
