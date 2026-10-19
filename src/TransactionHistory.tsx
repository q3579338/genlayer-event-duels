import { ExternalLink, Download } from "lucide-react";
import type { TransactionRecord } from "./journal";
import { finalOutcome } from "./transaction";
import { short } from "./model";

const labels: Record<string, string> = {
  deposit: "充值到可用额度", deploy_candidate: "部署测试修复版",
  create_duel: "创建挑战", accept_duel: "接受挑战", resolve_duel: "请求核验",
  cancel_duel: "取消挑战", refund_duel: "退款", withdraw: "提取额度",
};
function outcome(record: TransactionRecord) {
  if (!record.receipt) return "已发送 · 待核对";
  try {
    const result = finalOutcome(record.receipt);
    if (result === false) return "执行未成功";
    if (result === true) return record.action === "withdraw" ? "请求执行成功 · 到账待核对" : "最终确认 · 执行成功";
    if (record.receipt.txExecutionResult !== undefined && record.receipt.txExecutionResult > 1)
      return `${record.receipt.statusName || record.receipt.status} · 当前执行出错，仍待最终确认`;
    return `${record.receipt.statusName || record.receipt.status || "等待网络"} · 尚未最终确认`;
  } catch { return "回执信息不完整 · 待核对"; }
}
export function TransactionHistory({ records, busy, onCheck }: {
  records: TransactionRecord[]; busy: boolean; onCheck: (record: TransactionRecord) => void;
}) {
  const json = JSON.stringify({
    format: "event-duels-test-record/v1", network: "Bradbury", chainId: 4221,
    exportedAt: new Date().toISOString(), records,
    limitation: "Local browser record, not a cryptographic proof. Verify every hash on-chain. Withdraw execution success alone does not prove receipt of an external transfer.",
  }, null, 2);
  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "event-duels-transactions.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <details className="transaction-history" open={records.length > 0}>
    <summary>测试网交易记录 <span>{records.length} 笔 · 仅当前浏览器保存</span></summary>
    <p>按创建、接受、核验、提取逐笔核对。ACCEPTED 仍可能申诉；提取请求成功后，还需核对后续转账与钱包到账。</p>
    {records.length ? <>
      <button onClick={download}><Download size={14} /> 导出交易回执</button>
      <details><summary>查看完整交易 JSON</summary><pre>{json}</pre></details>
      <ol>{records.map((record) => <li key={record.hash}>
        <div><strong>{labels[record.action] || record.action}</strong><span>{outcome(record)}</span></div>
        <a href={`https://explorer-bradbury.genlayer.com/tx/${record.hash}`} target="_blank" rel="noreferrer">{record.hash} <ExternalLink size={12} /></a>
        <small>钱包 {record.wallet ? short(record.wallet) : "旧记录未保存"} · 合约 {short(record.contract)} · 附带金额 {record.value || "0"} wei</small>
        <button disabled={busy} onClick={() => onCheck(record)}>更新这笔回执 · 只读</button>
      </li>)}</ol>
    </> : <p>尚无发送记录。连接钱包不会创建交易。</p>}
  </details>;
}
