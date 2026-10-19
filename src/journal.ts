export const JOURNAL_KEY = "event-duels:bradbury:journal:v1";
export interface TransactionRecord {
  hash: string;
  contract: string;
  action: string;
  wallet?: string;
  value?: string;
  args?: unknown[];
  submittedAt?: string;
  checkedAt?: string;
  receipt?: { status?: string | number; statusName?: string; txExecutionResult?: number; [key: string]: unknown };
}
type Store = Pick<Storage, "getItem" | "setItem">;
export function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return String(value);
  if (value instanceof Map)
    return Object.fromEntries([...value].map(([key, item]) => [String(key), jsonSafe(item)]));
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  return value;
}
export function loadJournal(storage: Store): TransactionRecord[] {
  try {
    const records: unknown = JSON.parse(storage.getItem(JOURNAL_KEY) || "[]");
    if (!Array.isArray(records)) return [];
    return records.filter((r): r is TransactionRecord => r &&
      /^0x[0-9a-fA-F]{64}$/.test(r.hash) && /^0x[0-9a-fA-F]{40}$/.test(r.contract) &&
      typeof r.action === "string").slice(0, 100);
  } catch { return []; }
}
// Storage failures must never turn an already-broadcast transaction into an
// apparent send failure. The caller retains the hash in memory for recovery.
export function saveRecord(storage: Store, record: TransactionRecord): boolean {
  try {
    const records = loadJournal(storage);
    const old = records.find((r) => r.hash === record.hash);
    storage.setItem(JOURNAL_KEY, JSON.stringify(jsonSafe([
      { ...old, ...record }, ...records.filter((r) => r.hash !== record.hash),
    ].slice(0, 100))));
    return true;
  } catch { return false; }
}
