import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PolymarketClient } from "../lib/polymarket/client";
import { buildReferenceCapture, serializeReferenceCapture } from "../lib/polymarket/capture";
import { fetchReferenceQuoteForMapping } from "../lib/polymarket/discovery";
import { getApprovedMapping } from "../lib/polymarket/mapping";
import { verifyReferenceCapture } from "../lib/polymarket/verify";
import { microsToCents } from "../lib/solana/priceMicros";

/**
 * npm run polymarket:capture -- <mappingId>
 *
 * Fetch the live YES-token order book for an APPROVED mapping, build a durable
 * reference capture (canonical JSON + deterministic hashes), verify it end-to-
 * end, and write it atomically to fixtures/polymarket/<mappingId>.capture.json.
 * Read-only against Polymarket; no orders, no auth, no secrets in the output.
 */

async function main() {
  const mappingId = process.argv[2] ?? "fifwc-fra-esp-2026-07-14-france-win";
  const mapping = getApprovedMapping(mappingId);
  if (!mapping) throw new Error(`mapping ${mappingId} is not in the approved registry`);

  const client = new PolymarketClient();
  const { descriptor, book, quote } = await fetchReferenceQuoteForMapping(mapping, { client });

  const capture = buildReferenceCapture({
    mapping,
    descriptor,
    book,
    quote,
    mode: "HISTORICAL_CAPTURE",
  });

  const verification = verifyReferenceCapture(capture);
  if (!verification.valid) throw new Error(`capture failed self-verification: ${verification.errors.join("; ")}`);

  const output = resolve(process.env.POLYMARKET_CAPTURE_PATH ?? `fixtures/polymarket/${mappingId}.capture.json`);
  await mkdir(dirname(output), { recursive: true });
  const tmp = `${output}.tmp`;
  await writeFile(tmp, serializeReferenceCapture(capture), "utf8");
  await rename(tmp, output);

  console.log(
    JSON.stringify(
      {
        captured: output,
        mappingId,
        question: descriptor.question,
        method: quote.method,
        quoteValid: quote.quoteValid,
        rejectionReasons: quote.rejectionReasons,
        bestBid: microsToCents(quote.bestBidMicros),
        bestAsk: microsToCents(quote.bestAskMicros),
        midpoint: microsToCents(quote.midpointMicros),
        midpointMicros: quote.midpointMicros,
        orderBookHash: quote.orderBookHash,
        rawPayloadHash: capture.rawPayloadHash,
        normalizedQuoteHash: capture.normalizedQuoteHash,
        mappingHash: capture.mappingHash,
        pricingPolicyHash: capture.pricingPolicyHash,
        statuses: verification.statuses,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`Polymarket capture failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
