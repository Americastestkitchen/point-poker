// An invite link pasted into Join a table: `https://…/?room=BCDF` from this same site gives its
// table code. Production, the dev site and each preview keep their own tables, so a link from
// another site points at a table that isn't here.
import { TABLE_CODE } from "../../../../shared/rules.ts";

export type PastedLink = { t: "code"; code: string } | { t: "rejected"; reason: string };

export const NOT_OURS = "That link isn't one of our tables.";
export const NO_CODE = "That link doesn't have a table code in it.";
export const BAD_CODE = "That link's table code doesn't look right.";

const CODE = new RegExp(`^[${TABLE_CODE.letters}]{${TABLE_CODE.length}}$`);

/**
 * What pasted `text` says, on the page at `here` (its origin and path): a table code, or why the
 * link won't do. Null when it isn't a link at all, so the slots take it like typing.
 */
export function readInviteLink(text: string, here: string): PastedLink | null {
  const pasted = text.trim();
  // a code never has these; a link always does
  if (!/[/?=]/.test(pasted)) return null;
  let url: URL;
  try {
    url = new URL(pasted);
  } catch {
    return { t: "rejected", reason: NOT_OURS };
  }
  if (url.origin + url.pathname !== here) return { t: "rejected", reason: NOT_OURS };
  const room = url.searchParams.get("room")?.trim().toUpperCase();
  if (!room) return { t: "rejected", reason: NO_CODE };
  return CODE.test(room) ? { t: "code", code: room } : { t: "rejected", reason: BAD_CODE };
}
