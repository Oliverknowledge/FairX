# FairX v2 architecture

```text
genuine TxLINE historical capture + StablePrice
  → canonical JSON hash + deterministic pricing
  → MarketV2 template and evidence commitments
  → user-signed OrderEscrowV2
      ├─ stale positive edge → exact wallet refund
      └─ synchronized order → wallet-owned Position + MarketVault
  → feed authority closes market
  → LineGuard CPI → TxLINE ValidateStatV2
  → LineGuard derives MATCH_WINNER_HOME_V1 outcome
  → resolution proposal + 2-of-3 approvals
  → position owner claims from the same isolated MarketVault
```

## Canonical PDAs

- AuthorityConfig: `3aHfuXLKtRmQrCiMzWMe7CiP2pARKu7rkcR78bmdVpai`
- MarketV2: `GRP8PvhytfrXku1WW5bnaWDgS7L14A84qNG51kRB5E2j`
- MarketVault: `2w9qFjUGNjdKjEw3tp9ko3SoCYdk19bwKoxixxZ6KyLb`
- Position: `FvhAN2x2S1CNvAuu3EQDpQfnWg4cNXiGZkJySsqf9PMJ`
- Validation receipt: `7RV4xKZxtpZwXrWLK8HxXMMzvLpgNydKHuBBxP11nbWq`
- Resolution proposal: `5PXYx3zHgaBUSkLw1A9CCPrj1hJYeLXRK2PuwmrVjRZp`

## Authority model

Feed, pricing, emergency, and three resolution roles are distinct. Resolution requires 2-of-3. Emergency action can only void/refund. Authority updates use the program's timelocked path. The current program upgrade authority has not been transferred.

## Trust and deployment boundaries

- Direct TxLINE CPI is enforced for the canonical resolution.
- Public users sign their own devnet orders and claims through wallet adapter.
- The canonical automated lifecycle used a secure test-user keypair, not Phantom.
- Operator services still ingest and reprice TxLINE evidence and submit resolution proposals.
- Program is unaudited, devnet-only, and not a real-money or mainnet system.

Legacy shared-ProtocolVault accounts remain readable historical evidence but are not the source of truth for v2 markets.
