import { useUi } from "../context.tsx";
import { useFocusable, type DemoState } from "../focus.ts";
import { intentOf } from "../input/intent.ts";
import { cx } from "./cx.ts";
import s from "./Toggle.module.css";

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  demoState?: DemoState;
}

/** An on/off switch. Enter, Space, a click or a tap flips it; ← turns it off and → on. */
export function Toggle({ label, checked, onChange, disabled, demoState }: ToggleProps) {
  const { sounds } = useUi();
  const focus = useFocusable(disabled);
  const set = (next: boolean) => {
    if (next === checked) return;
    sounds.confirm();
    onChange(next);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      {...focus}
      data-demo={demoState}
      className={cx(s.toggle, checked && s.on)}
      onClick={() => set(!checked)}
      onKeyDown={(e) => {
        const intent = intentOf(e);
        if (intent === "left" || intent === "right") {
          e.preventDefault();
          set(intent === "right");
        }
      }}
    >
      <span className={s.label}>{label}</span>
      <span className={s.track} aria-hidden>
        <span className={s.state}>{checked ? "ON" : "OFF"}</span>
        <span className={s.knob} />
      </span>
    </button>
  );
}
