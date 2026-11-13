// Mounting the UI kit: React draws the UI layer on top of the canvas, nothing else.
// The 3D world stays plain Three.js, and per-frame values (the camera, animations) never go
// through React state.
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { UiProvider, type UiSounds } from "./context.tsx";
import { Toaster } from "./kit/Toast.tsx";
import type { Toasts } from "./toasts.ts";
import { tokensCss } from "./tokens.ts";
import s from "./root.module.css";

/** Declares the design tokens as CSS variables, once per document. */
export function installTokens(doc: Document = document) {
  if (doc.getElementById("pp-tokens")) return;
  const style = doc.createElement("style");
  style.id = "pp-tokens";
  style.textContent = tokensCss();
  doc.head.append(style);
}

export interface MountOptions {
  /** Hover, confirm and back sounds; pass the `createAudio()` instance so mute applies. */
  sounds?: UiSounds;
  toasts?: Toasts;
}

/** Render `ui` into `container` (an overlay above the canvas). Returns a function that unmounts it. */
export function mountUi(container: HTMLElement, ui: ReactNode, { sounds, toasts }: MountOptions = {}): () => void {
  installTokens(container.ownerDocument);
  container.classList.add(s.root!);
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <UiProvider sounds={sounds} toasts={toasts} layer={container}>
        {ui}
        <Toaster />
      </UiProvider>
    </StrictMode>,
  );
  return () => root.unmount();
}
