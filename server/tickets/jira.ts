// Read-only Jira Cloud client. Only issues GET requests.
import type { Ticket, TicketSummary } from "../../shared/protocol.ts";
import { parseIssueKey } from "../../shared/rules.ts";
import type { TicketQuery, TicketSource } from "./source.ts";

/** How we sign in to Jira. An API token today; OAuth (#12) becomes a second kind. */
export type JiraAuth = { kind: "apiToken"; email: string; token: string };

export interface JiraConfig {
  baseUrl: string;
  auth: JiraAuth;
  /** The custom field that holds story points. */
  pointsField?: string;
  /** Project used for "current & upcoming sprints" when there's no ticket to go by. */
  defaultProject?: string;
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

const upcomingJql = (project: string) =>
  `project = ${project} AND sprint in (openSprints(), futureSprints()) AND statusCategory != Done ORDER BY rank`;
const epicChildrenJql = (epicKey: string) => `parent = ${epicKey} ORDER BY rank`;

export function jiraSource(cfg: JiraConfig): TicketSource {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const pointsField = cfg.pointsField ?? "customfield_10004";
  const authorization = "Basic " + Buffer.from(`${cfg.auth.email}:${cfg.auth.token}`).toString("base64");

  async function get(path: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: authorization, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) throw new Error("Ticket not found (or no access)");
    if (!res.ok) throw new Error(`Jira answered ${res.status}`);
    return res.json();
  }

  async function search(jql: string): Promise<TicketSummary[]> {
    const j = await get("/rest/api/3/search/jql", { jql, fields: `summary,status,${pointsField}`, maxResults: "50" });
    return (j.issues ?? []).map((i: any) => ({
      key: i.key,
      summary: i.fields?.summary ?? "",
      status: i.fields?.status?.name ?? "",
      points: typeof i.fields?.[pointsField] === "number" ? i.fields[pointsField] : null,
    }));
  }

  return {
    enabled: true,
    async get(ref) {
      const key = parseIssueKey(ref);
      if (!key) throw new Error("That doesn't look like a ticket link or key");
      const fields = ["summary", "description", "issuetype", "status", "priority", "assignee", "reporter", "labels", "parent", pointsField];
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
        currentPoints: typeof f[pointsField] === "number" ? f[pointsField] : null,
        url: `${base}/browse/${j.key}`,
        adf: f.description && JSON.stringify(f.description).length < 300_000 ? f.description : null,
        statusCategory: ["new", "indeterminate", "done"].includes(f.status?.statusCategory?.key) ? f.status.statusCategory.key : "",
        parent: f.parent ? { key: f.parent.key, summary: f.parent.fields?.summary ?? "" } : null,
      } satisfies Ticket;
    },
    async find(q: TicketQuery) {
      switch (q.kind) {
        case "epic": return { label: `Epic ${q.key}`, tickets: await search(epicChildrenJql(q.key)) };
        case "upcoming": return { label: "Current & upcoming sprints", tickets: await search(upcomingJql(q.project ?? cfg.defaultProject ?? "SD")) };
      }
    },
  };
}
