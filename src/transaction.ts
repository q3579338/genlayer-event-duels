// Stable Bradbury status codes. Consensus completion and execution success
// are separate: even a finalized receipt can contain a contract error.
interface Receipt {
  status?: string | number;
  statusName?: string;
  txExecutionResult?: number;
}

export function finalOutcome(receipt: Receipt): boolean | null {
  if (Number(receipt.status) === 8) return false; // CANCELED
  if (Number(receipt.status) !== 7) return null; // FINALIZED only
  if (receipt.txExecutionResult === undefined)
    throw new Error("最终回执缺少执行结果，请继续核对；暂不判定成功。");
  return receipt.txExecutionResult === 1; // FINISHED_WITH_RETURN
}

export async function waitForOutcome(
  read: () => Promise<Receipt>,
  { attempts = 13, interval = 5000, onProgress }: {
    attempts?: number;
    interval?: number;
    onProgress?: (status: string) => void;
  } = {},
): Promise<boolean> {
  let status = "等待网络返回";
  for (let i = 0; i < attempts; i++) {
    const receipt = await read();
    status = receipt.statusName || String(receipt.status ?? "未知");
    onProgress?.(status);
    const outcome = finalOutcome(receipt);
    if (outcome !== null) return outcome;
    if (i + 1 < attempts)
      await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`交易仍在等待最终确认（${status}）。编号已保留，请稍后继续查询，不要重复发送。`);
}
