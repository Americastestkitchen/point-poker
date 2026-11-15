import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBack, useUi } from "../context.tsx";
import { useFocusable } from "../focus.ts";
import { intentOf } from "../input/intent.ts";
import { step } from "../input/roving.ts";
import { aimAt, wedgeAngle, wedgeAt, type Point } from "../input/wheel.ts";
import { cx } from "./cx.ts";
import s from "./Wheel.module.css";

export interface WheelItem<T extends string> {
  id: T;
  /** What stands on the wheel: an emoji, an icon. */
  icon: ReactNode;
  /** Its name, shown in the hub while it's highlighted, and read out. */
  label: string;
}

export interface WheelProps<T extends string> {
  open: boolean;
  onClose: () => void;
  /** What the wheel is for, read out when it opens. */
  label: string;
  /** Up to about ten; the first stands at the top and the rest go round clockwise. */
  items: readonly WheelItem<T>[];
  onPick: (id: T) => void;
  /** What sits in the hub, over the highlighted item's name. */
  children?: ReactNode;
  /**
   * The key that opened it. Letting go of it picks the highlighted item, so "hold, flick the
   * mouse, let go" picks in one move; with nothing highlighted yet the wheel just stays open.
   */
  holdKey?: string;
  /**
   * `holdKey` opened it and is still down. Until it's let go, the mouse aims as if it started in
   * the hub: the first flick goes from the centre, wherever the pointer was resting.
   */
  held?: boolean;
  /** Gallery only: draws it in place instead of over the screen. */
  inline?: boolean;
}

/**
 * A wheel of things to pick from, over the game. Moving the mouse towards an item highlights it
 * (no need to reach it), as does hovering or the arrow keys; a click, a tap or Enter picks.
 * Opened by holding a key (`held`), the mouse aims from wherever it was, as if from the hub.
 * Esc or a click outside closes it. Like a Dialog, it holds focus while it's open.
 */
export function Wheel<T extends string>({
  open,
  onClose,
  label,
  items,
  onPick,
  children,
  holdKey,
  held = false,
  inline = false,
}: WheelProps<T>) {
  const { sounds, layer } = useUi();
  const box = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // which item has focus: the one a pick would take
  const [active, setActive] = useState(-1);
  const pressedOutside = useRef(false);
  // while the key that opened it is held: aim from where the pointer was first seen, not the centre
  const aiming = useRef(false);
  const start = useRef<Point>(undefined);
  const close = () => {
    sounds.back();
    onClose();
  };
  const pick = (id: T) => {
    sounds.confirm();
    onPick(id);
  };
  useBack(close, open && !inline, 1);

  useLayoutEffect(() => {
    const node = box.current;
    if (!open || inline) return;
    // the wheel itself takes focus, with nothing highlighted: a tap on the key that opened it picks nothing
    node?.focus({ preventScroll: true });
    return () => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && node?.contains(focused)) focused.blur();
    };
  }, [open, inline]);

  useLayoutEffect(() => {
    if (!open) return;
    aiming.current = held && !!holdKey && !inline;
    start.current = undefined;
  }, [open, held, holdKey, inline]);

  if (!open) return null;

  const focus = (i: number) => buttons.current[i]?.focus({ preventScroll: true });

  // the mouse only has to head for an item: whichever wedge it points into gets the highlight
  const flick = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || (e.movementX === 0 && e.movementY === 0) || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const pointer = { x: e.clientX, y: e.clientY };
    if (aiming.current) start.current ??= pointer;
    const centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const aim = aimAt(pointer, centre, aiming.current ? start.current : undefined);
    const i = wedgeAt(aim.x, aim.y, items.length, r.width * HUB);
    if (i >= 0 && i !== active) focus(i);
  };

  const keys = (e: KeyboardEvent<HTMLElement>) => {
    const intent = intentOf(e);
    // round the wheel either way; Tab stays inside it too
    const dir =
      e.key === "Tab"
        ? e.shiftKey
          ? -1
          : 1
        : intent === "left" || intent === "up"
          ? -1
          : intent === "right" || intent === "down"
            ? 1
            : 0;
    if (!dir) return;
    e.preventDefault();
    focus(step(active, items.length, dir));
  };

  const wheel = (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a modal keeps the keyboard inside itself (the WAI-ARIA dialog pattern)
    <div
      ref={box}
      role="dialog"
      aria-modal={!inline}
      aria-label={label}
      tabIndex={-1}
      className={s.wheel}
      onKeyDown={keys}
      onKeyUp={(e) => {
        if (!holdKey || e.key.toLowerCase() !== holdKey) return;
        const item = items[active];
        if (item) pick(item.id);
        // let go with nothing picked: it stays open, and the mouse goes back to pointing where it is
        else aiming.current = false;
      }}
      // while aiming, what the pointer happens to be over doesn't take the highlight: only the flick does
      onPointerMoveCapture={(e) => {
        if (!aiming.current) return;
        e.stopPropagation();
        flick(e);
      }}
    >
      {items.map((item, i) => (
        <Slot
          key={item.id}
          item={item}
          angle={wedgeAngle(i, items.length)}
          active={i === active}
          ref={(el) => void (buttons.current[i] = el)}
          onFocus={() => setActive(i)}
          onBlur={() => setActive((now) => (now === i ? -1 : now))}
          onPick={() => pick(item.id)}
        />
      ))}
      <div className={s.hub}>
        {children}
        <span className={s.name} aria-hidden>
          {items[active]?.label ?? " "}
        </span>
      </div>
    </div>
  );
  if (inline) return wheel;

  return createPortal(
    <div
      role="presentation"
      className={s.backdrop}
      onPointerMove={flick}
      // a press that starts and ends outside the wheel closes it, on the click (see Dialog)
      onPointerDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget;
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onClick={(e) => {
        const outside = pressedOutside.current && e.target === e.currentTarget;
        pressedOutside.current = false;
        if (outside) close();
      }}
    >
      {wheel}
    </div>,
    layer ?? document.body,
  );
}

/** How much of the wheel's width the hub's radius takes: closer in than this, the mouse highlights nothing. */
const HUB = 0.14;

function Slot<T extends string>({
  item,
  angle,
  active,
  ref,
  onFocus,
  onBlur,
  onPick,
}: {
  item: WheelItem<T>;
  angle: number;
  active: boolean;
  ref: (el: HTMLButtonElement | null) => void;
  onFocus(): void;
  onBlur(): void;
  onPick(): void;
}) {
  const focus = useFocusable();
  return (
    <button
      type="button"
      {...focus}
      ref={ref}
      tabIndex={-1}
      className={cx(s.item, active && s.active)}
      style={{ "--angle": `${angle}deg` }}
      aria-label={item.label}
      onFocus={(e) => {
        focus.onFocus(e);
        onFocus();
      }}
      onBlur={(e) => {
        focus.onBlur(e);
        onBlur();
      }}
      onClick={onPick}
    >
      <span aria-hidden>{item.icon}</span>
    </button>
  );
}
