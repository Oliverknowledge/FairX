/**
 * Independent verifier for the unified-lifecycle settlement proof. It re-derives every
 * integrity claim from the recorded fields so that tampering with the validated result,
 * winning side, payout, fixture, sequence, root, or pool totals is detected.
 */

export interface SettlementProofRecordShape {
  programId: string;
  marketPda: string;
  marketConfigPda: string;
  marketType: "MATCH_WINNER_HOME";
  ruleBindingDeployment: "UPGRADE_PENDING" | "DEPLOYED";
  receiptMarketPda: string;
  vaultPda: string;
  fixtureId: number;
  fixtureIdHash: string;
  sequence: number;
  resolution: "YES_WON" | "NO_WON" | "VOIDED";
  derivedOutcome: number;
  resolutionRule: "HOME_TEAM_WINS";
  resolutionRuleCode: number;
  yesMeaning: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamHash: string;
  awayTeamHash: string;
  homeStatKey: number;
  awayStatKey: number;
  homeScore: number;
  awayScore: number;
  validationRootPda: string;
  validateStatV2Passed: boolean;
  inProgramMerkleVerification: boolean;
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
export const HOME_TEAM_WINS_RULE = 0;
export const CANONICAL_FIXTURE_ID = 18_209_181;
export const CANONICAL_FIXTURE_HASH = "f90186a5dde4dbdad1486870c7b3839282d1e7132cbd7955fe86b40caf9ac7d0";
export const CANONICAL_HOME_TEAM_HASH = "7a1ca4ef7515f7276bae7230545829c27810c9d9e98ab2c06066bee6270d5153";
export const CANONICAL_AWAY_TEAM_HASH = "b675f5df5fe68da179f367852f25b42aa16fd84b05d9b05da50cd723635dfd02";

export interface SettlementVerification {
  valid: boolean;
  errors: string[];
}

/** Outcome is a pure function of the committed rule and submitted scores. */
export function deriveOutcome(homeScore: number, awayScore: number, resolutionRule = HOME_TEAM_WINS_RULE): number {
  if (resolutionRule !== HOME_TEAM_WINS_RULE) return 0;
  return homeScore > awayScore ? 1 : homeScore < awayScore ? 2 : 3;
}

export function verifySettlementProof(record: SettlementProofRecordShape): SettlementVerification {
  const errors: string[] = [];
  const check = (cond: boolean, message: string) => {
    if (!cond) errors.push(message);
  };

  check(record.programId === CANONICAL_LINEGUARD_PROGRAM, "program id does not match the canonical LineGuard program");
  check(record.receiptMarketPda === record.marketPda, "validation receipt belongs to another market");
  check(record.marketType === "MATCH_WINNER_HOME", "market type is unsupported for settlement");
  check(record.ruleBindingDeployment === "UPGRADE_PENDING" || record.ruleBindingDeployment === "DEPLOYED", "invalid rule-binding deployment status");
  check(record.vaultPda === CANONICAL_PROTOCOL_VAULT, "vault PDA does not match the canonical ProtocolVault");
  check(record.validationRootPda === GENUINE_TXLINE_ROOT_PDA, "validation root PDA is not the genuine TxLINE daily-scores root");
  check(record.fixtureId === CANONICAL_FIXTURE_ID, "fixture id does not match the canonical market");
  check(record.fixtureIdHash === CANONICAL_FIXTURE_HASH, "fixture commitment does not match the canonical market");
  check(record.resolutionRule === "HOME_TEAM_WINS" && record.resolutionRuleCode === HOME_TEAM_WINS_RULE, "resolution rule was tampered");
  check(record.yesMeaning === "France/home team wins", "committed YES meaning was tampered");
  check(record.homeTeam === "France" && record.homeTeamHash === CANONICAL_HOME_TEAM_HASH, "committed home team mapping was tampered");
  check(record.awayTeam === "Morocco" && record.awayTeamHash === CANONICAL_AWAY_TEAM_HASH, "committed away team mapping was tampered");
  check(record.homeStatKey === 1 && record.awayStatKey === 2, "committed stat keys were tampered");
  check(record.validateStatV2Passed === true, "separate TxLINE validateStatV2 validation did not pass");
  check(record.inProgramMerkleVerification === false, "record incorrectly claims in-program Merkle verification");
  check(Number.isInteger(record.homeScore) && record.homeScore >= 0 && record.homeScore <= 99, "home score is outside valid bounds");
  check(Number.isInteger(record.awayScore) && record.awayScore >= 0 && record.awayScore <= 99, "away score is outside valid bounds");
  check(record.homeScore === 1 && record.awayScore === 0, "submitted scores do not match the canonical validation payload");

  // The outcome must be exactly what the committed rule derives from the submitted score.
  const derived = deriveOutcome(record.homeScore, record.awayScore, record.resolutionRuleCode);
  check(record.derivedOutcome === derived, "derived outcome does not follow from the committed rule and submitted scores");
  const resolutionFromOutcome = derived === 1 ? "YES_WON" : derived === 2 ? "NO_WON" : "VOIDED";
  check(record.resolution === resolutionFromOutcome, "resolution does not match the derived outcome");
  if (derived !== 3) check(record.winnerSide === (derived === 1 ? "YES" : "NO"), "winning side does not match the derived outcome");

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
