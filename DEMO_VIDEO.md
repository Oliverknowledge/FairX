# FairX v2 demo video

Target: 3–4 minutes, desktop 1440×900, browser zoom 100%.

1. **Homepage** — show FairX v2 deployed on devnet, slot `475831626`, direct TxLINE CPI, isolated vault and 2-of-3 resolution.
2. **Walkthrough** — genuine TxLINE historical event → stale refund → reprice → accepted Position → close → direct CPI → two approvals → YES → claim → conservation.
3. **Canonical market** — show the complete public settled state without connecting a wallet: France won, Position claimed, refund/payout transactions and `0.02 = 0.01 + 0.01` vault accounting.
4. **V2 verifier** — open `/verify/v2-france-morocco`; point to both hash domains and `V2 LIFECYCLE VERIFIED`.
5. **Tamper** — change the Borsh hash, approval mask and payout in separate resets; each must show `TAMPER DETECTED`.
6. **Wallet modal** — show Phantom and Solflare support. Say clearly: “The recorded canonical lifecycle used a secure test-user devnet keypair, not a browser extension.”
7. **Proof hub** — primary v2 evidence first; legacy proofs only under **Historical protocol versions**.

Closing narration:

> FairX protected entry, verified the result and paid the winning position from the same isolated market vault. This is an unaudited Solana devnet prototype using Devnet SOL only, with no mainnet or real-money operation.

Before recording, verify every surface identifies v2 as deployed, there is no horizontal overflow or browser console error, and every Explorer link targets `cluster=devnet`.
