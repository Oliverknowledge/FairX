import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { buildInitializeMarketV2Instruction } from "@/lib/solana/initializeMarketV2";
import { deriveMarketV2Pda } from "@/lib/solana/lineguardV2";
import { accountDiscriminator, instructionDiscriminator, INITIALIZE_MARKET_V2_DISCRIMINATOR } from "@/lib/solana/schemaVerify";

const H = "11".repeat(32); // a valid non-zero 32-byte hex hash
const NOW = 1_784_000_000;

function validParams(over: Record<string, unknown> = {}) {
  return {
    admin: PublicKey.default,
    payer: PublicKey.default,
    label: "fairx-france-spain-v2",
    fixtureId: 18237038,
    fixtureIdHash: H, homeTeamHash: H, awayTeamHash: H,
    homeStatKey: 1, awayStatKey: 2,
    materialityConfigHash: H, pricingConfigHash: H, pricingModelHash: H, oddsPayloadHash: H,
    oddsSequence: 1, materialSeq: 1, pricedAtSeq: 1,
    displayedPriceMicros: 411_250, fairPriceMicros: 411_250, toleranceMicros: 20_000,
    closeTime: NOW + 10_000, claimDeadline: 0, evidenceMode: 0, settlementMinTimestampMs: (NOW + 10_000) * 1000,
    nowSeconds: NOW,
    ...over,
  };
}

describe("initialize_market_v2 builder", () => {
  it("derives the France–Spain PDAs from the selected label (no France–Morocco fallback)", () => {
    const built = buildInitializeMarketV2Instruction(validParams());
    expect(built.marketPda.toBase58()).toBe("FG2juXJha8pRoeGtf9umUEBamd6AQ6WBi8RxLb4UAzA7");
    expect(built.vaultPda.toBase58()).toBe("Bn1wCdP6duXEmHxosyobDWJtmVtqEUFoNdBpV32nMDCU");
    // Must NOT be the canonical France–Morocco market PDA.
    expect(built.marketPda.toBase58()).not.toBe(deriveMarketV2Pda("fairx-france-morocco-v2").toBase58());
  });

  it("carries the exact deployed discriminator and 6 accounts with correct signer/writable flags", () => {
    const built = buildInitializeMarketV2Instruction(validParams());
    expect(built.instruction.data.subarray(0, 8).equals(INITIALIZE_MARKET_V2_DISCRIMINATOR)).toBe(true);
    const keys = built.instruction.keys;
    expect(keys).toHaveLength(6);
    expect(keys[0].isSigner).toBe(true); // admin
    expect(keys[1].isSigner).toBe(true); // payer
    expect(keys[1].isWritable).toBe(true);
    expect(keys[3].pubkey.toBase58()).toBe(built.marketPda.toBase58());
    expect(keys[4].pubkey.toBase58()).toBe(built.vaultPda.toBase58());
  });

  it("fail-closes on wrong kickoff (close_time not in the future)", () => {
    expect(() => buildInitializeMarketV2Instruction(validParams({ closeTime: NOW - 1 }))).toThrow(/close_time/);
  });

  it("fail-closes when claim_deadline is not 0", () => {
    expect(() => buildInitializeMarketV2Instruction(validParams({ claimDeadline: 123 }))).toThrow(/claim_deadline/);
  });

  it("fail-closes on out-of-range price and identical stat keys and zero hashes", () => {
    expect(() => buildInitializeMarketV2Instruction(validParams({ fairPriceMicros: 1_000_000 }))).toThrow(/fair_price/);
    expect(() => buildInitializeMarketV2Instruction(validParams({ awayStatKey: 1 }))).toThrow(/stat_key/);
    expect(() => buildInitializeMarketV2Instruction(validParams({ homeTeamHash: "00".repeat(32) }))).toThrow(/non-zero/);
  });

  it("fail-closes when LIVE settlement_min_timestamp precedes close_time", () => {
    expect(() => buildInitializeMarketV2Instruction(validParams({ settlementMinTimestampMs: 1 }))).toThrow(/settlement_min_timestamp/);
  });
});

describe("anchor discriminators (deployed-schema compatibility)", () => {
  it("match the live on-chain account discriminators", () => {
    expect(accountDiscriminator("MarketV2").toString("hex")).toBe("1b3c324bbfc156e3");
    expect(accountDiscriminator("MarketVault").toString("hex")).toBe("310996847ca289d0");
  });
  it("initialize_market_v2 discriminator matches the deployed IDL", () => {
    expect(Array.from(instructionDiscriminator("initialize_market_v2"))).toEqual([142, 105, 160, 176, 44, 37, 178, 160]);
  });
});
