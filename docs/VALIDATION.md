# 验证记录

日期：2026-10-09。环境：Windows，Node.js 24.16.0，Python 3.13，Chrome。

## 已通过

- `npm run build`：TypeScript 检查与生产构建成功。SDK 依赖使主 bundle 较大，Vite 给出体积提醒；这不是运行失败。
- `python -m unittest discover -s tests -v`：8 项测试全部通过。
- `genvm-lint 0.11.0 check contracts/EventDuels.py`：3 项检查及语义验证通过，识别到 10 个方法（4 view、6 write）。工具提示存在更新的 Python runner，本仓库保留已检查的固定版本。
- Bradbury RPC 的 `gen_getContractSchema`：远程 GenVM 成功识别构造函数和全部 10 个公开方法。此操作只提取接口，没有发送部署交易。
- Chrome 本地演示：创建挑战 → 切换参与者 → 接受 → 快进到期 → YES → 胜方额度 0.2 → 提取归零。
- Chrome 本地演示：另一挑战 → UNKNOWN → 快进到 72 小时后 → 双方退款，乙方额度显示 0.1。
- 浏览器上述流程未记录 JavaScript 错误。

## 单元测试覆盖

等额投入、禁止自我接受和第二对手、权限及期限、未匹配取消、YES / NO 结算、UNKNOWN / 缺失证据 / 无效模型输出、预发布或缺日期、晚发布、重复结算与提现、额度守恒、限制任意 URL 和投入范围、拒绝不支持的链编号。

主机存储、网络、AI、共识和转账全部为替身。测试直接导入实际合约代码，但不证明 GenVM 的完整执行行为。

## 未验证

Bradbury 部署、钱包签名、网络费用兼容性、真实 AI 判断及共识、合约原生余额、外部转账到账、72 小时后实际退款。当前不得宣称为已完成链上端到端测试的产品。
