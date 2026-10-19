# GenLayer 贡献提交准备

**2026-10-19 更新：旧合约真实创建失败，尚未重新提交 Explorer。** 前端 v0.2.0 准备了独立充值的候选合约，31 项本地检查与远程只读 GenVM 场景通过。需先重新部署并验证真实存取，再完成双钱包流程。以下历史草稿不得用于宣称新版已完成链上验收。

## 官方规则快照

2026-10-09 在 [官方提交页](https://portal.genlayer.foundation/submit-contribution) 查看：

- Intelligent Contracts：页面标注 0–500 BP，强调可复用、有用或有教育价值的独立合约。
- Projects：页面标注 20–4,000 BP，每周 2 个提交额度；需要解决真实信任问题、完整源码、准确文档、前端实际调用合约及完整交易生命周期，网站链接必填。
- Milestones：页面标注 20–4,000 BP，只适用于已经被接受并进入 Project Explorer 的项目；需要实质性新进展，仅外观修改不符合要求。

这些是类别显示的范围，不是本项目的预估得分或保证。以后以提交当日官方页面为准。

## 当前可如实使用的描述

**项目名：** 见证 / Event Duels

**一句话：** A GenLayer testnet prototype that locks two-party GitHub release predictions, evaluates release-note evidence, and implements settlement or timeout refunds.

**说明草稿：**

Event Duels explores a narrow trust problem: two participants should not depend on a website operator to rewrite their agreed release criteria or choose a payout recipient after the event. The Intelligent Contract fixes the repository, tag, feature claim, deadlines and equal deposits. It fetches the specified GitHub release through GenLayer, evaluates the feature claim with independent execution and strict equivalence, and stores the evidence and verdict. YES and NO credit the winner; UNKNOWN keeps the challenge open until a 72-hour refund threshold. Participants withdraw their credited amount separately.

The repository includes the actual Python contract, a Chinese React frontend, a clearly labelled local demonstration, a Bradbury wallet adapter, twelve contract-state tests and eight transaction/recovery tests. Frontend v0.1.1 adds stale-read invalidation, persistent transaction records with exact wei amounts and raw receipts, and page-readable JSON evidence. The current version passes local checks, remote schema extraction and read-only deployment/source verification. The Bradbury deployment is FINALIZED with FINISHED_WITH_RETURN and its source exactly matches the repository. A public walkthrough separates manual demo steps from real chain evidence. Live duel/AI/settlement/payout validation is still pending.

**源码：** https://github.com/q3579338/genlayer-event-duels

**公开演示：** https://q3579338.github.io/genlayer-event-duels/ （默认是明确标注的本地模拟，不代表已上链）

**操作图解与验证：** https://q3579338.github.io/genlayer-event-duels/review.html

**实际合约：** https://explorer-bradbury.genlayer.com/address/0x3cE9F1A0143f77405784F47Aa56467013c3846E9 （已最终确认并执行成功）

## 提交前还需完成

1. 检查公开演示网址可正常访问（2026-10-09 已在 Chrome 验证）。
2. 真实测试网部署与最小交互证据，按 `DEPLOYMENT.md` 记录。
3. 填写项目 Logo、主分类、使用步骤及可复现结果。
4. 把说明中的验证状态更新成事实，再选择合适类别提交。不要把本地模拟截图当成真实链上交互。

本文件是准备材料，没有向 Portal 自动提交任何贡献。后续有实质新功能或可复现的验证进展时，再记录新的里程碑，避免重复包装同一份成果。
