import assert from "node:assert/strict";
import { startJobSchema } from "@itr/shared";

assert.equal(startJobSchema.safeParse({ pan: "ABCDE1234F" }).success, true);
assert.equal(startJobSchema.safeParse({ pan: "bad-pan" }).success, false);

console.log("service validation tests passed");
