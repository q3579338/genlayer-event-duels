import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Check,
  X,
  LockKeyhole,
  Clock3,
  ExternalLink,
  GitBranch,
  Wallet,
  RefreshCw,
  FlaskConical,
  Scale,
  ShieldCheck,
  CircleDot,
  Github,
} from "lucide-react";
import { formatEther, parseEther } from "viem";
import type { CalldataEncodable } from "genlayer-js/types";
import {
  ALICE,
  BOB,
  DEMO_KEY,
  freshDemo,
  loadDemo,
  short,
  statusLabel,
  when,
} from "./model";
import type { Duel, Verdict } from "./model";
import {
  address,
  addWalletRpc,
  WALLET_RPC,
  connectWallet,
  finalize,
  loadPending,
  readDuels,
  send,
} from "./chain";
import type { Pending } from "./chain";
import contractSource from "../contracts/EventDuels.py?raw";

const token = (wei: string) => formatEther(BigInt(wei));
const dateInput = (seconds: number) => {
  const d = new Date(seconds * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function App() {
  const [mode, setMode] = useState<"demo" | "chain">("demo");
  const [demo, setDemo] = useState(loadDemo);
  const [persona, setPersona] = useState(ALICE);
  const [wallet, setWallet] = useState("");
  const [contract, setContract] = useState(
    () =>
      localStorage.getItem("event-duels:contract") ||
      import.meta.env.VITE_CONTRACT_ADDRESS ||
      "",
  );
  const [liveDuels, setLiveDuels] = useState<Duel[]>([]);
  const [credit, setCredit] = useState("0");
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState("全部挑战");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(loadPending);
  const [tick, setTick] = useState(Date.now());
  const isDemo = mode === "demo";
  const now = Math.floor(tick / 1000) + (isDemo ? demo.offset : 0);
  const actor = isDemo ? persona : wallet;
  const duels = isDemo ? demo.duels : liveDuels;
  const balance = isDemo ? demo.credits[persona] || "0" : credit;
  const duel = duels.find((d) => d.id === selected);
  const disabled = busy || (!isDemo && (!ready || !wallet || !!pending));
  useEffect(() => {
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
  }, [demo]);
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const provider = window.ethereum;
    const reset = () => {
      setWallet("");
      setCredit("0");
      setNotice("钱包账户或网络已变更，请重新连接。");
    };
    provider?.on?.("accountsChanged", reset);
    provider?.on?.("chainChanged", reset);
    return () => {
      provider?.removeListener?.("accountsChanged", reset);
      provider?.removeListener?.("chainChanged", reset);
    };
  }, []);
  async function run(fn: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message.slice(0, 450) : "操作未完成，请重试。",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh(c = contract, w = wallet) {
    setReady(false);
    setLiveDuels([]);
    setCredit("0");
    const result = await readDuels(address(c), w);
    setLiveDuels(result.duels);
    setCredit(result.credit);
    setReady(true);
    localStorage.setItem("event-duels:contract", c);
  }
  async function wait(p: Pending) {
    setNotice("已发送，正在等待最终确认；查询超时后可继续查询。");
    const success = await finalize(p);
    setPending(null);
    if (!success)
      throw new Error("交易已结束但未成功执行，请在浏览器中核对原因。");
    setNotice(
      p.action === "withdraw"
        ? "提现请求已最终确认；请再核对钱包到账和后续转账记录。"
        : "交易已最终确认。",
    );
    if (p.contract.toLowerCase() === contract.toLowerCase())
      await refresh(p.contract);
  }
  async function transact(
    action: string,
    args: CalldataEncodable[] = [],
    value = 0n,
  ) {
    if (!ready || !wallet || pending)
      throw new Error("请先连接合约、钱包，并处理已有交易。");
    const p = await send(address(contract), wallet, action, args, value);
    setPending(p);
    await wait(p);
  }
  function demoAction(action: string, d?: Duel, verdict?: Verdict) {
    const next = structuredClone(demo);
    const record = d && next.duels.find((x) => x.id === d.id)!;
    const addCredit = (who: string, amount: bigint) => {
      next.credits[who] = String(BigInt(next.credits[who] || "0") + amount);
    };
    if (action === "withdraw") next.credits[actor] = "0";
    else if (record) {
      const stake = BigInt(record.stake);
      if (action === "accept_duel") {
        record.opponent = actor;
        record.status = "ACTIVE";
      }
      if (action === "cancel_duel") {
        record.status = "CANCELLED";
        record.settled_at = now;
        addCredit(record.creator, stake);
      }
      if (action === "refund_duel") {
        record.status = "REFUNDED";
        record.settled_at = now;
        addCredit(record.creator, stake);
        addCredit(record.opponent, stake);
      }
      if (action === "resolve_duel" && verdict) {
        record.verdict = verdict;
        record.last_checked = now;
        record.checks++;
        record.evidence = {
          available: true,
          published_at: new Date((record.deadline - 3600) * 1000).toISOString(),
          body:
            verdict === "YES"
              ? "【人工选择的演示证据】This release adds CSV export for user data."
              : verdict === "NO"
                ? "【人工选择的演示证据】CSV export is planned for a future release."
                : "【人工选择的演示证据】No clear statement about this feature.",
        };
        if (verdict !== "UNKNOWN") {
          record.status = "SETTLED";
          record.settled_at = now;
          addCredit(
            verdict === "YES" ? record.creator : record.opponent,
            2n * stake,
          );
        }
      }
    }
    setDemo(next);
    setNotice("本地演示已更新，未发送链上交易。");
  }
  const action = (name: string, d?: Duel, verdict?: Verdict) =>
    run(async () => {
      if (isDemo) demoAction(name, d, verdict);
      else await transact(name, d ? [d.id] : []);
    });
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run(async () => {
      const repo = String(form.get("repository")).trim();
      const tag = String(form.get("tag")).trim();
      const feature = String(form.get("feature")).trim();
      const acceptance = Math.floor(
        new Date(String(form.get("accept"))).getTime() / 1000,
      );
      const deadline = Math.floor(
        new Date(String(form.get("deadline"))).getTime() / 1000,
      );
      const amount = String(form.get("stake"));
      if (!/^\d+(\.\d{1,18})?$/.test(amount))
        throw new Error("金额最多支持 18 位小数。");
      const stake = parseEther(amount);
      if (stake < 10n ** 15n || stake > 10n ** 19n)
        throw new Error("请使用 0.001–10 test GEN。");
      if (
        !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(repo) ||
        !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(tag)
      )
        throw new Error("请填写 owner/repo 和简单的版本标签。");
      if (feature.length < 10 || feature.length > 600)
        throw new Error("判定标准需要 10–600 个字符。");
      if (
        !(
          acceptance >= now + 60 &&
          deadline > acceptance &&
          deadline <= now + 90 * 86400
        )
      )
        throw new Error(
          "接受截止需至少在 1 分钟后，事件截止须更晚且在 90 天内。",
        );
      if (isDemo) {
        const id = Math.max(0, ...demo.duels.map((d) => d.id)) + 1;
        setDemo({
          ...demo,
          duels: [
            {
              id,
              repository: repo,
              tag,
              feature,
              stake: String(stake),
              source_url: `https://api.github.com/repos/${repo}/releases/tags/${tag}`,
              creator: actor,
              opponent: "",
              created_at: now,
              accept_before: acceptance,
              deadline,
              refund_after: deadline + 259200,
              status: "OPEN",
              verdict: "",
              last_checked: 0,
              checks: 0,
              settled_at: 0,
              evidence: {},
            },
            ...demo.duels,
          ],
        });
        setSelected(id);
        setNotice("演示挑战已创建。切换到乙方，可以体验接受挑战。");
      } else
        await transact(
          "create_duel",
          [repo, tag, feature, acceptance, deadline],
          stake,
        );
      setShowCreate(false);
    });
  }
  const visible = duels.filter(
    (d) =>
      tab === "全部挑战" ||
      (tab === "等待对手"
        ? d.status === "OPEN"
        : d.creator === actor || d.opponent === actor),
  );
  function downloadContract() {
    const url = URL.createObjectURL(
      new Blob([contractSource], { type: "text/x-python" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "EventDuels.py";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <header className="header">
        <a className="brand" href="#">
          <span className="brand-icon">
            <Scale size={21} />
          </span>
          <strong>见证</strong>
          <span className="brand-en">EVENT DUELS</span>
        </a>
        <nav>
          <a href="#challenges">探索挑战</a>
          <a href="#how">运作方式</a>
          <a
            href="https://github.com/q3579338/genlayer-event-duels"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={16} /> 开源代码
          </a>
        </nav>
        <button
          className="wallet"
          disabled={busy}
          onClick={() =>
            isDemo
              ? setPersona(persona === ALICE ? BOB : ALICE)
              : run(async () => {
                  const w = await connectWallet();
                  setWallet(w);
                  if (contract) await refresh(contract, w);
                })
          }
        >
          <Wallet size={16} />
          {isDemo
            ? `演示${persona === ALICE ? "甲" : "乙"}方 · 切换`
            : wallet
              ? short(wallet)
              : "连接钱包"}
        </button>
      </header>
      <main>
        <div className="mode-bar">
          <span>
            <FlaskConical size={15} />
            {isDemo
              ? "本地体验模式 · 示例数据，不调用 AI，不发生链上交易"
              : "Bradbury 测试网 · 仅限测试代币 · 链上资金流程尚待实测"}
          </span>
          <div className="toggle">
            <button
              className={isDemo ? "active" : ""}
              disabled={busy}
              onClick={() => {
                setMode("demo");
                setSelected(null);
              }}
            >
              体验演示
            </button>
            <button
              className={!isDemo ? "active" : ""}
              disabled={busy}
              onClick={() => {
                setMode("chain");
                setSelected(null);
              }}
            >
              连接测试网
            </button>
          </div>
        </div>
        <section className="hero">
          <div>
            <p className="eyebrow">
              <span /> BUILT ON GENLAYER
            </p>
            <h1>
              让承诺，
              <br />
              有据可判<span>。</span>
            </h1>
            <p className="intro">
              一个版本，会如期带来新功能吗？
              <br />
              锁定规则与公开证据，让智能合约见证双方的判断。
            </p>
            <button
              className="primary"
              disabled={!isDemo && !ready}
              onClick={() => setShowCreate(true)}
            >
              发起一个挑战 <ArrowUpRight size={18} />
            </button>
            <a className="text-link" href="#how">
              先了解规则 <ArrowRight size={15} />
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="evidence-chip">
              <GitBranch size={15} /> GitHub Release{" "}
              <span>PUBLIC EVIDENCE</span>
            </div>
            <div className="verdict-card">
              <div className="verdict-head">
                <Scale size={20} />
                <span>一个问题 · 两种判断</span>
              </div>
              <strong>新功能，按期交付？</strong>
              <div className="sides">
                <div>
                  <span>YES</span>
                  <small>会如期支持</small>
                </div>
                <i>vs</i>
                <div>
                  <span>NO</span>
                  <small>证据明确否定</small>
                </div>
              </div>
              <div className="verdict-foot">
                <LockKeyhole size={13} /> 规则锁定后，双方无法修改
              </div>
            </div>
            <div className="consensus-chip">
              <ShieldCheck size={20} />
              <div>
                独立核验 · 共识裁决<small>GenLayer Intelligent Contract</small>
              </div>
            </div>
          </div>
        </section>
        <div className="principles">
          <span>
            <LockKeyhole />
            相同投入，规则先行
          </span>
          <span>
            <GitBranch />
            指定仓库，固定版本
          </span>
          <span>
            <Clock3 />
            证据不足，72 小时后可退款
          </span>
        </div>
        {!isDemo && (
          <section className="connection">
            <div>
              <strong>连接合约</strong>
              <p>仅支持 Bradbury（4221）。Studio 模拟器地址不能在此使用。</p>
              {!contract.trim() && (
                <div className="notice">
                  尚未填写合约地址。添加 RPC 只配置钱包网络；还需先在 GenLayer Studio
                  完成部署，再把生成的合约地址填入下方。钱包地址不能代替合约地址。
                </div>
              )}
            </div>
            <div className="rpc-setup">
              <div>
                <strong>钱包发送交易报错？添加官方 RPC</strong>
                <code>{WALLET_RPC}</code>
                <p>
                  链 ID：4221 · 币种：GEN · 只请求添加网络配置，不发送交易。
                </p>
                <p>
                  如果此网络已存在，请在 MetaMask 中选中新
                  RPC；网页无法确认钱包当前选中的 RPC 地址。
                </p>
                <a
                  href="https://docs.genlayer.com/developers/networks"
                  target="_blank"
                  rel="noreferrer"
                >
                  核对官方网络说明 <ExternalLink size={12} />
                </a>
              </div>
              <button
                disabled={busy || !!pending}
                onClick={() =>
                  run(async () => {
                    await addWalletRpc();
                    setNotice(
                      "钱包已处理添加请求。请在 MetaMask 中确认并选中 https://rpc.testnet-chain.genlayer.com；网络已存在时，钱包可能不会自动更换 RPC。",
                    );
                  })
                }
              >
                添加官方钱包 RPC
              </button>
            </div>
            <div className="connect-row">
              <input
                aria-label="合约地址"
                placeholder="粘贴 Studio 部署成功后生成的 0x… 合约地址"
                value={contract}
                disabled={busy || !!pending}
                onChange={(e) => {
                  setContract(e.target.value);
                  setReady(false);
                  setLiveDuels([]);
                  setCredit("0");
                  setError("");
                }}
              />
              <button
                disabled={busy || !!pending || !contract.trim()}
                onClick={() =>
                  run(async () => {
                    await refresh();
                    setNotice("已加载最终确认的链上数据。");
                  })
                }
              >
                加载合约
              </button>
            </div>
            <p>
              <button className="link-button" onClick={downloadContract}>
                下载合约源码
              </button>{" "}
              ·{" "}
              <a
                href="https://studio.genlayer.com/contracts"
                target="_blank"
                rel="noreferrer"
              >
                打开 GenLayer Studio <ExternalLink size={12} />
              </a>{" "}
              ·{" "}
              <a
                href="https://github.com/q3579338/genlayer-event-duels/blob/main/docs/DEPLOYMENT.md"
                target="_blank"
                rel="noreferrer"
              >
                部署说明
              </a>
            </p>
          </section>
        )}
        <div aria-live="polite">
          {notice && (
            <div className="notice">
              <Check size={17} />
              {notice}
            </div>
          )}
          {error && <div className="error">{error}</div>}
          {busy && (
            <div className="notice">
              <RefreshCw size={15} className="spin" />
              操作进行中，请留意钱包提示。
            </div>
          )}
        </div>
        {pending && (
          <div className="pending">
            <strong>有一笔待核对的测试网交易</strong>
            <code>{pending.hash}</code>
            <small>
              合约 {pending.contract} · {pending.action}
              。查询超时不等于失败，请勿重复发送。
            </small>
            <button disabled={busy} onClick={() => run(() => wait(pending))}>
              继续查询最终状态
            </button>
          </div>
        )}
        <section id="challenges" className="challenges">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MAKE A CALL</p>
              <h2>
                公开挑战 <span>{isDemo ? "DEMO" : "TESTNET"}</span>
              </h2>
            </div>
            <div className="credit">
              <span>我的待提取额度</span>
              <strong>
                {token(balance)} <small>test GEN</small>
              </strong>
              <button
                disabled={disabled || BigInt(balance) === 0n}
                onClick={() => action("withdraw")}
              >
                提取 <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
          <div className="list-toolbar">
            <div className="tabs">
              {["全部挑战", "等待对手", "与我相关"].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "selected" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <span>
              {isDemo ? "仅当前浏览器可见" : "显示最近 50 条最终确认记录"}
            </span>
          </div>
          <div className="cards">
            {visible.map((d) => (
              <button
                className="duel-card"
                key={d.id}
                onClick={() => setSelected(d.id)}
              >
                <div className="card-top">
                  <span className={"status " + d.status}>
                    <CircleDot size={12} />
                    {statusLabel[d.status]}
                  </span>
                  <span className="number">
                    #{String(d.id).padStart(3, "0")} <ArrowUpRight size={17} />
                  </span>
                </div>
                <div className="repo">
                  <GitBranch size={15} />
                  {d.repository}
                </div>
                <h3>
                  {d.tag} 会按期支持
                  <br />
                  {d.feature.replace(/^正式版的发布说明明确宣布：/, "")}
                </h3>
                <div className="card-rule">以指定版本的公开发布说明为准</div>
                <div className="card-line">
                  <span>
                    <Clock3 size={13} />
                    事件截止
                  </span>
                  <strong>{when(d.deadline)}</strong>
                </div>
                <div className="card-bottom">
                  <div>
                    <strong>{token(d.stake)}</strong>
                    <span> test GEN / 每方</span>
                  </div>
                  <span className="round-arrow">
                    <ArrowRight size={18} />
                  </span>
                </div>
              </button>
            ))}
            <button
              className="new-card"
              disabled={!isDemo && !ready}
              onClick={() => setShowCreate(true)}
            >
              <span>
                <Plus size={24} />
              </span>
              <strong>你的下一个判断</strong>
              <p>
                选择公开仓库，约定版本和功能
                <br />
                邀请持不同观点的人加入
              </p>
              <b>
                创建挑战 <ArrowUpRight size={14} />
              </b>
            </button>
          </div>
          {!isDemo && !ready && (
            <p className="empty">
              填写合约地址后加载真实挑战。这里不会显示模拟成交或用户数量。
            </p>
          )}
        </section>
        <section id="how" className="how">
          <div>
            <p className="eyebrow">FROM CLAIM TO EVIDENCE</p>
            <h2>判断归你，规则归合约。</h2>
            <p>
              首版只回答一个可核验的问题：
              <br />
              指定版本的发布说明，是否明确支持约定功能？
            </p>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>把标准说清楚</strong>
                <p>
                  仓库、版本、功能、时间与金额一并锁定。发起方选择
                  YES，接受方选择 NO。
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>让证据接受核验</strong>
                <p>
                  截止后，由参与者请求 GenLayer 获取 GitHub 发布说明并独立判定。
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>按结果结算</strong>
                <p>
                  明确结果计入胜方可提取额度；证据不足保留 UNKNOWN，72
                  小时后双方可退款。
                </p>
              </div>
            </li>
          </ol>
        </section>
        <div className="limitations">
          <ShieldCheck size={19} />
          <p>
            这是测试网原型。它核验发布说明中的声明，不能证明软件功能实际可用；发布说明也可能被仓库所有者修改。缺失版本或未提及功能不会直接判
            NO。真实资金流程、AI 共识与到账仍需链上验证。
          </p>
        </div>
        {isDemo && (
          <div className="demo-tools">
            <span>演示工具 · 当前模拟时间 {when(now)}</span>
            <button
              onClick={() => {
                setDemo(freshDemo());
                setSelected(null);
                setNotice("已重置本地示例。");
              }}
            >
              重置示例
            </button>
          </div>
        )}
      </main>
      <footer>
        <a className="brand" href="#">
          <Scale size={19} />
          <strong>见证</strong>
        </a>
        <span>一个公开问题，一份共同遵守的约定。</span>
        <a
          href="https://github.com/q3579338/genlayer-event-duels"
          target="_blank"
          rel="noreferrer"
        >
          MIT 开源 <ArrowUpRight size={13} />
        </a>
      </footer>
      {showCreate && (
        <div className="overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
          >
            <button
              aria-label="关闭创建"
              className="close"
              disabled={busy}
              onClick={() => setShowCreate(false)}
            >
              <X />
            </button>
            <p className="eyebrow">NEW CHALLENGE</p>
            <h2 id="create-title">把你的判断写下来</h2>
            <p className="muted">你支持 YES。对方投入相同金额，支持 NO。</p>
            <form onSubmit={create}>
              <div className="form-grid">
                <label>
                  GitHub 仓库
                  <input
                    name="repository"
                    required
                    placeholder="owner/repository"
                    defaultValue={isDemo ? "example-labs/atlas" : ""}
                  />
                </label>
                <label>
                  版本标签
                  <input
                    name="tag"
                    required
                    placeholder="v2.0.0"
                    defaultValue="v2.0.0"
                  />
                </label>
              </div>
              <label>
                功能判定标准
                <textarea
                  name="feature"
                  required
                  minLength={10}
                  maxLength={600}
                  placeholder="例如：发布说明明确宣布用户可将自己的数据导出为 CSV 文件。"
                />
              </label>
              <div className="form-grid">
                <label>
                  接受挑战截止
                  <input
                    name="accept"
                    type="datetime-local"
                    required
                    defaultValue={dateInput(now + 86400)}
                  />
                </label>
                <label>
                  事件截止
                  <input
                    name="deadline"
                    type="datetime-local"
                    required
                    defaultValue={dateInput(now + 172800)}
                  />
                </label>
              </div>
              <label>
                每方投入 · test GEN
                <input
                  name="stake"
                  inputMode="decimal"
                  required
                  defaultValue="0.1"
                />
              </label>
              <p className="form-note">
                YES：按期正式发布且明确支持。NO：发布晚于截止，或发布说明明确否定
                / 留待未来实现。其余为 UNKNOWN，事件截止 72
                小时后可申请原额退款。创建与接受均需支付各自投入；测试网另有网络费用。
              </p>
              {error && <div className="error">{error}</div>}
              <button
                className="primary full"
                disabled={disabled}
                type="submit"
              >
                {busy
                  ? "等待处理…"
                  : isDemo
                    ? "创建演示挑战"
                    : "签名并创建挑战"}
                <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
      {duel && !showCreate && (
        <div className="overlay">
          <section
            className="modal detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <button
              aria-label="关闭详情"
              className="close"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <span className={"status " + duel.status}>
              {statusLabel[duel.status]} · #{duel.id}
            </span>
            <h2 id="detail-title">
              {duel.repository} <small>{duel.tag}</small>
            </h2>
            <p className="claim">{duel.feature}</p>
            <div className="participants">
              <div>
                <span className="yes">YES · 发起方</span>
                <strong>{short(duel.creator)}</strong>
              </div>
              <LockKeyhole size={20} />
              <div>
                <span className="no">NO · 接受方</span>
                <strong>{short(duel.opponent)}</strong>
              </div>
            </div>
            <dl>
              <div>
                <dt>每方投入</dt>
                <dd>{token(duel.stake)} test GEN</dd>
              </div>
              <div>
                <dt>接受截止</dt>
                <dd>{when(duel.accept_before)}</dd>
              </div>
              <div>
                <dt>事件截止</dt>
                <dd>{when(duel.deadline)}</dd>
              </div>
              <div>
                <dt>最早退款</dt>
                <dd>{when(duel.refund_after)}</dd>
              </div>
            </dl>
            <a
              className="source"
              href={duel.source_url}
              target="_blank"
              rel="noreferrer"
            >
              <GitBranch size={14} />
              {isDemo ? "示例证据地址（虚构仓库）" : "查看约定的公开证据源"}
              <ExternalLink size={13} />
            </a>
            {duel.verdict && (
              <div className="evidence">
                <strong>
                  最近判定：{duel.verdict}
                  {isDemo && "（人工演示）"}
                </strong>
                <p>
                  {when(duel.last_checked)} · 第 {duel.checks} 次核验
                </p>
                <pre>
                  {duel.evidence.body ||
                    `未取得足够证据。${duel.evidence.http_status || duel.evidence.problem || ""}`}
                </pre>
              </div>
            )}
            {error && <div className="error">{error}</div>}
            {notice && <div className="notice">{notice}</div>}
            <div className="actions">
              {duel.status === "OPEN" && (
                <>
                  {now < duel.accept_before && actor !== duel.creator && (
                    <button
                      className="primary"
                      disabled={disabled}
                      onClick={() => action("accept_duel", duel)}
                    >
                      支持 NO，投入 {token(duel.stake)} test GEN
                    </button>
                  )}
                  {(actor === duel.creator || now >= duel.accept_before) && (
                    <button
                      disabled={disabled}
                      onClick={() => action("cancel_duel", duel)}
                    >
                      取消并取回额度
                    </button>
                  )}
                  {actor === duel.creator && now < duel.accept_before && (
                    <p className="muted">
                      {isDemo
                        ? "关闭详情，点击右上角切换到演示乙方，即可接受挑战。"
                        : "等待另一位参与者接受挑战。"}
                    </p>
                  )}
                </>
              )}
              {duel.status === "ACTIVE" && (
                <>
                  {now < duel.deadline && (
                    <p className="muted">事件尚未截止，截止后才能请求裁决。</p>
                  )}
                  {now >= duel.deadline &&
                    now < duel.refund_after &&
                    [duel.creator, duel.opponent].includes(actor) && (
                      <>
                        {isDemo ? (
                          <div className="demo-verdict">
                            <p>演示专用：人工选择结果，不会调用 AI。</p>
                            {(["YES", "NO", "UNKNOWN"] as Verdict[]).map(
                              (v) => (
                                <button
                                  key={v}
                                  disabled={
                                    disabled || now < duel.last_checked + 300
                                  }
                                  onClick={() =>
                                    action("resolve_duel", duel, v)
                                  }
                                >
                                  {v}
                                </button>
                              ),
                            )}
                          </div>
                        ) : (
                          <button
                            className="primary"
                            disabled={disabled || now < duel.last_checked + 300}
                            onClick={() => action("resolve_duel", duel)}
                          >
                            请求 GenLayer 核验
                          </button>
                        )}
                        {now < duel.last_checked + 300 && (
                          <p>请在上次核验 5 分钟后重试。</p>
                        )}
                      </>
                    )}
                  {now >= duel.refund_after && (
                    <button
                      className="primary"
                      disabled={disabled}
                      onClick={() => action("refund_duel", duel)}
                    >
                      申请双方原额退款
                    </button>
                  )}
                </>
              )}
              {["SETTLED", "CANCELLED", "REFUNDED"].includes(duel.status) && (
                <p>处理已完成。关闭详情后，可在「我的待提取额度」中提取。</p>
              )}
            </div>
            {isDemo && duel.status === "ACTIVE" && (
              <div className="time-tools">
                <span>仅推进当前浏览器的模拟时间</span>
                <button
                  onClick={() =>
                    setDemo({
                      ...demo,
                      offset:
                        demo.offset + Math.max(0, duel.deadline - now + 1),
                    })
                  }
                >
                  快进到事件截止
                </button>
                <button
                  onClick={() =>
                    setDemo({
                      ...demo,
                      offset:
                        demo.offset + Math.max(0, duel.refund_after - now + 1),
                    })
                  }
                >
                  快进到可退款
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
