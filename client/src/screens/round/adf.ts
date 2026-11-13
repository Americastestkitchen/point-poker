// Jira's Atlassian Document Format, read into a small tree of safe elements. Pure, so it's
// tested in node; Adf.tsx turns the tree into React elements (never raw HTML), so ticket
// content can't inject markup. Tags come from a fixed list, links only go to http(s).
import { safeUrl } from "../text.ts";

/** The elements a description can use. */
export type AdfTag =
  | "div"
  | "p"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "ul"
  | "ol"
  | "li"
  | "blockquote"
  | "pre"
  | "code"
  | "hr"
  | "br"
  | "span"
  | "strong"
  | "em"
  | "s"
  | "u"
  | "a"
  | "table"
  | "tbody"
  | "tr"
  | "th"
  | "td";

/** What an element is for, beyond its tag; Adf.tsx styles each one. */
export type AdfRole =
  | "tasks"
  | "task"
  | "taskDone"
  | "mention"
  | "lozenge"
  | "cardLink"
  | "media"
  | "tableWrap"
  | "expand"
  | "expandTitle"
  | "empty"
  | `panel-${PanelType}`;

export type PanelType = "info" | "note" | "warning" | "error" | "success";
const PANELS: readonly PanelType[] = ["info", "note", "warning", "error", "success"];

export interface AdfElement {
  tag: AdfTag;
  role?: AdfRole;
  /** Only on `a`, and only http(s). */
  href?: string;
  children: AdfOut[];
}
export type AdfOut = AdfElement | string;

/** ADF as it comes off the wire: anything, read carefully. */
interface Node {
  type: string;
  text: string | undefined;
  attrs: Record<string, unknown>;
  marks: { type: string; attrs: Record<string, unknown> }[];
  content: unknown[] | undefined;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function read(v: unknown): Node | null {
  if (!isObject(v) || typeof v.type !== "string") return null;
  return {
    type: v.type,
    text: str(v.text),
    attrs: isObject(v.attrs) ? v.attrs : {},
    marks: Array.isArray(v.marks)
      ? v.marks.filter(isObject).map((m) => ({ type: str(m.type) ?? "", attrs: isObject(m.attrs) ? m.attrs : {} }))
      : [],
    content: Array.isArray(v.content) ? v.content : undefined,
  };
}

const el = (tag: AdfTag, children: AdfOut[] = [], extra: Partial<AdfElement> = {}): AdfElement => ({
  tag,
  children,
  ...extra,
});

const MARKS: Record<string, AdfTag> = { strong: "strong", em: "em", code: "code", strike: "s", underline: "u" };

/** Text with its marks, the first mark innermost (as Jira nests them). */
function text(node: Node): AdfOut {
  let out: AdfOut = node.text ?? "";
  for (const m of node.marks) {
    const tag = MARKS[m.type];
    if (tag) out = el(tag, [out]);
    else if (m.type === "link") {
      const href = safeUrl(m.attrs.href);
      if (href) out = el("a", [out], { href });
    }
  }
  return out;
}

function kids(node: Node): AdfOut[] {
  return (node.content ?? []).flatMap((c) => {
    const r = render(c);
    return r === null ? [] : [r];
  });
}

/** Jira's levels 1–6 sit under the sheet's own title: h3 at the biggest (no level reads as 3). */
const heading = (level: unknown): AdfTag => {
  const n = typeof level === "number" && Number.isFinite(level) ? level : 3;
  const h = Math.min(6, Math.max(3, Math.round(n) + 2));
  return h === 3 ? "h3" : h === 4 ? "h4" : h === 5 ? "h5" : "h6";
};

function render(raw: unknown): AdfOut | null {
  const node = read(raw);
  if (!node) return null;
  const a = node.attrs;
  switch (node.type) {
    case "doc":
      return el("div", kids(node));
    case "text":
      return text(node);
    case "paragraph":
      return el("p", kids(node));
    case "heading":
      return el(heading(a.level), kids(node));
    case "bulletList":
      return el("ul", kids(node));
    case "orderedList":
      return el("ol", kids(node));
    case "listItem":
      return el("li", kids(node));
    case "taskList":
      return el("ul", kids(node), { role: "tasks" });
    case "taskItem": {
      const done = a.state === "DONE";
      return el("li", [done ? "☑ " : "☐ ", ...kids(node)], { role: done ? "taskDone" : "task" });
    }
    case "blockquote":
      return el("blockquote", kids(node));
    case "codeBlock":
      return el("pre", [el("code", kids(node))]);
    case "rule":
      return el("hr");
    case "hardBreak":
      return el("br");
    case "panel": {
      const type = PANELS.find((p) => p === a.panelType) ?? "info";
      return el("div", kids(node), { role: `panel-${type}` });
    }
    case "mention":
      return el("span", [str(a.text) ?? "@someone"], { role: "mention" });
    case "emoji":
      return str(a.text) ?? str(a.shortName) ?? "";
    case "status":
      return el("span", [str(a.text) ?? ""], { role: "lozenge" });
    case "date": {
      const when = Number(a.timestamp);
      return a.timestamp && Number.isFinite(when) ? new Date(when).toLocaleDateString() : "";
    }
    case "inlineCard":
    case "blockCard":
    case "embedCard": {
      const href = safeUrl(a.url);
      if (!href) return null;
      const link = el("a", [href.replace(/^https?:\/\/(www\.)?/i, "").slice(0, 70)], { href, role: "cardLink" });
      return node.type === "inlineCard" ? link : el("p", [link]);
    }
    case "mediaSingle":
    case "mediaGroup":
      return el("div", ["📎 Attachment (open in Jira to view)"], { role: "media" });
    case "media":
      return null;
    case "table":
      return el("div", [el("table", [el("tbody", kids(node))])], { role: "tableWrap" });
    case "tableRow":
      return el("tr", kids(node));
    case "tableHeader":
      return el("th", kids(node));
    case "tableCell":
      return el("td", kids(node));
    // shown open, with its title: there's nothing to unfold on a printed ticket
    case "expand":
    case "nestedExpand":
      return el("div", [el("p", [str(a.title) || "Details"], { role: "expandTitle" }), ...kids(node)], {
        role: "expand",
      });
    default:
      return node.content ? el("div", kids(node)) : null;
  }
}

/** All the text in a tree, as it would read. */
export function textOf(out: AdfOut): string {
  return typeof out === "string" ? out : out.children.map(textOf).join("");
}

/**
 * A ticket's description as a tree: the rich one when it says anything, else the plain text
 * in paragraphs, else a shrug.
 */
export function readAdf(adf: unknown, fallback: string): AdfOut[] {
  const doc = render(adf);
  if (doc !== null && textOf(doc).trim()) return [doc];
  if (fallback.trim()) return fallback.split(/\n{2,}/).map((para) => el("p", [para]));
  return [el("p", ["No description. Bold of them."], { role: "empty" })];
}
