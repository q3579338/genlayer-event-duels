# 验证记录

## 2026-10-19 · 0.2.0 部署候选准备

保留旧合约源码和旧部署，新增 `contracts/candidates/EventDuels.py`：独立最小 payable `deposit`；创建和接受改为 nonpayable，从已到账额度锁定。身份按 immediate sender 记账，提现固定给该 sender。前端仅在候选源码全文匹配且部署最终状态可读时开放写入。

31 项本地测试通过：旧合约 12 项、候选 8 项、交易与恢复 11 项。远程 GenVM schema 证实 deposit.payable=true、create_duel.payable=false、accept_duel.payable=false；候选构造函数通过。带 0.001 模拟 value 的只读构造函数集成场景通过 deposit → 无效创建拒绝且保留额度 → 有效创建 → 取消 → 提现方法调用。没有广播部署或真实转账，不能作为独立链上存取证明。源码 SHA256：`041f9b904f648591d2e31b1d9b9b3839e3fa937285cf356068722d229ac3dabb`。

生产构建通过，旧部署写入保护已在 Chrome 验证：加载旧合约后创建按钮仍禁用，未连接钱包时部署按钮禁用。全局 `genvm-lint` 命令当前不可用；不把历史版本的 lint 记录用于此候选。

用户已确认候选部署交易 `0xa827b52613063200e8ae09ae2875d77e81f9b0c37e40187dc0782f099a4b4862`，新地址 `0x3D53d6546A81e64Aa17A1472A2B101e7479905Ca`。19:40（北京时间）回执为 ACCEPTED / FINISHED_WITH_RETURN；链上源码全文和以上 SHA256 匹配。接受状态 count、locked、owed 均为 0，最终状态暂不可读。不是部署签名待处理，不得重复发送。候选最终确认、实际充值和原路提取到账尚未验证。新增只读 `check:candidate-live` 留存回执、双状态额度和 EVM 余额；不会签名或广播。

## 2026-10-19 · 前端 v0.1.1

真实创建调用已广播：`0xa0f11dfb6e48f70344002dd78b81fb99990632b511244350314c9276e6c2d512`。最新为 FINALIZED / FINISHED_WITH_ERROR，调试 trace 返回 `Use a directly connected testnet wallet`。节点 receipt 的 sender 与 txOrigin 均为用户已连接钱包，但实际 GenVM 地址比较仍失败，完整原因尚未证实。没有成功创建挑战，不计作端到端通过。

对应 EVM 广播交易为 `0xa232563b3c8cfb6655e20ffddb00698d44a487d75797fd41081856b3adf19a30`：chainId=4221，value=1000000000000000 wei，调用当前固定 SDK 的 ConsensusMain `addTransaction`，内部 recipient 是实际 EventDuels。旧合约 EVM 余额已读到 0.001 test GEN；该笔创建失败，没有相应挑战或可提取额度，回收尚未验证。已暂停新写操作，后续应先修正资金接收流程。

MetaMask 显示网站恶意告警。线上 JS/CSS 与本地产物哈希相同；生产依赖 `npm audit --omit=dev` 未报告已知漏洞；MetaMask 公共列表没有当前域名及其父域的直接命中。这些检查不能排除其他供应商名单、交易分析、模糊匹配或其他风险，不能据此判定误报。没有关闭或自动绕过钱包安全提醒。

- `npm test`：12 项合约状态测试 + 8 项交易与恢复测试通过。新增 UNKNOWN 五分钟重试边界、精确退款时间边界、双边分别提取、证据异常回滚、不可用证据不进入 AI，以及迟到读取失效和记录存储故障恢复检查。
- `npm run check:schema`：远程 GenVM 仍识别全部 10 个公开方法。
- `npm run check:deploy`：只读构造函数模拟通过，没有签名或广播。
- `npm run check:live`：真实部署仍为 FINALIZED / execution=1；链上源码全文与本地文件完全相等。读取 finalized 状态得到 count=0 / locked=0 / owed=0。完整文件 SHA256 为 `ce7b8850419b81e4e2f47b87cb3b4a23995b2bfe2d79b80c6db024a13e2b57ba`；旧部署记录的 `745fc0…` 是去除首尾空白后的哈希，两者口径不同，不是代码变更。
- Chrome 本地流程实际操作：非法金额拒绝、创建 0.001 示例、第二参与者等额接受、截止前禁止裁决、YES 给甲方双倍额度、NO 给乙方双倍额度、UNKNOWN 后重试按钮禁用、快进 72 小时后双方各退原额并分别提取、未匹配取消及提取。以上均为明确标注的本地演示，不调用真实 AI。
- Chrome 真实只读流程：选择最终确认，加载实际 Bradbury 合约，页面显示成功并返回空挑战列表。
- 交易历史和证据现在均支持页面内查看完整 JSON，避免下载受阻时无法复查记录。生产构建中的证据 JSON 已在 Chrome 展开、读取并成功解析，mode=local-demo / status=SETTLED / verdict=YES；浏览器下载事件仍未取得保存文件，不把它登记成下载验证通过。
- 生产构建已在 Chrome 验证；操作图解两张图片加载正常，应用未记录 JavaScript error。TypeScript 与 Vite 构建通过，主 bundle 约 812 kB（gzip 204 kB），仍有体积提醒。

新增审核材料为公开 `review.html`、只读快照和 [LIVE_TEST_PLAN.md](LIVE_TEST_PLAN.md)。Explorer 重新提交需在真实双钱包流程完成后补齐对应交易证据。

**尚未验证：**真实创建/接受/AI 裁决/取消/提现和外部到账；真实 72 小时退款路径。用户钱包签名与必要的测试币补充是下一步接手点。不能把以下历史记录或本次本地演示写成已完成链上端到端验收。

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
# 2026-10-12 前端证据展示更新

挑战详情现在展示合约已有的证据字段：版本、发布时间、草稿与预发布标记、发布标题及原文。缺失字段明确显示“未记录”，不会编造 AI 推理过程。新增 JSON 导出按钮，记录挑战数据、模式、合约地址与读取状态，并注明导出不是独立的密码学证明。

构建检查通过；Chrome 本地演示从接受挑战、推进模拟时间到人工 YES 裁决已验证，证据详情正常显示。浏览器下载事件等待超时，文件实际保存仍待复查。以上不是实际链上 AI 裁决或资金到账验证。

