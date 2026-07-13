import * as anchor from "@anchor-lang/core";
import anchorPkg from "@anchor-lang/core";
import { expect } from "chai";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Program } from "@anchor-lang/core";
import type { Lineguard } from "../target/types/lineguard";
const canonicalValidation = JSON.parse(readFileSync(new URL("../fixtures/txline/canonical.validation.json", import.meta.url), "utf8")) as {
  dailyScoresRootPda: string;
  programId: string;
  validationPayloadHash: string;
  validationPayload: any;
};

describe("lineguard v2 wallet positions and isolated vaults", () => {
  const BN = anchorPkg.BN;
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.lineguard as Program<Lineguard>;
  const admin = provider.wallet.publicKey;
  const feed = anchor.web3.Keypair.generate();
  const pricing = anchor.web3.Keypair.generate();
  const emergency = anchor.web3.Keypair.generate();
  const resolution = [anchor.web3.Keypair.generate(), anchor.web3.Keypair.generate(), anchor.web3.Keypair.generate()];
  const trader = anchor.web3.Keypair.generate();
  const counterparty = anchor.web3.Keypair.generate();
  const unauthorizedInitializer = anchor.web3.Keypair.generate();
  const futureUpgradeAuthority = anchor.web3.Keypair.generate();
  const authorityConfig = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("authorities-v2")], program.programId)[0];

  const hash32 = (value: string): number[] => Array.from(createHash("sha256").update(value).digest());
  const marketId = (value: string): number[] => hash32(value);
  const marketPda = (id: number[]) => anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("market-v2"), Buffer.from(id)], program.programId)[0];
  const vaultPda = (market: anchor.web3.PublicKey) => anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("market-vault"), market.toBuffer()], program.programId)[0];
  const orderPda = (market: anchor.web3.PublicKey, owner: anchor.web3.PublicKey, id: number[]) => anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("order-v2"), market.toBuffer(), owner.toBuffer(), Buffer.from(id)], program.programId)[0];
  const positionPda = (market: anchor.web3.PublicKey, side: number, owner = trader.publicKey) => anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), owner.toBuffer(), Buffer.from([side])], program.programId)[0];

  function marketArgs(label: string, closeDelaySeconds = 3600) {
    const now = Math.floor(Date.now() / 1000);
    return {
      marketId: marketId(label),
      fixtureId: new BN(18_209_181),
      templateId: 1,
      fixtureIdHash: hash32("18209181"),
      homeTeamHash: hash32("France"),
      awayTeamHash: hash32("Morocco"),
      homeStatKey: 1,
      awayStatKey: 2,
      resolutionRule: 0,
      materialityConfigHash: hash32("goals:red-cards:penalties:odds"),
      pricingConfigHash: hash32("part1:Pct:micros"),
      pricingModelHash: hash32("MATCH_WINNER_HOME_TXLINE_DEMARGINED_V1"),
      pricingModelVersion: 1,
      oddsPayloadHash: hash32(`odds:${label}:1`),
      oddsSequence: new BN(1),
      materialSeq: new BN(1),
      pricedAtSeq: new BN(1),
      displayedPriceMicros: new BN(400_000),
      fairPriceMicros: new BN(400_000),
      toleranceMicros: new BN(20_000),
      closeTime: new BN(now + closeDelaySeconds),
      claimDeadline: new BN(0),
      evidenceMode: 1,
      settlementMinTimestamp: new BN(canonicalValidation.validationPayload.ts),
    };
  }

  before(async () => {
    const [traderSig, counterpartySig, proposerSig, unauthorizedSig, feedSig, futureUpgradeSig] = await Promise.all([
      provider.connection.requestAirdrop(trader.publicKey, 3 * anchor.web3.LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(counterparty.publicKey, 3 * anchor.web3.LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(resolution[0].publicKey, anchor.web3.LAMPORTS_PER_SOL / 10),
      provider.connection.requestAirdrop(unauthorizedInitializer.publicKey, anchor.web3.LAMPORTS_PER_SOL / 10),
      provider.connection.requestAirdrop(feed.publicKey, anchor.web3.LAMPORTS_PER_SOL / 10),
      provider.connection.requestAirdrop(futureUpgradeAuthority.publicKey, anchor.web3.LAMPORTS_PER_SOL / 10),
    ]);
    await Promise.all([
      provider.connection.confirmTransaction(traderSig, "confirmed"),
      provider.connection.confirmTransaction(counterpartySig, "confirmed"),
      provider.connection.confirmTransaction(proposerSig, "confirmed"),
      provider.connection.confirmTransaction(unauthorizedSig, "confirmed"),
      provider.connection.confirmTransaction(feedSig, "confirmed"),
      provider.connection.confirmTransaction(futureUpgradeSig, "confirmed"),
    ]);
  });

  it("secures the one-time authority bootstrap and stores the intended roles", async () => {
    const beforeArgs = marketArgs("v2-before-authorities");
    const beforeMarket = marketPda(beforeArgs.marketId);
    try {
      await program.methods.initializeMarketV2(beforeArgs).accountsPartial({
        admin,
        payer: admin,
        authorityConfig,
        market: beforeMarket,
        marketVault: vaultPda(beforeMarket),
      }).rpc();
      expect.fail("market initialization must fail before AuthorityConfig exists");
    } catch (error) {
      expect(String(error)).to.match(/not initialized|AccountNotInitialized|AccountOwnedByWrongProgram/);
    }

    const roleKeys = resolution.map((key) => key.publicKey) as [anchor.web3.PublicKey, anchor.web3.PublicKey, anchor.web3.PublicKey];
    for (const candidate of [unauthorizedInitializer, feed, futureUpgradeAuthority]) {
      try {
        await program.methods.initializeAuthorities(feed.publicKey, pricing.publicKey, roleKeys, emergency.publicKey, 2)
          .accountsPartial({ admin: candidate.publicKey, authorityConfig }).signers([candidate]).rpc();
        expect.fail("an unauthorized signer must not claim the authority PDA");
      } catch (error) {
        expect(String(error)).to.match(/address constraint|ConstraintAddress|InvalidAuthority|market authority/);
      }
    }

    await program.methods.initializeAuthorities(feed.publicKey, pricing.publicKey, roleKeys, emergency.publicKey, 2)
      .accountsPartial({ admin, authorityConfig }).rpc();
    const stored = await program.account.authorityConfig.fetch(authorityConfig);
    expect(stored.admin.toBase58()).to.equal(admin.toBase58());
    expect(stored.feedAuthority.toBase58()).to.equal(feed.publicKey.toBase58());
    expect(stored.pricingAuthority.toBase58()).to.equal(pricing.publicKey.toBase58());
    expect(stored.emergencyAuthority.toBase58()).to.equal(emergency.publicKey.toBase58());
    expect(stored.resolutionAuthorities.map((key) => key.toBase58())).to.deep.equal(roleKeys.map((key) => key.toBase58()));
    expect(stored.threshold).to.equal(2);

    try {
      await program.methods.initializeAuthorities(feed.publicKey, pricing.publicKey, roleKeys, emergency.publicKey, 2)
        .accountsPartial({ admin, authorityConfig }).rpc();
      expect.fail("a second authority initialization must fail");
    } catch (error) {
      expect(String(error)).to.match(/already in use|custom program error: 0x0|AccountAlreadyInitialized/);
    }
    try {
      await program.methods.proposeAuthorityUpdate(feed.publicKey, pricing.publicKey, roleKeys, emergency.publicKey, 2)
        .accountsPartial({ admin: feed.publicKey, authorityConfig }).signers([feed]).rpc();
      expect.fail("a runtime role must not alter authority configuration");
    } catch (error) {
      expect(String(error)).to.match(/has one|ConstraintHasOne|market authority/);
    }
  });

  async function initialize(label: string, closeDelaySeconds = 3600, payer = admin, signers: anchor.web3.Keypair[] = []) {
    const args = marketArgs(label, closeDelaySeconds);
    const id = args.marketId;
    const market = marketPda(id);
    const marketVault = vaultPda(market);
    await program.methods.initializeMarketV2(args)
      .accountsPartial({ admin, payer, authorityConfig, market, marketVault }).signers(signers).rpc();
    return { id, market, marketVault };
  }

  it("requires stored-admin authorization for every v2 market initializer", async () => {
    for (const [label, candidate] of [
      ["random", unauthorizedInitializer],
      ["feed", feed],
      ["pricing", pricing],
      ["emergency", emergency],
      ["resolution", resolution[0]],
    ] as const) {
      const args = marketArgs(`v2-unauthorized-${label}`);
      const market = marketPda(args.marketId);
      try {
        await program.methods.initializeMarketV2(args).accountsPartial({
          admin: candidate.publicKey,
          payer: admin,
          authorityConfig,
          market,
          marketVault: vaultPda(market),
        }).signers([candidate]).rpc();
        expect.fail(`${label} must not initialize a v2 market`);
      } catch (error) {
        expect(String(error)).to.match(/has one|ConstraintHasOne|market authority/);
      }
    }

    const wrongArgs = marketArgs("v2-wrong-config");
    const wrongMarket = marketPda(wrongArgs.marketId);
    try {
      await program.methods.initializeMarketV2(wrongArgs).accountsPartial({
        admin,
        payer: admin,
        authorityConfig: unauthorizedInitializer.publicKey,
        market: wrongMarket,
        marketVault: vaultPda(wrongMarket),
      }).rpc();
      expect.fail("a substituted AuthorityConfig account must fail");
    } catch (error) {
      expect(String(error)).to.match(/not initialized|AccountOwnedByWrongProgram|ConstraintSeeds/);
    }

    const poisonedArgs = { ...marketArgs("fairx-france-morocco-v2"), fixtureIdHash: hash32("attacker-fixture") };
    const canonicalMarket = marketPda(poisonedArgs.marketId);
    try {
      await program.methods.initializeMarketV2(poisonedArgs).accountsPartial({
        admin: unauthorizedInitializer.publicKey,
        payer: admin,
        authorityConfig,
        market: canonicalMarket,
        marketVault: vaultPda(canonicalMarket),
      }).signers([unauthorizedInitializer]).rpc();
      expect.fail("an unauthorized signer must not poison the canonical market PDA");
    } catch (error) {
      expect(String(error)).to.match(/has one|ConstraintHasOne|market authority/);
    }

    const created = await initialize("v2-admin-initialized", 3600, unauthorizedInitializer.publicKey, [unauthorizedInitializer]);
    const stored = await program.account.marketV2.fetch(created.market);
    expect(stored.authorityConfig.toBase58()).to.equal(authorityConfig.toBase58());
    expect(stored.fixtureIdHash).to.deep.equal(hash32("18209181"));
    try {
      await program.methods.initializeMarketV2(marketArgs("v2-admin-initialized")).accountsPartial({
        admin,
        payer: admin,
        authorityConfig,
        market: created.market,
        marketVault: created.marketVault,
      }).rpc();
      expect.fail("duplicate market initialization must fail");
    } catch (error) {
      expect(String(error)).to.match(/already in use|custom program error: 0x0|AccountAlreadyInitialized/);
    }
  });

  it("makes evidence provenance explicit and forbids expiring claims", async () => {
    for (const [label, args, match] of [
      ["expiring-claim", { ...marketArgs("v2-expiring-claim"), claimDeadline: new BN(1) }, /do not expire|ClaimsMustNotExpire/],
      ["invalid-evidence-mode", { ...marketArgs("v2-invalid-evidence-mode"), evidenceMode: 2 }, /Evidence mode|InvalidEvidenceMode/],
    ] as const) {
      const market = marketPda(args.marketId);
      try {
        await program.methods.initializeMarketV2(args).accountsPartial({ admin, payer: admin, authorityConfig, market, marketVault: vaultPda(market) }).rpc();
        expect.fail(`${label} must reject`);
      } catch (error) {
        expect(String(error)).to.match(match);
      }
    }
    const liveArgs = marketArgs("v2-live-evidence-too-old");
    liveArgs.evidenceMode = 0;
    liveArgs.settlementMinTimestamp = liveArgs.closeTime.muln(1_000).subn(1);
    const liveMarket = marketPda(liveArgs.marketId);
    try {
      await program.methods.initializeMarketV2(liveArgs).accountsPartial({ admin, payer: admin, authorityConfig, market: liveMarket, marketVault: vaultPda(liveMarket) }).rpc();
      expect.fail("live evidence must not predate market close");
    } catch (error) {
      expect(String(error)).to.match(/evidence timestamp|InvalidEvidenceTimestamp/);
    }
  });

  async function placeOnly(
    market: anchor.web3.PublicKey,
    marketVault: anchor.web3.PublicKey,
    label: string,
    side: 0 | 1,
    stake: number,
    owner = trader,
    overrides: Partial<{
      expectedExecutionPrice: anchorPkg.BN;
      maxSlippage: anchorPkg.BN;
      expectedPricingSequence: anchorPkg.BN;
      expectedOddsSequence: anchorPkg.BN;
      expirySlot: anchorPkg.BN;
    }> = {}
  ) {
    const id = marketId(label);
    const order = orderPda(market, owner.publicKey, id);
    const position = positionPda(market, side, owner.publicKey);
    const stored = await program.account.marketV2.fetch(market);
    const executionPrice = side === 0 ? stored.displayedPriceMicros : new BN(1_000_000).sub(stored.displayedPriceMicros);
    const slot = await provider.connection.getSlot("confirmed");
    await program.methods.placeOrderV2(
      id,
      side,
      new BN(stake),
      new BN(20_000),
      overrides.expectedExecutionPrice ?? executionPrice,
      overrides.maxSlippage ?? new BN(5_000),
      overrides.expectedPricingSequence ?? stored.pricedAtSeq,
      overrides.expectedOddsSequence ?? stored.oddsSequence,
      overrides.expirySlot ?? new BN(slot + 150)
    )
      .accountsPartial({ trader: owner.publicKey, market, marketVault, order, position })
      .signers([owner]).rpc();
    return { order, position };
  }

  async function placeAndEvaluate(market: anchor.web3.PublicKey, marketVault: anchor.web3.PublicKey, label: string, side: 0 | 1, stake: number, owner = trader) {
    const { order, position } = await placeOnly(market, marketVault, label, side, stake, owner);
    await program.methods.evaluateOrderV2().accountsPartial({ market, marketVault, order, trader: owner.publicKey, position }).rpc();
    return { order, position };
  }

  it("creates a trader-owned position and conserves the isolated vault", async () => {
    const { market, marketVault } = await initialize("v2-position");
    const { position } = await placeAndEvaluate(market, marketVault, "v2-position-order", 0, 10_000_000);
    const stored = await program.account.position.fetch(position);
    const vault = await program.account.marketVault.fetch(marketVault);
    expect(stored.trader.toBase58()).to.equal(trader.publicKey.toBase58());
    expect(stored.market.toBase58()).to.equal(market.toBase58());
    expect(stored.acceptedLamports.toNumber()).to.equal(10_000_000);
    expect(stored.sharesOrPoolWeight.toNumber()).to.equal(25_000_000);
    expect(stored.entryPriceMicros.toNumber()).to.equal(400_000);
    expect(vault.totalDeposited.toNumber()).to.equal(10_000_000);
    expect(vault.totalAccepted.toNumber()).to.equal(10_000_000);
    expect(vault.totalClaimable.toNumber()).to.equal(10_000_000);
  });

  it("rejects unsigned price movement, sequence drift, and expired orders", async () => {
    const { market, marketVault } = await initialize("v2-signed-order-constraints");
    const stored = await program.account.marketV2.fetch(market);
    const slot = await provider.connection.getSlot("confirmed");
    const cases = [
      { label: "slippage", overrides: { expectedExecutionPrice: new BN(500_000), maxSlippage: new BN(1_000) }, match: /slippage|SlippageExceeded/ },
      { label: "pricing-sequence", overrides: { expectedPricingSequence: stored.pricedAtSeq.addn(1) }, match: /pricing sequence|PricingSequenceMismatch/ },
      { label: "odds-sequence", overrides: { expectedOddsSequence: stored.oddsSequence.addn(1) }, match: /odds sequence|OddsSequenceMismatch/ },
      { label: "expiry", overrides: { expirySlot: new BN(slot - 1) }, match: /expired|OrderExpired/ },
    ];
    for (const testCase of cases) {
      try {
        await placeOnly(market, marketVault, `v2-signed-${testCase.label}`, 0, 1_000_000, trader, testCase.overrides);
        expect.fail(`${testCase.label} must reject`);
      } catch (error) {
        expect(String(error)).to.match(testCase.match);
      }
    }
  });

  it("scopes identical order ids by trader and returns cancel rent", async () => {
    const { market, marketVault } = await initialize("v2-trader-scoped-orders");
    const first = await placeOnly(market, marketVault, "same-order-id", 0, 1_000_000, trader);
    const second = await placeOnly(market, marketVault, "same-order-id", 0, 1_000_000, counterparty);
    expect(first.order.toBase58()).not.to.equal(second.order.toBase58());
    await program.methods.cancelOrderV2().accountsPartial({ trader: trader.publicKey, market, order: first.order, position: first.position }).signers([trader]).rpc();
    await program.methods.cancelOrderV2().accountsPartial({ trader: counterparty.publicKey, market, order: second.order, position: second.position }).signers([counterparty]).rpc();
    expect(await provider.connection.getAccountInfo(first.order)).to.equal(null);
    expect(await provider.connection.getAccountInfo(second.order)).to.equal(null);
    await program.methods.closeMarketV2().accountsPartial({ closer: feed.publicKey, authorityConfig, market }).signers([feed]).rpc();
    await program.methods.closeEmptyPositionV2().accountsPartial({ trader: trader.publicKey, market, position: first.position }).signers([trader]).rpc();
    await program.methods.closeEmptyPositionV2().accountsPartial({ trader: counterparty.publicKey, market, position: second.position }).signers([counterparty]).rpc();
  });

  it("allows permissionless evaluation after close so escrow cannot be stranded", async () => {
    const { market, marketVault } = await initialize("v2-timeout-recovery");
    const { order, position } = await placeOnly(market, marketVault, "v2-timeout-order", 1, 5_000_000);
    const beforeRecovery = await provider.connection.getBalance(trader.publicKey);
    await program.methods.closeMarketV2().accountsPartial({ closer: feed.publicKey, authorityConfig, market }).signers([feed]).rpc();
    await program.methods.evaluateOrderV2().accountsPartial({ market, marketVault, order, trader: trader.publicKey, position }).rpc();
    const afterRecovery = await provider.connection.getBalance(trader.publicKey);
    expect(afterRecovery - beforeRecovery).to.be.greaterThan(5_000_000);
    expect(await provider.connection.getAccountInfo(order)).to.equal(null);
    const vault = await program.account.marketVault.fetch(marketVault);
    expect(vault.totalRefunded.toNumber()).to.equal(5_000_000);
    await program.methods.closeEmptyPositionV2().accountsPartial({ trader: trader.publicKey, market, position }).signers([trader]).rpc();
  });

  it("makes the signed execution price economically change pool shares", async () => {
    const { market, marketVault } = await initialize("v2-price-weighted-shares");
    const cheap = await placeAndEvaluate(market, marketVault, "v2-cheap-yes", 0, 10_000_000, trader);
    await program.methods.commitTxlineOddsV2(new BN(2), new BN(800_000), hash32("odds:price-weighted:2"), 1, hash32("MATCH_WINNER_HOME_TXLINE_DEMARGINED_V1"))
      .accountsPartial({ pricingAuthority: pricing.publicKey, authorityConfig, market }).signers([pricing]).rpc();
    await program.methods.repriceMarketV2().accountsPartial({ pricingAuthority: pricing.publicKey, authorityConfig, market }).signers([pricing]).rpc();
    const expensive = await placeAndEvaluate(market, marketVault, "v2-expensive-yes", 0, 10_000_000, counterparty);
    const cheapPosition = await program.account.position.fetch(cheap.position);
    const expensivePosition = await program.account.position.fetch(expensive.position);
    expect(cheapPosition.sharesOrPoolWeight.toNumber()).to.equal(25_000_000);
    expect(expensivePosition.sharesOrPoolWeight.toNumber()).to.equal(12_500_000);
  });

  it("refunds stale positive edge to the exact trader without accepted weight", async () => {
    const { market, marketVault } = await initialize("v2-refund");
    await program.methods.ingestMaterialEventV2(new BN(2), hash32("goal-seq-2"))
      .accountsPartial({ feedAuthority: feed.publicKey, authorityConfig, market }).signers([feed]).rpc();
    await program.methods.commitTxlineOddsV2(new BN(2), new BN(630_000), hash32("genuine-odds-seq-2"), 1, hash32("MATCH_WINNER_HOME_TXLINE_DEMARGINED_V1"))
      .accountsPartial({ pricingAuthority: pricing.publicKey, authorityConfig, market }).signers([pricing]).rpc();
    const before = await provider.connection.getBalance(trader.publicKey);
    const { order, position } = await placeAndEvaluate(market, marketVault, "v2-refund-order", 0, 10_000_000);
    const after = await provider.connection.getBalance(trader.publicKey);
    const storedOrder = await provider.connection.getAccountInfo(order);
    const storedPosition = await program.account.position.fetch(position);
    const vault = await program.account.marketVault.fetch(marketVault);
    expect(storedOrder).to.equal(null);
    expect(storedPosition.acceptedLamports.toNumber()).to.equal(0);
    expect(vault.totalRefunded.toNumber()).to.equal(10_000_000);
    expect(vault.totalClaimable.toNumber()).to.equal(0);
    expect(before - after).to.be.lessThan(2_000_000); // position rent + fees; order rent and stake returned
    await program.methods.closeMarketV2().accountsPartial({ closer: feed.publicKey, authorityConfig, market }).signers([feed]).rpc();
    await program.methods.closeEmptyPositionV2().accountsPartial({ trader: trader.publicKey, market, position }).signers([trader]).rpc();
    expect(await provider.connection.getAccountInfo(position)).to.equal(null);
  });

  it("rejects cross-market vault substitution", async () => {
    const a = await initialize("v2-isolation-a");
    const b = await initialize("v2-isolation-b");
    const id = marketId("v2-isolation-order");
    try {
      const stored = await program.account.marketV2.fetch(a.market);
      const slot = await provider.connection.getSlot("confirmed");
      await program.methods.placeOrderV2(id, 0, new BN(1_000_000), new BN(20_000), stored.displayedPriceMicros, new BN(5_000), stored.pricedAtSeq, stored.oddsSequence, new BN(slot + 150)).accountsPartial({
        trader: trader.publicKey,
        market: a.market,
        marketVault: b.marketVault,
        order: orderPda(a.market, trader.publicKey, id),
        position: positionPda(a.market, 0),
      }).signers([trader]).rpc();
      expect.fail("market B vault must not accept market A collateral");
    } catch (error) {
      expect(String(error)).to.match(/ConstraintSeeds|does not belong to this market|InvalidMarket/);
    }
  });

  it("allows only the emergency role to void, then requires the trader to claim", async () => {
    const { market, marketVault } = await initialize("v2-void-claim");
    const { position } = await placeAndEvaluate(market, marketVault, "v2-void-claim-order", 1, 7_000_000);
    try {
      await program.methods.emergencyVoidMarketV2().accountsPartial({ emergencyAuthority: pricing.publicKey, authorityConfig, market }).signers([pricing]).rpc();
      expect.fail("pricing authority must not have emergency power");
    } catch (error) {
      expect(String(error)).to.match(/emergency authority|InvalidEmergencyAuthority/);
    }
    await program.methods.emergencyVoidMarketV2().accountsPartial({ emergencyAuthority: emergency.publicKey, authorityConfig, market }).signers([emergency]).rpc();
    await program.methods.claimPositionV2().accountsPartial({ trader: trader.publicKey, market, marketVault, position }).signers([trader]).rpc();
    const stored = await provider.connection.getAccountInfo(position);
    const vault = await program.account.marketVault.fetch(marketVault);
    expect(stored).to.equal(null);
    expect(vault.totalPaid.toNumber()).to.equal(7_000_000);
    expect(vault.totalClaimable.toNumber()).to.equal(0);
    try {
      await program.methods.claimPositionV2().accountsPartial({ trader: trader.publicKey, market, marketVault, position }).signers([trader]).rpc();
      expect.fail("double claim must fail");
    } catch (error) {
      expect(String(error)).to.match(/already claimed|PositionAlreadyClaimed|not initialized|AccountNotInitialized/);
    }
  });

  it("CPIs into genuine TxLINE validateStatV2, derives the outcome, and enforces 2-of-3", async function () {
    const txlineExecutable = await provider.connection.getAccountInfo(new anchor.web3.PublicKey(canonicalValidation.programId));
    if (!txlineExecutable?.executable) this.skip(); // Surfpool ignores test.validator clone; legacy validator runs this case.
    const { market, marketVault } = await initialize("v2-direct-cpi", 120);
    const yes = await placeAndEvaluate(market, marketVault, "v2-direct-cpi-yes", 0, 4_000_000, trader);
    const no = await placeAndEvaluate(market, marketVault, "v2-direct-cpi-no", 1, 4_000_000, counterparty);
    await program.methods.closeMarketV2().accountsPartial({ closer: feed.publicKey, authorityConfig, market }).signers([feed]).rpc();

    const source = canonicalValidation.validationPayload;
    const proofNode = (node: { hash: number[]; isRightSibling: boolean }) => ({ hash: node.hash, isRightSibling: node.isRightSibling });
    const payload = {
      ts: new BN(source.ts),
      fixtureSummary: {
        fixtureId: new BN(source.summary.fixtureId),
        updateStats: {
          updateCount: source.summary.updateStats.updateCount,
          minTimestamp: new BN(source.summary.updateStats.minTimestamp),
          maxTimestamp: new BN(source.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: source.summary.eventStatsSubTreeRoot,
      },
      fixtureProof: source.subTreeProof.map(proofNode),
      mainTreeProof: source.mainTreeProof.map(proofNode),
      eventStatRoot: source.eventStatRoot,
      stats: source.statsToProve.map((stat, index) => ({
        stat: { key: stat.key, value: stat.value, period: stat.period },
        statProof: source.statProofs[index].map(proofNode),
      })),
    };
    const txlineRoot = new anchor.web3.PublicKey(canonicalValidation.dailyScoresRootPda);
    const txlineProgram = new anchor.web3.PublicKey(canonicalValidation.programId);
    const validationReceipt = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("txval-v2"), market.toBuffer()], program.programId)[0];
    const resolutionProposal = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("resolution-v2"), market.toBuffer()], program.programId)[0];
    const encodedPayload = program.coder.types.encode("statValidationInput", payload);
    const borshPayloadHash = Array.from(createHash("sha256").update(encodedPayload).digest());
    try {
      await program.methods.proveResolutionWithTxlineV2(
        Array(32).fill(9),
        payload
      ).accountsPartial({ proposer: resolution[0].publicKey, authorityConfig, market, txlineRoot, txlineProgram, validationReceipt, resolutionProposal })
        .signers([resolution[0]]).rpc();
      expect.fail("a hash unrelated to the exact CPI payload must fail");
    } catch (error) {
      expect(String(error)).to.match(/validation receipt|ValidationPayloadMismatch/);
    }
    await program.methods.proveResolutionWithTxlineV2(
      borshPayloadHash,
      payload
    ).accountsPartial({
      proposer: resolution[0].publicKey,
      authorityConfig,
      market,
      txlineRoot,
      txlineProgram,
      validationReceipt,
      resolutionProposal,
    }).preInstructions([
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
    ]).signers([resolution[0]]).rpc();

    const receipt = await program.account.txlineValidationReceiptV2.fetch(validationReceipt);
    expect(receipt.directCpiVerified).to.equal(true);
    expect(receipt.homeScore).to.equal(1);
    expect(receipt.awayScore).to.equal(0);
    expect(receipt.derivedOutcome).to.equal(1);
    try {
      await program.methods.executeResolutionV2().accountsPartial({ authorityConfig, market, validationReceipt, resolutionProposal }).rpc();
      expect.fail("one approval must not execute a 2-of-3 proposal");
    } catch (error) {
      expect(String(error)).to.match(/threshold|ResolutionThresholdNotMet/);
    }
    await program.methods.approveResolutionV2().accountsPartial({ approver: resolution[1].publicKey, authorityConfig, market, resolutionProposal }).signers([resolution[1]]).rpc();
    await program.methods.executeResolutionV2().accountsPartial({ authorityConfig, market, validationReceipt, resolutionProposal }).rpc();
    const resolved = await program.account.marketV2.fetch(market);
    expect(resolved.resolution).to.equal(1);
    expect(resolved.resolved).to.equal(true);
    await program.methods.claimPositionV2().accountsPartial({ trader: trader.publicKey, market, marketVault, position: yes.position }).signers([trader]).rpc();
    await program.methods.closeLosingPositionV2().accountsPartial({ trader: counterparty.publicKey, market, position: no.position }).signers([counterparty]).rpc();
    const paidVault = await program.account.marketVault.fetch(marketVault);
    const paidMarket = await program.account.marketV2.fetch(market);
    expect(paidVault.totalPaid.toNumber()).to.equal(8_000_000);
    expect(paidVault.totalClaimable.toNumber()).to.equal(0);
    expect(paidMarket.claimedWinningLamports.toNumber()).to.equal(8_000_000);
    expect(await provider.connection.getAccountInfo(yes.position)).to.equal(null);
    expect(await provider.connection.getAccountInfo(no.position)).to.equal(null);
  });

  it("simulates the exact three-wallet preview with isolated stale refund and counterparty payout", async function () {
    const txlineExecutable = await provider.connection.getAccountInfo(new anchor.web3.PublicKey(canonicalValidation.programId));
    if (!txlineExecutable?.executable) this.skip();

    const args = marketArgs("v3-three-wallet-preview-local", 120);
    args.oddsSequence = new BN(1_783_632_223_405);
    args.materialSeq = new BN(738);
    args.pricedAtSeq = new BN(738);
    args.displayedPriceMicros = new BN(522_740);
    args.fairPriceMicros = new BN(522_740);
    args.oddsPayloadHash = hash32("canonical-old-odds");
    const market = marketPda(args.marketId);
    const marketVault = vaultPda(market);
    await program.methods.initializeMarketV2(args)
      .accountsPartial({ admin, payer: admin, authorityConfig, market, marketVault }).rpc();

    const walletA = trader;
    const walletB = counterparty;
    const walletC = unauthorizedInitializer;
    const balancesBefore = await Promise.all([walletA, walletB, walletC].map((wallet) => provider.connection.getBalance(wallet.publicKey)));
    async function exactOrder(owner: anchor.web3.Keypair, label: string, side: 0 | 1, expectedPrice: number, expectedOddsSequence: number) {
      const placed = await placeOnly(market, marketVault, label, side, 10_000_000, owner, {
        expectedExecutionPrice: new BN(expectedPrice),
        maxSlippage: new BN(0),
        expectedPricingSequence: new BN(738),
        expectedOddsSequence: new BN(expectedOddsSequence),
      });
      await program.methods.evaluateOrderV2().accountsPartial({ market, marketVault, order: placed.order, trader: owner.publicKey, position: placed.position }).rpc();
      return placed;
    }

    const a = await exactOrder(walletA, "wallet-a-honest-yes", 0, 522_740, 1_783_632_223_405);
    const b = await exactOrder(walletB, "wallet-b-honest-no", 1, 477_260, 1_783_632_223_405);
    await program.methods.ingestMaterialEventV2(new BN(739), hash32("canonical-goal-seq-739"))
      .accountsPartial({ feedAuthority: feed.publicKey, authorityConfig, market }).signers([feed]).rpc();
    await program.methods.commitTxlineOddsV2(new BN(1_783_632_332_626), new BN(865_050), hash32("canonical-new-odds"), 1, args.pricingModelHash)
      .accountsPartial({ pricingAuthority: pricing.publicKey, authorityConfig, market }).signers([pricing]).rpc();
    const c = await exactOrder(walletC, "wallet-c-stale-exploit", 0, 522_740, 1_783_632_332_626);
    await program.methods.repriceMarketV2().accountsPartial({ pricingAuthority: pricing.publicKey, authorityConfig, market }).signers([pricing]).rpc();
    await program.methods.closeMarketV2().accountsPartial({ closer: feed.publicKey, authorityConfig, market }).signers([feed]).rpc();

    const source = canonicalValidation.validationPayload;
    const proofNode = (node: { hash: number[]; isRightSibling: boolean }) => ({ hash: node.hash, isRightSibling: node.isRightSibling });
    const payload = {
      ts: new BN(source.ts),
      fixtureSummary: {
        fixtureId: new BN(source.summary.fixtureId),
        updateStats: {
          updateCount: source.summary.updateStats.updateCount,
          minTimestamp: new BN(source.summary.updateStats.minTimestamp),
          maxTimestamp: new BN(source.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: source.summary.eventStatsSubTreeRoot,
      },
      fixtureProof: source.subTreeProof.map(proofNode),
      mainTreeProof: source.mainTreeProof.map(proofNode),
      eventStatRoot: source.eventStatRoot,
      stats: source.statsToProve.map((stat, index) => ({
        stat: { key: stat.key, value: stat.value, period: stat.period },
        statProof: source.statProofs[index].map(proofNode),
      })),
    };
    const validationReceipt = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("txval-v2"), market.toBuffer()], program.programId)[0];
    const resolutionProposal = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("resolution-v2"), market.toBuffer()], program.programId)[0];
    const borshPayloadHash = Array.from(createHash("sha256").update(program.coder.types.encode("statValidationInput", payload)).digest());
    await program.methods.proveResolutionWithTxlineV2(borshPayloadHash, payload).accountsPartial({
      proposer: resolution[0].publicKey,
      authorityConfig,
      market,
      txlineRoot: new anchor.web3.PublicKey(canonicalValidation.dailyScoresRootPda),
      txlineProgram: new anchor.web3.PublicKey(canonicalValidation.programId),
      validationReceipt,
      resolutionProposal,
    }).preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })]).signers([resolution[0]]).rpc();
    await program.methods.approveResolutionV2().accountsPartial({ approver: resolution[1].publicKey, authorityConfig, market, resolutionProposal }).signers([resolution[1]]).rpc();
    await program.methods.executeResolutionV2().accountsPartial({ authorityConfig, market, validationReceipt, resolutionProposal }).rpc();
    await program.methods.claimPositionV2().accountsPartial({ trader: walletA.publicKey, market, marketVault, position: a.position }).signers([walletA]).rpc();
    await program.methods.closeLosingPositionV2().accountsPartial({ trader: walletB.publicKey, market, position: b.position }).signers([walletB]).rpc();
    await program.methods.closeEmptyPositionV2().accountsPartial({ trader: walletC.publicKey, market, position: c.position }).signers([walletC]).rpc();

    const [storedMarket, storedVault, ...closed] = await Promise.all([
      program.account.marketV2.fetch(market),
      program.account.marketVault.fetch(marketVault),
      ...[a.order, b.order, c.order, a.position, b.position, c.position].map((address) => provider.connection.getAccountInfo(address)),
    ]);
    const balancesAfter = await Promise.all([walletA, walletB, walletC].map((wallet) => provider.connection.getBalance(wallet.publicKey)));
    expect(storedMarket.yesShares.toNumber()).to.equal(19_129_969);
    expect(storedMarket.noShares.toNumber()).to.equal(20_952_939);
    expect(storedMarket.resolution).to.equal(1);
    expect(storedVault.totalDeposited.toNumber()).to.equal(30_000_000);
    expect(storedVault.totalAccepted.toNumber()).to.equal(20_000_000);
    expect(storedVault.totalRefunded.toNumber()).to.equal(10_000_000);
    expect(storedVault.totalPaid.toNumber()).to.equal(20_000_000);
    expect(storedVault.totalClaimable.toNumber()).to.equal(0);
    expect(storedVault.roundingDust.toNumber()).to.equal(0);
    expect(closed.every((account) => account === null)).to.equal(true);
    expect(balancesAfter[0] - balancesBefore[0]).to.equal(10_000_000);
    expect(balancesAfter[1] - balancesBefore[1]).to.equal(-10_000_000);
    expect(balancesAfter[2] - balancesBefore[2]).to.equal(0);
  });

  it("exposes the direct CPI payload and no caller-supplied outcome", () => {
    const instruction = program.idl.instructions.find((item) => item.name === "proveResolutionWithTxlineV2");
    expect(instruction?.args.map((arg) => arg.name)).to.deep.equal(["validationPayloadHash", "payload"]);
    expect(program.idl.instructions.find((item) => item.name === "executeResolutionV2")?.args).to.deep.equal([]);
  });
});
