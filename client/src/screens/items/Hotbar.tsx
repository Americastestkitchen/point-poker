// The hotbar (region "items", the right edge; a row over the dock on phones): your hand items.
// The lit one is what clicking someone uses on them. Pick with a click or a tap, the number
// keys, or the scroll wheel over the room (the world's keys and wheel live in
// scene/engine/input.ts). An item that was just used drains back up while it cools down.
import { useEffect, useReducer } from "react";
import { ITEMS, type ItemId } from "../../../../shared/catalog/items.ts";
import { cooldownOf } from "../../app/items.ts";
import { Button, cx, useRoving } from "../../ui/index.ts";
import { useAppState, useGame } from "../game.tsx";
import { useLetGoAfterTouch } from "../parts/touch.ts";
import s from "./Hotbar.module.css";

export function Hotbar() {
  const picked = useAppState((st) => st.ui.item);
  const roving = useRoving(ITEMS.length);
  const now = ITEMS.find((i) => i.id === picked);
  return (
    <div className={s.wrap}>
      {/* what you just picked, said once: it fades by itself, and comes back when you pick another */}
      {now && (
        <p key={now.id} className={s.caption} aria-hidden>
          <b>{now.name}</b>
          <span>{now.does}</span>
        </p>
      )}
      <div className={s.bar} role="toolbar" aria-label="Hand items" aria-orientation="vertical">
        {ITEMS.map((item, i) => (
          <Slot
            key={item.id}
            item={item}
            picked={item.id === picked}
            roving={roving.item(i)}
            onKeyDown={roving.onKeyDown}
          />
        ))}
      </div>
    </div>
  );
}

function Slot({
  item,
  picked,
  roving,
  onKeyDown,
}: {
  item: (typeof ITEMS)[number];
  picked: boolean;
  roving: ReturnType<ReturnType<typeof useRoving>["item"]>;
  onKeyDown: ReturnType<typeof useRoving>["onKeyDown"];
}) {
  const { actions } = useGame();
  const usedAt = useAppState((st) => st.ui.itemsUsed[item.id]);
  const cooling = useCooling(item.id, usedAt);
  const tap = useLetGoAfterTouch(() => actions.items.pick(item.id));
  return (
    <Button
      {...roving}
      {...tap}
      shape="round"
      size="md"
      className={cx(s.slot, picked && s.picked)}
      aria-pressed={picked}
      aria-keyshortcuts={item.key}
      aria-label={`${item.name}: ${item.does.toLowerCase()}`}
      title={`${item.name}: ${item.does.toLowerCase()}`}
      onKeyDown={onKeyDown}
    >
      <span className={s.emoji} aria-hidden>
        {item.emoji}
      </span>
      <kbd className={s.key} aria-hidden>
        {item.key}
      </kbd>
      {/* a new one each use, so the drain starts over */}
      {cooling && <span key={usedAt} className={s.cooling} style={{ animationDuration: `${cooldownOf(item.id)}ms` }} />}
    </Button>
  );
}

/** Whether `item` is still cooling down, re-rendering when it's ready again. */
function useCooling(item: ItemId, usedAt: number | undefined): boolean {
  const { actions } = useGame();
  const [, ready] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    // nothing to wait for until it's been used
    const left = usedAt === undefined ? 0 : actions.items.cooling(item);
    if (left <= 0) return;
    const timer = setTimeout(ready, left);
    return () => clearTimeout(timer);
  }, [actions, item, usedAt]);
  return usedAt !== undefined && actions.items.cooling(item) > 0;
}
