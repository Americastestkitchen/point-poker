// Every pp-* key the browser keeps, typed. The only module that knows the key names.
import { z } from "zod";
import { Look } from "../../../shared/look.ts";

/** The subset of the Web Storage API we use; tests pass an in-memory one. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What we remember about you. */
export const Profile = z.object({ name: z.string(), look: Look });
export type Profile = z.infer<typeof Profile>;

/** A saved profile, keeping whichever parts still read: a bad look doesn't lose your name. */
const SavedProfile = z
  .object({
    name: Profile.shape.name.optional().catch(undefined),
    look: Profile.shape.look.optional().catch(undefined),
  })
  .catch({});

export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

export function createStorage(s: StorageLike) {
  return {
    /** What we remember about you: name and look. Missing or unreadable parts come back undefined. */
    profile(): Partial<Profile> {
      let saved: unknown;
      try {
        saved = JSON.parse(s.getItem("pp-me") ?? "{}");
      } catch {
        /* start over */
      }
      return SavedProfile.parse(saved);
    },
    setProfile: (p: Profile) => s.setItem("pp-me", JSON.stringify(p)),

    /** Your seat token at a table, so a reload puts you back in your seat. */
    token: (room: string) => s.getItem(`pp-token-${room}`) ?? undefined,
    setToken: (room: string, token: string) => s.setItem(`pp-token-${room}`, token),

    /** Set on the browser that opened the table: it makes you the dealer. */
    dealerKey: (room: string) => s.getItem(`pp-dealer-${room}`) ?? undefined,
    setDealerKey: (room: string, key: string) => s.setItem(`pp-dealer-${room}`, key),

    hostPass: () => s.getItem("pp-host-pass") ?? "",
    setHostPass: (pass: string) => s.setItem("pp-host-pass", pass),

    muted: () => s.getItem("pp-muted") === "1",
    setMuted: (m: boolean) => s.setItem("pp-muted", m ? "1" : "0"),

    mic: () => !!s.getItem("pp-mic"),
    setMic: (on: boolean) => (on ? s.setItem("pp-mic", "1") : s.removeItem("pp-mic")),
  };
}

export type Storage = ReturnType<typeof createStorage>;
