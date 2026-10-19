import test from "node:test";
import assert from "node:assert/strict";
import { requestWalletAccount } from "../src/wallet-access.ts";

const A = "0xa9EE18b34Ec00664D73d89b8F8BBA68bEB888888";
const B = "0x378eFaDE29d33eddefcF0Ef700917E343dfA2cdc";

test("ordinary reconnect retains the wallet-provided account without changing permissions", async () => {
  const requests = [];
  const provider = { request: async request => { requests.push(request); return [A]; } };
  assert.equal(await requestWalletAccount(provider), A);
  assert.deepEqual(requests, [{ method: "eth_requestAccounts" }]);
});

test("explicit account choice reopens only account permission and uses the returned CDC identity", async () => {
  const requests = [];
  const provider = { request: async request => {
    requests.push(request);
    return request.method === "wallet_requestPermissions" ? [] : [B];
  } };
  assert.equal(await requestWalletAccount(provider, true), B);
  assert.deepEqual(requests, [
    { method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] },
    { method: "eth_requestAccounts" },
  ]);
});

test("rejected account choice cannot continue with the previous account", async () => {
  const requests = [];
  const rejection = Object.assign(new Error("User rejected"), { code: 4001 });
  const provider = { request: async request => { requests.push(request); throw rejection; } };
  await assert.rejects(requestWalletAccount(provider, true), error => error === rejection);
  assert.equal(requests.length, 1);
  for (const result of [[], null, ["bad-address"]])
    await assert.rejects(requestWalletAccount({ request: async () => result }), /有效账户/);
});
