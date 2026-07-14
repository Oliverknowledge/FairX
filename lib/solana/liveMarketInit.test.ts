import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import capture from "@/fixtures/polymarket/fifwc-fra-esp-2026-07-14-france-win.capture.json";
import { LIVE_MARKET, MAX_CAPTURE_AGE_MS, captureAgeMs, deriveInitParamsFromCapture, readAuthorityConfigAdmin } from "@/lib/solana/liveMarketInit";
import { buildInitializeMarketV2Instruction } from "@/lib/solana/initializeMarketV2";
import { deriveMarketV2Pda } from "@/lib/solana/lineguardV2";

const ADMIN = new PublicKey("8GEhW9qEJEFPQ6sA34H9fMUk937LPCVvKcVwWbhka4vx");

describe("deriveInitParamsFromCapture", () => {
  const params = deriveInitParamsFromCapture(capture as never, { admin: ADMIN, payer: ADMIN, nowSeconds: LIVE_MARKET.closeTime - 3600 });

  it("pins the reviewed constants (fixture, claim, evidence, close, settlement, stat keys, tolerance)", () => {
    expect(params.label).toBe("fairx-france-spain-v2");
    expect(params.fixtureId).toBe(18237038);
    expect(params.claimDeadline).toBe(0);
    expect(params.evidenceMode).toBe(0); // LIVE
    expect(params.closeTime).toBe(1_784_055_600);
    expect(params.settlementMinTimestampMs).toBe(1_784_055_600_000);
    expect(params.homeStatKey).toBe(1);
    expect(params.awayStatKey).toBe(2);
    expect(params.toleranceMicros).toBe(20_000);
  });

  it("takes displayed = fair price from the verified capture midpoint", () => {
    expect(params.displayedPriceMicros).toBe(capture.derived.midpointMicros);
    expect(params.fairPriceMicros).toBe(capture.derived.midpointMicros);
  });

  it("takes every hash from the capture (non-zero) and builds a valid France–Spain instruction", () => {
    for (const h of [params.oddsPayloadHash, params.pricingModelHash, params.fixtureIdHash, params.materialityConfigHash, params.homeTeamHash, params.awayTeamHash]) {
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    }
    const built = buildInitializeMarketV2Instruction(params);
    expect(built.marketPda.toBase58()).toBe(deriveMarketV2Pda("fairx-france-spain-v2").toBase58());
    expect(built.marketPda.toBase58()).not.toBe(deriveMarketV2Pda("fairx-france-morocco-v2").toBase58());
  });
});

describe("capture freshness + authority admin parsing", () => {
  it("captureAgeMs flags stale captures against the 60s policy", () => {
    const fresh = { ...capture, capturedAt: new Date().toISOString() } as never;
    expect(captureAgeMs(fresh)).toBeLessThan(MAX_CAPTURE_AGE_MS);
    const stale = { ...capture, capturedAt: new Date(Date.now() - 120_000).toISOString() } as never;
    expect(captureAgeMs(stale)).toBeGreaterThan(MAX_CAPTURE_AGE_MS);
  });

  it("readAuthorityConfigAdmin extracts the pubkey at offset 8", () => {
    const data = new Uint8Array(436);
    data.set(ADMIN.toBytes(), 8);
    expect(readAuthorityConfigAdmin(data).toBase58()).toBe(ADMIN.toBase58());
  });
});

describe("initializer is dry-run by default and gates --send behind --confirm-market", () => {
  const src = readFileSync(resolve(process.cwd(), "scripts/fairx-initialize-live-market.ts"), "utf8");

  it("defaults to dry-run when --send is absent", () => {
    expect(src).toMatch(/DRY_RUN\s*=\s*argv\.includes\("--dry-run"\)\s*\|\|\s*!SEND/);
  });

  it("requires --confirm-market <label> before it can send", () => {
    const guardIdx = src.indexOf('confirmMarket !== LIVE_MARKET.label');
    const sendIdx = src.indexOf("sendRawTransaction");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(sendIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(sendIdx); // confirm guard precedes the broadcast
  });

  it("never prints the operator secret key", () => {
    expect(src).not.toMatch(/secretKey/);
    expect(src).toMatch(/never printed|never logged|Never logged|Never printed/i);
  });
});
