/**
 * Independently verifies the recorded FairX V4 lifecycle from RPC and prints the verdict.
 * Read-only; never signs or sends. Prints VERIFIED / FAILED / UNKNOWN and every check.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyV4Lifecycle } from "../lib/proof/v4LifecycleVerifier";
import { V4_NOT_RECORDED } from "../lib/v4/lifecycleEvidence";

async function main() {
  let record: unknown;
  try {
    record = JSON.parse(await readFile(resolve(process.cwd(), "fixtures/lineguard/v4-france-morocco-lifecycle.json"), "utf8"));
  } catch {
    record = V4_NOT_RECORDED;
  }
  const result = await verifyV4Lifecycle(record);
  console.log(`\nFairX V4 lifecycle verification: ${result.status} (record: ${result.recordState})`);
  console.log(`RPC ${result.rpcUrl} · ${result.checkedAt}`);
  console.log(`verified ${result.summary.verified} · failed ${result.summary.failed} · unknown ${result.summary.unknown}\n`);
  for (const check of result.checks) console.log(`  ${check.status === "VERIFIED" ? "✓" : check.status === "FAILED" ? "✗" : "?"} ${check.label}: ${check.detail}`);
  if (result.status === "FAILED") process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
