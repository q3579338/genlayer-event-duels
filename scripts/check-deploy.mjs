// Read-only constructor simulation; this does not broadcast or sign a deploy.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { abi } from "genlayer-js";
import { toRlp, toHex, zeroAddress } from "viem";

const code = await readFile(new URL("../contracts/EventDuels.py", import.meta.url), "utf8");
const data = toRlp([toHex(code), toHex(abi.calldata.encode({})), "0x00"]);
const response = await fetch("https://rpc-bradbury.genlayer.com", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "gen_call", params: [{
    type: "deploy", from: zeroAddress, to: zeroAddress, data,
  }] }),
  signal: AbortSignal.timeout(60000),
});
const result = await response.json();
await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
await writeFile(new URL("../artifacts/constructor-simulation.json", import.meta.url), JSON.stringify(result, null, 2));
if (result.error) throw new Error(result.error.message);
// Current stable node returns "0x00"; newer nodes return a structured result.
if (result.result !== "0x00" && result.result?.status?.code !== 0)
  throw new Error(`Unexpected constructor result: ${JSON.stringify(result.result)}`);
console.log("Bradbury constructor simulation passed; no transaction submitted.");
