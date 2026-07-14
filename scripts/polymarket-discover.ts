import { PolymarketClient } from "../lib/polymarket/client";
import { discoverMarketForMapping, fetchReferenceQuoteForMapping } from "../lib/polymarket/discovery";
import { listApprovedMappings, verifyMapping } from "../lib/polymarket/mapping";
import { microsToCents } from "../lib/solana/priceMicros";

/**
 * npm run polymarket:discover
 *
 * Read-only: for every APPROVED mapping, verify its hashes, fetch the live
 * Polymarket market + YES-token order book, and print the reference quote.
 * No auth, no writes, no orders. Optional `--search "<q>"` runs a raw
 * public-search to help propose new mappings (proposals still need manual
 * review before they can be added to the registry).
 */

async function main() {
  const client = new PolymarketClient();
  const searchIdx = process.argv.indexOf("--search");
  if (searchIdx >= 0 && process.argv[searchIdx + 1]) {
    const results = await client.publicSearch(process.argv[searchIdx + 1]);
    console.log(JSON.stringify(results, null, 2).slice(0, 4000));
    return;
  }

  for (const mapping of listApprovedMappings()) {
    const mappingErrors = verifyMapping(mapping);
    const out: Record<string, unknown> = {
      mappingId: mapping.mappingId,
      fixture: `${mapping.txlineHomeTeam} vs ${mapping.txlineAwayTeam}`,
      yesMeaning: mapping.fairxYesMeaning,
      conditionId: mapping.polymarketConditionId,
      yesTokenId: mapping.polymarketYesTokenId,
      mappingHash: mapping.mappingHash,
      mappingValid: mappingErrors.length === 0,
      mappingErrors,
    };
    try {
      const descriptor = await discoverMarketForMapping(mapping, client);
      const { quote } = await fetchReferenceQuoteForMapping(mapping, { client });
      out.live = {
        question: descriptor.question,
        active: descriptor.active,
        closed: descriptor.closed,
        method: quote.method,
        quoteValid: quote.quoteValid,
        rejectionReasons: quote.rejectionReasons,
        bestBid: microsToCents(quote.bestBidMicros),
        bestAsk: microsToCents(quote.bestAskMicros),
        midpoint: microsToCents(quote.midpointMicros),
        spreadMicros: quote.spreadMicros,
        bidDepth: quote.bidDepth,
        askDepth: quote.askDepth,
        quoteAgeMs: quote.quoteAgeMs,
        orderBookHash: quote.orderBookHash,
      };
    } catch (err) {
      out.live = { error: err instanceof Error ? err.message : String(err) };
    }
    console.log(JSON.stringify(out, null, 2));
  }
}

main().catch((error) => {
  console.error(`Polymarket discovery failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
