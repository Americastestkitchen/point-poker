import { useEffect, useRef, useState } from "react";
import { useUi } from "../context.tsx";
import { useFocusable, type DemoState } from "../focus.ts";
import { cursorOf, LETTERS, normalize } from "../input/slots.ts";
import { cx } from "./cx.ts";
import s from "./CodeSlots.module.css";

export interface CodeSlotsProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  /** Called when the last slot fills, and on Enter once it's full. */
  onComplete?: (code: string) => void;
  length?: number;
  alphabet?: string;
  /** Shakes and turns the slots red, e.g. "no table with that code". */
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  demoState?: DemoState;
}

/**
 * A row of letter slots for a table code. The typing goes into a real (invisible) input
 * over the slots, so phones bring up their keyboard and pasting a whole code works.
 */
export function CodeSlots({
  label,
  value,
  onChange,
  onComplete,
  length = 4,
  alphabet = LETTERS,
  error,
  disabled,
  autoFocus,
  demoState,
}: CodeSlotsProps) {
  const { sounds } = useUi();
  const focus = useFocusable(disabled);
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const cursor = cursorOf(value, length);
  const showFocus = (focused || demoState === "focus") && !disabled;

  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <label className={cx(s.slots, error && s.error, disabled && s.disabled)} data-demo={demoState}>
      <span className={s.label}>{label}</span>
      <span className={s.row}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={cx(s.slot, value[i] && s.filled, showFocus && i === cursor && s.cursor)}>
            {value[i] ?? ""}
          </span>
        ))}
        <input
          ref={input}
          className={s.input}
          value={value}
          disabled={disabled}
          aria-invalid={error}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={length * 4 /* room for a paste with spaces in it */}
          {...focus}
          onFocus={(e) => {
            focus.onFocus(e);
            setFocused(true);
            e.currentTarget.setSelectionRange(value.length, value.length);
          }}
          onBlur={() => setFocused(false)}
          // the caret always sits after the last letter, like the slots show
          onSelect={(e) => {
            const end = e.currentTarget.value.length;
            if (e.currentTarget.selectionStart !== end) e.currentTarget.setSelectionRange(end, end);
          }}
          onChange={(e) => {
            const next = normalize(e.target.value, length, alphabet);
            if (next === value) return;
            if (next.length > value.length) sounds.hover();
            onChange(next);
            if (next.length === length && value.length < length) onComplete?.(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.length === length) {
              e.preventDefault();
              sounds.confirm();
              onComplete?.(value);
            }
          }}
        />
      </span>
    </label>
  );
}
