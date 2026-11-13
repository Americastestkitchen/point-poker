// Basement-only textures: the casino felt and the sad wallpaper.
import * as THREE from "three";
import { FONT, canvasTex } from "../../scene/art/textures.ts";

export function feltTexture(): THREE.CanvasTexture {
  return canvasTex(1024, 1024, (g) => {
    const grad = g.createRadialGradient(512, 512, 60, 512, 512, 560);
    grad.addColorStop(0, "#1f7a43");
    grad.addColorStop(1, "#0b3a1f");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 1024);
    // fuzz
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "200,255,210"},${Math.random() * 0.05})`;
      g.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }
    g.strokeStyle = "rgba(230,190,90,0.65)";
    g.lineWidth = 6;
    g.beginPath(); g.ellipse(512, 512, 330, 330, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(512, 512, 345, 345, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(230,190,90,0.7)";
    g.font = `bold 34px ${FONT}`;
    g.textAlign = "center";
    const msg = "  NO REFUNDS ON SCOPE CREEP  ✦  CLOSEST GUESS TAKES THE POT  ✦  TIES SPLIT  ✦";
    const r = 395;
    for (let i = 0; i < msg.length; i++) {
      const a = (i / msg.length) * Math.PI * 2 - Math.PI / 2;
      g.save();
      g.translate(512 + Math.cos(a) * r, 512 + Math.sin(a) * r);
      g.rotate(a + Math.PI / 2);
      g.fillText(msg.charAt(i), 0, 0);
      g.restore();
    }
  });
}

export function wallpaperTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = "#2b2233";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#231b2a";
    for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 14, 256);
    g.fillStyle = "rgba(200,160,90,0.12)";
    for (let y = 16; y < 256; y += 64) for (let x = 23; x < 256; x += 64) {
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  return t;
}
