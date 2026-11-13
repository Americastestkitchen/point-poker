// What every catalog list gets: its ids as a tuple (for z.enum) and a lookup
// by id that keeps each entry's exact type. The casts live here so callers
// never need one.

type Entry = { readonly id: string };

/** Every id in the list, as the non-empty tuple z.enum() takes. */
export function idsOf<T extends readonly [Entry, ...Entry[]]>(items: T): [T[number]["id"], ...T[number]["id"][]] {
  return items.map((i) => i.id) as [T[number]["id"], ...T[number]["id"][]];
}

/** The list keyed by id. */
export function byId<T extends readonly Entry[]>(items: T): { readonly [K in T[number] as K["id"]]: K } {
  return Object.fromEntries(items.map((i) => [i.id, i])) as { readonly [K in T[number] as K["id"]]: K };
}
