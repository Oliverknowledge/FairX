import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/txline/v4-france-morocco-lifecycle.json";
import {
  executablePrices,
  grossPayout,
  invariantHolds,
  REPLAY_STAKE_LAMPORTS,
  runCanonicalLifecycle,
  V4_EVIDENCE,
} from "@/lib/v4/replay";

describe("FairX V4 deterministic France-Morocco replay", () => {
  it("derives executable prices from genuine raw TxLINE prices", () => {
    expect(executablePrices(fixture.preGoalOddsValidation.odds.Prices)).toEqual({
      yesProbabilityMicros: 522_785n,
      yesPriceMicros: 532_785n,
      noPriceMicros: 487_215n,
    });
    expect(executablePrices(fixture.postGoalOddsValidation.odds.Prices)).toEqual({
      yesProbabilityMicros: 864_793n,
      yesPriceMicros: 874_793n,
      noPriceMicros: 145_207n,
    });
  });

  it("floors fixed payout and reserves only incremental liability", () => {
    const gross = grossPayout(REPLAY_STAKE_LAMPORTS, 532_785n);
    expect(gross).toBe(18_769_297n);
    expect(gross - REPLAY_STAKE_LAMPORTS).toBe(8_769_297n);
  });

  it("contains the genuine goal and final-period proof, never the 1-0 record", () => {
    expect(V4_EVIDENCE.goal.sequence).toBe(739);
    expect(V4_EVIDENCE.goal.sourcePayloadSha256).toBe("e4701bab0a8d2b8576eef7d2050ad032d3e090315129f51a732c8c6e5f2db598");
    expect(V4_EVIDENCE.finalSequence).toBe(1114);
    expect(V4_EVIDENCE.finalResult).toEqual({ home: 2, away: 0 });
    expect(V4_EVIDENCE.finalProof.statsToProve).toEqual([
      { key: 1001, value: 0, period: 100 },
      { key: 1002, value: 0, period: 100 },
      { key: 3001, value: 2, period: 100 },
      { key: 3002, value: 0, period: 100 },
    ]);
  });

  it("includes complete odds and final proof branches", () => {
    expect(fixture.preGoalOddsValidation.subTreeProof).toHaveLength(10);
    expect(fixture.preGoalOddsValidation.mainTreeProof).toHaveLength(6);
    expect(fixture.postGoalOddsValidation.subTreeProof).toHaveLength(11);
    expect(fixture.postGoalOddsValidation.mainTreeProof).toHaveLength(6);
    expect(fixture.finalStatValidation.statProofs).toHaveLength(4);
  });

  it("runs the full conservative lifecycle and reconciles every snapshot", () => {
    const lifecycle = runCanonicalLifecycle();
    expect(lifecycle.snapshots.every(invariantHolds)).toBe(true);
    expect(lifecycle.preWithdrawalFreeCollateral).toBe(199_799_428n);
    expect(lifecycle.lifetimePayouts).toBe(30_200_572n);
    expect(lifecycle.lifetimeRefunds).toBe(10_000_000n);
    expect(lifecycle.lifetimeLosingStakes).toBe(10_000_000n);
    expect(lifecycle.final).toEqual({
      label: "Operator withdrew free collateral",
      spendableLamports: 0n,
      freeCollateral: 0n,
      reservedLiability: 0n,
      acceptedStakePrincipal: 0n,
    });
    expect(lifecycle.positions.find((position) => position.id === "stale-bot")?.status).toBe("REFUNDED");
  });
});
