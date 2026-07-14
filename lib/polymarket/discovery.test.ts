import { describe, expect, it } from "vitest";
import { MappingMismatchError, findMappedMarket } from "@/lib/polymarket/discovery";
import { FRANCE_SPAIN_MAPPING } from "@/lib/polymarket/mapping";
import type { GammaEvent } from "@/lib/polymarket/schemas";
import type { PolymarketMarketDescriptor } from "@/lib/polymarket/types";

const descriptor = (o: Partial<PolymarketMarketDescriptor> = {}): PolymarketMarketDescriptor => ({
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
  ...o,
});

const event = (market: PolymarketMarketDescriptor): GammaEvent => ({
  eventId: FRANCE_SPAIN_MAPPING.polymarketEventId,
  slug: FRANCE_SPAIN_MAPPING.polymarketSlug,
  title: "France vs. Spain",
  closed: false,
  active: true,
  markets: [market],
});

describe("mapping-bound discovery (anti-substitution)", () => {
  it("returns the mapped market when identity matches", () => {
    expect(findMappedMarket(event(descriptor()), FRANCE_SPAIN_MAPPING).marketId).toBe(
      FRANCE_SPAIN_MAPPING.polymarketMarketId
    );
  });

  it("rejects a swapped YES token id", () => {
    expect(() => findMappedMarket(event(descriptor({ yesTokenId: "999999999" })), FRANCE_SPAIN_MAPPING)).toThrow(
      MappingMismatchError
    );
  });

  it("rejects a swapped NO token id", () => {
    expect(() => findMappedMarket(event(descriptor({ noTokenId: "999999999" })), FRANCE_SPAIN_MAPPING)).toThrow(
      MappingMismatchError
    );
  });

  it("rejects a market whose condition id is absent", () => {
    expect(() => findMappedMarket(event(descriptor({ conditionId: "0xdead" })), FRANCE_SPAIN_MAPPING)).toThrow(
      MappingMismatchError
    );
  });

  it("rejects an event id that is not the mapped event", () => {
    const wrong = { ...event(descriptor()), eventId: "000000" };
    expect(() => findMappedMarket(wrong, FRANCE_SPAIN_MAPPING)).toThrow(MappingMismatchError);
  });
});
