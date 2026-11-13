import { test } from "node:test";
import assert from "node:assert/strict";
import { readAdf, textOf, type AdfOut } from "./adf.ts";

const doc = (...content: unknown[]) => ({ type: "doc", version: 1, content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks: unknown[] = []) => ({ type: "text", text, marks });
/** The one rendered doc's children. */
const body = (...content: unknown[]): AdfOut[] => {
  const [root] = readAdf(doc(...content), "");
  assert.ok(root && typeof root !== "string" && root.tag === "div");
  return root.children;
};

test("paragraphs, headings (under the sheet's title) and text", () => {
  assert.deepEqual(body(p(t("Hello"))), [{ tag: "p", children: ["Hello"] }]);
  const heads = body(
    { type: "heading", attrs: { level: 1 }, content: [t("a")] },
    { type: "heading", attrs: { level: 3 }, content: [t("b")] },
    { type: "heading", attrs: { level: 6 }, content: [t("c")] },
    { type: "heading", content: [t("d")] },
  );
  assert.deepEqual(heads.map((h) => typeof h !== "string" && h.tag), ["h3", "h5", "h6", "h5"]);
});

test("marks wrap the text, the first one innermost", () => {
  const [para] = body(p(t("x", [{ type: "strong" }, { type: "em" }, { type: "code" }, { type: "strike" }, { type: "underline" }, { type: "textColor" }])));
  assert.deepEqual(para, {
    tag: "p",
    children: [{ tag: "u", children: [{ tag: "s", children: [{ tag: "code", children: [{ tag: "em", children: [{ tag: "strong", children: ["x"] }] }] }] }] }],
  });
});

test("links only go to http(s), opening elsewhere", () => {
  const [para] = body(p(
    t("ok", [{ type: "link", attrs: { href: "https://example.com/a" } }]),
    t("bad", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
    t("odd", [{ type: "link", attrs: { href: 7 } }]),
  ));
  assert.deepEqual(para, { tag: "p", children: [{ tag: "a", href: "https://example.com/a", children: ["ok"] }, "bad", "odd"] });
});

test("lists, task lists, quotes, code, rules and breaks", () => {
  const out = body(
    { type: "bulletList", content: [{ type: "listItem", content: [p(t("one"))] }] },
    { type: "orderedList", content: [{ type: "listItem", content: [p(t("two"))] }] },
    { type: "taskList", content: [
      { type: "taskItem", attrs: { state: "DONE" }, content: [t("done")] },
      { type: "taskItem", attrs: { state: "TODO" }, content: [t("todo")] },
    ] },
    { type: "blockquote", content: [p(t("quote"))] },
    { type: "codeBlock", content: [t("let x = 1")] },
    { type: "rule" },
    p(t("a"), { type: "hardBreak" }, t("b")),
  );
  assert.deepEqual(out, [
    { tag: "ul", children: [{ tag: "li", children: [{ tag: "p", children: ["one"] }] }] },
    { tag: "ol", children: [{ tag: "li", children: [{ tag: "p", children: ["two"] }] }] },
    { tag: "ul", role: "tasks", children: [
      { tag: "li", role: "taskDone", children: ["☑ ", "done"] },
      { tag: "li", role: "task", children: ["☐ ", "todo"] },
    ] },
    { tag: "blockquote", children: [{ tag: "p", children: ["quote"] }] },
    { tag: "pre", children: [{ tag: "code", children: ["let x = 1"] }] },
    { tag: "hr", children: [] },
    { tag: "p", children: ["a", { tag: "br", children: [] }, "b"] },
  ]);
});

test("panels, mentions, emoji, status lozenges and dates", () => {
  const out = body(
    { type: "panel", attrs: { panelType: "warning" }, content: [p(t("careful"))] },
    { type: "panel", attrs: { panelType: "custom" }, content: [p(t("custom"))] },
    { type: "panel", content: [p(t("plain"))] },
    p(
      { type: "mention", attrs: { id: "1", text: "@Ada" } },
      { type: "mention", attrs: {} },
      { type: "emoji", attrs: { shortName: ":smile:", text: "😄" } },
      { type: "emoji", attrs: { shortName: ":custom:" } },
      { type: "status", attrs: { text: "IN REVIEW", color: "blue" } },
      { type: "date", attrs: { timestamp: "1700000000000" } },
      { type: "date", attrs: { timestamp: "soon" } },
    ),
  );
  assert.deepEqual(out.slice(0, 3).map((o) => typeof o !== "string" && o.role), ["panel-warning", "panel-info", "panel-info"]);
  const para = out[3];
  assert.ok(para && typeof para !== "string");
  const [mention, someone, emoji, custom, status, date, bad] = para.children;
  assert.deepEqual(mention, { tag: "span", role: "mention", children: ["@Ada"] });
  assert.deepEqual(someone, { tag: "span", role: "mention", children: ["@someone"] });
  assert.equal(emoji, "😄");
  assert.equal(custom, ":custom:");
  assert.deepEqual(status, { tag: "span", role: "lozenge", children: ["IN REVIEW"] });
  assert.equal(date, new Date(1700000000000).toLocaleDateString());
  assert.equal(bad, "", "not a date: nothing rather than 'Invalid Date'");
});

test("smart links: inline in the text, block and embed as their own line; unsafe ones vanish", () => {
  const long = `https://www.example.com/${"x".repeat(100)}`;
  const out = body(
    p({ type: "inlineCard", attrs: { url: "https://example.com/page" } }),
    { type: "blockCard", attrs: { url: long } },
    { type: "embedCard", attrs: { url: "javascript:alert(1)" } },
  );
  assert.deepEqual(out[0], { tag: "p", children: [{ tag: "a", role: "cardLink", href: "https://example.com/page", children: ["example.com/page"] }] });
  const block = out[1];
  assert.ok(block && typeof block !== "string" && block.tag === "p");
  const link = block.children[0];
  assert.ok(link && typeof link !== "string");
  assert.equal(link.href, long);
  assert.equal(textOf(link).length, 70, "the shown address is cut to 70 characters");
  assert.ok(textOf(link).startsWith("example.com/"));
  assert.equal(out.length, 2);
});

test("attachments point to Jira; tables get a scroller and a body", () => {
  const out = body(
    { type: "mediaSingle", content: [{ type: "media", attrs: { id: "x" } }] },
    { type: "mediaGroup", content: [{ type: "media" }] },
    { type: "table", content: [
      { type: "tableRow", content: [{ type: "tableHeader", content: [p(t("H"))] }] },
      { type: "tableRow", content: [{ type: "tableCell", content: [p(t("C"))] }] },
    ] },
  );
  assert.deepEqual(out[0], { tag: "div", role: "media", children: ["📎 Attachment (open in Jira to view)"] });
  assert.equal(typeof out[1] !== "string" && out[1]?.role, "media");
  assert.deepEqual(out[2], {
    tag: "div", role: "tableWrap", children: [{ tag: "table", children: [{ tag: "tbody", children: [
      { tag: "tr", children: [{ tag: "th", children: [{ tag: "p", children: ["H"] }] }] },
      { tag: "tr", children: [{ tag: "td", children: [{ tag: "p", children: ["C"] }] }] },
    ] }] }],
  });
});

test("expands show open with their title; unknown nodes keep their content or vanish", () => {
  const out = body(
    { type: "expand", attrs: { title: "More" }, content: [p(t("inside"))] },
    { type: "nestedExpand", attrs: {}, content: [p(t("deeper"))] },
    { type: "somethingNew", content: [p(t("kept"))] },
    { type: "extension", attrs: { extensionKey: "x" } },
    { notAType: true },
    "a string",
    null,
  );
  assert.deepEqual(out, [
    { tag: "div", role: "expand", children: [{ tag: "p", role: "expandTitle", children: ["More"] }, { tag: "p", children: ["inside"] }] },
    { tag: "div", role: "expand", children: [{ tag: "p", role: "expandTitle", children: ["Details"] }, { tag: "p", children: ["deeper"] }] },
    { tag: "div", children: [{ tag: "p", children: ["kept"] }] },
  ]);
});

test("no rich text: the plain description in paragraphs, or a shrug", () => {
  assert.deepEqual(readAdf(null, "First.\n\nSecond\nline."), [{ tag: "p", children: ["First."] }, { tag: "p", children: ["Second\nline."] }]);
  assert.deepEqual(readAdf(doc(p(), { type: "rule" }), "Plain"), [{ tag: "p", children: ["Plain"] }], "a doc with no words falls back");
  assert.deepEqual(readAdf("not adf", "  "), [{ tag: "p", role: "empty", children: ["No description. Bold of them."] }]);
  assert.deepEqual(readAdf([1, 2], ""), [{ tag: "p", role: "empty", children: ["No description. Bold of them."] }]);
});

test("text is never markup", () => {
  const [para] = body(p(t("<img src=x onerror=alert(1)>")));
  assert.deepEqual(para, { tag: "p", children: ["<img src=x onerror=alert(1)>"] });
});
