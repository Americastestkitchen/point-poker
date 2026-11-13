import type { ReactNode } from "react";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  /** What yes does, as a verb: "Kick", "Cancel round". */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for things you can't take back. */
  tone?: "primary" | "danger";
  onConfirm: () => void;
  /** No, Esc, the ✕ or a click outside. */
  onCancel: () => void;
}

/**
 * "Are you sure?" in the kit's look, instead of the browser's confirm(). Opened from inside
 * another dialog, it sits on top and takes Esc first. Focus starts on the safe choice.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Never mind",
  tone = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      width="sm"
      actions={
        <>
          <Button data-autofocus onPress={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
