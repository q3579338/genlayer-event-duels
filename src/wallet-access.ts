import { isAddress } from "viem";
import type { Address } from "viem";

interface AccountProvider {
  request(request: { method: string; params?: unknown[] }): Promise<unknown>;
}

// Re-request account access only on the explicit account-choice action.
// Ordinary reconnects never reopen permissions or initiate a transaction.
export async function requestWalletAccount(provider: AccountProvider, chooseAccount = false): Promise<Address> {
  if (chooseAccount) {
    try {
      await provider.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
    } catch (error) {
      const code = (error as { code?: number })?.code;
      if (code === -32601 || code === 4200)
        throw new Error("当前钱包不支持网页选择账户。请在 MetaMask 的「所有权限」中选择此网站，再编辑连接账户。");
      throw error;
    }
  }
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const account = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof account !== "string" || !isAddress(account))
    throw new Error("钱包未提供有效账户，请重新连接。");
  return account;
}
