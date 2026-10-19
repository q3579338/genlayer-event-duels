# 验证记录

## 2026-10-20 · 创建 #1 最终确认，CDC 充值请求待签名

创建 `0x639e86817befc3088ed90986cc1c5de6615d8eab518d0209d8bce630ea5d81c7` 已 FINALIZED / execution=1。实际最终确认时间为北京时间 07:33:38，EVM `0x2702e12933120e5b0aeb8aef0a74c7c611ec738d0fc7f1601b937e77a76c68a8`，区块 25555968。07:34:35 的独立读取在前后核对同一合约的 accepted/finalized 指针相同且均为此最终创建，同时再次验证完整源码 SHA256。最终挑战 #1 为 OPEN、creator=888、opponent 为空，stake/locked=1000000000000000 wei，双方可用额度与 owed 均为 0，count=1。六个参数和附带 value=0 与已签名标准相符。见 [最终创建证明](../public/dual-wallet-create-finalized.json)。

用户完成账户选择后，网页明确显示 CDC 完整地址，最终状态加载通过。签名前只读余额为 100 test GEN、nonce=0，额度为 0。已用网页请求独立 deposit 0.001 test GEN，停在钱包签名处；没有手动代签或重复发送，尚无观察到的充值 hash，也未发起接受。接受仍须等待 CDC 此笔充值最终到账。此次只更新链上证据与材料，没有修改合约或重部署。

## 2026-10-20 · 显式更换网站连接账户

用户在 MetaMask 首页切换 CDC 后，网页重新连接仍返回 888，因此增加独立的「更换账户」入口，按 [MetaMask 官方账户权限接口](https://docs.metamask.io/metamask-connect/evm/reference/json-rpc-api/wallet_requestPermissions/) 重新请求 eth_accounts，并由用户在钱包中选择此网站使用的账户。普通连接不重开权限；更换前清空当前钱包和可写状态，拒绝后不沿用旧账户。历史区块、当前首账户、网络和源码检查保持执行，已有 pending 和交易历史保留。此入口不会请求签名或发送交易。

40 项本地测试和生产构建通过。新增检查覆盖普通重连不扩展权限、更换后使用实际 CDC 身份、用户拒绝后不继续读取旧账户及无效账户拒绝。真实钱包弹窗选择与 CDC 后续签名仍需用户完成，不能用替身测试代替实际连接结果。

## 2026-10-20 · 888 充值最终确认，创建 #1 已接受

888 的第二笔独立充值 `0x9e284cd9ff7d28b7e054324b08cc6fab90abd83e4da2699ab16a21d8ff574f39` 最终于北京时间 06:48:41 完成，FINALIZED / execution=1。最终确认 EVM `0x9eca7eb6881cd1edd3bd0220f3c39065c67c9621cdbf077daddfb9c9057bcfec`，区块 25555249。06:51 受保护的最终账本检查确认 888 额度及 owed 各 1000000000000000 wei、locked/count=0，源码仍匹配；两种共识指针都指向该最终充值。早先 06:13 的 COMMITTING 和 06:18 的 ACCEPTED 只是过程快照。

随后用户签名创建 `0x639e86817befc3088ed90986cc1c5de6615d8eab518d0209d8bce630ea5d81c7`。07:04 核对 outer EVM `0x50800b2a996928007d73c260fdf789d703e074a97c01ee1f79e4e3d9bc4d21e1` 的 from=888、候选 innerRecipient、value=0、nonce=7、成功回执；六个参数与已准备表单相同。IC 为 ACCEPTED / execution=1，临时挑战 #1 为 OPEN，锁定 0.001，888 额度变为 0。最早最终确认资格为 07:33:28；资格时间不能代替实际最终确认。CDC 充值及接受尚未发送，链上 AI 共识仍未执行。见 [进度快照](../public/dual-wallet-live-audit.json)。

没有重发已签名交易、清除 pending、创建定时循环或联系社区成员。继续核对同笔创建，最终确认后再检查 CDC 实际连接、独立充值及接受；每次钱包签名均由用户完成。

## 2026-10-20 · 888 原路提现到账，节点历史保护

提现 `0x0ca8ebc22a3f75bcd27dfd370f8465eacd2d53e8044f2cd780d0e406dc09ff73` 已 FINALIZED / execution=1。实际最终确认 EVM 交易为 `0x9bb700fb5f987e4545ebcd4296b59f45b1657e0577c74d598a50c6f55b7bce98`，区块 25533079，北京时间 2026-10-19 21:17:37。

该区块前后，888 余额从 `99992848677159926450` 增至 `99993848677159926450` wei，恰好增加 0.001 test GEN；候选合约从 `1000000000000000` 降为 0 wei。唯一另一笔同区块交易已回滚，付款地址也是不同的最终确认执行者，因此不影响这两个余额差额。当前 888 nonce=6，与原提现提交后相同；余额与原有基线扣除提交手续费再加回 0.001 完全一致。CDC 余额仍为 100 test GEN。`debug_traceTransaction` 不可用，本次依据历史余额、最终确认事件和外部消息交叉核对。可用 `npm run check:withdraw` 只读复现。见 [到账证据](../public/withdraw-live-audit.json)。

通用 `rpc.testnet-chain.genlayer.com` 当前仅返回区块 48637，并找不到本部署历史；Bradbury 与官方 faucet 源码列出的 `zksync-os-testnet-genlayer.zksync.dev` 返回一致历史。原因尚不确定，不能据通用节点的零余额认定资金消失。最终确认读取统一使用 Bradbury；钱包连接和所有写入前增加历史区块 hash 检查，历史不同则阻止签名请求。37 项本地测试和生产构建通过。见 [节点快照](../public/network-readiness.json)。

存取最小闭环通过；双钱包创建／接受、AI 共识裁决及真实 UNKNOWN/72 小时退款仍待执行，Explorer 保持草稿。

## 2026-10-19 · 888 充值最终确认，原路提现已接受

20:45 首笔充值 `0xc762d3337a43719b39cb613d49d97acad0ae889e20e1c8ef4d5afca84580c7a7` 已 FINALIZED / execution=1。独立共识 accepted/finalized 指针均为这笔最终充值；受保护的最终读取确认 888 钱包额度与 owed 为 1000000000000000 wei，外部合约余额同额，locked/count 为 0。

随后同一 888 钱包确认 `withdraw()`，交易 `0x0ca8ebc22a3f75bcd27dfd370f8465eacd2d53e8044f2cd780d0e406dc09ff73`。20:48 回执为 ACCEPTED / execution=1，外部消息的 recipient 明确为 `0xa9EE18b34Ec00664D73d89b8F8BBA68bEB888888`，value=1000000000000000 wei，onAcceptance=false。EVM 提交 `0xd0e85dd23201d3812194f7136e1f5e4680501ee8154e287eef14b42b67e3d4c7` 附带 value=0，795421 gas × 187500000 wei = 149141437500000 wei 网络费，与本地保存的钱包余额变化相符。

20:49 接受状态额度与 owed 已为 0，但合约外部余额仍为 0.001 test GEN；最终读取保护因提现尚待确认而拒绝展示最终余额。因此不能把额度归零、父交易接受或执行成功当作外部到账。节点返回的本次最早最终确认资格为北京时间 21:17:37，仍须实际最终回执、外部转账和余额核对。见 [withdraw-live-audit.json](../public/withdraw-live-audit.json)。存取闭环尚未完成，Explorer 保留草稿。

## 2026-10-19 · 首笔独立充值与最终读取保护

首笔真实 `deposit()`：`0xc762d3337a43719b39cb613d49d97acad0ae889e20e1c8ef4d5afca84580c7a7`，20:21 核对为 ACCEPTED / FINISHED_WITH_RETURN。EVM 提交 `0x5b1c262deee01f279c73a14945c0945c709cee298317320a8fbf638ac0e5b6d3` 的 chainId=4221、value=1000000000000000 wei，inner recipient 为新候选。接受状态中 owed 与用户额度均为同额，locked/count 为 0，外部合约余额同额。尚未最终确认，不计作完成存取闭环；最早最终确认资格时间由节点返回为北京时间 20:44:05，仍须实际 FINALIZED 状态。

发现 RPC `gen_call(status=finalized)` 在充值回执仍为 ACCEPTED 时返回新额度。独立共识数据查询证实最新 accepted 指针是充值交易、最新 finalized 指针仍是部署。因此新增 `withFinalizedRead`：在读取前后从同一 EVM 区块分别取得两种交易指针，要求地址、非零编号及 FINALIZED 状态相符，并且读取期间最终指针不变；否则不显示为最终状态。候选写入资格也增加已最终确认交易的独立证明。节点 `status` 参数继续保留，不能单独作为最终性证据。

35 项本地测试通过：旧合约 12、候选 8、交易与恢复 15。新增 4 项覆盖节点提前返回额度、读取期间状态变化、稳定边界及缺失／其他地址／RPC 错误的证明。生产构建通过。真实只读集成证实候选的待确认充值被拦截、已稳定的旧部署可读取；摘要见 [finality-boundary-validation.json](../public/finality-boundary-validation.json)。首笔充值记录见 [deposit-live-audit.json](../public/deposit-live-audit.json)。提现、外部到账和完整双钱包流程仍未执行。

Chrome 本地生产预览使用独立页面且没有连接钱包：对新候选选择最终确认后，实际显示“此合约还有尚未最终确认的交易”，额度保持未加载、创建和提取不可用；切换回旧部署后最终状态可正常只读加载，旧写操作仍禁用。没有清除正式站点的待确认记录，也没有发起额外资金操作。

## 2026-10-19 · 0.2.0 部署候选准备

保留旧合约源码和旧部署，新增 `contracts/candidates/EventDuels.py`：独立最小 payable `deposit`；创建和接受改为 nonpayable，从已到账额度锁定。身份按 immediate sender 记账，提现固定给该 sender。前端仅在候选源码全文匹配且部署最终状态可读时开放写入。

31 项本地测试通过：旧合约 12 项、候选 8 项、交易与恢复 11 项。远程 GenVM schema 证实 deposit.payable=true、create_duel.payable=false、accept_duel.payable=false；候选构造函数通过。带 0.001 模拟 value 的只读构造函数集成场景通过 deposit → 无效创建拒绝且保留额度 → 有效创建 → 取消 → 提现方法调用。没有广播部署或真实转账，不能作为独立链上存取证明。源码 SHA256：`041f9b904f648591d2e31b1d9b9b3839e3fa937285cf356068722d229ac3dabb`。

生产构建通过，旧部署写入保护已在 Chrome 验证：加载旧合约后创建按钮仍禁用，未连接钱包时部署按钮禁用。全局 `genvm-lint` 命令当前不可用；不把历史版本的 lint 记录用于此候选。

用户已确认候选部署交易 `0xa827b52613063200e8ae09ae2875d77e81f9b0c37e40187dc0782f099a4b4862`，新地址 `0x3D53d6546A81e64Aa17A1472A2B101e7479905Ca`。19:40（北京时间）回执为 ACCEPTED / FINISHED_WITH_RETURN；链上源码全文和以上 SHA256 匹配。接受状态 count、locked、owed 均为 0，最终状态暂不可读。不是部署签名待处理，不得重复发送。候选最终确认、实际充值和原路提取到账尚未验证。新增只读 `check:candidate-live` 留存回执、双状态额度和 EVM 余额；不会签名或广播。

20:02:54 更新：候选已 FINALIZED / FINISHED_WITH_RETURN，`npm run check:candidate-live -- --require-finalized` 通过。源码全文匹配；接受与最终状态版本均为 0.2.0，count、locked、owed、sender 额度及 EVM 余额均为 0。Chrome 自动恢复部署记录并显示“源码核对通过”，充值入口可用。尚未执行实际充值或提取。发现版本切换后查看合约链接和源码下载仍混用旧版，已改为当前地址链接与两版分别命名的源码入口；候选载入后禁用重复部署按钮。

## 2026-10-19 · 真实网页与 AI 的只读检查

使用候选源码和注入的 ACTIVE 挑战、模拟锁定额度及测试时间，通过远程 GenVM 读取本仓库真实 `v0.1.1` 发布说明并执行 `resolve_duel`。检查 YES、SETTLED、保存的证据及胜方 2000000000000000 wei 模拟额度。没有发送交易或使用真实资金，不能替代多验证者共识和链上结算。

19:49 第一次检查在证据可用时得到 UNKNOWN，未通过预期 YES。单独的只读诊断场景输出原始回答 YES；19:51 使用未修改裁决逻辑的相同场景通过，19:53 保存为可复现命令后再次通过。初次 UNKNOWN 的具体原因未证实；没有为通过检查而修改部署候选的解析或提示词，也不根据少量运行推算可靠性。

命令：`npm run check:ai-smoke`。每次将测试源码、原始 RPC 结果和简短摘要保存到独立 `artifacts/ai-smoke/<time>/`，失败返回非零退出码。公开摘要见 [ai-smoke.json](../public/ai-smoke.json)，保留首次未通过结果。待完成的真实双钱包验收和 72 小时退款没有因此变成已完成。

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

