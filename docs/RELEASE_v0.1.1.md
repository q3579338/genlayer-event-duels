Event Duels v0.1.1 improves transaction recovery and review evidence on the existing Bradbury contract.

- Exportable transaction records contain transaction hash, wallet, exact wei amount, submitted arguments and the latest raw receipt.
- Finality and execution success are shown separately. Withdraw execution success still requires external transfer and wallet-balance verification.
- Account, network and contract changes invalidate stale reads. Broadcast hashes remain visible even if browser storage fails.
- Evidence and transaction JSON can be inspected directly in the page.
- A public walkthrough separates the manual local demo from real chain evidence.
- 12 contract-state tests and 8 transaction/recovery tests pass. Production build, remote schema and read-only deployment/source checks pass.

This is a testnet prototype. Deployment is finalized; live two-wallet AI settlement, refunds and external payouts remain unverified. The existing contract and its 72-hour refund rule are unchanged.
