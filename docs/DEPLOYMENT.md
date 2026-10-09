# 部署与最小链上验收

状态：修正版部署已执行成功，当前已最终确认（`FINALIZED`），执行结果为 `FINISHED_WITH_RETURN`。不要把共识接受、本地演示或只读模拟写成最终确认或完整链上交互证据。

## 修正版实际部署

- 网络：GenLayer Bradbury，钱包 chain ID `4221`。
- 合约：[0x3cE9F1A0143f77405784F47Aa56467013c3846E9](https://explorer-bradbury.genlayer.com/address/0x3cE9F1A0143f77405784F47Aa56467013c3846E9)。
- 交易：[0x2248e257bec2e51a0b7aac4014d94895d70cf54a4f48e81c4c7653f76266ba90](https://explorer-bradbury.genlayer.com/tx/0x2248e257bec2e51a0b7aac4014d94895d70cf54a4f48e81c4c7653f76266ba90)。
- 源码提交：`3e12f38b92138c1cc17d9fb3821c615e47cf6c6d`；已读取链上源码并核对与仓库一致（仅规范换行与首尾空白）。
- 最新回执：`status=7`、`txExecutionResult=1`，即最终确认且执行成功。最终状态的 `get_stats` 已再次通过读取。
- 已读取 `get_stats`：版本 `event-duels/0.1.0`，挑战数 0、锁定额度 0、待提取额度 0；前端已加载真实空列表。
- 节点返回的最终确认资格时间为北京时间 2026-10-09 13:36:37。到时仍需网络实际写入最终确认状态，时间经过本身不证明 `FINALIZED`。

公开核验快照见 [deployment.json](deployment.json)。前端默认读取「共识已接受」，明确保留申诉窗口提示；选择「最终确认」时会用节点的 `status: finalized` 筛选，不会偷偷降级到接受状态。每笔写交易仍跟踪到最终确认。

## 2026-10-09 兼容性修正

首次成功广播的部署：[交易记录](https://explorer-bradbury.genlayer.com/tx/0x6e577bec7808a43ed13d5bb1ade5b215894c6af19fd7c15070191580947bdcb1)，源码提交 `8fd120c`。节点返回 `ACCEPTED`、`txExecutionResult=2`（执行错误），不能把达成共识写成部署成功。

调试回放触发了构造函数的链编号检查。只读 `gen_call` 进一步验证：Bradbury 节点传给 GenVM 的 `gl.message.chain_id` 为 `1`，而钱包的 EVM 网络编号是 `4221`。已移除这项错误比较；前端继续检查钱包网络为 4221。该修正不是合约层面的主网隔离保证。

修正后 `npm run check:deploy` 已在 Bradbury 节点执行构造函数成功，未发送交易。后续更改构造函数时应重新执行这项检查，不能只检查 schema。

前端 SDK 固定为 `genlayer-js@1.1.8`。原 `2.0.0-rc.1` 读取当前 Bradbury 交易时要求不存在的 `ConsensusDataBigRounds` 注册项；切换稳定版后已成功读取实际交易。v0.6 RC 属于单独的预览发布系列，参考[官方迁移说明](https://docs.genlayer.com/developers/consensus-v06-migration)。

## 先在 Studio 检查

1. 打开 [GenLayer Studio](https://studio.genlayer.com/contracts)，导入 `contracts/EventDuels.py`。
2. 使用文件第一行固定的 Python SDK 版本，构造函数无参数。
3. 在 Studio 中部署并检查 `get_stats()` 返回 `event-duels/0.1.0`。
4. Studio 的模拟器与 Bradbury 是不同网络。模拟器产生的地址不能填入本前端的 Bradbury 地址框。

## Bradbury 部署

1. 使用自己的测试网钱包和官方部署工具，将同一份源码部署到 Bradbury（chain ID 4221）。确认当前 SDK / Studio 支持该网络，再确认部署交易。
2. 等待部署最终确认，记录完整合约地址、部署交易链接和源码提交 SHA。
3. 启动本前端，选择「连接测试网」，本项目地址已经默认填好。选择读取状态并加载，地址需要通过 `get_stats()` 版本检查。
4. 连接钱包，确认钱包当前账户及网络。若账户或网络变化，界面会要求重新连接。

本仓库不收集、生成或保存用于链上部署的私钥，也没有自动支付主网费用的脚本。

## MetaMask 的 RPC 格式错误

2026-10-09 在 Studio 部署时遇到 `cannot unmarshal string into Go struct field Request.id of type int`，发生于钱包广播阶段。只读请求复现结果：`https://rpc-bradbury.genlayer.com` 接受数字请求 ID，但拒绝字符串 ID；官方底层链端点 `https://rpc.testnet-chain.genlayer.com` 两种都接受，均返回 chain ID 4221。

在本页面选择「连接测试网」→「添加官方钱包 RPC」，即可请求钱包添加以下配置：

- RPC URL：`https://rpc.testnet-chain.genlayer.com`
- Chain ID：`4221`
- 币种：`GEN`
- 区块浏览器：`https://explorer.testnet-chain.genlayer.com`

需要在 MetaMask 确认。已有此网络时，钱包可能只返回请求成功而不修改当前 RPC，请在该网络的设置中选中新地址。添加网络不会自动签名、广播或重试部署。智能合约读取仍走 `rpc-bradbury.genlayer.com`，底层链端点不能替代 `gen_*` 接口。参考：[官方 Networks 文档](https://docs.genlayer.com/developers/networks)。

## 一次最小验收

使用两个不同的测试网钱包，选自己有权发布的公开测试仓库。建议每方使用最低金额 0.001 test GEN，另外预留网络费用。

1. 甲方创建挑战：固定简单标签（如 `v0.0.1`）与明确功能标准，接受截止至少 1 分钟后，事件截止更晚。记录交易编号。
2. 乙方接受，投入必须相等。等待最终确认；核对挑战双方地址和状态。
3. 截止前在测试仓库发布正式 Release，说明明确支持约定功能。不要写入秘密信息。
4. 事件截止后，参与者请求裁决。核对保存的证据、裁决和待提取额度；模型共识失败时应如实保留失败记录。
5. 胜方提取。除了父交易最终确认，还需核验触发的外部转账和钱包实际余额变化；网络费用与挑战金额分开记录。
6. 另一个不匹配的挑战用于取消检查；UNKNOWN 退款最早在事件截止 72 小时后可链上执行。不要为演示擅自宣称这条实际退款路径已经验证。

前端等待最终状态时每 5 秒查询一次，一批约一分钟，超时后保留交易编号，可点击「继续查询最终状态」。有待核对交易时禁止发起新交易；不要通过重置浏览器数据来绕过保护。

## 需要补齐的证据

- 网络、合约地址、源码 SHA、部署交易链接。
- 创建、接受、裁决、提现的真实交易链接。
- `get_duel()` 返回的公开证据快照与最终状态。
- 失败、未知结果与外部转账状态，不能只截成功提示。
- 演示网址和一段可以让审核者复现操作的说明。

完成后更新 `docs/VALIDATION.md` 和 README，再提交为已经完成链上集成的项目。
