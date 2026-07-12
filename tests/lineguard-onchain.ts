import * as anchor from "@anchor-lang/core";
import { expect } from "chai";
import { Program } from "@anchor-lang/core";
import { createHash } from "node:crypto";
import { Lineguard } from "../target/types/lineguard";

const MICROS_ONE = 1_000_000;
const DISPLAYED_40 = 400_000;
const FAIR_63 = 630_000;
const TOLERANCE_2C = 20_000;
const STAKE_LAMPORTS = 500_000_000;

// Genuine TxLINE France vs Morocco (fixture 18209181, seq 739) validation evidence.
const FIXTURE_ID = 18_209_181;
const SEQUENCE = 739;
const ROOT_EPOCH_DAY = 20_643;
const STAT_KEY_HOME = 1;
const STAT_KEY_AWAY = 2;
const TXLINE_ROOT = new anchor.web3.PublicKey("EUCbk9vftUek4vChr6rnXP9hhR8UuHGBDJKLsAQTZ9Zr");
const VALIDATION_PAYLOAD_HASH = Array.from(Buffer.from("a16b46dbdc5f80a62fa102460b9826386fa130e25db2076303ab4a018bd6f809", "hex"));
const EVENT_STAT_ROOT = [41, 41, 242, 203, 204, 197, 75, 89, 57, 218, 2, 255, 8, 62, 99, 187, 195, 23, 222, 195, 12, 94, 81, 14, 107, 223, 49, 193, 169, 145, 33, 67];

describe("lineguard on-chain settlement guard", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.lineguard as Program<Lineguard>;
  const trader = provider.wallet.publicKey;

  function id32(label: string): Buffer {
    const out = Buffer.alloc(32);
    out.write(label.slice(0, 32), "utf8");
    return out;
  }

  function hash32(value: string): number[] {
    return Array.from(createHash("sha256").update(value).digest());
  }

  function pdaMarket(marketId: Buffer): anchor.web3.PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("market"), marketId], program.programId)[0];
  }
  function pdaOrder(market: anchor.web3.PublicKey, orderId: Buffer): anchor.web3.PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("order"), market.toBuffer(), orderId], program.programId)[0];
  }
  function pdaConfig(market: anchor.web3.PublicKey): anchor.web3.PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("config"), market.toBuffer()], program.programId)[0];
  }
  function pdaReceipt(market: anchor.web3.PublicKey): anchor.web3.PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("txval"), market.toBuffer()], program.programId)[0];
  }
  function pdaVault(): anchor.web3.PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("vault")], program.programId)[0];
  }
  function enumName(value: unknown): string {
    return Object.keys(value as Record<string, unknown>)[0];
  }

  async function initializeMarket(
    label: string,
    opts: {
      materialSeq?: number; pricedAtSeq?: number; displayed?: number; fair?: number;
      tolerance?: number; fixtureId?: number; closeTime?: number; marketType?: number;
      homeStatKey?: number; awayStatKey?: number;
    } = {}
  ) {
    const marketId = id32(label);
    const market = pdaMarket(marketId);
    const marketConfig = pdaConfig(market);
    await program.methods
      .initializeMarketConfig(
        Array.from(marketId),
        new anchor.BN(opts.materialSeq ?? 1),
        new anchor.BN(opts.pricedAtSeq ?? 1),
        new anchor.BN(opts.displayed ?? DISPLAYED_40),
        new anchor.BN(opts.fair ?? DISPLAYED_40),
        new anchor.BN(opts.tolerance ?? TOLERANCE_2C),
        opts.marketType ?? 0,
        hash32(String(opts.fixtureId ?? FIXTURE_ID)),
        Array.from(Buffer.alloc(32, 2)),
        Array.from(Buffer.alloc(32, 3)),
        Array.from(Buffer.alloc(32, 4)),
        new anchor.BN(opts.fixtureId ?? FIXTURE_ID),
        new anchor.BN(opts.closeTime ?? 0),
        0,
        opts.homeStatKey ?? STAT_KEY_HOME,
        opts.awayStatKey ?? STAT_KEY_AWAY,
        hash32("France"),
        hash32("Morocco")
      )
      .accountsPartial({ authority: trader, market, marketConfig })
      .rpc();
    return { marketId, market, marketConfig };
  }

  async function placeOrder(label: string, market: anchor.web3.PublicKey, side: 0 | 1, stake = STAKE_LAMPORTS) {
    const orderId = id32(label);
    const order = pdaOrder(market, orderId);
    await program.methods
      .placeOrder(Array.from(orderId), side, new anchor.BN(stake))
      .accountsPartial({ trader, market, order })
      .rpc();
    return { orderId, order };
  }

  const EVENT_HASH = Array.from(Buffer.alloc(32, 7));

  async function evaluate(market: anchor.web3.PublicKey, marketConfig: anchor.web3.PublicKey, order: anchor.web3.PublicKey) {
    await program.methods.evaluateOrder().accountsPartial({ market, marketConfig, order, trader, vault: pdaVault() }).rpc();
  }
  async function fill(label: string, market: anchor.web3.PublicKey, marketConfig: anchor.web3.PublicKey, side: 0 | 1, stake = STAKE_LAMPORTS) {
    const { order } = await placeOrder(label, market, side, stake);
    await evaluate(market, marketConfig, order);
    return order;
  }
  async function submitValidation(
    market: anchor.web3.PublicKey,
    opts: {
      fixtureId?: number; sequence?: number; home?: number; away?: number;
      root?: anchor.web3.PublicKey; payloadHash?: number[]; eventRoot?: number[]; confirm?: boolean;
    } = {}
  ) {
    const marketConfig = pdaConfig(market);
    await program.methods
      .submitTxlineValidation(
        new anchor.BN(opts.fixtureId ?? FIXTURE_ID),
        new anchor.BN(opts.sequence ?? SEQUENCE),
        ROOT_EPOCH_DAY,
        opts.home ?? 1,
        opts.away ?? 0,
        opts.payloadHash ?? VALIDATION_PAYLOAD_HASH,
        opts.eventRoot ?? EVENT_STAT_ROOT
      )
      .accountsPartial({ authority: trader, market, marketConfig, txlineRoot: opts.root ?? TXLINE_ROOT, receipt: pdaReceipt(market) })
      .rpc();
    if (opts.confirm !== false) await confirmValidation(market);
  }
  async function confirmValidation(market: anchor.web3.PublicKey) {
    await program.methods.confirmValidation().accountsPartial({
      authority: trader,
      market,
      marketConfig: pdaConfig(market),
      receipt: pdaReceipt(market),
    }).rpc();
  }
  async function closeMarket(market: anchor.web3.PublicKey) {
    await program.methods.closeMarket().accountsPartial({ closer: trader, market }).rpc();
  }
  async function resolveFromTxline(market: anchor.web3.PublicKey) {
    await program.methods.resolveMarketFromTxline().accountsPartial({
      authority: trader,
      market,
      marketConfig: pdaConfig(market),
      receipt: pdaReceipt(market),
    }).rpc();
  }
  async function settleOrder(market: anchor.web3.PublicKey, order: anchor.web3.PublicKey) {
    await program.methods.settleOrder().accountsPartial({ market, order, trader, vault: pdaVault() }).rpc();
  }
  async function refundVoided(market: anchor.web3.PublicKey, order: anchor.web3.PublicKey) {
    await program.methods.refundVoidedOrder().accountsPartial({ market, order, trader, vault: pdaVault() }).rpc();
  }

  before(async () => {
    try {
      await program.methods.initializeVault().accountsPartial({ authority: trader, vault: pdaVault() }).rpc();
    } catch {
      // singleton vault may already exist
    }
  });

  it("injects the genuine TxLINE root account into the local validator", async () => {
    const info = await provider.connection.getAccountInfo(TXLINE_ROOT);
    expect(info, "TxLINE root must be injected via Anchor.toml [[test.validator.account]]").to.not.equal(null);
    expect(info!.owner.toBase58()).to.equal("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
  });

  // ---- Protection (LineGuard) ----

  it("refunds a stale YES attack", async () => {
    const { market, marketConfig } = await initializeMarket("yes-refund");
    await program.methods.ingestMaterialEvent(new anchor.BN(2), new anchor.BN(FAIR_63), EVENT_HASH).accountsPartial({ authority: trader, market }).rpc();
    const { order } = await placeOrder("yes-refund-order", market, 0);
    await evaluate(market, marketConfig, order);
    const evaluated = await program.account.orderEscrow.fetch(order);
    expect(evaluated.edgeMicros.toNumber()).to.equal(230_000);
    expect(enumName(evaluated.verdict)).to.equal("voidedRefunded");
    expect(enumName(evaluated.settlementDestination)).to.equal("trader");
  });

  it("fills a stale NO losing-side order into the vault + pool", async () => {
    const { market, marketConfig } = await initializeMarket("no-fill");
    await program.methods.ingestMaterialEvent(new anchor.BN(2), new anchor.BN(FAIR_63), EVENT_HASH).accountsPartial({ authority: trader, market }).rpc();
    const order = await fill("no-fill-order", market, marketConfig, 1);
    const evaluated = await program.account.orderEscrow.fetch(order);
    expect(enumName(evaluated.verdict)).to.equal("staleAllowedNoEdge");
    expect(enumName(evaluated.status)).to.equal("filled");
    const m = await program.account.marketState.fetch(market);
    expect(m.marketTotalIn.toNumber()).to.equal(STAKE_LAMPORTS);
    expect(m.noPoolLamports.toNumber()).to.equal(STAKE_LAMPORTS);
  });

  it("allows an in-sync order", async () => {
    const { market, marketConfig } = await initializeMarket("sync-allow");
    const order = await fill("sync-allow-order", market, marketConfig, 0);
    const evaluated = await program.account.orderEscrow.fetch(order);
    expect(enumName(evaluated.verdict)).to.equal("allowed");
    expect(enumName(evaluated.status)).to.equal("filled");
  });

  // ---- TxLINE-bound resolution ----

  it("does not expose caller-supplied outcome or stat-key arguments", () => {
    const instruction = program.idl.instructions.find((item) => item.name === "submitTxlineValidation");
    expect(instruction?.args.map((arg) => arg.name)).to.deep.equal([
      "fixtureId",
      "sequence",
      "rootEpochDay",
      "homeScore",
      "awayScore",
      "validationPayloadHash",
      "eventStatRoot",
    ]);
  });

  it("submit_txline_validation binds the genuine root and derives the outcome from the score", async () => {
    const { market } = await initializeMarket("bind-outcome", { homeStatKey: 11, awayStatKey: 12 });
    await closeMarket(market);
    await submitValidation(market, { home: 1, away: 0 });
    const receipt = await program.account.txlineValidationReceipt.fetch(pdaReceipt(market));
    expect(receipt.fixtureId.toNumber()).to.equal(FIXTURE_ID);
    expect(receipt.sequence.toNumber()).to.equal(SEQUENCE);
    expect(receipt.validationRootPda.toBase58()).to.equal(TXLINE_ROOT.toBase58());
    expect(receipt.homeStatKey).to.equal(11);
    expect(receipt.awayStatKey).to.equal(12);
    expect(receipt.resolutionRule).to.equal(0);
    expect(receipt.derivedOutcome).to.equal(1); // home > away => YES
    expect(receipt.confirmed).to.equal(true);
  });

  it("resolution is deterministic: identical scores derive an identical outcome", async () => {
    const { market: a } = await initializeMarket("determ-a");
    const { market: b } = await initializeMarket("determ-b");
    await closeMarket(a);
    await closeMarket(b);
    await submitValidation(a, { home: 1, away: 0 });
    await submitValidation(b, { home: 1, away: 0 });
    const ra = await program.account.txlineValidationReceipt.fetch(pdaReceipt(a));
    const rb = await program.account.txlineValidationReceipt.fetch(pdaReceipt(b));
    expect(ra.derivedOutcome).to.equal(rb.derivedOutcome);
  });

  it("an away-team win derives NO without accepting an outcome argument", async () => {
    const { market, marketConfig } = await initializeMarket("away-win");
    const yes = await fill("away-yes", market, marketConfig, 0);
    await fill("away-no", market, marketConfig, 1);
    await closeMarket(market);
    await submitValidation(market, { home: 0, away: 2 }); // away wins => NO
    await resolveFromTxline(market);
    const m = await program.account.marketState.fetch(market);
    expect(m.resolution).to.equal(2); // NO won, though the same operator ran everything
    try {
      await settleOrder(market, yes);
      expect.fail("YES order should not win an away-team result");
    } catch (e) {
      expect(String(e)).to.match(/Order is not on the winning side|OrderDidNotWin/);
    }
  });

  it("rejects a fixture mismatch", async () => {
    const { market } = await initializeMarket("fixture-mismatch");
    await closeMarket(market);
    try {
      await submitValidation(market, { fixtureId: 99_999_999 });
      expect.fail("wrong fixture should be rejected");
    } catch (e) {
      expect(String(e)).to.match(/fixture does not match|FixtureMismatch/);
    }
  });

  it("rejects a root account not owned by the TxLINE program", async () => {
    const { market } = await initializeMarket("wrong-root");
    await closeMarket(market);
    const fake = anchor.web3.Keypair.generate().publicKey; // non-existent => system-owned
    try {
      await submitValidation(market, { root: fake });
      expect.fail("wrong root should be rejected");
    } catch (e) {
      expect(String(e)).to.match(/not the genuine on-chain root|InvalidTxlineRoot/);
    }
  });

  it("rejects validation before trading closes", async () => {
    const { market } = await initializeMarket("validate-before-close");
    try {
      await submitValidation(market);
      expect.fail("validation before close should fail");
    } catch (e) {
      expect(String(e)).to.match(/Trading must be closed|MarketNotClosed/);
    }
  });

  it("rejects unsupported settlement market types", async () => {
    for (const marketType of [1, 2, 3]) {
      try {
        await initializeMarket(`unsupported-${marketType}`, { marketType });
        expect.fail(`market type ${marketType} should be rejected`);
      } catch (e) {
        expect(String(e)).to.match(/MATCH_WINNER_HOME|UnsupportedSettlementMarketType/);
      }
    }
  });

  it("allows a draft replacement, then freezes it at confirmation", async () => {
    const { market } = await initializeMarket("draft-replace");
    await closeMarket(market);
    await submitValidation(market, { home: 1, away: 0, confirm: false });
    await submitValidation(market, { home: 0, away: 2, confirm: false });
    let receipt = await program.account.txlineValidationReceipt.fetch(pdaReceipt(market));
    expect(receipt.derivedOutcome).to.equal(2);
    await confirmValidation(market);
    try {
      await submitValidation(market, { home: 3, away: 0, confirm: false });
      expect.fail("confirmed validation should be immutable");
    } catch (e) {
      expect(String(e)).to.match(/already confirmed|ValidationAlreadyConfirmed/);
    }
    receipt = await program.account.txlineValidationReceipt.fetch(pdaReceipt(market));
    expect(receipt.homeScore).to.equal(0);
    expect(receipt.awayScore).to.equal(2);
  });

  it("rejects zero validation hashes and out-of-bounds scores", async () => {
    const { market } = await initializeMarket("invalid-validation");
    await closeMarket(market);
    try {
      await submitValidation(market, { payloadHash: Array(32).fill(0), confirm: false });
      expect.fail("zero validation hash should fail");
    } catch (e) {
      expect(String(e)).to.match(/must be nonzero|ZeroValidationPayloadHash/);
    }
    try {
      await submitValidation(market, { home: 100, confirm: false });
      expect.fail("score above the bound should fail");
    } catch (e) {
      expect(String(e)).to.match(/between 0 and 99|InvalidScore/);
    }
  });

  it("does not resolve from an unconfirmed validation", async () => {
    const { market, marketConfig } = await initializeMarket("unconfirmed");
    await fill("unconfirmed-yes", market, marketConfig, 0);
    await closeMarket(market);
    await submitValidation(market, { confirm: false });
    try {
      await resolveFromTxline(market);
      expect.fail("unconfirmed validation should not resolve");
    } catch (e) {
      expect(String(e)).to.match(/must be confirmed|ValidationNotConfirmed/);
    }
  });

  it("rejects a new fill after trading closes, and a double resolution", async () => {
    const { market, marketConfig } = await initializeMarket("close-gating");
    await fill("cg-yes", market, marketConfig, 0);
    await fill("cg-no", market, marketConfig, 1);
    await closeMarket(market);
    const { order } = await placeOrder("cg-late", market, 0);
    try {
      await evaluate(market, marketConfig, order);
      expect.fail("fill after close should fail");
    } catch (e) {
      expect(String(e)).to.match(/Trading is closed|TradingClosed/);
    }
    await submitValidation(market);
    await resolveFromTxline(market);
    try {
      await resolveFromTxline(market);
      expect.fail("double resolution should fail");
    } catch (e) {
      expect(String(e)).to.match(/already been resolved|MarketAlreadyResolved/);
    }
  });

  it("voids a draw safely and allows exact refunds", async () => {
    const { market, marketConfig } = await initializeMarket("draw-void");
    const yes = await fill("draw-yes", market, marketConfig, 0, 100_000_000);
    const no = await fill("draw-no", market, marketConfig, 1, 100_000_000);
    await closeMarket(market);
    await submitValidation(market, { home: 2, away: 2 });
    const receipt = await program.account.txlineValidationReceipt.fetch(pdaReceipt(market));
    expect(receipt.derivedOutcome).to.equal(3);
    await resolveFromTxline(market);
    expect((await program.account.marketState.fetch(market)).resolution).to.equal(3);
    await refundVoided(market, yes);
    await refundVoided(market, no);
  });

  it("rejects a receipt PDA from another market", async () => {
    const { market: a, marketConfig: ca } = await initializeMarket("receipt-market-a");
    const { market: b, marketConfig: cb } = await initializeMarket("receipt-market-b");
    await fill("receipt-a-yes", a, ca, 0, 1_000_000);
    await fill("receipt-b-yes", b, cb, 0, 1_000_000);
    await closeMarket(a);
    await closeMarket(b);
    await submitValidation(a);
    await submitValidation(b);
    try {
      await program.methods.resolveMarketFromTxline().accountsPartial({
        authority: trader,
        market: b,
        marketConfig: pdaConfig(b),
        receipt: pdaReceipt(a),
      }).rpc();
      expect.fail("receipt from market A should not resolve market B");
    } catch (e) {
      expect(String(e)).to.match(/does not belong to this market|InvalidMarket|ConstraintSeeds/);
    }
  });

  it("cannot change validation after resolution", async () => {
    const { market, marketConfig } = await initializeMarket("immutable-resolved");
    await fill("immutable-yes", market, marketConfig, 0, 1_000_000);
    await closeMarket(market);
    await submitValidation(market);
    await resolveFromTxline(market);
    try {
      await submitValidation(market, { home: 0, away: 1, confirm: false });
      expect.fail("resolved validation should be immutable");
    } catch (e) {
      expect(String(e)).to.match(/already been resolved|MarketAlreadyResolved/);
    }
  });

  // ---- Parimutuel settlement + accounting ----

  it("resolves from TxLINE and pays the winning side parimutuel", async () => {
    const { market, marketConfig } = await initializeMarket("settle-parimutuel");
    const yesOrder = await fill("sp-yes", market, marketConfig, 0);
    const noOrder = await fill("sp-no", market, marketConfig, 1);
    await closeMarket(market);
    await submitValidation(market, { home: 1, away: 0 });
    await resolveFromTxline(market);

    const resolved = await program.account.marketState.fetch(market);
    expect(resolved.resolution).to.equal(1);
    expect(Buffer.from(resolved.resolutionEventHash).equals(Buffer.from(EVENT_STAT_ROOT))).to.equal(true);
    expect(resolved.tradingClosed).to.equal(true);

    const vaultBefore = await provider.connection.getBalance(pdaVault());
    await settleOrder(market, yesOrder);
    const vaultAfter = await provider.connection.getBalance(pdaVault());
    expect(vaultBefore - vaultAfter).to.equal(2 * STAKE_LAMPORTS);

    const settled = await program.account.orderEscrow.fetch(yesOrder);
    expect(enumName(settled.status)).to.equal("settled");

    const m = await program.account.marketState.fetch(market);
    // Accounting conservation: total_in == both pools; paid + refunded <= total_in.
    expect(m.marketTotalIn.toNumber()).to.equal(m.yesPoolLamports.toNumber() + m.noPoolLamports.toNumber());
    expect(m.marketTotalPaid.toNumber() + m.marketTotalRefunded.toNumber()).to.be.at.most(m.marketTotalIn.toNumber());
    expect(m.marketTotalPaid.toNumber()).to.equal(2 * STAKE_LAMPORTS);

    try {
      await settleOrder(market, noOrder);
      expect.fail("losing order should not settle");
    } catch (e) {
      expect(String(e)).to.match(/Order is not on the winning side|OrderDidNotWin/);
    }
    try {
      await settleOrder(market, yesOrder);
      expect.fail("double settle should fail");
    } catch (e) {
      expect(String(e)).to.match(/Only a filled order can be settled|OrderNotFilled/);
    }
  });

  it("splits a pool across many winners and bounds integer dust", async () => {
    const { market, marketConfig } = await initializeMarket("split-dust");
    // yes_pool = 3_000_000, no_pool = 1_000_000, total = 4_000_000.
    const a = await fill("sd-yes-a", market, marketConfig, 0, 1_000_000);
    const b = await fill("sd-yes-b", market, marketConfig, 0, 2_000_000);
    await fill("sd-no", market, marketConfig, 1, 1_000_000);
    await closeMarket(market);
    await submitValidation(market, { home: 1, away: 0 });
    await resolveFromTxline(market);

    const vaultBefore = await provider.connection.getBalance(pdaVault());
    await settleOrder(market, a);
    await settleOrder(market, b);
    const vaultAfter = await provider.connection.getBalance(pdaVault());
    const paid = vaultBefore - vaultAfter;
    const total = 4_000_000;
    // a: 1_000_000*4/3 -> 1_333_333 ; b: 2_000_000*4/3 -> 2_666_666 ; sum = 3_999_999.
    expect(paid).to.equal(3_999_999);
    const dust = total - paid;
    expect(dust).to.be.greaterThan(0);
    expect(dust).to.be.lessThan(2); // dust < number of winners
    const m = await program.account.marketState.fetch(market);
    expect(m.marketTotalPaid.toNumber()).to.equal(paid);
    expect(m.marketTotalPaid.toNumber()).to.be.at.most(m.marketTotalIn.toNumber());
  });

  it("voids a market whose validated winning side has no filled stake, and refunds every order", async () => {
    const { market, marketConfig } = await initializeMarket("void-no-winner");
    // Only NO fills; validated outcome is YES (home 1 - 0 away) => yes_pool == 0 => void.
    const noA = await fill("void-no-a", market, marketConfig, 1, 200_000_000);
    const noB = await fill("void-no-b", market, marketConfig, 1, 300_000_000);
    await closeMarket(market);
    await submitValidation(market, { home: 1, away: 0 });
    await resolveFromTxline(market);

    const m = await program.account.marketState.fetch(market);
    expect(m.resolution).to.equal(3); // VoidedNoWinningPool

    // Settlement is not allowed on a voided market.
    try {
      await settleOrder(market, noA);
      expect.fail("voided market cannot settle");
    } catch (e) {
      expect(String(e)).to.match(/voided; use refund|MarketVoided/);
    }

    const vaultBefore = await provider.connection.getBalance(pdaVault());
    await refundVoided(market, noA);
    await refundVoided(market, noB);
    const vaultAfter = await provider.connection.getBalance(pdaVault());
    expect(vaultBefore - vaultAfter).to.equal(500_000_000); // exact original stakes returned

    const refunded = await program.account.marketState.fetch(market);
    expect(refunded.marketTotalRefunded.toNumber()).to.equal(500_000_000);
    expect(refunded.marketTotalRefunded.toNumber()).to.be.at.most(refunded.marketTotalIn.toNumber());
    expect(enumName((await program.account.orderEscrow.fetch(noA)).status)).to.equal("settled");

    try {
      await refundVoided(market, noA);
      expect.fail("double refund should fail");
    } catch (e) {
      expect(String(e)).to.match(/Only a filled order can be settled|OrderNotFilled/);
    }
  });

  it("emergency void refunds without picking a winner", async () => {
    const { market, marketConfig } = await initializeMarket("emergency-void");
    const yes = await fill("ev-yes", market, marketConfig, 0, 100_000_000);
    await program.methods.emergencyVoidMarket().accountsPartial({ authority: trader, market }).rpc();
    const m = await program.account.marketState.fetch(market);
    expect(m.resolution).to.equal(3);
    const vaultBefore = await provider.connection.getBalance(pdaVault());
    await refundVoided(market, yes);
    const vaultAfter = await provider.connection.getBalance(pdaVault());
    expect(vaultBefore - vaultAfter).to.equal(100_000_000);
  });

  it("one market's settlement cannot exceed its own accounted pool (cross-market isolation)", async () => {
    const { market: a, marketConfig: ca } = await initializeMarket("iso-a");
    const yesA = await fill("iso-a-yes", a, ca, 0, 100_000_000);
    await fill("iso-a-no", a, ca, 1, 100_000_000);
    const { market: b, marketConfig: cb } = await initializeMarket("iso-b");
    await fill("iso-b-yes", b, cb, 0, 400_000_000);
    await fill("iso-b-no", b, cb, 1, 400_000_000);

    await closeMarket(a);
    await submitValidation(a, { home: 1, away: 0 });
    await resolveFromTxline(a);
    await settleOrder(a, yesA);

    const ma = await program.account.marketState.fetch(a);
    // Market A paid exactly its own pool; it can never draw on B's funds.
    expect(ma.marketTotalPaid.toNumber()).to.equal(ma.marketTotalIn.toNumber());
    const mb = await program.account.marketState.fetch(b);
    const vault = await provider.connection.getBalance(pdaVault());
    // B's stakes are untouched and remain fully backed inside the shared vault.
    expect(mb.marketTotalPaid.toNumber()).to.equal(0);
    expect(vault).to.be.at.least(mb.marketTotalIn.toNumber());
  });
});
