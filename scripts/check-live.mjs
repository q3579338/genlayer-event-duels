// Read-only audit. Never creates an account, signs or broadcasts a transaction.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient, abi } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { hexToBytes, toHex, toRlp, zeroAddress } from "viem";

const deployment = JSON.parse(await readFile(new URL("../docs/deployment.json", import.meta.url), "utf8"));
const client = createClient({ chain: testnetBradbury });
const localCode = await readFile(new URL("../contracts/EventDuels.py", import.meta.url), "utf8");
const receipt = await client.getTransaction({ hash: deployment.transactionId });
const code = await client.getContractCode(deployment.address);
async function read(functionName, args = [], status = "finalized") {
  const data = toRlp([toHex(abi.calldata.encode(abi.calldata.makeCalldataObject(functionName, args, undefined))), "0x00"]);
  const response = await fetch(testnetBradbury.rpcUrls.default.http[0], {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "gen_call", params: [{
      type: "read", from: zeroAddress, to: deployment.address, data, status,
    }] }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const rpc = await response.json();
  if (rpc.error) throw new Error(rpc.error.message);
  const result = rpc.result;
  if (typeof result !== "string" && result?.status?.code !== 0) throw new Error(JSON.stringify(result));
  const encoded = typeof result === "string" ? result : result.data;
  return abi.calldata.decode(hexToBytes(encoded.startsWith("0x") ? encoded : `0x${encoded}`));
}
const [stats, duels] = await Promise.all([read("get_stats"), read("list_duels", [0, 50])]);
const acceptedStats = await read("get_stats", [], "accepted");
const nativeResponse = await fetch("https://rpc.testnet-chain.genlayer.com", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [deployment.address, "latest"] }),
  signal: AbortSignal.timeout(30000),
});
const nativeRpc = await nativeResponse.json();
if (!nativeResponse.ok || nativeRpc.error) throw new Error("External balance could not be verified");
const audit = {
  observedAt: new Date().toISOString(), network: "Bradbury", chainId: 4221,
  contract: deployment.address, deploymentTransaction: deployment.transactionId,
  deployment: { status: receipt.status, statusName: receipt.statusName, executionResult: receipt.txExecutionResult },
  sourceSha256: createHash("sha256").update(code).digest("hex"), sourceMatches: code === localCode,
  // The original deployment manifest hashed trimmed source text.
  trimmedSourceSha256: createHash("sha256").update(code.trim()).digest("hex"),
  state: "finalized", stats, duels,
  acceptedStats,
  externalBalance: { state: "latest EVM", wei: String(BigInt(nativeRpc.result)),
    limitation: "Separate from the IC ledger; pending or failed native value may remain uncredited. Recoverability is not established by this balance." },
  limitation: "Read-only state audit. Not proof of live duel execution, AI consensus, refunds or external payout.",
};
const json = JSON.stringify(audit, (_, v) => typeof v === "bigint" ? String(v) : v instanceof Map ? Object.fromEntries(v) : v, 2);
const dir = new URL("../artifacts/", import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL("live-audit.json", dir), json + "\n");
console.log(json);
if (Number(receipt.status) !== 7 || receipt.txExecutionResult !== 1 || !audit.sourceMatches)
  throw new Error("Deployment receipt or deployed source failed verification");
