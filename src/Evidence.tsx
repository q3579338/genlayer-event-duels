import type { Duel } from "./model";
import { when } from "./model";

export function Evidence({ duel, demo, contract, readState }: {
  duel: Duel; demo: boolean; contract: string; readState: string;
}) {
  const evidence = duel.evidence;
  const record = {
      format: "event-duels-evidence/1", mode: demo ? "local-demo" : "bradbury",
      exported_at: new Date().toISOString(),
      contract: demo ? null : contract, read_state: demo ? null : readState,
      disclaimer: "Exported frontend data, not a cryptographic proof. Verify against the contract. Release notes may change. No AI reasoning trace is provided.",
      duel,
  };
  const json = JSON.stringify(record, null, 2);
  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `event-duels-${demo ? "demo" : "bradbury"}-${duel.id}-evidence.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="evidence">
    <strong>最近判定：{duel.verdict}{demo && "（人工演示）"}</strong>
    <p>{when(duel.last_checked)} · 第 {duel.checks} 次核验</p>
    <dl>
      <div><dt>证据版本</dt><dd>{evidence.tag || "未记录"}</dd></div>
      <div><dt>发布时间</dt><dd>{evidence.published_at || "未记录"}</dd></div>
      <div><dt>草稿</dt><dd>{typeof evidence.draft === "boolean" ? (evidence.draft ? "是" : "否") : "未记录"}</dd></div>
      <div><dt>预发布</dt><dd>{typeof evidence.prerelease === "boolean" ? (evidence.prerelease ? "是" : "否") : "未记录"}</dd></div>
    </dl>
    {evidence.title && <p>发布标题：{evidence.title}</p>}
    <pre>{evidence.body || `未取得足够证据。${evidence.http_status || evidence.problem || ""}`}</pre>
    <p className="muted">{demo ? "以下内容为本地演示数据。" : "以下内容为当前读取状态下的合约记录。"}导出文件用于复查，不是独立证明；发布说明可能被修改。合约未保存 AI 推理过程。</p>
    <button onClick={download}>下载{demo ? "演示" : "裁决"}证据 JSON</button>
    <details><summary>查看完整 JSON 记录</summary><pre aria-label="证据 JSON 记录">{json}</pre></details>
  </div>;
}
