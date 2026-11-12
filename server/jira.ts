// Read-only Jira Cloud client. Only issues GET requests.
import type { Ticket, TicketSummary } from "../shared/protocol.ts";

const BASE = process.env.JIRA_BASE_URL?.replace(/\/+$/, "") ?? "";
const EMAIL = process.env.JIRA_EMAIL ?? "";
const TOKEN = process.env.JIRA_API_TOKEN ?? "";
const POINTS_FIELD = process.env.JIRA_POINTS_FIELD ?? "customfield_10004";

export const jiraEnabled = Boolean(BASE && EMAIL && TOKEN);

const KEY_RE = /\b([A-Z][A-Z0-9_]+-\d+)\b/;

/** Pulls an issue key out of a pasted link (browse/, selectedIssue=, etc.) or a bare key. */
export function parseIssueKey(ref: string): string | null {
  const m = ref.trim().toUpperCase().match(KEY_RE);
  return m ? m[1] : null;
}

async function get(path: string, params: Record<string, string> = {}): Promise<any> {
  if (!jiraEnabled) throw new Error("Jira isn't configured on the server");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64"),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) throw new Error("Ticket not found (or no access)");
  if (!res.ok) throw new Error(`Jira answered ${res.status}`);
  return res.json();
}

/** Flattens Atlassian Document Format into readable plain text. */
export function adfToText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  const kids = () => (node.content ?? []).map(adfToText).join("");
  switch (node.type) {
    case "text": return node.text ?? "";
    case "hardBreak": return "\n";
    case "mention": return node.attrs?.text ?? "@someone";
    case "emoji": return node.attrs?.text ?? node.attrs?.shortName ?? "";
    case "inlineCard": case "blockCard": return node.attrs?.url ?? "";
    case "paragraph": case "heading": return kids() + "\n\n";
    case "listItem": return "• " + kids().trim() + "\n";
    case "bulletList": case "orderedList": return kids() + "\n";
    case "codeBlock": return kids() + "\n\n";
    case "rule": return "———\n";
    case "tableRow": return (node.content ?? []).map((c: any) => adfToText(c).trim()).join(" | ") + "\n";
    case "mediaSingle": case "mediaGroup": case "media": return "[attachment]\n";
    default: return kids();
  }
}

export async function fetchTicket(ref: string): Promise<Ticket> {
  const key = parseIssueKey(ref);
  if (!key) throw new Error("That doesn't look like a ticket link or key");
  const fields = ["summary", "description", "issuetype", "status", "priority", "assignee", "reporter", "labels", "parent", POINTS_FIELD];
  const j = await get(`/rest/api/3/issue/${encodeURIComponent(key)}`, { fields: fields.join(",") });
  const f = j.fields ?? {};
  return {
    key: j.key,
    summary: f.summary ?? "",
    description: adfToText(f.description).replace(/\n{3,}/g, "\n\n").trim().slice(0, 6000),
    type: f.issuetype?.name ?? "",
    status: f.status?.name ?? "",
    priority: f.priority?.name ?? "",
    assignee: f.assignee?.displayName ?? "Unassigned",
    reporter: f.reporter?.displayName ?? "",
    labels: f.labels ?? [],
    currentPoints: typeof f[POINTS_FIELD] === "number" ? f[POINTS_FIELD] : null,
    url: `${BASE}/browse/${j.key}`,
    adf: f.description && JSON.stringify(f.description).length < 300_000 ? f.description : null,
    statusCategory: ["new", "indeterminate", "done"].includes(f.status?.statusCategory?.key) ? f.status.statusCategory.key : "",
    parent: f.parent ? { key: f.parent.key, summary: f.parent.fields?.summary ?? "" } : null,
  };
}

export function defaultQueueJql(project: string): string {
  return `project = ${project} AND sprint in (openSprints(), futureSprints()) AND statusCategory != Done ORDER BY rank`;
}

export async function searchTickets(jql: string): Promise<TicketSummary[]> {
  const j = await get("/rest/api/3/search/jql", {
    jql,
    fields: `summary,status,${POINTS_FIELD}`,
    maxResults: "50",
  });
  return (j.issues ?? []).map((i: any) => ({
    key: i.key,
    summary: i.fields?.summary ?? "",
    status: i.fields?.status?.name ?? "",
    points: typeof i.fields?.[POINTS_FIELD] === "number" ? i.fields[POINTS_FIELD] : null,
  }));
}

export function epicChildrenJql(epicKey: string): string {
  return `parent = ${epicKey} ORDER BY rank`;
}

export const defaultProject = process.env.JIRA_PROJECT ?? "SD";
