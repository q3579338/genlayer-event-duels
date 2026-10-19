export interface FinalityTip {
  txId: string;
  recipient: string;
  status: number | bigint;
}
export interface FinalityTips { accepted: FinalityTip; finalized: FinalityTip }
export function asFinalityTip(value: unknown): FinalityTip {
  const tip = value as Record<string, unknown> | null;
  if (!tip || typeof tip.txId !== "string" || typeof tip.recipient !== "string"
      || (typeof tip.status !== "number" && typeof tip.status !== "bigint"))
    throw new Error("暂时无法核实此合约的最终确认记录，请稍后重试。");
  return { txId: tip.txId, recipient: tip.recipient, status: tip.status };
}
export function assertFinalizedTip(contract: string, tip: FinalityTip) {
  if (!tip || !/^0x[0-9a-fA-F]{64}$/.test(tip.txId) || /^0x0{64}$/.test(tip.txId)
      || Number(tip.status) !== 7 || tip.recipient?.toLowerCase() !== contract.toLowerCase())
    throw new Error("暂时无法核实此合约的最终确认记录，请稍后重试。");
}
function confirmedBoundary(contract: string, tips: FinalityTips) {
  assertFinalizedTip(contract, tips.finalized);
  if (tips.accepted?.txId?.toLowerCase() !== tips.finalized.txId.toLowerCase()
      || Number(tips.accepted?.status) !== 7
      || tips.accepted?.recipient?.toLowerCase() !== contract.toLowerCase())
    throw new Error("此合约还有尚未最终确认的交易。请等待，或选择「共识已接受」查看临时数据。");
  return tips.finalized.txId.toLowerCase();
}
// gen_call(status=finalized) alone returned provisional deposit credit on Bradbury.
// Fail closed unless on-chain transaction pointers agree before and after the read.
export async function withFinalizedRead<T>(contract: string,
  loadTips: () => Promise<FinalityTips>, read: () => Promise<T>): Promise<T> {
  const before = confirmedBoundary(contract, await loadTips());
  const result = await read();
  const after = confirmedBoundary(contract, await loadTips());
  if (before !== after) throw new Error("读取期间链上记录已变化，请重新加载最终状态。");
  return result;
}
