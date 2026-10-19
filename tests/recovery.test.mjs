import test from "node:test";
import assert from "node:assert/strict";
import { ReadGuard } from "../src/read-guard.ts";
import { JOURNAL_KEY, jsonSafe, loadJournal, saveRecord } from "../src/journal.ts";

test("late reads cannot overwrite a new wallet, network or contract context", async () => {
  const guard = new ReadGuard();
  let releaseOld;
  const oldCurrent = guard.begin();
  const old = new Promise((resolve) => { releaseOld = resolve; }).then(() => oldCurrent());
  guard.invalidate();
  const newCurrent = guard.begin();
  assert.equal(newCurrent(), true);
  releaseOld();
  assert.equal(await old, false);
  guard.invalidate();
  assert.equal(newCurrent(), false);
});
const record = { hash: "0x" + "ab".repeat(32), contract: "0x" + "cd".repeat(20), action: "accept_duel", value: "1000000000000000001" };
function store() { const data = new Map(); return { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) }; }
test("journal preserves the exact amount and nested receipt data across reloads", () => {
  const storage = store();
  assert.equal(saveRecord(storage, record), true);
  assert.equal(saveRecord(storage, { ...record, receipt: { status: 7, txExecutionResult: 1,
    result: { messages: [new Map([["value", 1000000000000000001n]])] } } }), true);
  const records = loadJournal(storage);
  assert.equal(records.length, 1);
  assert.equal(records[0].value, "1000000000000000001");
  assert.equal(records[0].receipt.result.messages[0].value, "1000000000000000001");
  assert.equal(records[0].receipt.txExecutionResult, 1);
  assert.deepEqual(jsonSafe({ nested: [12n] }), { nested: ["12"] });
});
test("storage failure cannot hide a broadcast hash; malformed saved data is ignored", () => {
  assert.equal(saveRecord({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, record), false);
  const storage = store();
  storage.setItem(JOURNAL_KEY, JSON.stringify([{ action: "fake" }, record]));
  assert.deepEqual(loadJournal(storage), [record]);
  storage.setItem(JOURNAL_KEY, "broken");
  assert.deepEqual(loadJournal(storage), []);
});
test("a new deployment does not erase the failed legacy call's non-final receipt", () => {
  const storage = store();
  saveRecord(storage, { ...record, action: "create_duel", receipt: { status: 5, txExecutionResult: 2 } });
  const deployment = { ...record, hash: "0x" + "ef".repeat(32), action: "deploy_candidate" };
  saveRecord(storage, deployment);
  const records = loadJournal(storage);
  assert.equal(records.length, 2);
  assert.equal(records.find(r => r.hash === record.hash).receipt.status, 5);
  assert.equal(records.find(r => r.hash === deployment.hash).action, "deploy_candidate");
});
