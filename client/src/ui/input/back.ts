// "Esc goes back": whatever is on top (a dialog, a sub-menu) takes it first.

export type BackHandler = () => void;

export function createBackStack() {
  const stack: { handler: BackHandler; depth: number }[] = [];
  return {
    /**
     * Register a way back; call the returned function when it's no longer open.
     * `depth` is how deeply it's nested (a dialog opened from inside a dialog is one deeper):
     * the deepest goes first, and among equals the one that opened last.
     */
    push(handler: BackHandler, depth = 0): () => void {
      const entry = { handler, depth };
      stack.push(entry);
      return () => {
        const i = stack.indexOf(entry);
        if (i >= 0) stack.splice(i, 1);
      };
    },
    /** Go back from the topmost thing. False when there's nothing to go back from. */
    back(): boolean {
      let top = stack[0];
      for (const entry of stack) if (top && entry.depth >= top.depth) top = entry;
      if (!top) return false;
      top.handler();
      return true;
    },
    get depth() {
      return stack.length;
    },
  };
}

export type BackStack = ReturnType<typeof createBackStack>;
