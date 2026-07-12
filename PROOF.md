# FairX v2 canonical devnet proof

The current canonical proof is the settled France–Morocco v2 market. Legacy shared-vault proofs remain available only under **Historical protocol versions** on `/proof`.

## Program and market

- Program: `6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe`
- Slot: `475831626`
- Market: `GRP8PvhytfrXku1WW5bnaWDgS7L14A84qNG51kRB5E2j`
- Market vault: `2w9qFjUGNjdKjEw3tp9ko3SoCYdk19bwKoxixxZ6KyLb`
- Position: `FvhAN2x2S1CNvAuu3EQDpQfnWg4cNXiGZkJySsqf9PMJ`
- Template: `MATCH_WINNER_HOME_V1`

## TxLINE and resolution

- Fixture / sequence: `18209181` / `739`
- TxLINE program: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- Root PDA: `EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr`
- CPI: `ValidateStatV2` succeeded
- Scores: France `1`, Morocco `0`
- Derived outcome: `YES`
- Borsh payload hash: `1b1c31c9ffee2aec676fa9d9585e677c0c5ee42d38ec137f222fc87ea8501c98`
- Approval mask: `011`; threshold `2-of-3`; proposal executed

## Protection, position, and payout

- Stale refund transaction: `53CJo5rqySudR88vbK73CBwa6UoWXQrNwDTw2eKtjZAiFrNZYCfFsbxSAETsmB71E2wd92vZSwbVk5Sut4GPGUqB`
- Accepted-position transaction: `2dj1svkdjYFcpoyUZvJgUSrQvThAQtmtjX7pvK1tzMWq6udsMmVWnabQuooJ4THCg9xC3RX2JvUBxVR9R6TzUSFG`
- Claim transaction: `4q3mMYvWBrJzv3Vyix9TBYJGjCWAtMAAMAMsQrmnM1e7MiHwBvsevZhJf5UBMQvoKW1AtyoE6Ji3S9zY9c2QgJHR`
- Trader: `8GEhW9qEJEFPQ6sA34H9fMUk937LPCVvKcVwWbhka4vx`
- Refunded / accepted / paid: `0.01 / 0.01 / 0.01 Devnet SOL`

## Conservation

```text
20,000,000 deposited
= 10,000,000 refunded
+ 10,000,000 paid
+ 0 claimable
+ 0 rounding dust
```

The vault retains only its `1,510,320`-lamport rent reserve. A repeated claim is rejected with `PositionAlreadyClaimed`.

Open `/verify/v2-france-morocco` to reconstruct both TxLINE hash domains and exercise every tamper control.
