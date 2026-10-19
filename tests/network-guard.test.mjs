import test from "node:test";
import assert from "node:assert/strict";
import { BRADBURY_CHECKPOINT, assertBradburyHistory } from "../src/network-guard.ts";

test("a wallet on chain 4221 must also retain this deployment's history", () => {
  assert.doesNotThrow(() => assertBradburyHistory(BRADBURY_CHECKPOINT));
  assert.doesNotThrow(() => assertBradburyHistory({ ...BRADBURY_CHECKPOINT,
    hash: BRADBURY_CHECKPOINT.hash.toUpperCase() }));
});
test("same chain ID with an absent, changed or malformed checkpoint cannot request a signature", () => {
  for (const value of [null, undefined, {}, { number: BRADBURY_CHECKPOINT.number, hash: "0xwrong" },
    { ...BRADBURY_CHECKPOINT, number: "0x1" }, { ...BRADBURY_CHECKPOINT, hash: 1 }])
    assert.throws(() => assertBradburyHistory(value), /已阻止签名请求/);
});
