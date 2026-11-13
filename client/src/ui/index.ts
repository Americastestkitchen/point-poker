// The game UI kit: design tokens, primitives and one shared input model.
// Screens import from here; gallery.html demos the kit in dev and is bundled by build:gallery.
export { tokens } from "./tokens.ts";
export { mountUi, installTokens } from "./root.tsx";
export { UiProvider, useUi, useBack, silent, type UiSounds } from "./context.tsx";
export { useFocusable, useRoving, type DemoState } from "./focus.ts";
export { intentOf, type Intent } from "./input/intent.ts";
export { createToasts, type Toasts, type ToastTone } from "./toasts.ts";

export { cx } from "./kit/cx.ts";
export { Panel } from "./kit/Panel.tsx";
export { Button, ButtonLink, type ButtonProps, type ButtonLinkProps } from "./kit/Button.tsx";
export { MenuList, type MenuItem } from "./kit/MenuList.tsx";
export { Carousel } from "./kit/Carousel.tsx";
export { CodeSlots } from "./kit/CodeSlots.tsx";
export { Toggle } from "./kit/Toggle.tsx";
export { Slider } from "./kit/Slider.tsx";
export { Dialog, type DialogProps } from "./kit/Dialog.tsx";
export { ConfirmDialog, type ConfirmDialogProps } from "./kit/ConfirmDialog.tsx";
export { TextField, type TextFieldProps } from "./kit/TextField.tsx";
export { ScrollArea, type ScrollAreaProps } from "./kit/ScrollArea.tsx";
export { Spinner } from "./kit/Spinner.tsx";
export { Toast, Toaster } from "./kit/Toast.tsx";
export { Tooltip } from "./kit/Tooltip.tsx";
export { KeyHint } from "./kit/KeyHint.tsx";
export { CoinCounter } from "./kit/CoinCounter.tsx";
