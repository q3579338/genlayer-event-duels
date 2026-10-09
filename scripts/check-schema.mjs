import { readFile, mkdir, writeFile } from 'node:fs/promises';
const url = process.env.GENLAYER_RPC || 'https://rpc-bradbury.genlayer.com';
const code = await readFile(new URL('../contracts/EventDuels.py', import.meta.url));
const response = await fetch(url, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'gen_getContractSchema', params: [{ code: code.toString('base64') }] }),
  signal: AbortSignal.timeout(60000),
});
const data = await response.json();
if (!response.ok || data.error) throw new Error(`Schema check failed (HTTP ${response.status}, RPC ${data.error?.code ?? 'unknown'}).`);
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/contract-schema.json', import.meta.url), JSON.stringify(data.result, null, 2));
console.log('Remote GenVM schema validated:', Object.keys(data.result.methods || {}));
