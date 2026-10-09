import { createClient, isSuccessful } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";
import type { CalldataEncodable, TransactionHash } from "genlayer-js/types";
import { isAddress } from "viem";
import type { Address } from "viem";
import type { Duel } from "./model";
import { VERSION } from "./model";

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
export async function readDuels(contract: Address, wallet: string) {
  const read = (functionName: string, args: CalldataEncodable[] = []) =>
    reader.readContract({
      address: contract,
      functionName,
      args,
      jsonSafeReturn: true,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    });
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
  // A prototype uses simulation per write; never silently falls back to zero fees.
  const fees = await client.estimateTransactionFeesForWrite(call);
  const hash = await client.writeContract({ ...call, fees });
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new Error(
      "钱包返回的交易编号无法识别，请先在钱包中核对，避免重复提交。",
    );
  const pending = { hash: hash as TransactionHash, contract, action };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  return pending;
}
export async function finalize(pending: Pending) {
  const receipt = await reader.waitForFinalization({
    hash: pending.hash,
    interval: 5000,
    retries: 12,
  });
  localStorage.removeItem(PENDING_KEY);
  return isSuccessful(receipt);
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
