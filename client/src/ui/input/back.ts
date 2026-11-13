// "Esc goes back": whatever opened last (a dialog, a sub-menu) closes first.

export type BackHandler = () => void;

export function createBackStack() {
  const stack: { handler: BackHandler }[] = [];
  return {
    /** Register a way back; call the returned function when it's no longer open. */
    push(handler: BackHandler): () => void {
      const entry = { handler };
      stack.push(entry);
      return () => {
        const i = stack.indexOf(entry);
        if (i >= 0) stack.splice(i, 1);
      };
    },
    /** Go back from the topmost thing. False when there's nothing to go back from. */
    back(): boolean {
      const top = stack.at(-1);
      if (!top) return false;
      top.handler();
      return true;
    },
    get depth() { return stack.length; },
  };
}

export type BackStack = ReturnType<typeof createBackStack>;
