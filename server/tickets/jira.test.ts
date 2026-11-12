import { test } from "node:test";
import assert from "node:assert/strict";
import { adfToText } from "./jira.ts";

test("ADF flattens to text", () => {
  const doc = { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] }] },
  ] };
  assert.equal(adfToText(doc).trim(), "Hello world\n\n• one");
});
