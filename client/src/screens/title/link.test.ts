import { test } from "node:test";
import assert from "node:assert/strict";
import { BAD_CODE, NO_CODE, NOT_OURS, readInviteLink } from "./link.ts";

const HERE = "https://pp.example/";

test("an invite link from this site gives its table code", () => {
  assert.deepEqual(readInviteLink("https://pp.example/?room=BCDF", HERE), { t: "code", code: "BCDF" });
  assert.deepEqual(readInviteLink("  https://pp.example/?room=bcdf \n", HERE), { t: "code", code: "BCDF" });
  assert.deepEqual(readInviteLink("https://pp.example/?host=1&room=ZXCV", HERE), { t: "code", code: "ZXCV" });
});

test("a plain code isn't a link: the slots take it like typing", () => {
  assert.equal(readInviteLink("BCDF", HERE), null);
  assert.equal(readInviteLink(" bc df ", HERE), null);
});

test("a link from another site isn't one of our tables", () => {
  assert.deepEqual(readInviteLink("https://other.example/?room=BCDF", HERE), { t: "rejected", reason: NOT_OURS });
  assert.deepEqual(readInviteLink("http://pp.example/?room=BCDF", HERE), { t: "rejected", reason: NOT_OURS });
  assert.deepEqual(readInviteLink("https://pp.example/gallery?room=BCDF", HERE), {
    t: "rejected",
    reason: NOT_OURS,
  });
  assert.deepEqual(readInviteLink("pp.example/?room=BCDF", HERE), { t: "rejected", reason: NOT_OURS });
});

test("a link without a real table code says so", () => {
  assert.deepEqual(readInviteLink("https://pp.example/", HERE), { t: "rejected", reason: NO_CODE });
  assert.deepEqual(readInviteLink("https://pp.example/?room=", HERE), { t: "rejected", reason: NO_CODE });
  assert.deepEqual(readInviteLink("https://pp.example/?room=ABCD", HERE), { t: "rejected", reason: BAD_CODE });
  assert.deepEqual(readInviteLink("https://pp.example/?room=BCD", HERE), { t: "rejected", reason: BAD_CODE });
  assert.deepEqual(readInviteLink("https://pp.example/?room=BCDFG", HERE), { t: "rejected", reason: BAD_CODE });
});
