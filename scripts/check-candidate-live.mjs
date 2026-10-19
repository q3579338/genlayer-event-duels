// Read-only candidate audit. No wallet, account creation, signing or broadcast.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient, abi } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { hexToBytes, toHex, toRlp, zeroAddress } from "viem";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("docs/candidate-deployment.json", root), "utf8"));
const client = createClient({ chain: testnetBradbury });
const [receipt, source, expected] = await Promise.all([
  client.getTransaction({ hash: manifest.transactionId }),
  client.getContractCode(manifest.address),
  readFile(new URL(manifest.sourcePath, root), "utf8"),
]);
async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(JSON.stringify(result.error ?? result));
  return result.result;
}
async function read(method, args, status) {
  const data = toRlp([toHex(abi.calldata.encode(abi.calldata.makeCalldataObject(method, args, undefined))), "0x00"]);
  const result = await rpc(testnetBradbury.rpcUrls.default.http[0], "gen_call", [{
    type: "read", from: zeroAddress, to: manifest.address, data, status,
  }]);
  if (typeof result !== "string" && result?.status?.code !== 0) throw new Error(JSON.stringify(result));
  const encoded = typeof result === "string" ? result : result.data;
  const decoded = abi.calldata.decode(hexToBytes(encoded.startsWith("0x") ? encoded : `0x${encoded}`));
  return decoded instanceof Map ? Object.fromEntries(decoded) : decoded;
}
const stateResults = await Promise.allSettled(["accepted", "finalized"].map(async (state) => ({
  state,
  stats: await read("get_stats", [], state),
  senderCreditWei: await read("get_credit", [manifest.sender], state),
})));
const states = stateResults.map((result, index) => result.status === "fulfilled" ? result.value : ({
  state: ["accepted", "finalized"][index], error: result.reason.message,
}));
const native = await rpc("https://rpc.testnet-chain.genlayer.com", "eth_getBalance", [manifest.address, "latest"]);
const normalized = (text) => text.replace(/\r\n/g, "\n").trim();
const sourceSha256 = createHash("sha256").update(source).digest("hex");
const sourceMatchesCandidate = normalized(source) === normalized(expected) && sourceSha256 === manifest.sourceSha256;
const identityMatches = receipt.recipient.toLowerCase() === manifest.address.toLowerCase()
  && receipt.sender.toLowerCase() === manifest.sender.toLowerCase();
const finalizedRead = states.find((state) => state.state === "finalized");
const audit = {
  observedAt: new Date().toISOString(), network: manifest.network, chainId: manifest.walletChainId,
  contract: manifest.address, transactionId: manifest.transactionId,
  deployment: { status: receipt.status, statusName: receipt.statusName,
    executionResult: receipt.txExecutionResult, executionResultName: receipt.txExecutionResultName },
  sender: receipt.sender, identityMatches, sourceSha256, sourceMatchesCandidate,
  finalizedSourceReady: identityMatches && sourceMatchesCandidate && Number(receipt.status) === 7
    && receipt.txExecutionResult === 1 && finalizedRead?.stats?.version === manifest.version,
  states, externalBalanceWei: String(BigInt(native)),
  limitation: "Read-only deployment and ledger snapshot. No independent live deposit, duel, AI consensus or external payout is proven. Latest EVM balance is separate from the Intelligent Contract ledger.",
};
await mkdir(new URL("artifacts/", root), { recursive: true });
const json = JSON.stringify(audit, (_, value) => typeof value === "bigint" ? String(value)
  : value instanceof Map ? Object.fromEntries(value) : value, 2);
await writeFile(new URL("artifacts/candidate-live-audit.json", root), json + "\n");
console.log(json);
if (!identityMatches || !sourceMatchesCandidate || receipt.txExecutionResult !== 1)
  throw new Error("Candidate identity, source or execution verification failed");
if (process.argv.includes("--require-finalized") && !audit.finalizedSourceReady)
  throw new Error("Candidate is not finalized and readable yet; no new writes should be prepared");
