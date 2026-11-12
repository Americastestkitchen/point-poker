import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIssueKey } from "./rules.ts";

test("issue keys come out of links and bare keys", () => {
  assert.equal(parseIssueKey("https://x.atlassian.net/browse/SD-1975"), "SD-1975");
  assert.equal(parseIssueKey("https://x.atlassian.net/jira/software/c/projects/SD/boards/1?selectedIssue=SD-42"), "SD-42");
  assert.equal(parseIssueKey(" sd-7 "), "SD-7");
  assert.equal(parseIssueKey("nope"), null);
});
