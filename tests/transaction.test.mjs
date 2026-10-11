import test from "node:test";
import assert from "node:assert/strict";
import { finalOutcome, waitForOutcome } from "../src/transaction.ts";
import { duelActionCall, contractCall } from "../src/payable.ts";

test("accept UI action maps the exact stake in wei to writeContract", async () => {
  const duel = { id: 42, stake: "1000000000000000001" };
  const action = duelActionCall("accept_duel", duel);
  const calls = [];
  const client = { writeContract: async (call) => calls.push(call) };
  await client.writeContract(contractCall("0xcontract", action.name, action.args, action.value));
  assert.deepEqual(calls, [{ address: "0xcontract", functionName: "accept_duel", args: [42], value: 1000000000000000001n }]);
  for (const name of ["resolve_duel", "cancel_duel", "refund_duel", "withdraw"])
    assert.equal(duelActionCall(name, name === "withdraw" ? undefined : duel).value, 0n);
  assert.throws(() => duelActionCall("accept_duel"), /请选择/);
});

test("accepted or ready-to-finalize is not finalized", () => {
  for (const status of [0, 3, 5, 6, 11, 12, 13])
    assert.equal(finalOutcome({ status, txExecutionResult: 1 }), null);
});
test("a finalized contract error is a failure", () => {
  assert.equal(finalOutcome({ status: 7, txExecutionResult: 2 }), false);
  assert.equal(finalOutcome({ status: 7, txExecutionResult: 1 }), true);
  assert.equal(finalOutcome({ status: 8 }), false);
  assert.throws(() => finalOutcome({ status: 7 }), /缺少执行结果/);
});
test("polling follows consensus through finalization", async () => {
  const receipts = [
    { status: 3, statusName: "COMMITTING" },
    { status: 5, statusName: "ACCEPTED", txExecutionResult: 1 },
    { status: 7, statusName: "FINALIZED", txExecutionResult: 1 },
  ];
  const progress = [];
  assert.equal(await waitForOutcome(async () => receipts.shift(), {
    attempts: 3, interval: 0, onProgress: (status) => progress.push(status),
  }), true);
  assert.deepEqual(progress, ["COMMITTING", "ACCEPTED", "FINALIZED"]);
});
test("timeout or RPC error never fabricates a successful result", async () => {
  await assert.rejects(waitForOutcome(async () => ({ status: 3 }), {
    attempts: 1, interval: 0,
  }), /不要重复发送/);
  await assert.rejects(waitForOutcome(async () => { throw new Error("offline"); }), /offline/);
});
