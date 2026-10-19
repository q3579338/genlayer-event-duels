// Read-only GenVM checks. No signature, deployment or real transfer is sent.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { abi } from "genlayer-js";
import { toRlp, toHex, zeroAddress, hexToBytes } from "viem";
import { jsonSafe } from "../src/journal.ts";
const code = await readFile(new URL("../contracts/candidates/EventDuels.py", import.meta.url), "utf8");
const wallet = "0xa9ee18b34ec00664d73d89b8f8bba68beb888888";
const harness = code.replace("        self.owed = u256(0)", `        self.owed = u256(0)
        # Read-only constructor harness: native value is supplied by gen_call.
        who = self._caller()
        assert int(gl.message.value) == 10**15, "simulation did not supply value"
        assert self.deposit() == str(10**15)
        assert self.get_credit(who) == str(10**15)
        now = self._now()
        rejected = False
        try:
            self.create_duel("https://invalid.example", "v2", "CSV export is available", now + 600, now + 3600, str(10**15))
        except gl.vm.UserError:
            rejected = True
        assert rejected and self.get_credit(who) == str(10**15)
        duel_id = self.create_duel("test/repo", "v2", "CSV export is available", now + 600, now + 3600, str(10**15))
        assert self.get_duel(duel_id)["status"] == "OPEN"
        assert self.get_credit(who) == "0" and int(self.locked) == 10**15
        self.cancel_duel(duel_id)
        assert self.get_credit(who) == str(10**15) and int(self.locked) == 0
        self.withdraw()
        assert self.get_credit(who) == "0" and int(self.owed) == 0`);
async function rpc(method, request) {
  const response = await fetch("https://rpc-bradbury.genlayer.com", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [request] }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  return response.json();
}
const deployCall = (source, value) => ({ type: "deploy", from: wallet, to: zeroAddress,
  data: toRlp([toHex(source), toHex(abi.calldata.encode({})), "0x00"]), value });
const results = await Promise.all([
  rpc("gen_getContractSchema", { code: Buffer.from(code).toString("base64") }),
  rpc("gen_call", deployCall(code, "0x0")),
  rpc("gen_call", deployCall(harness, "0x38d7ea4c68000")),
]);
await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
const summary = { observedAt: new Date().toISOString(), sourceSha256: createHash("sha256").update(code).digest("hex"),
  limitation: "Read-only constructor integration harness. Not separate on-chain transactions, AI consensus or receipt of external funds.", checks: [] };
let failed = false;
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  await writeFile(new URL(`../artifacts/candidate-check-${i}.json`, import.meta.url), JSON.stringify(result, null, 2));
  const methods = result.result?.methods;
  const success = !result.error && (i === 0
    ? methods?.deposit?.payable === true && methods?.create_duel?.payable === false && methods?.accept_duel?.payable === false
    : result.result === "0x00" || result.result?.status?.code === 0);
  let detail;
  if (result.error?.data) {
    try { detail = jsonSafe(abi.calldata.decode(hexToBytes(`0x${result.error.data.replace(/^0x/, "")}`))); }
    catch { detail = result.error.message.slice(0, 300); }
  }
  summary.checks.push({ name: ["schema", "constructor", "deposit/create/rejection/cancel/withdraw harness"][i], success, detail: detail?.data || detail });
  if (!success) failed = true;
}
await writeFile(new URL("../artifacts/candidate-validation.json", import.meta.url), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
if (failed) throw new Error("Candidate verification failed; inspect artifacts before signing anything");
