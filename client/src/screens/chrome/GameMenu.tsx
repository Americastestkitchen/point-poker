// The game menu (popup "menu"). Esc at the table already opens it: the screen
// root registers that (GameRoot.tsx useMenuKey), so this file only draws the menu and acts.
// It holds what you set rather than need at a glance: Character, Options (sound, mic),
// How to play and Invite, plus Leave table.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ConfirmDialog, Dialog, KeyHint, MenuList, type MenuItem } from "../../ui/index.ts";
import { useAppState, useGame, useMe, usePopup } from "../game.tsx";
import s from "./GameMenu.module.css";

type Choice = "resume" | "look" | "options" | "help" | "invite" | "leave";

export function GameMenu() {
  const { store, openLook, invite, leaveTable } = useGame();
  const popup = usePopup("menu");
  const code = useAppState((st) => st.room?.code);
  const me = useMe();
  // the "are you sure?" over the menu: a nested dialog, local to it
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!popup.open) setLeaving(false);
  }, [popup.open]);

  const items: readonly MenuItem<Choice>[] = [
    { id: "resume", label: <Label icon="▶">Resume</Label>, hint: <Hint>Back to the table</Hint> },
    {
      id: "look",
      label: (
        <Label icon={<span className={s.bean} style={{ "--me": me?.look.color } as CSSProperties} />}>Character</Label>
      ),
      hint: <Hint>Body, color & hat</Hint>,
    },
    { id: "options", label: <Label icon="⚙️">Options</Label>, hint: <Hint>Sound & mic</Hint> },
    { id: "help", label: <Label icon="❓">How to play</Label>, hint: <Hint>The rules, and the fun stuff</Hint> },
    { id: "invite", label: <Label icon="🔗">Invite</Label>, hint: <Hint>Copy this table's link</Hint> },
    { id: "leave", label: <Label icon="🚪">Leave table</Label> },
  ];

  const choose = (id: Choice) => {
    switch (id) {
      case "resume":
        return popup.close();
      case "look":
        popup.close();
        return openLook();
      case "options":
        return store.popupOpened("options");
      case "help":
        return store.popupOpened("help");
      // the menu stays open: the toast (or the copy-by-hand dialog) shows over it
      case "invite":
        return invite();
      case "leave":
        return setLeaving(true);
    }
  };

  return (
    <Dialog open={popup.open} onClose={popup.close} title="Menu" width="sm">
      {code && (
        <p className={s.table}>
          <span className={s.tableLabel}>Table</span>
          <span className={s.code} aria-label={`Table code ${code.split("").join(" ")}`}>
            {code.split("").map((ch, i) => (
              <span key={i} className={s.slot} aria-hidden>
                {ch}
              </span>
            ))}
          </span>
        </p>
      )}
      <MenuList label="Game menu" items={items} onSelect={choose} autoFocus />
      <p className={s.keys}>
        <KeyHint keys={["ArrowUp", "ArrowDown"]}>Move</KeyHint>
        <KeyHint keys={["Enter"]}>Pick</KeyHint>
        <KeyHint keys={["Escape"]}>Resume</KeyHint>
      </p>
      <ConfirmDialog
        open={leaving}
        title="Leave the table?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        tone="danger"
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          leaveTable();
        }}
      >
        <p className={s.confirm}>You'll go back to the start screen.</p>
      </ConfirmDialog>
    </Dialog>
  );
}

/** Lines up under the label, past the icon. */
function Hint({ children }: { children: ReactNode }) {
  return <span className={s.hint}>{children}</span>;
}

function Label({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className={s.label}>
      <span className={s.icon} aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  );
}
