// Read-only verification of the recorded first withdrawal. No signing/broadcast.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { createPublicClient, decodeEventLog, http, toHex } from "viem";
import { BRADBURY_RPC, BRADBURY_CHECKPOINT, assertBradburyHistory } from "../src/network-guard.ts";

const root = new URL("../", import.meta.url);
const recorded = JSON.parse(await readFile(new URL("public/withdraw-live-audit.json", root), "utf8"));
const finalizationHash = "0x9bb700fb5f987e4545ebcd4296b59f45b1657e0577c74d598a50c6f55b7bce98";
const evm = createPublicClient({ transport: http(BRADBURY_RPC) });
const checkpoint = await evm.getBlock({ blockNumber: BigInt(BRADBURY_CHECKPOINT.number) });
assertBradburyHistory({ number: toHex(checkpoint.number), hash: checkpoint.hash });
const client = createClient({ chain: testnetBradbury });
const [parent, submission, receipt, tx] = await Promise.all([
  client.getTransaction({ hash: recorded.transactionId }),
  evm.getTransaction({ hash: recorded.submission.evmTransaction }),
  evm.getTransactionReceipt({ hash: finalizationHash }),
  evm.getTransaction({ hash: finalizationHash }),
]);
const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();
const message = parent.messages?.[0];
if (Number(parent.status) !== 7 || parent.txExecutionResult !== 1
    || !same(parent.sender, recorded.sender) || !same(parent.recipient, recorded.contract)
    || parent.messages?.length !== 1 || !same(message.recipient, recorded.sender)
    || BigInt(message.value) !== 1000000000000000n || message.onAcceptance !== false
    || !same(submission.from, recorded.sender) || submission.value !== 0n)
  throw new Error("Withdrawal receipt, sender or external message does not match");
const finalizedEvent = receipt.logs.some((log) => {
  if (!same(log.address, testnetBradbury.consensusMainContract.address)) return false;
  try {
    const event = decodeEventLog({ abi: testnetBradbury.consensusMainContract.abi, ...log });
    return event.eventName === "TransactionFinalized" && same(event.args.txId, recorded.transactionId);
  } catch { return false; }
});
if (receipt.status !== "success" || !finalizedEvent || same(tx.from, recorded.sender))
  throw new Error("Missing successful independent finalization transaction");
const block = await evm.getBlock({ blockNumber: receipt.blockNumber });
const balances = await Promise.all([recorded.sender, recorded.contract].map(async (address) => ({
  address,
  beforeWei: await evm.getBalance({ address, blockNumber: receipt.blockNumber - 1n }),
  afterWei: await evm.getBalance({ address, blockNumber: receipt.blockNumber }),
})));
const otherTransactions = await Promise.all(block.transactions.filter((hash) => !same(hash, finalizationHash))
  .map(async (hash) => {
    const other = await evm.getTransactionReceipt({ hash });
    return { hash, status: other.status, from: other.from, to: other.to };
  }));
// Other transactions in this block must have reverted and paid fees from other
// accounts. This excludes another successful transfer affecting the deltas.
if (!block.transactions.some((hash) => same(hash, finalizationHash))
    || otherTransactions.some((other) => other.status !== "reverted"
      || same(other.from, recorded.sender) || same(other.from, recorded.contract))
    || balances[0].afterWei - balances[0].beforeWei !== BigInt(message.value)
    || balances[1].beforeWei - balances[1].afterWei !== BigInt(message.value))
  throw new Error("External payout cannot be attributed exactly to this finalization block");
const currentBalanceWei = await evm.getBalance({ address: recorded.sender });
const currentNonce = await evm.getTransactionCount({ address: recorded.sender });
const audit = { ...recorded, observedAt: new Date().toISOString(), status: parent.statusName,
  statusCode: parent.status, executionResult: parent.txExecutionResult,
  externalContractBalanceWei: String(await evm.getBalance({ address: recorded.contract })),
  payoutVerified: true, rpc: BRADBURY_RPC,
  finalization: { evmTransaction: finalizationHash, blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash, timestampUnix: block.timestamp,
    finalizedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
    receiptStatus: receipt.status, finalizer: tx.from, transactionsInBlock: block.transactions.length,
    otherTransactions },
  balanceProof: balances, currentWalletBalanceWei: currentBalanceWei, currentWalletNonce: currentNonce,
  limitation: "This recorded 0.001 test GEN withdrawal is verified by its finalized successful parent, same-wallet message, successful finalization event and exact opposite external balance deltas. The only other transaction in this block reverted and paid fees from a different account. debug_traceTransaction is unavailable. This does not prove duel creation/acceptance, independent AI settlement, live UNKNOWN refunds or every future payout.",
};
const json = JSON.stringify(audit, (_, v) => typeof v === "bigint" ? String(v) : v, 2) + "\n";
await mkdir(new URL("artifacts/", root), { recursive: true });
await writeFile(new URL("artifacts/withdraw-live-audit.json", root), json);
console.log(json);
