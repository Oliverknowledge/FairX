import * as anchor from "@anchor-lang/core";
import { expect } from "chai";
import { Program } from "@anchor-lang/core";
import { Lineguard } from "../target/types/lineguard";

const MICROS_ONE = 1_000_000;
const DISPLAYED_40 = 400_000;
const FAIR_63 = 630_000;
const TOLERANCE_2C = 20_000;
const STAKE_LAMPORTS = 500_000_000;

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

  function pdaMarket(marketId: Buffer): anchor.web3.PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketId],
      program.programId
    )[0];
  }

  function pdaOrder(market: anchor.web3.PublicKey, orderId: Buffer): anchor.web3.PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("order"), market.toBuffer(), orderId],
      program.programId
    )[0];
  }

  function pdaConfig(market: anchor.web3.PublicKey): anchor.web3.PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config"), market.toBuffer()],
      program.programId
    )[0];
  }

  function enumName(value: unknown): string {
    return Object.keys(value as Record<string, unknown>)[0];
  }

  async function initializeMarket(
    label: string,
    opts: {
      materialSeq?: number;
      pricedAtSeq?: number;
      displayed?: number;
      fair?: number;
      tolerance?: number;
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
        0,
        Array.from(Buffer.alloc(32, 1)),
        Array.from(Buffer.alloc(32, 2)),
        Array.from(Buffer.alloc(32, 3)),
        Array.from(Buffer.alloc(32, 4))
      )
      .accountsPartial({ authority: trader, market, marketConfig })
      .rpc();

    return { marketId, market, marketConfig };
  }

  async function placeOrder(label: string, market: anchor.web3.PublicKey, side: 0 | 1) {
    const orderId = id32(label);
    const order = pdaOrder(market, orderId);
    await program.methods
      .placeOrder(Array.from(orderId), side, new anchor.BN(STAKE_LAMPORTS))
      .accountsPartial({ trader, market, order })
      .rpc();
    return { orderId, order };
  }

  const EVENT_HASH = Array.from(Buffer.alloc(32, 7));

  function pdaVault(): anchor.web3.PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("vault")], program.programId)[0];
  }

  before(async () => {
    try {
      await program.methods.initializeVault().accountsPartial({ authority: trader, vault: pdaVault() }).rpc();
    } catch {
      // The singleton vault may already exist on a persistent validator.
    }
  });

  it("initialize market stores config hashes", async () => {
    const { market, marketConfig } = await initializeMarket("init-in-sync");
    const account = await program.account.marketState.fetch(market);
    const config = await program.account.marketConfig.fetch(marketConfig);

    expect(account.materialSeq.toNumber()).to.equal(1);
    expect(account.pricedAtSeq.toNumber()).to.equal(1);
    expect(account.displayedPriceMicros.toNumber()).to.equal(DISPLAYED_40);
    expect(account.fairPriceMicros.toNumber()).to.equal(DISPLAYED_40);
    expect(account.toleranceMicros.toNumber()).to.equal(TOLERANCE_2C);
    expect(enumName(account.status)).to.equal("trading");
    expect(config.marketType).to.equal(0);
    expect(Buffer.from(config.fixtureIdHash).equals(Buffer.alloc(32, 1))).to.equal(true);
    expect(Buffer.from(config.marketTitleHash).equals(Buffer.alloc(32, 2))).to.equal(true);
    expect(Buffer.from(config.materialityConfigHash).equals(Buffer.alloc(32, 3))).to.equal(true);
    expect(Buffer.from(config.settlementConfigHash).equals(Buffer.alloc(32, 4))).to.equal(true);
    expect(config.authority.equals(trader)).to.equal(true);
    expect(config.createdAtSlot.toNumber()).to.be.greaterThan(0);
  });

  it("event hash cannot be zero", async () => {
    const { market } = await initializeMarket("zero-event-hash");
    try {
      await program.methods
        .ingestMaterialEvent(new anchor.BN(2), new anchor.BN(FAIR_63), Array.from(Buffer.alloc(32)))
        .accountsPartial({ authority: trader, market })
        .rpc();
      expect.fail("zero event hash should fail");
    } catch (error) {
      expect(String(error)).to.match(/Source event hash must be nonzero|ZeroEventHash/);
    }
  });

  it("unauthorized ingest fails", async () => {
    const { market } = await initializeMarket("unauthorized-ingest");
    const unauthorized = anchor.web3.Keypair.generate();
    const airdrop = await provider.connection.requestAirdrop(unauthorized.publicKey, 10_000_000);
    await provider.connection.confirmTransaction(airdrop, "confirmed");
    try {
      await program.methods
        .ingestMaterialEvent(new anchor.BN(2), new anchor.BN(FAIR_63), EVENT_HASH)
        .accountsPartial({ authority: unauthorized.publicKey, market })
        .signers([unauthorized])
        .rpc();
      expect.fail("unauthorized ingest should fail");
    } catch (error) {
      expect(String(error)).to.match(/Only the configured market authority|InvalidAuthority/);
    }
  });

  it("refunds a stale YES attack", async () => {
    const { market, marketConfig } = await initializeMarket("yes-refund");

    await program.methods
      .ingestMaterialEvent(new anchor.BN(2), new anchor.BN(FAIR_63), EVENT_HASH)
      .accountsPartial({ authority: trader, market })
      .rpc();

    const staleMarket = await program.account.marketState.fetch(market);
    expect(staleMarket.materialSeq.toNumber()).to.equal(2);
    expect(staleMarket.pricedAtSeq.toNumber()).to.equal(1);
    expect(staleMarket.displayedPriceMicros.toNumber()).to.equal(DISPLAYED_40);
    expect(staleMarket.fairPriceMicros.toNumber()).to.equal(FAIR_63);
    expect(enumName(staleMarket.status)).to.equal("stale");

    const balanceBeforePlace = await provider.connection.getBalance(trader);
    const { order } = await placeOrder("yes-refund-order", market, 0);
    const balanceAfterPlace = await provider.connection.getBalance(trader);

    const placed = await program.account.orderEscrow.fetch(order);
    expect(placed.observedPriceMicros.toNumber()).to.equal(DISPLAYED_40);
    expect(enumName(placed.status)).to.equal("escrowed");
    expect(balanceAfterPlace).to.be.lessThan(balanceBeforePlace - STAKE_LAMPORTS);

    await program.methods.evaluateOrder().accountsPartial({ market, marketConfig, order, trader, vault: pdaVault() }).rpc();

    const evaluated = await program.account.orderEscrow.fetch(order);
    expect(evaluated.fairSidePriceMicros.toNumber()).to.equal(FAIR_63);
    expect(evaluated.edgeMicros.toNumber()).to.equal(230_000);
    expect(enumName(evaluated.verdict)).to.equal("voidedRefunded");
    expect(enumName(evaluated.status)).to.equal("voidedRefunded");
    expect(enumName(evaluated.settlementDestination)).to.equal("trader");
    expect(Buffer.from(evaluated.sourceEventHash).equals(Buffer.alloc(32, 7))).to.equal(true);
    expect(Buffer.from(evaluated.materialityConfigHash).equals(Buffer.alloc(32, 3))).to.equal(true);

    const balanceAfterEvaluate = await provider.connection.getBalance(trader);
    const orderLamports = await provider.connection.getBalance(order);
    expect(balanceAfterEvaluate).to.be.greaterThan(balanceAfterPlace + STAKE_LAMPORTS - 100_000);
    expect(orderLamports).to.be.lessThan(STAKE_LAMPORTS);
  });

  it("fills a stale NO losing-side order", async () => {
    const { market, marketConfig } = await initializeMarket("no-fill");

    await program.methods
      .ingestMaterialEvent(new anchor.BN(2), new anchor.BN(FAIR_63), EVENT_HASH)
      .accountsPartial({ authority: trader, market })
      .rpc();

    const { order } = await placeOrder("no-fill-order", market, 1);
    await program.methods.evaluateOrder().accountsPartial({ market, marketConfig, order, trader, vault: pdaVault() }).rpc();

    const evaluated = await program.account.orderEscrow.fetch(order);
    expect(evaluated.observedPriceMicros.toNumber()).to.equal(MICROS_ONE - DISPLAYED_40);
    expect(evaluated.fairSidePriceMicros.toNumber()).to.equal(MICROS_ONE - FAIR_63);
    expect(evaluated.edgeMicros.toNumber()).to.equal(-230_000);
    expect(enumName(evaluated.verdict)).to.equal("staleAllowedNoEdge");
    expect(enumName(evaluated.status)).to.equal("filled");
    expect(enumName(evaluated.settlementDestination)).to.equal("vault");
    expect(Buffer.from(evaluated.sourceEventHash).equals(Buffer.alloc(32, 7))).to.equal(true);
    expect(Buffer.from(evaluated.materialityConfigHash).equals(Buffer.alloc(32, 3))).to.equal(true);

    // A filled order finalizes its stake into the ProtocolVault, not the order PDA.
    const orderLamports = await provider.connection.getBalance(order);
    const vaultLamports = await provider.connection.getBalance(pdaVault());
    expect(orderLamports).to.be.lessThan(STAKE_LAMPORTS);
    expect(vaultLamports).to.be.greaterThan(STAKE_LAMPORTS);

    // The normalized source-event hash was bound into on-chain market state.
    const evaluatedMarket = await program.account.marketState.fetch(market);
    expect(Buffer.from(evaluatedMarket.sourceEventHash).equals(Buffer.alloc(32, 7))).to.equal(true);
  });

  it("allows an in-sync order", async () => {
    const { market, marketConfig } = await initializeMarket("sync-allow");
    const { order } = await placeOrder("sync-allow-order", market, 0);

    await program.methods.evaluateOrder().accountsPartial({ market, marketConfig, order, trader, vault: pdaVault() }).rpc();

    const evaluated = await program.account.orderEscrow.fetch(order);
    expect(evaluated.fairSidePriceMicros.toNumber()).to.equal(DISPLAYED_40);
    expect(evaluated.edgeMicros.toNumber()).to.equal(0);
    expect(enumName(evaluated.verdict)).to.equal("allowed");
    expect(enumName(evaluated.status)).to.equal("filled");
  });

  it("allows stale edge below tolerance", async () => {
    const { market, marketConfig } = await initializeMarket("below-tolerance", {
      materialSeq: 2,
      pricedAtSeq: 1,
      displayed: DISPLAYED_40,
      fair: 415_000,
      tolerance: TOLERANCE_2C,
    });
    const { order } = await placeOrder("below-tolerance-order", market, 0);

    await program.methods.evaluateOrder().accountsPartial({ market, marketConfig, order, trader, vault: pdaVault() }).rpc();

    const evaluated = await program.account.orderEscrow.fetch(order);
    expect(evaluated.observedPriceMicros.toNumber()).to.equal(DISPLAYED_40);
    expect(evaluated.fairSidePriceMicros.toNumber()).to.equal(415_000);
    expect(evaluated.edgeMicros.toNumber()).to.equal(15_000);
    expect(enumName(evaluated.verdict)).to.equal("staleAllowedNoEdge");
    expect(enumName(evaluated.status)).to.equal("filled");
  });
});
