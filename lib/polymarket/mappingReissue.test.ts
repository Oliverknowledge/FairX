import { describe, expect, it } from "vitest";
import { FRANCE_SPAIN_MAPPING, finalizeMapping, verifyMapping } from "@/lib/polymarket/mapping";
import { verifyReferenceCapture } from "@/lib/polymarket/verify";
import { buildReferenceQuote } from "@/lib/polymarket/pricing";
import type { RawOrderBook } from "@/lib/polymarket/types";
import capture from "@/fixtures/polymarket/fifwc-fra-esp-2026-07-14-france-win.capture.json";

const OLD_PLACEHOLDER_HASH = "1f164dc5557ba1a9b99ecf42a0ef7421e07783c1ea57ff2281cd5524ddf9a3cd";

describe("France–Spain mapping reissue", () => {
  it("binds the real numeric TxLINE fixture id and drops the placeholder", () => {
    expect(FRANCE_SPAIN_MAPPING.txlineFixtureId).toBe("18237038");
    expect(FRANCE_SPAIN_MAPPING.txlineFixtureId.startsWith("TXLINE-PENDING")).toBe(false);
    expect(verifyMapping(FRANCE_SPAIN_MAPPING)).toEqual([]);
  });

  it("changes the mapping hash after fixture replacement (auditable divergence)", () => {
    expect(FRANCE_SPAIN_MAPPING.mappingHash).not.toBe(OLD_PLACEHOLDER_HASH);
    const withPlaceholder = finalizeMapping({
      ...FRANCE_SPAIN_MAPPING,
      txlineFixtureId: "TXLINE-PENDING-FIFWC-FRA-ESP-2026-07-14",
    });
    expect(withPlaceholder.mappingHash).not.toBe(FRANCE_SPAIN_MAPPING.mappingHash);
  });

  it("keeps team/rule hashes stable (only identity that changed moved the hash)", () => {
    expect(FRANCE_SPAIN_MAPPING.homeTeamHash).toBe("5805a44363043a9d90dab15c178070ba421afc40f6dbe3baabb68a348efb109d");
    expect(FRANCE_SPAIN_MAPPING.awayTeamHash).toBe("9aba88878c228f67879b11a67e39345dbc00d3eedbcf3a52d2e9ff637fa877c9");
  });
});

describe("capture identity + freshness gates", () => {
  it("the retained historical capture still self-verifies against its embedded mapping", () => {
    expect(verifyReferenceCapture(capture as never).valid).toBe(true);
  });

  it("rejects a wrong Polymarket condition id", () => {
    const tampered = { ...capture, mapping: { ...capture.mapping, polymarketConditionId: "0xdeadbeef" } };
    const result = verifyReferenceCapture(tampered as never);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/identity|mapping hash/i);
  });

  it("rejects a substituted YES token id", () => {
    const tampered = { ...capture, market: { ...capture.market, yesTokenId: "999" } };
    const result = verifyReferenceCapture(tampered as never);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/identity/i);
  });

  it("rejects a stale quote (age over the 60s policy)", () => {
    const book: RawOrderBook = {
      market: "0xcond",
      assetId: "yes",
      timestamp: 1_000_000, // ancient
      bids: [{ price: "0.41", size: "5000" }],
      asks: [{ price: "0.42", size: "5000" }],
    };
    const quote = buildReferenceQuote(book, { now: 1_000_000 + 120_000 });
    expect(quote.quoteValid).toBe(false);
    expect(quote.rejectionReasons).toContain("QUOTE_TOO_OLD");
  });
});
