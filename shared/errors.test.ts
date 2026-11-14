import { test } from "node:test";
import assert from "node:assert/strict";
import { errorMessage } from "./errors.ts";

test("a caught error reads as its message, and anything else as itself", () => {
  assert.equal(errorMessage(new Error("Jira said no")), "Jira said no");
  assert.equal(errorMessage(new TypeError("")), "");
  assert.equal(errorMessage("not found"), "not found");
  assert.equal(errorMessage(404), "404");
  assert.equal(errorMessage(undefined), "undefined");
  assert.equal(errorMessage(null), "null");
});
