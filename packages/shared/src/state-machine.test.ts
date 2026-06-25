import assert from "node:assert/strict";
import { canTransition, isTerminalPhase } from "./state-machine.js";

assert.equal(canTransition("queued", "launching"), true);
assert.equal(canTransition("otp_waiting", "otp_submitted"), true);
assert.equal(canTransition("succeeded", "failed"), false);
assert.equal(canTransition("password", "otp_waiting"), false);
assert.equal(isTerminalPhase("failed"), true);
assert.equal(isTerminalPhase("captcha"), false);

console.log("shared state-machine tests passed");
