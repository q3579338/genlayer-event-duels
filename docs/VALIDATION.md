# 验证记录

日期：2026-10-09。环境：Windows，Node.js 24.16.0，Python 3.13，Chrome。

## 已通过

- `npm run build`：TypeScript 检查与生产构建成功。SDK 依赖使主 bundle 较大，Vite 给出体积提醒；这不是运行失败。
- `npm test`：8 项 Python 合约状态测试、4 项前端交易确认测试全部通过。后者检查最终确认、执行失败、未完成、查询超时与 RPC 异常。
- `genvm-lint 0.11.0 check contracts/EventDuels.py`：3 项检查及语义验证通过，识别到 10 个方法（4 view、6 write）。工具提示存在更新的 Python runner，本仓库保留已检查的固定版本。
- Bradbury RPC 的 `gen_getContractSchema`：远程 GenVM 成功识别构造函数和全部 10 个公开方法。此操作只提取接口，没有发送部署交易。
- Bradbury 的只读 `gen_call`：修正版构造函数执行成功；这是模拟，不代表上链。
- 已完成一次真实钱包签名与广播，并用稳定版 SDK 读取共识回执。首次部署的执行结果为错误，具体原因与修正见 `DEPLOYMENT.md`；不计作成功部署。
- 修正版真实部署：`0x2248…ba90` 的回执为 `ACCEPTED`、`FINISHED_WITH_RETURN`。已读取部署源码并与提交 `3e12f38` 核对一致。
- Chrome 前端真实读取：默认实际合约地址，`get_stats` 版本检查通过，`list_duels` 返回空列表。切换到「最终确认」时明确提示尚待确认，不显示接受状态数据。
- 实测稳定 SDK 的 `transaction_hash_variant` 在当前节点未筛选最终状态；前端已改为显式传 `status: accepted / finalized`。只读 RPC 验证：接受状态可读，最终状态当前返回合约尚不存在，符合未最终确认的回执。
- Chrome 本地演示：创建挑战 → 切换参与者 → 接受 → 快进到期 → YES → 胜方额度 0.2 → 提取归零。
- Chrome 本地演示：另一挑战 → UNKNOWN → 快进到 72 小时后 → 双方退款，乙方额度显示 0.1。
- 浏览器上述流程未记录 JavaScript 错误。
- GitHub Actions 的 [Checks](https://github.com/q3579338/genlayer-event-duels/actions/runs/37882757713) 和 [Publish demo](https://github.com/q3579338/genlayer-event-duels/actions/runs/37882757576) 已通过；公开 GitHub Pages 页面已在 Chrome 打开并正常显示。

## 单元测试覆盖

等额投入、禁止自我接受和第二对手、权限及期限、未匹配取消、YES / NO 结算、UNKNOWN / 缺失证据 / 无效模型输出、预发布或缺日期、晚发布、重复结算与提现、额度守恒、限制任意 URL 和投入范围、兼容 Bradbury GenVM 与钱包链编号不同的上下文。

主机存储、网络、AI、共识和转账全部为替身。测试直接导入实际合约代码，但不证明 GenVM 的完整执行行为。

## 未验证

前端写操作与网络费用兼容性、真实 AI 判断及共识、合约原生余额、外部转账到账、72 小时后实际退款。当前不得宣称为已完成链上端到端测试的产品。
