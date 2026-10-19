import test from 'node:test';
import assert from 'node:assert/strict';
import { asFinalityTip, withFinalizedRead } from '../src/finality-read.ts';

const contract = '0x1111111111111111111111111111111111111111';
const oldId = '0x' + 'a'.repeat(64), nextId = '0x' + 'b'.repeat(64);
const tip = (txId = oldId, status = 7, recipient = contract) => ({ txId, status, recipient });
const stable = (txId = oldId) => ({ accepted: tip(txId), finalized: tip(txId) });

test('stable finalized transaction boundary permits a read', async () => {
  let checks = 0;
  const result = await withFinalizedRead(contract, async () => { checks++; return stable(); }, async () => ({ credit: '0' }));
  assert.deepEqual(result, { credit: '0' });
  assert.equal(checks, 2);
});
test('provisional credit cannot be labelled finalized just because gen_call would return it', async () => {
  let reads = 0;
  await assert.rejects(withFinalizedRead(contract, async () => ({
    accepted: tip(nextId, 5), finalized: tip(),
  }), async () => { reads++; return { credit: '1000000000000000' }; }), /尚未最终确认/);
  assert.equal(reads, 0);
});
test('a changed boundary during the read invalidates the result', async () => {
  const snapshots = [stable(), stable(nextId)];
  await assert.rejects(withFinalizedRead(contract, async () => snapshots.shift(), async () => 'possibly mixed state'), /记录已变化/);
});
test('missing, unrelated or unavailable finality proof fails closed', async () => {
  assert.throws(() => asFinalityTip({ txId: oldId, recipient: contract }), /无法核实/);
  for (const final of [tip('0x' + '0'.repeat(64)), tip(oldId, 5), tip(oldId, 7, '0x2222222222222222222222222222222222222222')])
    await assert.rejects(withFinalizedRead(contract, async () => ({ accepted: tip(), finalized: final }), async () => 'untrusted'), /无法核实/);
  await assert.rejects(withFinalizedRead(contract, async () => { throw new Error('RPC offline'); }, async () => 'untrusted'), /RPC offline/);
});
