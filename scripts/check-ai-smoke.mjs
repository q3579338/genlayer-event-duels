// Read-only smoke check using real public GitHub data and GenVM AI.
// The ACTIVE duel, balances and deadlines are injected test fixtures.
// This does not deploy, transfer funds or prove multi-validator consensus.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { abi } from "genlayer-js";
import { toRlp, toHex, zeroAddress, hexToBytes } from "viem";
import { jsonSafe } from "../src/journal.ts";
const code = await readFile(new URL("../contracts/candidates/EventDuels.py", import.meta.url), "utf8");
const injection = `        self.owed = u256(0)
        # Injected read-only test fixture; these are not real funds or transactions.
        who = self._caller()
        now = self._now()
        self.count = u256(1)
        self.locked = u256(2 * 10**15)
        self._save({
            "id": 1, "repository": "q3579338/genlayer-event-duels", "tag": "v0.1.1",
            "feature": "The release notes explicitly announce exportable transaction records containing transaction hash, wallet, exact wei amount, and raw receipt.",
            "source_url": "https://api.github.com/repos/q3579338/genlayer-event-duels/releases/tags/v0.1.1",
            "creator": who, "opponent": "0x378efade29d33eddefcf0ef700917e343dfa2cdc",
            "stake": str(10**15), "created_at": now - 7200, "accept_before": now - 3600,
            "deadline": now - 60, "refund_after": now + 3 * 86400 - 60,
            "status": "ACTIVE", "verdict": "", "last_checked": 0, "checks": 0,
            "evidence": {}, "settled_at": 0,
        })
        self.resolve_duel(1)
        result = self._get(1)
        assert result["verdict"] == "YES" and result["status"] == "SETTLED", json.dumps(result)
        assert result["evidence"]["available"] and result["evidence"]["tag"] == "v0.1.1"
        assert self.get_credit(who) == str(2 * 10**15) and int(self.locked) == 0`;
if (code.split("        self.owed = u256(0)").length !== 2) throw new Error("Harness insertion is ambiguous");
const harness = code.replace("        self.owed = u256(0)", injection);
const started = new Date().toISOString();
const output = new URL(`../artifacts/ai-smoke/${started.replace(/[:.]/g, '-')}/`, import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('harness.py', output), harness);
const response = await fetch("https://rpc-bradbury.genlayer.com", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "gen_call", params: [{
    type: "deploy", from: "0xa9ee18b34ec00664d73d89b8f8bba68beb888888", to: zeroAddress,
    data: toRlp([toHex(harness), toHex(abi.calldata.encode({})), "0x00"]), value: "0x0",
  }] }), signal: AbortSignal.timeout(45000),
});
const raw = await response.json();
await writeFile(new URL('raw.json', output), JSON.stringify(raw, null, 2));
let detail;
if (raw.error?.data) {
  try { detail = jsonSafe(abi.calldata.decode(hexToBytes(`0x${raw.error.data.replace(/^0x/, "")}`))); }
  catch { detail = raw.error.message; }
}
const summary = { startedAt: started, observedAt: new Date().toISOString(),
  sourceSha256: createHash("sha256").update(code).digest("hex"),
  harnessSha256: createHash("sha256").update(harness).digest("hex"),
  success: response.ok && !raw.error && (raw.result === "0x00" || raw.result?.status?.code === 0),
  expected: "Real release lookup and AI YES, recorded evidence and winner credit in an injected read-only fixture",
  rpcError: raw.error?.message?.slice(0, 120),
  limitation: "Injected state and deadlines. Read-only GenVM execution; not a signed live duel, independent validator consensus or external transfer.",
};
const stored = (detail?.storage_changes ?? []).flatMap(pair => Array.isArray(pair) ? pair : Object.values(pair))
  .filter(value => value && typeof value === 'object').map(value => Buffer.from(Object.values(value)).toString('utf8'));
let outcome;
for (const text of stored) {
  const start = text.indexOf('{"accept_before"');
  if (start >= 0) { try { const duel = JSON.parse(text.slice(start).replace(/\0+$/, '')); outcome = {status:duel.status,verdict:duel.verdict,evidenceAvailable:duel.evidence?.available,tag:duel.evidence?.tag}; } catch {} }
}
summary.outcome = outcome;
await writeFile(new URL('summary.json', output), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary,null,2));
if (!summary.success) process.exitCode = 1;
