import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the network-touching discovery layer so the service is tested in isolation.
vi.mock("@/lib/polymarket/discovery", () => ({ fetchReferenceQuoteForMapping: vi.fn() }));

import { fetchReferenceQuoteForMapping } from "@/lib/polymarket/discovery";
import { FRANCE_SPAIN_MAPPING } from "@/lib/polymarket/mapping";
import { getReferenceQuoteView, resetReferenceServiceCaches } from "@/lib/polymarket/service";
import type { PolymarketMarketDescriptor, RawOrderBook, ReferenceQuote } from "@/lib/polymarket/types";

const MID = FRANCE_SPAIN_MAPPING.mappingId;
const mocked = vi.mocked(fetchReferenceQuoteForMapping);

const descriptor: PolymarketMarketDescriptor = {
  eventId: FRANCE_SPAIN_MAPPING.polymarketEventId,
  marketId: FRANCE_SPAIN_MAPPING.polymarketMarketId,
  conditionId: FRANCE_SPAIN_MAPPING.polymarketConditionId,
  slug: FRANCE_SPAIN_MAPPING.polymarketSlug,
  question: FRANCE_SPAIN_MAPPING.polymarketQuestion,
  yesTokenId: FRANCE_SPAIN_MAPPING.polymarketYesTokenId,
  noTokenId: FRANCE_SPAIN_MAPPING.polymarketNoTokenId,
  outcomes: ["Yes", "No"],
  resolutionRules: FRANCE_SPAIN_MAPPING.polymarketResolutionRules,
  active: true,
  closed: false,
  enableOrderBook: true,
};

const quote = (valid: boolean): ReferenceQuote => ({
  method: valid ? "ORDERBOOK_MIDPOINT" : "UNAVAILABLE",
  quoteValid: valid,
  rejectionReasons: valid ? [] : ["SPREAD_TOO_WIDE"],
  midpointMicros: 411_250,
  bestBidMicros: 410_000,
  bestAskMicros: 412_500,
  spreadMicros: 2_500,
  bidDepth: 1_000,
  askDepth: 1_000,
  lastTradeMicros: 410_000,
  quoteTimestamp: Date.now(),
  quoteAgeMs: 100,
  tokenId: FRANCE_SPAIN_MAPPING.polymarketYesTokenId,
  conditionId: FRANCE_SPAIN_MAPPING.polymarketConditionId,
  orderBookHash: "h",
});

const ok = (q: ReferenceQuote) => ({ descriptor, book: {} as RawOrderBook, quote: q });

describe("reference-quote service (freshness labelling)", () => {
  beforeEach(() => {
    resetReferenceServiceCaches();
    mocked.mockReset();
  });

  it("returns null for a non-allowlisted mapping", async () => {
    expect(await getReferenceQuoteView("../secret")).toBeNull();
  });

  it("labels a valid live fetch LIVE", async () => {
    mocked.mockResolvedValue(ok(quote(true)));
    const view = await getReferenceQuoteView(MID, { forceRefresh: true });
    expect(view?.freshness).toBe("LIVE");
    expect(view?.quote?.midpointCents).toBe("41.1¢");
  });

  it("labels a fetched-but-rejected quote UNAVAILABLE (never a fake live price)", async () => {
    mocked.mockResolvedValue(ok(quote(false)));
    const view = await getReferenceQuoteView(MID, { forceRefresh: true });
    expect(view?.freshness).toBe("UNAVAILABLE");
    expect(view?.unavailableReason).toContain("SPREAD_TOO_WIDE");
  });

  it("falls back to the verified bundled capture (HISTORICAL_CAPTURE) when upstream fails", async () => {
    mocked.mockRejectedValue(new Error("upstream down"));
    const view = await getReferenceQuoteView(MID, { forceRefresh: true });
    expect(view?.freshness).toBe("HISTORICAL_CAPTURE");
    expect(view?.quote?.quoteValid).toBe(true);
    expect(view?.capturedAt).toBeTruthy();
  });

  it("serves RECENTLY_CACHED when a prior success is cached and upstream then fails", async () => {
    mocked.mockResolvedValueOnce(ok(quote(true)));
    await getReferenceQuoteView(MID, { forceRefresh: true }); // seed cache
    mocked.mockRejectedValueOnce(new Error("upstream down"));
    const view = await getReferenceQuoteView(MID, { forceRefresh: true });
    expect(view?.freshness).toBe("RECENTLY_CACHED");
  });
});
