# FairX Vault V4 Phase C devnet record

Status: deployment complete; canonical France–Morocco lifecycle complete and independently verified. No further market initialization or transaction is pending.

## Deployed program

| Item | Final value |
| --- | --- |
| Cluster | Solana devnet |
| Program | `2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p` |
| ProgramData | `9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V` |
| Upgrade authority | `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq` |
| Deployment signature | `3na7aznRQK9v3B3hPuDcAmQ5T8gNunrJ3rP6Cr85R25Qzg9vFPs7J5LfgtKaA91tMPJdJFih413bX1A1zQmKjjS7` |
| Deployment slot | `476416258` |
| Deployment block time | `2026-07-15T11:28:14+01:00` |
| SBF size | 422,040 bytes |
| SBF SHA-256 | `7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0` |
| Maximum binary capacity | 422,040 bytes |
| Loader | `BPFLoaderUpgradeab1e11111111111111111111111` |

The Program is executable and loader-owned. ProgramData is loader-owned and records the approved upgrade authority. The deployed bytes were dumped after finalization and reproduced the approved SHA-256 exactly. The temporary buffer `BGB1ncPYwkJBjC1jSFo1tJ68wnaB6H9t3QfwfHhUteLM` was drained and purged.

## Deployment cost reconciliation

| Item | Lamports | SOL |
| --- | ---: | ---: |
| Program account rent | 1,141,440 | 0.001141440 |
| ProgramData rent | 2,938,602,480 | 2.938602480 |
| Permanent rent total | 2,939,743,920 | 2.939743920 |
| Finalized deployment fees across attempts | 2,245,000 | 0.002245000 |
| Total fee-payer debit | 2,941,988,920 | 2.941988920 |
| Fee payer before initial attempt | 8,524,879,551 | 8.524879551 |
| Fee payer after successful deployment | 5,582,890,631 | 5.582890631 |

Zero priority fee was used. The earlier public-RPC interruptions changed only how the resumable buffer upload was paced; every finalized loader write was reconciled before continuation. No private-key contents were printed, copied or committed.

## Canonical V4 lifecycle

Label: **“Deterministic replay using recorded TxLINE event, odds and final-result proofs.”**

The recorded market uses only TxLINE fixture `18209181`, France–Morocco:

1. operator vault funded with 200,000,000 lamports;
2. genuine pre-goal StablePrice quote committed and verified;
3. pre-goal YES and NO fixed-payout positions accepted;
4. confirmed France goal ingested at material sequence 739;
5. sequence-738 bot order atomically refunded;
6. genuine post-goal StablePrice quote committed and verified;
7. synchronized post-event YES position accepted;
8. final regulation-time TxLINE proof validated at sequence 1114, France 2–0 Morocco;
9. 2-of-3 resolution approved and executed YES;
10. both YES payouts claimed and the NO position reconciled lost;
11. the vault reconciled, all four disposable position PDAs closed, and free liquidity withdrawn.

The lifecycle fixture records 24 finalized transactions in `fixtures/lineguard/v4-france-morocco-lifecycle.json`. `npm run v4:verify-lifecycle` returned `VERIFIED` with 20 verified checks, zero failures and zero unknowns on 2026-07-15.

## Solvency reconciliation

| Accounting item | Lamports |
| --- | ---: |
| Operator deposits | 200,000,000 |
| Accepted user stake principal | 30,000,000 |
| Stale stake entering and atomically refunded | 10,000,000 |
| Pre-goal YES gross payout | 18,769,297 |
| Post-goal YES gross payout | 11,431,275 |
| Losing NO stake retained | 10,000,000 |
| Lifetime payouts | 30,200,572 |
| Final operator withdrawal | 199,799,428 |
| Final free collateral | 0 |
| Final reserved liability | 0 |
| Final accepted principal | 0 |
| Final pending refundable stake | 0 |
| Final open position count | 0 |

Conservation: `200,000,000 + 30,000,000 - 30,200,572 = 199,799,428`. The stale 10,000,000-lamport stake entered and left in the same instruction and therefore does not affect accepted-principal conservation. V4 intentionally performs no opposite-side liability netting.

## Public authorities and custody boundary

- Bootstrap administrator, operator, fee payer and upgrade authority: `ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq`
- TxLINE feed authority: `FbC9mbuyi9iWeMyhe9ZtTRg6KY4qz6Vqb83S2ssUwSm5`
- Pricing authority: `Ckwtt9Hd6eyn9wWFTEsJ1YyhUg9jCWAm944od29wK1qa`
- Resolution authorities: `ABrWPMaGRRCY2qGbF3cYkZv7E2rMMANoesGWcoSDUkTG`, `EXVwU5mGZBAn7MBWZLwnDwqSkDZzn6PvhXJwh1L5cNm5`, `HECJKgZMDXvmzwqnSe1FBcrzCWhuaiiHCH9Hm1XfGDbf`

Signer files remain external to the repository. No private key, seed phrase or keypair JSON belongs in source control.

## Remaining boundary

Phase C's authorized devnet deployment and one canonical lifecycle are complete. This remains an unaudited, upgradeable, single-operator devnet prototype. No mainnet deployment, authority rotation, generalized market creation or additional fixture is authorized by this record.
