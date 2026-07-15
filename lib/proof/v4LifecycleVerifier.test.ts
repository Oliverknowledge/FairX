import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { BorshAccountsCoder, BN, type Idl } from "@anchor-lang/core";
import idl from "@/lib/v4/idl.json";
import manifest from "@/fixtures/txline/v4-build-manifest.json";
import { verifyV4Lifecycle, type V4RpcClient } from "@/lib/proof/v4LifecycleVerifier";
import { V4_CANONICAL, V4_LIFECYCLE_STEPS, V4_NOT_RECORDED, type V4RecordedEvidence } from "@/lib/v4/lifecycleEvidence";
import {
  deriveAuthorityConfigV4Pda, deriveLiquidityVaultV4Pda, deriveMarketV4Pda,
  deriveQuoteReceiptV4Pda, deriveResolutionProposalV4Pda, deriveResolutionReceiptV4Pda,
} from "@/lib/v4/program";

const coder = new BorshAccountsCoder(idl as Idl);
const PROGRAM = new PublicKey(V4_CANONICAL.marketIdSeed.length ? manifest.programId : manifest.programId);
const LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const TXLINE = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const ODDS_ROOT = new PublicKey("ACo4UtSFM5jtUeQwkrWuv7uDS9qeNVQv858eRBTKpHxh");
const SCORES_ROOT = new PublicKey("EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr");
const PROGRAM_DATA = new PublicKey("9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V");
const SO_PATH = "target/deploy/fairx_vault_v4.so";
const hasBinary = existsSync(SO_PATH);

const z32 = () => Array(32).fill(0);
const acct = (owner: PublicKey, data: Buffer, executable = false): AccountInfo<Buffer> =>
  ({ owner, data, executable, lamports: 1_000_000, rentEpoch: 0 } as unknown as AccountInfo<Buffer>);

function programAccount(): AccountInfo<Buffer> {
  const data = Buffer.alloc(36);
  data.writeUInt32LE(2, 0); // UpgradeableLoaderState::Program
  PROGRAM_DATA.toBuffer().copy(data, 4);
  return acct(LOADER, data, true);
}
function programDataAccount(): AccountInfo<Buffer> {
  const sbf = hasBinary ? readFileSync(SO_PATH) : Buffer.alloc(manifest.sbfSizeBytes);
  return acct(LOADER, Buffer.concat([Buffer.alloc(45), sbf]));
}

async function encMarket(): Promise<Buffer> {
  return coder.encode("MarketV4", {
    authority_config: PublicKey.default, market_id: z32(), fixture_id: new BN(V4_CANONICAL.fixtureId),
    fixture_hash: z32(), home_team_hash: z32(), away_team_hash: z32(),
    home_participant_id: new BN(1999), away_participant_id: new BN(2530), home_participant_is_home: true,
    regulation_template_hash: z32(), hard_stop_unix_seconds: new BN(0), oracle_grace_seconds: new BN(0),
    latest_material_event_sequence: new BN(739), latest_material_event_ts: new BN(0), latest_material_event_hash: z32(),
    latest_quote_sequence: new BN(2), quote_material_event_sequence: new BN(739), quote_source_ts: new BN(0),
    quote_message_id_hash: z32(), quote_payload_hash: z32(), quote_raw_prices: [0, 0, 0],
    quote_yes_probability_micros: new BN(0), quote_yes_price_micros: new BN(0), quote_no_price_micros: new BN(0),
    quote_verified: true, trading_closed: true, resolved: true, resolution: V4_CANONICAL.resolutionYes,
    resolved_at: new BN(0), final_sequence: new BN(V4_CANONICAL.finalSequence), final_validation_payload_hash: z32(),
    void_reason_code: 0, bump: 255,
  });
}
async function encVault(market: PublicKey, payouts: number): Promise<Buffer> {
  return coder.encode("LiquidityVaultV4", {
    market, operator: PublicKey.default, free_collateral: new BN(0),
    reserved_liability: new BN(0), accepted_stake_principal: new BN(0), pending_refundable_stake: new BN(0),
    yes_reserved_liability: new BN(0), no_reserved_liability: new BN(0),
    lifetime_operator_deposits: new BN(V4_CANONICAL.operatorDepositLamports), lifetime_operator_withdrawals: new BN(199_799_428),
    lifetime_user_stakes: new BN(40_000_000), lifetime_refunds: new BN(V4_CANONICAL.stakeLamports),
    lifetime_payouts: new BN(payouts), lifetime_losing_stakes: new BN(V4_CANONICAL.stakeLamports),
    position_count: new BN(0), next_order_nonce: new BN(4), accounting_sequence: new BN(9),
    min_stake_lamports: new BN(V4_CANONICAL.minStakeLamports), max_stake_lamports: new BN(V4_CANONICAL.maxStakeLamports), bump: 255,
  });
}
async function encResolutionReceipt(): Promise<Buffer> {
  return coder.encode("TxlineResolutionReceiptV4", {
    market: PublicKey.default, final_sequence: new BN(V4_CANONICAL.finalSequence), validation_root_pda: SCORES_ROOT,
    validation_payload_hash: z32(), event_stat_root: z32(), home_regulation_score: V4_CANONICAL.homeScore,
    away_regulation_score: V4_CANONICAL.awayScore, derived_outcome: V4_CANONICAL.resolutionYes, proof_timestamp: new BN(0),
    direct_cpi_verified: true, bump: 255,
  });
}
async function encProposal(): Promise<Buffer> {
  return coder.encode("ResolutionProposalV4", {
    market: PublicKey.default, validation_receipt: PublicKey.default, validation_payload_hash: z32(),
    derived_outcome: V4_CANONICAL.resolutionYes, void_reason_code: 0, approvals_mask: 3, executed: true, bump: 255,
  });
}
async function encQuote(hash: number[]): Promise<Buffer> {
  return coder.encode("TxlineQuoteValidationReceiptV4", {
    market: PublicKey.default, quote_sequence: new BN(1), validation_root_pda: ODDS_ROOT, payload_hash: hash,
    message_id_hash: z32(), source_ts: new BN(0), raw_prices: [0, 0, 0], yes_price_micros: new BN(0),
    no_price_micros: new BN(0), direct_cpi_verified: true, currently_executable: false, bump: 255,
  });
}

const WALLET_ROLES = ["operator", "traderPreYes", "traderPreNo", "traderStaleBot", "traderPostYes", "feed", "pricing", "resA", "resB", "resC"] as const;
const explorerTx = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
// Deterministic, valid-base58, 87-char, non-degenerate signatures (never a placeholder pattern).
const fakeSig = (i: number) => Array.from({ length: 87 }, (_, k) => B58[(k * 7 + i * 13 + 5) % B58.length]).join("");

async function buildWorld() {
  const market = deriveMarketV4Pda(createHash("sha256").update(V4_CANONICAL.marketIdSeed).digest());
  const accounts = {
    authorityConfig: deriveAuthorityConfigV4Pda().toBase58(),
    market: market.toBase58(),
    vault: deriveLiquidityVaultV4Pda(market).toBase58(),
    quoteReceiptPre: deriveQuoteReceiptV4Pda(market, BigInt(V4_CANONICAL.preGoal.quoteSequence)).toBase58(),
    quoteReceiptPost: deriveQuoteReceiptV4Pda(market, BigInt(V4_CANONICAL.postGoal.quoteSequence)).toBase58(),
    resolutionReceipt: deriveResolutionReceiptV4Pda(market).toBase58(),
    resolutionProposal: deriveResolutionProposalV4Pda(market).toBase58(),
  };
  const wallets = Object.fromEntries(WALLET_ROLES.map((r, i) => [r, PublicKey.unique().toBase58()])) as Record<(typeof WALLET_ROLES)[number], string>;
  const preHash = [...createHash("sha256").update("pre").digest()];
  const postHash = [...createHash("sha256").update("post").digest()];
  const closedPos = PublicKey.unique().toBase58();
  const lifetimePayouts = 18_769_297 + 11_431_275;

  // account map
  const map = new Map<string, AccountInfo<Buffer> | null>();
  map.set(PROGRAM.toBase58(), programAccount());
  map.set(PROGRAM_DATA.toBase58(), programDataAccount());
  map.set(accounts.market, acct(PROGRAM, await encMarket()));
  map.set(accounts.vault, acct(PROGRAM, await encVault(market, lifetimePayouts)));
  map.set(accounts.resolutionReceipt, acct(PROGRAM, await encResolutionReceipt()));
  map.set(accounts.resolutionProposal, acct(PROGRAM, await encProposal()));
  map.set(accounts.quoteReceiptPre, acct(PROGRAM, await encQuote(preHash)));
  map.set(accounts.quoteReceiptPost, acct(PROGRAM, await encQuote(postHash)));
  map.set(TXLINE.toBase58(), acct(LOADER, Buffer.alloc(0), true));
  map.set(ODDS_ROOT.toBase58(), acct(TXLINE, Buffer.alloc(16)));
  map.set(SCORES_ROOT.toBase58(), acct(TXLINE, Buffer.alloc(16)));
  map.set(closedPos, null); // closed account

  const keyList = [PROGRAM.toBase58(), ...WALLET_ROLES.map((r) => wallets[r]), accounts.market, accounts.vault];
  const walletIndex = (role: string) => keyList.indexOf(wallets[role as keyof typeof wallets]);

  // per-step balance deltas: only the checked steps move a wallet.
  const stepDelta: Record<string, [string, number]> = {
    refundStaleBot: ["traderStaleBot", -7000],
    claimHonestYes: ["traderPreYes", 18_764_297],
  };
  const txMap = new Map<string, unknown>();
  const transactions = V4_LIFECYCLE_STEPS.map((label, i) => {
    const sig = fakeSig(i + 1);
    const instr = { initializeMarket: "initialize_market_v4", initializeVault: "initialize_liquidity_vault", depositLiquidity: "deposit_liquidity", commitPreQuote: "commit_txline_quote", verifyPreQuote: "verify_txline_quote", acceptHonestYes: "place_fixed_payout_order", acceptHonestNo: "place_fixed_payout_order", ingestGoal: "ingest_material_event_v4", refundStaleBot: "place_fixed_payout_order", commitPostQuote: "commit_txline_quote", verifyPostQuote: "verify_txline_quote", closeStaleRefund: "close_fixed_payout_position", acceptSynchronizedYes: "place_fixed_payout_order", proveResolution: "prove_resolution_with_txline_v4", approveResolution: "approve_resolution_v4", executeResolution: "execute_resolution_v4", reconcileLosingNo: "reconcile_position", claimHonestYes: "claim_fixed_payout", claimSynchronizedYes: "claim_fixed_payout", reconcileVault: "reconcile_vault_surplus", closeHonestYes: "close_fixed_payout_position", closeLosingNo: "close_fixed_payout_position", closeSynchronizedYes: "close_fixed_payout_position", withdrawFreeLiquidity: "withdraw_free_liquidity" }[label]!;
    const disc = Buffer.from((manifest.instructionDiscriminatorsHex as Record<string, string>)[instr], "hex");
    const pre = new Array(keyList.length).fill(1_000_000_000);
    const post = [...pre];
    const d = stepDelta[label];
    if (d) post[walletIndex(d[0])] = pre[walletIndex(d[0])] + d[1];
    txMap.set(sig, {
      slot: 476_000_000 + i,
      meta: { err: null, preBalances: pre, postBalances: post },
      transaction: { signatures: [sig], message: { staticAccountKeys: keyList.map((k) => new PublicKey(k)), compiledInstructions: [{ programIdIndex: 0, accountKeyIndexes: [], data: new Uint8Array(disc) }] } },
    });
    return { label, instruction: instr, discriminatorHex: disc.toString("hex"), signature: sig, slot: 476_000_000 + i, blockTime: 1_783_600_000 + i, explorerUrl: explorerTx(sig), finalized: true };
  });

  const record: V4RecordedEvidence = {
    version: 1, state: "recorded", recordedAt: new Date().toISOString(), cluster: "devnet", rpcUrl: "https://api.devnet.solana.com",
    program: { programId: manifest.programId, programDataAddress: PROGRAM_DATA.toBase58(), deploymentSlot: 476_000_000, sbfSha256: manifest.sbfSha256 },
    txline: { programId: TXLINE.toBase58(), oddsRootPda: ODDS_ROOT.toBase58(), scoresRootPda: SCORES_ROOT.toBase58(), fixtureId: V4_CANONICAL.fixtureId, goalSequence: 739, finalSequence: 1114, homeScore: 2, awayScore: 0, preQuotePayloadHashHex: Buffer.from(preHash).toString("hex"), postQuotePayloadHashHex: Buffer.from(postHash).toString("hex"), resolutionPayloadHashHex: "ab".repeat(32) },
    accounts,
    authorities: { operator: wallets.operator, feed: wallets.feed, pricing: wallets.pricing, resolution: [wallets.resA, wallets.resB, wallets.resC], threshold: 2, approvalsMask: 3 },
    marketState: { resolved: true, resolution: 1, tradingClosed: true, finalSequence: 1114 },
    positions: [
      { id: "pre-yes", pda: PublicKey.unique().toBase58(), owner: wallets.traderPreYes, side: "YES", stakeLamports: 10_000_000, executionPriceMicros: 532_785, grossPayoutLamports: 18_769_297, quoteSequence: 1, materialEventSequence: 738, status: "CLAIMED", claimedLamports: 18_769_297 },
      { id: "pre-no", pda: PublicKey.unique().toBase58(), owner: wallets.traderPreNo, side: "NO", stakeLamports: 10_000_000, executionPriceMicros: 487_215, grossPayoutLamports: 20_524_900, quoteSequence: 1, materialEventSequence: 738, status: "LOST", claimedLamports: 0 },
      { id: "stale-bot", pda: closedPos, owner: wallets.traderStaleBot, side: "YES", stakeLamports: 10_000_000, executionPriceMicros: 532_785, grossPayoutLamports: 0, quoteSequence: 1, materialEventSequence: 738, status: "REFUNDED", claimedLamports: 0 },
      { id: "post-yes", pda: PublicKey.unique().toBase58(), owner: wallets.traderPostYes, side: "YES", stakeLamports: 10_000_000, executionPriceMicros: 874_793, grossPayoutLamports: 11_431_275, quoteSequence: 2, materialEventSequence: 739, status: "CLAIMED", claimedLamports: 11_431_275 },
    ],
    staleOrder: { positionId: "stale-bot", verdict: "REFUNDED", refundedStakeLamports: 10_000_000, walletNetLamports: -7000 },
    vault: { finalFreeCollateral: 0, finalReservedLiability: 0, finalAcceptedStakePrincipal: 0, finalPendingRefundableStake: 0, lifetimeOperatorDeposits: 200_000_000, lifetimeUserStakes: 40_000_000, lifetimeRefunds: 10_000_000, lifetimePayouts, lifetimeLosingStakes: 10_000_000, lifetimeOperatorWithdrawals: 199_799_428 },
    solvencySnapshots: [{ label: "final", freeCollateral: 0, reservedLiability: 0, acceptedStakePrincipal: 0, pendingRefundableStake: 0 }],
    wallets: WALLET_ROLES.map((role) => {
      let net = 0;
      for (const [, [r, dlt]] of Object.entries(stepDelta)) if (r === role) net += dlt;
      return { role, address: wallets[role], balanceBeforeLamports: 1_000_000_000, balanceAfterLamports: 1_000_000_000 + net, netAfterFundingLamports: net };
    }),
    transactions,
    closures: { [closedPos]: true },
  };

  const client: V4RpcClient = {
    getSlot: async () => 476_000_100,
    getMultipleAccountsInfo: async (keys) => keys.map((k) => map.get(k.toBase58()) ?? null),
    getTransaction: async (sig) => (txMap.get(sig) ?? null) as never,
  };
  return { record, client };
}

describe("verifyV4Lifecycle", () => {
  it("returns UNKNOWN and recordState not_recorded for the undeployed fixture", async () => {
    const result = await verifyV4Lifecycle(V4_NOT_RECORDED);
    expect(result.status).toBe("UNKNOWN");
    expect(result.recordState).toBe("not_recorded");
    expect(result.summary.failed).toBe(0);
  });

  it("returns UNKNOWN for a malformed / non-object record", async () => {
    expect((await verifyV4Lifecycle(null)).status).toBe("UNKNOWN");
    expect((await verifyV4Lifecycle({ version: 99, state: "recorded" })).recordState).toBe("invalid");
  });

  it("does not conflate a V3 record with V4 evidence", async () => {
    const v3Shaped = { version: 3, truth: { classification: "REAL" }, program: { programId: "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe" }, transactions: {} };
    const result = await verifyV4Lifecycle(v3Shaped);
    expect(result.status).toBe("UNKNOWN");
    expect(result.recordState).not.toBe("recorded");
  });

  it("returns UNKNOWN when RPC is unavailable, never success", async () => {
    const { record } = await buildWorld();
    const client: V4RpcClient = {
      getSlot: async () => { throw new Error("429 Too Many Requests"); },
      getMultipleAccountsInfo: async () => { throw new Error("429"); },
      getTransaction: async () => { throw new Error("429"); },
    };
    const result = await verifyV4Lifecycle(record, { client });
    expect(result.status).toBe("UNKNOWN");
    expect(result.summary.failed).toBe(0);
  });

  it("rejects a placeholder signature as FAILED", async () => {
    const { record, client } = await buildWorld();
    record.transactions[5].signature = "1111111111111111111111111111111111111111111111111111111111111111";
    const result = await verifyV4Lifecycle(record, { client });
    expect(result.status).toBe("FAILED");
    expect(result.checks.find((c) => c.id === "no-placeholder-signatures")?.status).toBe("FAILED");
  });

  it("returns FAILED on a transaction slot mismatch", async () => {
    const { record, client } = await buildWorld();
    record.transactions[0].slot = 1; // record says slot 1, chain says 476_000_000
    const result = await verifyV4Lifecycle(record, { client });
    expect(result.status).toBe("FAILED");
    expect(result.checks.find((c) => c.id === "transactions")?.status).toBe("FAILED");
  });

  it("returns FAILED when the resolution outcome is tampered", async () => {
    const { record, client } = await buildWorld();
    record.marketState.resolution = 2;
    // economic-record still ok; the on-chain market decode still says YES, but flip the recorded final to force a discriminator/econ mismatch path
    record.vault.lifetimeRefunds = 999; // breaks vault-invariant vs on-chain
    const result = await verifyV4Lifecycle(record, { client });
    expect(result.status).toBe("FAILED");
  });

  it.skipIf(!hasBinary)("returns VERIFIED for a correct mocked lifecycle", async () => {
    const { record, client } = await buildWorld();
    const result = await verifyV4Lifecycle(record, { client });
    if (result.status !== "VERIFIED") {
      // Surface the first failing check to make any offset/field drift obvious.
      const failing = result.checks.filter((c) => c.status !== "VERIFIED").map((c) => `${c.id}:${c.status}:${c.detail}`);
      throw new Error(`expected VERIFIED, got ${result.status}. Non-verified: ${failing.join(" | ")}`);
    }
    expect(result.status).toBe("VERIFIED");
    expect(result.recordState).toBe("recorded");
    expect(result.summary.failed).toBe(0);
    expect(result.summary.unknown).toBe(0);
  });
});
