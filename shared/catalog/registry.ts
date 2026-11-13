// What every catalog list gets: its ids as a tuple (for z.enum) and a lookup
// by id that keeps each entry's exact type. The one cast lives here so callers
// never need one.

type Entry = { readonly id: string };

/** Every id in the list, as the non-empty tuple z.enum() takes. */
export function idsOf<T extends readonly [Entry, ...Entry[]]>(items: T): [T[number]["id"], ...T[number]["id"][]] {
  const [first, ...rest]: readonly [T[number], ...T[number][]] = items;
  return [first.id, ...rest.map((i) => i.id)];
}

/** The list keyed by id. */
export function byId<T extends readonly Entry[]>(items: T): { readonly [K in T[number] as K["id"]]: K } {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.fromEntries can't type a key-remapped object; its entries come from this list
  return Object.fromEntries(items.map((i) => [i.id, i])) as { readonly [K in T[number] as K["id"]]: K };
}
