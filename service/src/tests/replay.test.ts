import assert from "node:assert/strict";
import { RingBuffer } from "../domain/ring-buffer.js";

const buffer = new RingBuffer<number>(3);
buffer.push(1);
buffer.push(2);
buffer.push(3);
buffer.push(4);

assert.deepEqual(buffer.snapshot(), [2, 3, 4]);

console.log("service replay buffer tests passed");
