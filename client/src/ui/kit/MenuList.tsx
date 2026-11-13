import { useEffect, useRef, type ReactNode } from "react";
import { useUi } from "../context.tsx";
import { useFocusable, useRoving, type DemoState } from "../focus.ts";
import { cx } from "./cx.ts";
import s from "./MenuList.module.css";

export interface MenuItem<Id extends string = string> {
  id: Id;
  label: ReactNode;
  /** A short line under the label. */
  hint?: ReactNode;
  disabled?: boolean;
}

export interface MenuListProps<Id extends string> {
  items: readonly MenuItem<Id>[];
  onSelect: (id: Id) => void;
  /** Read out by screen readers. */
  label: string;
  /** Focus the first item on mount, for menus that are the whole screen. */
  autoFocus?: boolean;
  /** Gallery only: force one item's look. */
  demo?: { id: Id; state: DemoState };
}

/** A game menu: ↑/↓ or the mouse move the highlight, Enter or a click picks. */
export function MenuList<Id extends string>({ items, onSelect, label, autoFocus, demo }: MenuListProps<Id>) {
  const { sounds } = useUi();
  const roving = useRoving(items.length, { disabled: (i) => !!items[i]?.disabled });
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoFocus) list.current?.querySelector<HTMLElement>("[tabindex='0']")?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div ref={list} role="menu" aria-label={label} className={s.menu} onKeyDown={roving.onKeyDown}>
      {items.map((item, i) => (
        <Item
          key={item.id}
          item={item}
          roving={roving.item(i)}
          demoState={demo?.id === item.id ? demo.state : undefined}
          onPick={() => {
            sounds.confirm();
            onSelect(item.id);
          }}
        />
      ))}
    </div>
  );
}

function Item({
  item,
  roving,
  demoState,
  onPick,
}: {
  item: MenuItem;
  roving: ReturnType<ReturnType<typeof useRoving>["item"]>;
  demoState?: DemoState;
  onPick: () => void;
}) {
  const focus = useFocusable(item.disabled);
  return (
    <button
      type="button"
      role="menuitem"
      {...roving}
      {...focus}
      disabled={item.disabled}
      aria-disabled={item.disabled}
      data-demo={demoState}
      className={cx(s.item)}
      onClick={onPick}
    >
      <span className={s.marker} aria-hidden>
        ▸
      </span>
      <span className={s.text}>
        <span className={s.label}>{item.label}</span>
        {item.hint && <span className={s.hint}>{item.hint}</span>}
      </span>
    </button>
  );
}
