export type Verdict = "YES" | "NO" | "UNKNOWN";
export interface Duel {
  id: number;
  repository: string;
  tag: string;
  feature: string;
  source_url: string;
  creator: string;
  opponent: string;
  stake: string;
  created_at: number;
  accept_before: number;
  deadline: number;
  refund_after: number;
  status: "OPEN" | "ACTIVE" | "SETTLED" | "REFUNDED" | "CANCELLED";
  verdict: Verdict | "";
  last_checked: number;
  checks: number;
  settled_at: number;
  evidence: {
    available?: boolean;
    published_at?: string;
    body?: string;
    http_status?: number;
    problem?: string;
  };
}
export const ALICE = "0x1111111111111111111111111111111111111111";
export const BOB = "0x2222222222222222222222222222222222222222";
export const VERSION = "event-duels/0.1.0";
export const DEMO_KEY = "event-duels:demo:v1";
export interface Demo {
  duels: Duel[];
  credits: Record<string, string>;
  offset: number;
}
export function freshDemo(): Demo {
  const now = Math.floor(Date.now() / 1000);
  return {
    offset: 0,
    credits: {},
    duels: [
      {
        id: 1,
        repository: "example-labs/atlas",
        tag: "v2.0.0",
        feature:
          "正式版的发布说明明确宣布：用户可以将自己的数据导出为 CSV 文件。",
        source_url:
          "https://api.github.com/repos/example-labs/atlas/releases/tags/v2.0.0",
        creator: ALICE,
        opponent: "",
        stake: "100000000000000000",
        created_at: now,
        accept_before: now + 86400,
        deadline: now + 2 * 86400,
        refund_after: now + 5 * 86400,
        status: "OPEN",
        verdict: "",
        last_checked: 0,
        checks: 0,
        settled_at: 0,
        evidence: {},
      },
    ],
  };
}
export function loadDemo(): Demo {
  try {
    const d = JSON.parse(localStorage.getItem(DEMO_KEY) || "null");
    if (d && Array.isArray(d.duels) && d.credits && Number.isFinite(d.offset))
      return d;
  } catch {
    /* Ignore obsolete browser-only sample data. */
  }
  return freshDemo();
}
export const short = (a: string) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "等待加入";
export const when = (ts: number) =>
  new Date(ts * 1000).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
export const statusLabel = {
  OPEN: "等待对手",
  ACTIVE: "进行中",
  SETTLED: "已裁决",
  REFUNDED: "已退款",
  CANCELLED: "已取消",
};
