import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateTxlineCapture } from "../lib/txline/captureFormat";

const path = resolve(process.env.TXLINE_CAPTURE_PATH ?? "fixtures/txline/canonical.json");

async function main() {
  const capture = JSON.parse(await readFile(path, "utf8"));
  const errors = validateTxlineCapture(capture);
  if (errors.length > 0) throw new Error(errors.join("; "));
  console.log(JSON.stringify({
    verified: true,
    capture: path,
    fixtureId: capture.fixtureId,
    seq: capture.normalizedEvent.seq,
    rawPayloadHash: capture.rawPayloadHash,
    normalizedEventHash: capture.normalizedEventHash,
  }, null, 2));
}

main().catch((error) => {
  console.error(`TxLINE capture verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
