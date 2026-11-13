// What every primitive shares: the sounds, the Esc stack and the toasts.
import { createContext, useContext, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { createBackStack, type BackStack } from "./input/back.ts";
import { intentOf } from "./input/intent.ts";
import { createToasts, type Toasts } from "./toasts.ts";

/** The kit's sounds. `createAudio()` from audio/sfx.ts is one, and it respects mute. */
export interface UiSounds {
  hover(): void;
  confirm(): void;
  back(): void;
}

export const silent: UiSounds = { hover() {}, confirm() {}, back() {} };

interface Ui {
  sounds: UiSounds;
  backStack: BackStack;
  toasts: Toasts;
  /** Where popups render: the UI layer, so they get its base styles. */
  layer: HTMLElement | null;
}

const UiContext = createContext<Ui | null>(null);

export interface UiProviderProps {
  sounds?: UiSounds;
  toasts?: Toasts;
  layer?: HTMLElement;
  children: ReactNode;
}

export function UiProvider({ sounds = silent, toasts, layer, children }: UiProviderProps) {
  const [ui] = useState<Ui>(() => ({
    sounds,
    backStack: createBackStack(),
    toasts: toasts ?? createToasts(),
    layer: layer ?? null,
  }));
  useEffect(() => {
    // capture, so Esc closes the topmost dialog before anything in it (or the 3D scene) sees it
    const onKey = (e: KeyboardEvent) => {
      if (intentOf(e) === "back" && ui.backStack.back()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    addEventListener("keydown", onKey, { capture: true });
    return () => removeEventListener("keydown", onKey, { capture: true });
  }, [ui]);
  return <UiContext value={ui}>{children}</UiContext>;
}

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error("UI kit components need a <UiProvider> (mountUi adds one)");
  return ui;
}

/**
 * While `active`, Esc calls `onBack`, unless something on top of this takes it first:
 * anything nested deeper (`depth`), or opened later at the same depth.
 */
export function useBack(onBack: () => void, active = true, depth = 0) {
  const { backStack } = useUi();
  const back = useEffectEvent(onBack);
  useEffect(() => (active ? backStack.push(() => back(), depth) : undefined), [active, backStack, depth]);
}
