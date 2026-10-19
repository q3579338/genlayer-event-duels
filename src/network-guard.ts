// Both endpoints currently report 4221 even when their histories disagree.
// Anchor this deployment's history before asking the wallet to sign anything.
export const BRADBURY_RPC = "https://rpc-bradbury.genlayer.com";
export const WALLET_RPC = "https://zksync-os-testnet-genlayer.zksync.dev";
export const BRADBURY_CHECKPOINT = {
  number: "0x185984a",
  hash: "0xd9cad3a4cb593b7f1461ecc4498314d1e093f52ff66d94bd6d2a87f7d4047d8f",
} as const;

export function assertBradburyHistory(value: unknown) {
  const block = value as { number?: unknown; hash?: unknown } | null;
  if (!block || typeof block.number !== "string" || typeof block.hash !== "string"
      || block.number.toLowerCase() !== BRADBURY_CHECKPOINT.number
      || block.hash.toLowerCase() !== BRADBURY_CHECKPOINT.hash)
    throw new Error(`钱包节点的交易历史与本合约不一致，已阻止签名请求。请在 MetaMask 的 Bradbury 网络中选中 ${WALLET_RPC}，再重新连接。`);
}
