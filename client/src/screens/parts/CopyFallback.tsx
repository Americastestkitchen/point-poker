import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Button, Dialog, ScrollArea } from "../../ui/index.ts";
import { useGame } from "../game.tsx";
import s from "./CopyFallback.module.css";

/**
 * When the clipboard says no: the text, already selected, to copy by hand. The screen root
 * mounts one; call `useGame().copy.copy()` to use it.
 */
export function CopyFallback() {
  const { copy, toasts } = useGame();
  const shown = useSyncExternalStore(copy.subscribe, copy.fallback);
  const text = useRef<HTMLPreElement>(null);

  // select it all, so Ctrl+C (or a long press) copies straight away
  useLayoutEffect(() => {
    const el = text.current;
    const sel = el?.ownerDocument.getSelection();
    if (!el || !sel) return;
    sel.selectAllChildren(el);
  }, [shown]);

  return (
    <Dialog open={!!shown} onClose={copy.dismiss} title={shown?.title ?? ""} width="md"
      actions={<Button variant="primary" onPress={copy.dismiss}>Done</Button>}>
      <p className={s.note}>Your browser wouldn't let us copy it. It's selected: copy it from here.</p>
      <ScrollArea maxHeight="40vh" label="Text to copy" className={s.box}
        onCopy={() => { toasts.show("📋 Copied"); }}>
        <pre ref={text} className={s.text}>{shown?.text}</pre>
      </ScrollArea>
    </Dialog>
  );
}
