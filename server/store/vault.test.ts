import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileVault, seal, unseal } from "./vault.ts";

const quiet = { info() {}, error() {} };

test("sealed secrets come back only with the same key, and only unchanged", () => {
  const sealed = seal({ refreshToken: "r-1" }, "key");
  assert.ok(!sealed.includes("r-1"), "the file doesn't show the token");
  assert.deepEqual(unseal(sealed, "key"), { refreshToken: "r-1" });
  assert.equal(unseal(sealed, "other key"), null);
  const changed = JSON.stringify({ ...JSON.parse(sealed), data: Buffer.from("{}").toString("base64") });
  assert.equal(unseal(changed, "key"), null);
  assert.equal(unseal("not json", "key"), null);
  const short = JSON.stringify({
    ...JSON.parse(sealed),
    tag: Buffer.from(JSON.parse(sealed).tag, "base64").subarray(0, 4).toString("base64"),
  });
  assert.equal(unseal(short, "key"), null, "a cut-down tag isn't enough");
});

test("the file vault keeps what was saved across restarts, and starts fresh when it can't open it", () => {
  const dir = mkdtempSync(join(tmpdir(), "pp-vault-"));
  assert.equal(fileVault(dir, "jira.json", "key", quiet).load(), null, "nothing yet");
  fileVault(dir, "jira.json", "key", quiet).save({ a: 1 });
  assert.deepEqual(fileVault(dir, "jira.json", "key", quiet).load(), { a: 1 });
  assert.equal(fileVault(dir, "jira.json", "new key", quiet).load(), null);
  writeFileSync(join(dir, "jira.json"), "garbage");
  assert.equal(fileVault(dir, "jira.json", "key", quiet).load(), null);
  fileVault(dir, "jira.json", "key", quiet).save({ b: 2 });
  assert.ok(!readFileSync(join(dir, "jira.json"), "utf8").includes('"b"'));
});
