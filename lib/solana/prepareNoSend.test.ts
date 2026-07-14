import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Safety invariant: the deployment-PREPARATION code path must never contain a
 * method that could sign, send, simulate, or fund a Solana transaction. This is
 * a source-level guard so a future edit that introduces one fails CI.
 */

const PREPARATION_SOURCES = [
  "scripts/fairx-prepare-live-market.ts",
  "lib/solana/initializeMarketV2.ts",
  "lib/solana/liveMarketInit.ts",
  "lib/solana/schemaVerify.ts",
  "lib/markets/useActiveTradeMarket.ts",
  "lib/markets/supportedMarkets.ts",
];

const FORBIDDEN = [
  /sendTransaction/,
  /sendRawTransaction/,
  /sendAndConfirmTransaction/,
  /simulateTransaction/,
  /requestAirdrop/,
  /partialSign/,
  /\.sign\s*\(/,
  /signTransaction/,
];

describe("preparation scripts never send, sign, or simulate", () => {
  for (const rel of PREPARATION_SOURCES) {
    it(`${rel} contains no transaction mutation methods`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(src), `${rel} must not match ${pattern}`).toBe(false);
      }
    });
  }
});
