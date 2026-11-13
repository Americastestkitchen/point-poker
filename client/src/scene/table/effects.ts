// Screen-space effects for things that happen to you in the 3D world.

/** A chip hit you in the face: flash "BONK!" and shake the screen. */
export function bonkMe() {
  const f = document.getElementById("bonk-flash")!;
  f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
  document.body.classList.add("shake");
  setTimeout(() => document.body.classList.remove("shake"), 360);
}
