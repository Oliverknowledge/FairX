import fixture from "@/fixtures/txline/v4-france-morocco-lifecycle.json";
export { V4_PROGRAM_ID } from "@/lib/v4/program";

export const V4_REPLAY_SLUG = "france-morocco-v4-replay";
export const REPLAY_LABEL = "Deterministic replay using recorded TxLINE event, odds and final-result proofs.";
export const MICROS_ONE = 1_000_000n;
export const REPLAY_SPREAD_MICROS = 10_000n;
export const REPLAY_STAKE_LAMPORTS = 10_000_000n;
export const OPERATOR_DEPOSIT_LAMPORTS = 200_000_000n;

export type Side = "YES" | "NO";
export type PositionStatus = "ACCEPTED" | "REFUNDED" | "CLAIMED" | "LOST" | "CLOSED";

export interface VaultSnapshot {
  label: string;
  spendableLamports: bigint;
  freeCollateral: bigint;
  reservedLiability: bigint;
  acceptedStakePrincipal: bigint;
}

export interface ReplayPosition {
  id: "pre-yes" | "pre-no" | "stale-bot" | "post-yes";
  ownerLabel: string;
  side: Side;
  stakeLamports: bigint;
  priceMicros: bigint;
  grossPayoutLamports: bigint;
  liabilityLamports: bigint;
  materialEventSequence: number;
  quoteLabel: string;
  status: PositionStatus;
}

export const V4_EVIDENCE = {
  fixtureId: fixture.fixtureId,
  home: "France",
  away: "Morocco",
  preGoal: fixture.preGoalOddsValidation,
  goal: fixture.goal,
  postGoal: fixture.postGoalOddsValidation,
  finalSequence: fixture.finalSequence,
  finalResult: fixture.finalResult,
  finalProof: fixture.finalStatValidation,
  oddsRootPda: fixture.oddsRootPda,
  scoresRootPda: fixture.scoresRootPda,
} as const;

export function deriveHomeProbabilityMicros(prices: readonly number[]): bigint {
  if (prices.length !== 3 || prices.some((price) => !Number.isInteger(price) || price <= 0)) {
    throw new Error("TxLINE prices must be three positive integers");
  }
  const [h, d, a] = prices.map(BigInt);
  const da = d * a;
  const denominator = da + h * a + h * d;
  return (da * MICROS_ONE + denominator / 2n) / denominator;
}

export function executablePrices(prices: readonly number[]) {
  const yesProbabilityMicros = deriveHomeProbabilityMicros(prices);
  return {
    yesProbabilityMicros,
    yesPriceMicros: yesProbabilityMicros + REPLAY_SPREAD_MICROS,
    noPriceMicros: MICROS_ONE - yesProbabilityMicros + REPLAY_SPREAD_MICROS,
  };
}

export function grossPayout(stakeLamports: bigint, executionPriceMicros: bigint): bigint {
  if (stakeLamports <= 0n || executionPriceMicros <= 0n || executionPriceMicros >= MICROS_ONE) {
    throw new Error("Invalid stake or execution price");
  }
  return (stakeLamports * MICROS_ONE) / executionPriceMicros;
}

/**
 * Canonical economic counterfactual for the recorded stale-order moment.
 * This is presentation-only arithmetic derived from the same recorded prices
 * and payout formula as the lifecycle; it does not alter settlement behavior.
 */
export function canonicalStaleCounterfactual() {
  const pre = executablePrices(V4_EVIDENCE.preGoal.odds.Prices);
  const post = executablePrices(V4_EVIDENCE.postGoal.odds.Prices);
  const staleGrossPayoutLamports = grossPayout(REPLAY_STAKE_LAMPORTS, pre.yesPriceMicros);
  const synchronizedGrossPayoutLamports = grossPayout(REPLAY_STAKE_LAMPORTS, post.yesPriceMicros);
  const staleLiabilityLamports = staleGrossPayoutLamports - REPLAY_STAKE_LAMPORTS;
  const synchronizedLiabilityLamports = synchronizedGrossPayoutLamports - REPLAY_STAKE_LAMPORTS;
  return {
    stakeLamports: REPLAY_STAKE_LAMPORTS,
    staleGrossPayoutLamports,
    synchronizedGrossPayoutLamports,
    staleLiabilityLamports,
    synchronizedLiabilityLamports,
    excessStaleLiabilityLamports: staleLiabilityLamports - synchronizedLiabilityLamports,
  };
}

function position(
  id: ReplayPosition["id"],
  ownerLabel: string,
  side: Side,
  priceMicros: bigint,
  materialEventSequence: number,
  quoteLabel: string,
  status: PositionStatus,
): ReplayPosition {
  const gross = status === "REFUNDED" ? 0n : grossPayout(REPLAY_STAKE_LAMPORTS, priceMicros);
  return {
    id,
    ownerLabel,
    side,
    stakeLamports: REPLAY_STAKE_LAMPORTS,
    priceMicros,
    grossPayoutLamports: gross,
    liabilityLamports: gross === 0n ? 0n : gross - REPLAY_STAKE_LAMPORTS,
    materialEventSequence,
    quoteLabel,
    status,
  };
}

export function runCanonicalLifecycle() {
  const pre = executablePrices(V4_EVIDENCE.preGoal.odds.Prices);
  const post = executablePrices(V4_EVIDENCE.postGoal.odds.Prices);
  const positions = [
    position("pre-yes", "Honest wallet A", "YES", pre.yesPriceMicros, 738, "Pre-goal", "ACCEPTED"),
    position("pre-no", "Honest wallet B", "NO", pre.noPriceMicros, 738, "Pre-goal", "ACCEPTED"),
    position("stale-bot", "Stale-sequence trader", "YES", pre.yesPriceMicros, 738, "Invalidated by seq 739", "REFUNDED"),
    position("post-yes", "Synchronized wallet", "YES", post.yesPriceMicros, 739, "Post-goal", "ACCEPTED"),
  ] satisfies ReplayPosition[];

  let spendableLamports = OPERATOR_DEPOSIT_LAMPORTS;
  let freeCollateral = OPERATOR_DEPOSIT_LAMPORTS;
  let reservedLiability = 0n;
  let acceptedStakePrincipal = 0n;
  const snapshots: VaultSnapshot[] = [];
  const snapshot = (label: string) => snapshots.push({ label, spendableLamports, freeCollateral, reservedLiability, acceptedStakePrincipal });
  snapshot("Vault funded");

  const accept = (accepted: ReplayPosition) => {
    spendableLamports += accepted.stakeLamports;
    freeCollateral -= accepted.liabilityLamports;
    reservedLiability += accepted.liabilityLamports;
    acceptedStakePrincipal += accepted.stakeLamports;
    snapshot(`${accepted.ownerLabel} accepted`);
  };

  accept(positions[0]);
  accept(positions[1]);
  snapshot("France goal seq 739 invalidated quote seq 1");

  // The stale stake enters and leaves within one instruction; no durable vault field changes.
  snapshot("Stale-sequence principal returned");
  accept(positions[3]);

  for (const winner of positions.filter((item) => item.status === "ACCEPTED" && item.side === "YES")) {
    spendableLamports -= winner.grossPayoutLamports;
    reservedLiability -= winner.liabilityLamports;
    acceptedStakePrincipal -= winner.stakeLamports;
    winner.status = "CLAIMED";
    snapshot(`${winner.ownerLabel} claimed`);
  }

  for (const loser of positions.filter((item) => item.status === "ACCEPTED")) {
    freeCollateral += loser.stakeLamports + loser.liabilityLamports;
    reservedLiability -= loser.liabilityLamports;
    acceptedStakePrincipal -= loser.stakeLamports;
    loser.status = "LOST";
    snapshot(`${loser.ownerLabel} reconciled`);
  }

  const preWithdrawalFreeCollateral = freeCollateral;
  spendableLamports -= preWithdrawalFreeCollateral;
  freeCollateral = 0n;
  snapshot("Operator withdrew free collateral");

  return {
    pre,
    post,
    positions,
    snapshots,
    final: snapshots.at(-1)!,
    preWithdrawalFreeCollateral,
    lifetimePayouts: positions.filter((item) => item.status === "CLAIMED").reduce((sum, item) => sum + item.grossPayoutLamports, 0n),
    lifetimeRefunds: REPLAY_STAKE_LAMPORTS,
    lifetimeLosingStakes: positions.filter((item) => item.status === "LOST").reduce((sum, item) => sum + item.stakeLamports, 0n),
  };
}

export function invariantHolds(snapshot: VaultSnapshot): boolean {
  return snapshot.spendableLamports
    === snapshot.freeCollateral + snapshot.reservedLiability + snapshot.acceptedStakePrincipal;
}

export function formatSol(lamports: bigint): string {
  return `${(Number(lamports) / 1_000_000_000).toFixed(6)} SOL`;
}

export function formatPrice(micros: bigint): string {
  return `${(Number(micros) / 10_000).toFixed(2)}¢`;
}

export function shortHash(value: string): string {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}
