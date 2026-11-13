// Read-only Jira Cloud client. Only issues GET requests.
import { z } from "zod";
import { Ticket, type TicketSummary } from "../../shared/protocol.ts";
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
  /** Tests pass a fake; otherwise the global fetch. */
  fetch?: typeof fetch;
}

// ---- Jira's replies, checked at the edge. An issue needs a key and fields;
// any field that's missing or odd falls back to a blank, so a strange issue
// still loads. Fields we don't name (like the points field) are kept as unknown.
const text = z.string().catch("");
const named = z.object({ name: text }).catch({ name: "" });
const person = z.object({ displayName: text }).nullable().catch(null);
const points = z.number().nullable().catch(null);

const Issue = z.object({
  key: z.string(),
  fields: z.looseObject({
    summary: text,
    /** Atlassian Document Format. */
    description: z.json().catch(null),
    issuetype: named,
    status: z.object({
      name: text,
      statusCategory: z.object({ key: Ticket.shape.statusCategory.catch("") }).catch({ key: "" }),
    }).catch({ name: "", statusCategory: { key: "" } }),
    priority: named,
    assignee: person,
    reporter: person,
    labels: z.array(z.string()).catch([]),
    parent: z.object({ key: z.string(), fields: z.object({ summary: text }).catch({ summary: "" }) }).nullable().catch(null),
  }),
});

const Search = z.object({
  issues: z.array(z.object({ key: z.string(), fields: z.looseObject({ summary: text, status: named }) })).default([]),
});

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
  const fetch = cfg.fetch ?? globalThis.fetch;

  /** GETs a Jira endpoint and checks the reply against `schema`. */
  async function get<S extends z.ZodType>(schema: S, path: string, params: Record<string, string> = {}): Promise<z.infer<S>> {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: authorization, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) throw new Error("Ticket not found (or no access)");
    if (!res.ok) throw new Error(`Jira answered ${res.status}`);
    const parsed = schema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw new Error("Jira sent a reply we couldn't read");
    return parsed.data;
  }

  async function search(jql: string): Promise<TicketSummary[]> {
    const j = await get(Search, "/rest/api/3/search/jql", { jql, fields: `summary,status,${pointsField}`, maxResults: "50" });
    return j.issues.map(({ key, fields: f }) => ({ key, summary: f.summary, status: f.status.name, points: points.parse(f[pointsField]) }));
  }

  return {
    enabled: true,
    async get(ref) {
      const key = parseIssueKey(ref);
      if (!key) throw new Error("That doesn't look like a ticket link or key");
      const fields = ["summary", "description", "issuetype", "status", "priority", "assignee", "reporter", "labels", "parent", pointsField];
      const { key: issueKey, fields: f } = await get(Issue, `/rest/api/3/issue/${encodeURIComponent(key)}`, { fields: fields.join(",") });
      return {
        key: issueKey,
        summary: f.summary,
        description: adfToText(f.description).replace(/\n{3,}/g, "\n\n").trim().slice(0, 6000),
        type: f.issuetype.name,
        status: f.status.name,
        priority: f.priority.name,
        assignee: f.assignee?.displayName ?? "Unassigned",
        reporter: f.reporter?.displayName ?? "",
        labels: f.labels,
        currentPoints: points.parse(f[pointsField]),
        url: `${base}/browse/${issueKey}`,
        adf: f.description && JSON.stringify(f.description).length < 300_000 ? f.description : null,
        statusCategory: f.status.statusCategory.key,
        parent: f.parent && { key: f.parent.key, summary: f.parent.fields.summary },
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
