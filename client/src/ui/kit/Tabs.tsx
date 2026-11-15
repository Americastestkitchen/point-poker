import { useId, type ReactNode } from "react";
import { useUi } from "../context.tsx";
import { useFocusable, useRoving, type DemoState } from "../focus.ts";
import { cx } from "./cx.ts";
import s from "./Tabs.module.css";

export interface Tab<Id extends string> {
  id: Id;
  label: ReactNode;
}

export interface TabsProps<Id extends string> {
  /** Read out by screen readers. */
  label: string;
  tabs: readonly Tab<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  /** The chosen tab's content. */
  children: ReactNode;
  className?: string;
  /** Gallery only: force one tab's look. */
  demo?: { id: Id; state: DemoState };
}

/**
 * A row of tabs over one panel. ←/→ or the mouse move the highlight; Enter, Space or a click
 * picks (a mouse passing over a tab only moves the focus, so it doesn't flip the panel).
 */
export function Tabs<Id extends string>({ label, tabs, value, onChange, children, className, demo }: TabsProps<Id>) {
  const { sounds } = useUi();
  const roving = useRoving(tabs.length, { orientation: "horizontal" });
  const base = useId();
  const tabId = (id: Id) => `${base}-tab-${id}`;
  const panelId = `${base}-panel`;
  return (
    <div className={cx(s.tabs, className)}>
      {/* oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- the tabs are the focus stops (roving tabindex); their arrow keys bubble here */}
      <div role="tablist" aria-label={label} className={s.list} onKeyDown={roving.onKeyDown}>
        {tabs.map((tab, i) => (
          <TabButton
            key={tab.id}
            id={tabId(tab.id)}
            panel={panelId}
            selected={tab.id === value}
            // the chosen tab is the Tab stop (and where a dialog's focus lands); ←/→ still reach the rest
            roving={{ ...roving.item(i), tabIndex: tab.id === value ? 0 : -1 }}
            demoState={demo?.id === tab.id ? demo.state : undefined}
            onPick={() => {
              if (tab.id === value) return;
              sounds.confirm();
              onChange(tab.id);
            }}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(value)} className={s.panel}>
        {children}
      </div>
    </div>
  );
}

function TabButton({
  id,
  panel,
  selected,
  roving,
  demoState,
  onPick,
  children,
}: {
  id: string;
  panel: string;
  selected: boolean;
  roving: ReturnType<ReturnType<typeof useRoving>["item"]>;
  demoState?: DemoState;
  onPick: () => void;
  children: ReactNode;
}) {
  const focus = useFocusable();
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={panel}
      {...roving}
      {...focus}
      data-demo={demoState}
      className={s.tab}
      onClick={onPick}
    >
      {children}
    </button>
  );
}
