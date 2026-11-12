// Rules both the server and the browser use, as plain functions.

const KEY_RE = /\b([A-Z][A-Z0-9_]+-\d+)\b/;

/** Pulls an issue key out of a pasted link (browse/, selectedIssue=, etc.) or a bare key. */
export function parseIssueKey(ref: string): string | null {
  const m = ref.trim().toUpperCase().match(KEY_RE);
  return m ? m[1] : null;
}
