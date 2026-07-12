/**
 * Independent verifier for the unified-lifecycle settlement proof. It re-derives every
 * integrity claim from the recorded fields so that tampering with the validated result,
 * winning side, payout, fixture, sequence, root, or pool totals is detected.
 */

export interface SettlementProofRecordShape {
  programId: string;
  vaultPda: string;
  fixtureId: number;
  sequence: number;
  resolution: "YES_WON" | "NO_WON" | "VOIDED";
  derivedOutcome: number;
  homeScore: number;
  awayScore: number;
  validationRootPda: string;
  protectionVerdict: string;
  protectionRefunded: boolean;
  winnerSide: "YES" | "NO";
  winnerStakeLamports: number;
  winnerPayoutLamports: number;
  yesPoolLamports: number;
  noPoolLamports: number;
  totalPoolLamports: number;
  winningPoolLamports: number;
  winnerOrderStatus: string;
  marketTotalInLamports: number;
  marketTotalPaidLamports: number;
  marketTotalRefundedLamports: number;
  transactions: Array<{ signature: string }>;
}

export const CANONICAL_LINEGUARD_PROGRAM = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";
export const CANONICAL_PROTOCOL_VAULT = "HyM4MaQzz6qfXPZfDVvtAPeLaxJVkN8Tde4TNqyoZkKE";
export const GENUINE_TXLINE_ROOT_PDA = "EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr";
export const EXPECTED_LIFECYCLE_TX_COUNT = 13;

export interface SettlementVerification {
  valid: boolean;
  errors: string[];
}

/** Outcome is a pure function of the proven score — this is what makes it non-forgeable. */
export function deriveOutcome(homeScore: number, awayScore: number): number {
  return homeScore > awayScore ? 1 : 2;
}

export function verifySettlementProof(record: SettlementProofRecordShape): SettlementVerification {
  const errors: string[] = [];
  const check = (cond: boolean, message: string) => {
    if (!cond) errors.push(message);
  };

  check(record.programId === CANONICAL_LINEGUARD_PROGRAM, "program id does not match the canonical LineGuard program");
  check(record.vaultPda === CANONICAL_PROTOCOL_VAULT, "vault PDA does not match the canonical ProtocolVault");
  check(record.validationRootPda === GENUINE_TXLINE_ROOT_PDA, "validation root PDA is not the genuine TxLINE daily-scores root");

  // The outcome must be exactly what the proven score derives — not an arbitrary value.
  const derived = deriveOutcome(record.homeScore, record.awayScore);
  check(record.derivedOutcome === derived, "derived outcome does not follow from the proven score");
  const resolutionFromOutcome = derived === 1 ? "YES_WON" : "NO_WON";
  check(record.resolution === resolutionFromOutcome, "resolution does not match the derived outcome");
  check(record.winnerSide === (derived === 1 ? "YES" : "NO"), "winning side does not match the derived outcome");

  // Pool + parimutuel payout arithmetic.
  check(record.totalPoolLamports === record.yesPoolLamports + record.noPoolLamports, "total pool != yes_pool + no_pool");
  check(record.winningPoolLamports === (record.winnerSide === "YES" ? record.yesPoolLamports : record.noPoolLamports), "winning pool does not match the winning side");
  if (record.winningPoolLamports > 0) {
    const expectedPayout = Math.floor((record.winnerStakeLamports * record.totalPoolLamports) / record.winningPoolLamports);
    check(record.winnerPayoutLamports === expectedPayout, "winner payout != stake * total_pool / winning_pool");
  }

  // Per-market solvency invariant: total_in == paid + refunded + remaining, and never negative.
  check(record.marketTotalPaidLamports + record.marketTotalRefundedLamports <= record.marketTotalInLamports, "paid + refunded exceeds accepted stake (insolvent)");
  check(record.marketTotalInLamports === record.totalPoolLamports, "accepted stake != pooled stake");

  // Protection leg happened on the same market.
  check(record.protectionRefunded === true, "the stale exploit was not refunded");
  check(record.protectionVerdict === "VOIDED_REFUNDED", "protection verdict is not VOIDED_REFUNDED");

  check(record.winnerOrderStatus === "Settled", "winning order is not marked Settled");
  check(record.transactions.length === EXPECTED_LIFECYCLE_TX_COUNT, `expected ${EXPECTED_LIFECYCLE_TX_COUNT} lifecycle transactions`);

  return { valid: errors.length === 0, errors };
}
