// Turning whatever a `catch` caught into words a person can read.

/** An Error's message, or anything else thrown as a string. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
