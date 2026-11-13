import { test } from "node:test";
import assert from "node:assert/strict";
import { adfToText, jiraSource } from "./jira.ts";

test("ADF flattens to text", () => {
  const doc = { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] }] },
  ] };
  assert.equal(adfToText(doc).trim(), "Hello world\n\n• one");
});

/** A Jira that answers every GET with `reply` (or a status code), and remembers what was asked. */
function jira(reply: unknown, status = 200) {
  const asked: URL[] = [];
  const source = jiraSource({
    baseUrl: "https://jira.example/",
    auth: { kind: "apiToken", email: "a@b.c", token: "t" },
    pointsField: "customfield_1",
    fetch: async (url) => {
      asked.push(new URL(String(url)));
      return new Response(JSON.stringify(reply), { status });
    },
  });
  return { source, asked };
}

test("an issue becomes a ticket", async () => {
  const description = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Do it" }] }] };
  const { source, asked } = jira({
    key: "SD-1",
    fields: {
      summary: "Fix it", description, issuetype: { name: "Bug" }, priority: { name: "High" },
      status: { name: "In Progress", statusCategory: { key: "indeterminate" } },
      assignee: { displayName: "Ann" }, reporter: { displayName: "Bob" }, labels: ["ux"],
      parent: { key: "SD-0", fields: { summary: "The epic" } }, customfield_1: 3,
    },
  });
  assert.deepEqual(await source.get("https://jira.example/browse/SD-1"), {
    key: "SD-1", summary: "Fix it", description: "Do it", type: "Bug", status: "In Progress", priority: "High",
    assignee: "Ann", reporter: "Bob", labels: ["ux"], currentPoints: 3, url: "https://jira.example/browse/SD-1",
    adf: description, statusCategory: "indeterminate", parent: { key: "SD-0", summary: "The epic" },
  });
  assert.ok(asked[0]);
  assert.equal(asked[0].pathname, "/rest/api/3/issue/SD-1");
});

test("a sparse or odd issue still loads, with blanks", async () => {
  const { source } = jira({ key: "SD-2", fields: { summary: null, status: { statusCategory: { key: "weird" } }, labels: "nope", customfield_1: "5" } });
  const t = await source.get("SD-2");
  assert.deepEqual(
    [t.summary, t.type, t.status, t.priority, t.assignee, t.reporter, t.labels, t.currentPoints, t.adf, t.statusCategory, t.parent],
    ["", "", "", "", "Unassigned", "", [], null, null, "", null],
  );
});

test("a reply that isn't an issue is an error, not a broken ticket", async () => {
  await assert.rejects(jira({ fields: {} }).source.get("SD-3"), { message: "Jira sent a reply we couldn't read" });
  await assert.rejects(jira({ errorMessages: ["gone"] }, 404).source.get("SD-4"), { message: "Ticket not found (or no access)" });
  await assert.rejects(jira({}, 500).source.get("SD-5"), { message: "Jira answered 500" });
});

test("a search lists ticket summaries with their points", async () => {
  const { source, asked } = jira({ issues: [
    { key: "SD-1", fields: { summary: "One", status: { name: "To Do" }, customfield_1: 2 } },
    { key: "SD-2", fields: {} },
  ] });
  assert.deepEqual(await source.find({ kind: "epic", key: "SD-0" }), { label: "Epic SD-0", tickets: [
    { key: "SD-1", summary: "One", status: "To Do", points: 2 },
    { key: "SD-2", summary: "", status: "", points: null },
  ] });
  assert.ok(asked[0]);
  assert.equal(asked[0].searchParams.get("jql"), "parent = SD-0 ORDER BY rank");
  assert.deepEqual(await jira({}).source.find({ kind: "upcoming" }), { label: "Current & upcoming sprints", tickets: [] });
});
