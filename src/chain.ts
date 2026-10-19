import { abi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import type { CalldataEncodable, TransactionHash } from "genlayer-js/types";
import { hexToBytes, isAddress, toHex, toRlp, zeroAddress } from "viem";
import type { Address } from "viem";
import type { Duel } from "./model";
import { VERSION } from "./model";
import { finalOutcome, waitForOutcome } from "./transaction";
import { DEPLOYMENT } from "./deployment";
import { contractCall } from "./payable";
import { saveRecord } from "./journal";
import candidateSource from "../contracts/candidates/EventDuels.py?raw";
export const CANDIDATE_VERSION = "event-duels/0.2.0";

type Provider = NonNullable<
  NonNullable<Parameters<typeof createClient>[0]>["provider"]
>;
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export const chain = testnetBradbury;
export const reader = createClient({ chain });
// The official L2 endpoint accepts MetaMask's string JSON-RPC request IDs.
// Keep Intelligent Contract reads on the separate GenLayer RPC above.
export const WALLET_RPC = "https://rpc.testnet-chain.genlayer.com";
export async function addWalletRpc(): Promise<void> {
  if (!window.ethereum)
    throw new Error("请在已安装 MetaMask 的 Chrome 中打开页面。");
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: "0x107d",
        chainName: "GenLayer Bradbury Testnet",
        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        rpcUrls: [WALLET_RPC],
        blockExplorerUrls: ["https://explorer.testnet-chain.genlayer.com"],
      },
    ],
  });
  // EIP-3085 may return success without changing an existing chain's RPC.
  // Do not report the endpoint as selected or trigger a transaction here.
}
export const PENDING_KEY = "event-duels:bradbury:pending";
export interface Pending {
  hash: TransactionHash;
  contract: Address;
  action: string;
  wallet?: string;
  value?: string;
  args?: unknown[];
  submittedAt?: string;
  storageIssue?: boolean;
}
export function address(value: string): Address {
  if (!isAddress(value)) throw new Error("请填写有效的 Bradbury 合约地址。");
  return value;
}
export async function connectWallet(): Promise<Address> {
  if (!window.ethereum)
    throw new Error("请在 Chrome 中安装并解锁支持 GenLayer 的钱包。");
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as Address[];
  if (!accounts[0]) throw new Error("钱包未提供账户。");
  const client = createClient({
    chain,
    account: accounts[0],
    provider: window.ethereum,
  });
  await client.connect("testnetBradbury");
  const current = await window.ethereum.request({ method: "eth_accounts" }) as Address[];
  const network = await window.ethereum.request({ method: "eth_chainId" });
  if (current[0]?.toLowerCase() !== accounts[0].toLowerCase() || Number(network) !== chain.id)
    throw new Error("连接过程中账户或网络已变更，请重新连接 Bradbury 钱包。");
  return current[0].toLowerCase() as Address;
}
function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint")
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value) : String(value);
  if (value instanceof Map)
    return Object.fromEntries([...value.entries()].map(([key, v]) => [key, jsonSafe(v)]));
  if (Array.isArray(value)) return value.map(jsonSafe);
  return value;
}

export type ReadState = "accepted" | "finalized";

async function readContractState(contract: Address, functionName: string, args: CalldataEncodable[], status: ReadState) {
  // The stable SDK sends transaction_hash_variant, which this node ignores.
  // Use the node's documented status filter explicitly to avoid treating
  // accepted state as finalized state.
  const data = toRlp([
    toHex(abi.calldata.encode(abi.calldata.makeCalldataObject(functionName, args, undefined))),
    "0x00",
  ]);
  const response = await fetch(chain.rpcUrls.default.http[0], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "gen_call", params: [{
      type: "read", from: zeroAddress, to: contract, data, status,
    }] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`节点读取失败（${response.status}），请稍后重试。`);
  const rpc = await response.json();
  if (rpc.error) throw new Error(rpc.error.message);
  const result = rpc.result;
  if (typeof result !== "string" && result?.status?.code !== 0)
    throw new Error(result?.status?.message || "节点未返回成功的读取结果。");
  const encoded = typeof result === "string" ? result : result.data;
  if (typeof encoded !== "string") throw new Error("节点读取回执缺少数据。");
  return jsonSafe(abi.calldata.decode(hexToBytes(
    (encoded.startsWith("0x") ? encoded : `0x${encoded}`) as `0x${string}`,
  )));
}

export async function readDuels(contract: Address, wallet: string, state: ReadState = "accepted") {
  if (contract.toLowerCase() === DEPLOYMENT.address.toLowerCase()) {
    const receipt = await reader.getTransaction({ hash: DEPLOYMENT.hash as TransactionHash });
    const outcome = finalOutcome(receipt);
    const accepted = Number(receipt.status) === 5 && receipt.txExecutionResult === 1;
    if (outcome === null && (state === "finalized" || !accepted))
      throw new Error(`合约部署正在等待最终确认（${receipt.statusName || receipt.status}）。可选择「共识已接受」查看当前数据，无需重新部署。`);
    if (outcome === false) throw new Error("部署交易未成功执行，请检查部署记录。");
  }
  const read = (functionName: string, args: CalldataEncodable[] = []) =>
    readContractState(contract, functionName, args, state);
  const stats = (await read("get_stats")) as { version?: string };
  if (stats.version !== VERSION && stats.version !== CANDIDATE_VERSION)
    throw new Error("合约版本不匹配，请使用本仓库的 EventDuels 合约。");
  let writable = false;
  if (stats.version === CANDIDATE_VERSION) {
    await verifyCandidateSource(contract);
    // Never enable deposits into a deployment proved only in accepted state.
    try {
      const final = await readContractState(contract, "get_stats", [], "finalized") as { version?: string };
      writable = final.version === CANDIDATE_VERSION;
    } catch { /* Read-only until deployment finality can be established. */ }
  }
  const [duels, credit] = await Promise.all([
    read("list_duels", [0, 50]),
    wallet ? read("get_credit", [wallet]) : "0",
  ]);
  return { duels: duels as unknown as Duel[], credit: String(credit), writable };
}
async function verifyCandidateSource(contract: Address) {
  const code = await reader.getContractCode(contract);
  const normalize = (value: string) => value.replace(/\r\n/g, "\n").trim();
  if (normalize(code) !== normalize(candidateSource))
    throw new Error("合约源码与本项目修复版不一致，已阻止写入。");
}
async function connectedProvider(wallet: string) {
  const provider = window.ethereum;
  if (!provider) throw new Error("请先连接钱包。");
  const accounts = await provider.request({ method: "eth_accounts" }) as string[];
  const chainId = await provider.request({ method: "eth_chainId" });
  if (accounts[0]?.toLowerCase() !== wallet || Number(chainId) !== chain.id)
    throw new Error("账户或网络已改变，请重新连接 Bradbury 钱包。");
  return provider;
}
function rememberPending(hash: unknown, contract: Address, wallet: string, action: string, args: unknown[], value: bigint): Pending {
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new Error("钱包返回的交易编号无法识别，请先在钱包中核对，避免重复提交。");
  const pending: Pending = { hash: hash as TransactionHash, contract, action,
    wallet, value: String(value), args, submittedAt: new Date().toISOString() };
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending, (_, v) => typeof v === "bigint" ? String(v) : v));
  } catch { pending.storageIssue = true; }
  if (!saveRecord(localStorage, pending)) pending.storageIssue = true;
  return pending;
}
export async function deployCandidate(wallet: string): Promise<Pending> {
  const previous = loadPending();
  if (previous) {
    // A new deployment is independent of the failed legacy create. Retain its
    // non-final receipt in history; never silently retry or replace that call.
    const receipt = await reader.getTransaction({ hash: previous.hash });
    if (previous.action !== "create_duel" || previous.contract.toLowerCase() !== DEPLOYMENT.address.toLowerCase() ||
        receipt.recipient?.toLowerCase() !== DEPLOYMENT.address.toLowerCase() || !((receipt.txExecutionResult ?? 0) > 1))
      throw new Error("请先核对已有交易，不能重复部署或覆盖待处理的请求。");
    if (!saveRecord(localStorage, { ...previous, checkedAt: new Date().toISOString(), receipt }))
      throw new Error("旧交易回执未能保存，请先导出记录，不要继续发送。");
  }
  const provider = await connectedProvider(wallet);
  const client = createClient({ chain, account: wallet as Address, provider });
  const hash = await client.deployContract({ code: new TextEncoder().encode(candidateSource), args: [] });
  return rememberPending(hash, zeroAddress, wallet, "deploy_candidate", [], 0n);
}
export async function checkRecordedTransaction(record: { hash: string; contract: string; action: string }) {
  const receipt = await reader.getTransaction({ hash: record.hash as TransactionHash });
  if (!saveRecord(localStorage, { ...record, checkedAt: new Date().toISOString(), receipt }))
    throw new Error("回执已读取，但浏览器未能保存，请先导出记录。");
  return receipt;
}
export async function deployedCandidate(pending: Pending): Promise<Address> {
  const receipt = await reader.getTransaction({ hash: pending.hash });
  if (finalOutcome(receipt) !== true) throw new Error("部署尚未最终确认且执行成功。");
  if (!receipt.recipient) throw new Error("部署回执未提供合约地址，请在浏览器中核对。");
  const contract = address(receipt.recipient);
  if (contract === zeroAddress) throw new Error("部署回执未提供合约地址，请在浏览器中核对。");
  await verifyCandidateSource(contract);
  return contract;
}
export async function send(
  contract: Address,
  wallet: string,
  action: string,
  args: CalldataEncodable[],
  value = 0n,
): Promise<Pending> {
  if (action !== "deposit" && value !== 0n)
    throw new Error("创建和接受挑战只使用已到账额度，不得附带新的转账。");
  await verifyCandidateSource(contract);
  const provider = await connectedProvider(wallet);
  const client = createClient({ chain, account: wallet as Address, provider });
  const call = contractCall(contract, action, args, value);
  // Stable Bradbury uses the 1.x submission ABI. The 2.x fee-distribution
  // API belongs to the separate v0.6 preview stack, not this deployment.
  const hash = await client.writeContract(call);
  return rememberPending(hash, contract, wallet, action, args, value);
}
export async function finalize(
  pending: Pending,
  onProgress?: (status: string) => void,
) {
  const success = await waitForOutcome(
    async () => {
      const receipt = await reader.getTransaction({ hash: pending.hash });
      saveRecord(localStorage, { ...pending, checkedAt: new Date().toISOString(), receipt });
      return receipt;
    },
    { onProgress },
  );
  if (success && pending.action === "deploy_candidate") await deployedCandidate(pending);
  // Do not erase a different pending transaction written by another tab.
  if (loadPending()?.hash === pending.hash) {
    try { localStorage.removeItem(PENDING_KEY); } catch { /* Hash remains visible in this tab. */ }
  }
  return success;
}
export function loadPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    return p && isAddress(p.contract) && /^0x[0-9a-fA-F]{64}$/.test(p.hash) && typeof p.action === "string"
      ? p
      : null;
  } catch {
    return null;
  }
}
