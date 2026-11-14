// One value the browser reads with useSyncExternalStore: get it, set it, hear when it changes.
// Setting the same value (Object.is) tells nobody. A listener may unsubscribe while being told.

export function createValue<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: (): T => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      for (const l of [...listeners]) l();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
