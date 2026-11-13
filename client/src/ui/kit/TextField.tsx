import { useEffect, useId, useRef, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { useUi } from "../context.tsx";
import { useFocusable, type DemoState } from "../focus.ts";
import { cx } from "./cx.ts";
import s from "./TextField.module.css";

export interface TextFieldProps {
  label: string;
  /** Keep the label for screen readers only, when the placeholder says it all. */
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** Enter pressed in the field. */
  onSubmit?: (value: string) => void;
  /** A paste landed; gets the field's value with it, e.g. to submit a pasted link straight away. */
  onPasted?: (value: string) => void;
  placeholder?: string;
  /** A message under the field (and red edges); `true` for red edges only. */
  error?: string | boolean;
  /** A quiet line under the field when there's no error. */
  hint?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  size?: "md" | "lg";
  /** Sits inside the field on the right, like a "Deal it" button. */
  trailing?: ReactNode;
  spellCheck?: boolean;
  autoCapitalize?: "off" | "sentences" | "words" | "characters";
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  ref?: Ref<HTMLInputElement>;
  demoState?: DemoState;
}

/** One line of text in the kit's look: label, field, and an error or hint under it. */
export function TextField({
  label, hideLabel, value, onChange, onSubmit, onPasted, placeholder, error, hint, disabled, autoFocus, maxLength,
  size = "md", trailing, spellCheck = false, autoCapitalize, inputMode, enterKeyHint, ref, demoState,
}: TextFieldProps) {
  const { sounds } = useUi();
  const focus = useFocusable(disabled);
  const id = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const pasted = useRef(false);
  const message = typeof error === "string" && error ? error : null;

  useEffect(() => { if (autoFocus) input.current?.focus({ preventScroll: true }); }, [autoFocus]);

  return (
    <div className={cx(s.field, s[size], !!error && s.error, disabled && s.disabled)} data-demo={demoState}>
      <label htmlFor={id} className={cx(s.label, hideLabel && s.hidden)}>{label}</label>
      <div className={s.box}>
        <input
          id={id}
          ref={(el) => {
            input.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          className={s.input}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={spellCheck}
          autoCapitalize={autoCapitalize}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          aria-invalid={!!error}
          aria-describedby={message || hint ? `${id}-note` : undefined}
          {...focus}
          onPaste={() => { pasted.current = true; }}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            if (pasted.current) {
              pasted.current = false;
              onPasted?.(next);
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !onSubmit || e.nativeEvent.isComposing) return;
            e.preventDefault();
            sounds.confirm();
            onSubmit(value);
          }}
        />
        {trailing && <span className={s.trailing}>{trailing}</span>}
      </div>
      {message
        ? <span id={`${id}-note`} className={s.message} role="alert">{message}</span>
        : hint && <span id={`${id}-note`} className={s.hint}>{hint}</span>}
    </div>
  );
}
