import type { V4EvidenceIdentity, PublicV4LifecycleVerification, V4VerificationResponse } from "@/lib/proof/verificationApi";

export const V4_EVIDENCE_IDENTITY: V4EvidenceIdentity = {
  cluster: "devnet",
  programId: "2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p",
  fixtureVersion: "v4-lifecycle-1-fixture-18209181",
  evidenceHash: "3ce468b71a25c8197e6eefad93aec2480da8d83569d11b72a9c51995cb795583",
  deploymentSlot: 476416258,
  deployedProgramHash: "7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0",
  cacheKey: "devnet:2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p:v4-lifecycle-1-fixture-18209181:3ce468b71a25c8197e6eefad93aec2480da8d83569d11b72a9c51995cb795583:476416258:7917273c9c1dca1fb9f69f2b0f905b698fe69383913ca462d51f8888bffc71f0",
};

/**
 * Durable build snapshot produced only after a complete 20/20 RPC verifier run.
 * It is presentation/cache metadata, not canonical lifecycle evidence.
 */
export const V4_LAST_VERIFIED_SNAPSHOT: PublicV4LifecycleVerification = {
  status: "VERIFIED",
  recordState: "recorded",
  checkedAt: "2026-07-16T15:34:52.122Z",
  summary: { verified: 20, failed: 0, unknown: 0 },
  checks: [
    { id: "no-placeholder-signatures", label: "No placeholder signatures", status: "VERIFIED", detail: "Every recorded signature is a plausible, unique base58 ed25519 signature." },
    { id: "cluster", label: "Devnet cluster", status: "VERIFIED", detail: "Recorded cluster is devnet." },
    { id: "program-id", label: "Canonical V4 program id", status: "VERIFIED", detail: "Record targets the approved V4 program 2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p." },
    { id: "pda-derivations", label: "PDA derivations", status: "VERIFIED", detail: "Market, vault, quote receipts, resolution receipt and proposal all match their program-derived addresses." },
    { id: "transaction-manifest", label: "Lifecycle transaction manifest", status: "VERIFIED", detail: "All 24 required steps present, uniquely signed, finalized, with manifest-matching discriminators." },
    { id: "economic-record", label: "Recorded economics self-consistent", status: "VERIFIED", detail: "Stale order refunded (payout 0), NO position lost, both YES positions settled, and the vault reconciles reserves and principal to zero." },
    { id: "program", label: "Executable V4 program", status: "VERIFIED", detail: "The program is executable, loader-owned, and points at the recorded ProgramData account.", evidence: "https://explorer.solana.com/address/2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p?cluster=devnet" },
    { id: "program-data", label: "Deployed binary identity", status: "VERIFIED", detail: "The deployed ProgramData bytes hash to the reproducible SBF SHA-256 in the build manifest.", evidence: "https://explorer.solana.com/address/9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V?cluster=devnet" },
    { id: "ownership", label: "Program account ownership", status: "VERIFIED", detail: "Market, vault, both quote receipts, resolution receipt and proposal are all owned by the V4 program." },
    { id: "txline-identity", label: "Genuine TxLINE program and roots", status: "VERIFIED", detail: "The fixed TxLINE program is executable and owns both the recorded odds and scores roots.", evidence: "https://explorer.solana.com/address/EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr?cluster=devnet" },
    { id: "market-state", label: "Resolved market state", status: "VERIFIED", detail: "Market decoded from RPC is resolved YES, trading-closed, at the final sequence 1114." },
    { id: "vault-invariant", label: "Vault accounting invariant", status: "VERIFIED", detail: "Live vault: free, reserved, principal and pending are 0; lifetime refund, payout and operator-withdrawal totals match the record.", evidence: "https://explorer.solana.com/address/HNBpMxmqsGYURbHGLezgzh52LKod1uQx17ww4ykf7DfN?cluster=devnet" },
    { id: "resolution", label: "Threshold resolution evidence", status: "VERIFIED", detail: "Resolution receipt binds France 2–0 via a verified direct CPI; the proposal is executed with ≥2 distinct approvals.", evidence: "https://explorer.solana.com/address/D1fCKyxRq8UkiYsCVcXi66HYkTqFe1qe1spV4z1zrNm5?cluster=devnet" },
    { id: "receipt-hashes", label: "Quote receipt hashes", status: "VERIFIED", detail: "On-chain quote-receipt payload hashes equal the recorded pre-goal and post-goal quote hashes." },
    { id: "transactions", label: "Finalized lifecycle transactions", status: "VERIFIED", detail: "Fetched 24 finalized successful transactions; checked signatures, slots, explorer links, program key and on-chain instruction discriminators." },
    { id: "stale-refund", label: "Stale-sequence principal returned", status: "VERIFIED", detail: "The stale order's transaction returns the full stake; the wallet loses only position rent and the transaction fee." },
    { id: "winner-payout", label: "Winner payout settled", status: "VERIFIED", detail: "The winning YES position receives its fixed gross payout (net of the claim transaction fee)." },
    { id: "no-double-claim", label: "No double claim", status: "VERIFIED", detail: "The winning position is claimed exactly once; claimed lamports equal its frozen gross payout." },
    { id: "balance-deltas", label: "Wallet balance changes", status: "VERIFIED", detail: "Every recorded wallet's net lamport change is recomputed from transaction metadata and matches." },
    { id: "closures", label: "Rent recovery / account closures", status: "VERIFIED", detail: "Every account the record marks closed is absent on-chain; its rent returned to the owner." },
  ],
};

export function initialV4VerificationResponse(privateConfigured: boolean, now = Date.now()): V4VerificationResponse {
  const ageSeconds = Math.max(0, Math.floor((now - Date.parse(V4_LAST_VERIFIED_SNAPSHOT.checkedAt)) / 1_000));
  return {
    verification: V4_LAST_VERIFIED_SNAPSHOT,
    latestAttempt: null,
    evidence: V4_EVIDENCE_IDENTITY,
    cache: { source: "snapshot", cached: true, stale: ageSeconds > 600, ageSeconds, ttlSeconds: 600, verifiedAt: V4_LAST_VERIFIED_SNAPSHOT.checkedAt },
    rpc: { privateConfigured },
  };
}
