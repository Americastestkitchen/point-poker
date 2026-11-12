// Renders Jira's Atlassian Document Format with DOM APIs only (no innerHTML),
// so ticket content can't inject markup.

type Node = { type: string; text?: string; attrs?: Record<string, any>; marks?: { type: string; attrs?: Record<string, any> }[]; content?: Node[] };

const safeUrl = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function text(node: Node): globalThis.Node {
  let out: HTMLElement | Text = document.createTextNode(node.text ?? "");
  for (const m of node.marks ?? []) {
    let wrap: HTMLElement | null = null;
    if (m.type === "strong") wrap = el("strong");
    else if (m.type === "em") wrap = el("em");
    else if (m.type === "code") wrap = el("code");
    else if (m.type === "strike") wrap = el("s");
    else if (m.type === "underline") wrap = el("u");
    else if (m.type === "link") {
      const href = safeUrl(m.attrs?.href);
      if (href) { const a = el("a"); a.href = href; a.target = "_blank"; a.rel = "noreferrer"; wrap = a; }
    }
    if (wrap) { wrap.append(out); out = wrap; }
  }
  return out;
}

function kids(parent: HTMLElement, node: Node) {
  for (const c of node.content ?? []) {
    const r = render(c);
    if (r) parent.append(r);
  }
  return parent;
}

function render(node: Node): globalThis.Node | null {
  switch (node.type) {
    case "doc": return kids(el("div"), node);
    case "text": return text(node);
    case "paragraph": return kids(el("p"), node);
    case "heading": {
      const lvl = Math.min(6, Math.max(3, (node.attrs?.level ?? 3) + 2));
      return kids(el(`h${lvl}` as "h3"), node);
    }
    case "bulletList": return kids(el("ul"), node);
    case "orderedList": return kids(el("ol"), node);
    case "listItem": return kids(el("li"), node);
    case "taskList": return kids(el("ul", "tasks"), node);
    case "taskItem": {
      const li = el("li", node.attrs?.state === "DONE" ? "done" : "");
      li.append(node.attrs?.state === "DONE" ? "☑ " : "☐ ");
      return kids(li, node);
    }
    case "blockquote": return kids(el("blockquote"), node);
    case "codeBlock": {
      const pre = el("pre");
      pre.append(kids(el("code"), node));
      return pre;
    }
    case "rule": return el("hr");
    case "hardBreak": return el("br");
    case "panel": return kids(el("div", `panel-${node.attrs?.panelType ?? "info"}`), node);
    case "mention": return el("span", "mention", node.attrs?.text ?? "@someone");
    case "emoji": return document.createTextNode(node.attrs?.text ?? node.attrs?.shortName ?? "");
    case "status": return el("span", "lozenge", node.attrs?.text ?? "");
    case "date": return document.createTextNode(node.attrs?.timestamp ? new Date(Number(node.attrs.timestamp)).toLocaleDateString() : "");
    case "inlineCard": case "blockCard": case "embedCard": {
      const href = safeUrl(node.attrs?.url);
      if (!href) return null;
      const a = el("a", "card-link", href.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70));
      a.href = href; a.target = "_blank"; a.rel = "noreferrer";
      return node.type === "inlineCard" ? a : (() => { const p = el("p"); p.append(a); return p; })();
    }
    case "mediaSingle": case "mediaGroup": return el("div", "media", "📎 Attachment (open in Jira to view)");
    case "media": return null;
    case "table": {
      const wrap = el("div", "table-wrap");
      const t = el("table");
      kids(t, node);
      wrap.append(t);
      return wrap;
    }
    case "tableRow": return kids(el("tr"), node);
    case "tableHeader": return kids(el("th"), node);
    case "tableCell": return kids(el("td"), node);
    case "expand": case "nestedExpand": {
      const d = el("details");
      d.append(el("summary", "", node.attrs?.title || "Details"));
      return kids(d, node);
    }
    default: return node.content ? kids(el("div"), node) : null;
  }
}

export function renderAdf(adf: unknown, fallback: string): HTMLElement {
  const box = el("div", "adf");
  const r = adf && typeof adf === "object" ? render(adf as Node) : null;
  if (r && (r as HTMLElement).textContent?.trim()) box.append(r);
  else if (fallback.trim()) for (const para of fallback.split(/\n{2,}/)) box.append(el("p", "", para));
  else box.append(el("p", "empty", "No description. Bold of them."));
  return box;
}
