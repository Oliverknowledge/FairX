import { PolymarketClient } from "@/lib/polymarket/client";
import { buildReferenceQuote, type BuildQuoteOptions } from "@/lib/polymarket/pricing";
import type { GammaEvent } from "@/lib/polymarket/schemas";
import type {
  FairXExternalMarketMapping,
  PolymarketMarketDescriptor,
  RawOrderBook,
  ReferenceQuote,
} from "@/lib/polymarket/types";

/**
 * Discovery binds an approved mapping to a live Polymarket market — and
 * refuses anything that does not match the mapping exactly. This is the
 * anti-substitution layer: a swapped condition id, a swapped YES/NO token, or
 * a book whose asset/market disagrees with the mapping is a hard error, never
 * a silently-accepted quote.
 */

export class MappingMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MappingMismatchError";
  }
}

/** Select the mapped market from an event and verify its identity end-to-end. */
export function findMappedMarket(event: GammaEvent, mapping: FairXExternalMarketMapping): PolymarketMarketDescriptor {
  if (event.eventId !== mapping.polymarketEventId) {
    throw new MappingMismatchError(`event ${event.eventId} != mapped event ${mapping.polymarketEventId}`);
  }
  const market = event.markets.find((m) => m.conditionId === mapping.polymarketConditionId);
  if (!market) throw new MappingMismatchError(`condition ${mapping.polymarketConditionId} not found in event`);
  if (market.yesTokenId !== mapping.polymarketYesTokenId) {
    throw new MappingMismatchError("YES token id does not match mapping");
  }
  if (market.noTokenId !== mapping.polymarketNoTokenId) {
    throw new MappingMismatchError("NO token id does not match mapping");
  }
  if (market.marketId !== mapping.polymarketMarketId) {
    throw new MappingMismatchError("market id does not match mapping");
  }
  return market;
}

export async function discoverMarketForMapping(
  mapping: FairXExternalMarketMapping,
  client: PolymarketClient = new PolymarketClient()
): Promise<PolymarketMarketDescriptor> {
  const event = await client.getEventById(mapping.polymarketEventId);
  return findMappedMarket(event, mapping);
}

export interface ReferenceQuoteResult {
  descriptor: PolymarketMarketDescriptor;
  book: RawOrderBook;
  quote: ReferenceQuote;
}

/**
 * Full path: discover the mapped market, fetch the YES-token book, verify the
 * book's asset/market identity against the mapping, and compute the quote.
 */
export async function fetchReferenceQuoteForMapping(
  mapping: FairXExternalMarketMapping,
  opts: { client?: PolymarketClient } & BuildQuoteOptions = {}
): Promise<ReferenceQuoteResult> {
  const client = opts.client ?? new PolymarketClient();
  const descriptor = await discoverMarketForMapping(mapping, client);
  const book = await client.getBook(mapping.polymarketYesTokenId);

  if (book.assetId !== mapping.polymarketYesTokenId) {
    throw new MappingMismatchError("order book asset id does not match mapped YES token");
  }
  if (book.market !== mapping.polymarketConditionId) {
    throw new MappingMismatchError("order book condition id does not match mapping");
  }

  const quote = buildReferenceQuote(book, {
    now: opts.now,
    marketClosed: opts.marketClosed ?? descriptor.closed,
    config: opts.config,
  });
  return { descriptor, book, quote };
}
