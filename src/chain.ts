import { abi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import type { CalldataEncodable, TransactionHash } from "genlayer-js/types";
import { hexToBytes, isAddress, toHex, toRlp, zeroAddress } from "viem";
import type { Address } from "viem";
import type { Duel } from "./model";
import { VERSION } from "./model";
import { finalOutcome, waitForOutcome } from "./transaction";
import { DEPLOYMENT } from "./deployment";

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
  return accounts[0].toLowerCase() as Address;
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
  if (stats.version !== VERSION)
    throw new Error("合约版本不匹配，请使用本仓库的 EventDuels 合约。");
  const [duels, credit] = await Promise.all([
    read("list_duels", [0, 50]),
    wallet ? read("get_credit", [wallet]) : "0",
  ]);
  return { duels: duels as unknown as Duel[], credit: String(credit) };
}
export async function send(
  contract: Address,
  wallet: string,
  action: string,
  args: CalldataEncodable[],
  value = 0n,
): Promise<Pending> {
  const provider = window.ethereum;
  if (!provider) throw new Error("请先连接钱包。");
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];
  const chainId = await provider.request({ method: "eth_chainId" });
  if (accounts[0]?.toLowerCase() !== wallet || Number(chainId) !== chain.id)
    throw new Error("账户或网络已改变，请重新连接 Bradbury 钱包。");
  const client = createClient({ chain, account: wallet as Address, provider });
  const call = { address: contract, functionName: action, args, value };
  // Stable Bradbury uses the 1.x submission ABI. The 2.x fee-distribution
  // API belongs to the separate v0.6 preview stack, not this deployment.
  const hash = await client.writeContract(call);
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new Error(
      "钱包返回的交易编号无法识别，请先在钱包中核对，避免重复提交。",
    );
  const pending = { hash: hash as TransactionHash, contract, action };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  return pending;
}
export async function finalize(
  pending: Pending,
  onProgress?: (status: string) => void,
) {
  const success = await waitForOutcome(
    () => reader.getTransaction({ hash: pending.hash }),
    { onProgress },
  );
  localStorage.removeItem(PENDING_KEY);
  return success;
}
export function loadPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    return p && isAddress(p.contract) && /^0x[0-9a-fA-F]{64}$/.test(p.hash)
      ? p
      : null;
  } catch {
    return null;
  }
}
