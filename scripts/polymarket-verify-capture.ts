import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyReferenceCapture } from "../lib/polymarket/verify";
import type { PolymarketReferenceCapture } from "../lib/polymarket/types";

/**
 * npm run polymarket:verify-capture -- [mappingId]
 *
 * Offline RECORDED-EVIDENCE verification: recompute every hash and re-derive
 * the quote from the stored raw book. Never re-fetches Polymarket, so it never
 * claims LIVE VERIFIED. Exits non-zero on any tamper.
 */

async function main() {
  const mappingId = process.argv[2] ?? "fifwc-fra-esp-2026-07-14-france-win";
  const path = resolve(process.env.POLYMARKET_CAPTURE_PATH ?? `fixtures/polymarket/${mappingId}.capture.json`);
  const capture = JSON.parse(await readFile(path, "utf8")) as PolymarketReferenceCapture;
  const result = verifyReferenceCapture(capture);
  console.log(
    JSON.stringify(
      {
        verified: result.valid,
        mode: result.mode,
        capture: path,
        statuses: result.statuses,
        recomputed: result.recomputed,
        errors: result.errors,
      },
      null,
      2
    )
  );
  if (!result.valid) process.exit(1);
}

main().catch((error) => {
  console.error(`Polymarket capture verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
