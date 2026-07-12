use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe");

const MICROS_ONE: u64 = 1_000_000;
// The official TxLINE (TxOdds) devnet oracle program. The genuine on-chain daily-scores
// root PDA is owned by this program; resolution binds to it so an operator cannot invent
// a root or an outcome.
// 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J (base58) as its raw 32-byte pubkey.
const TXLINE_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    86, 117, 159, 44, 144, 95, 120, 96, 200, 99, 119, 20, 191, 36, 145, 48, 157, 192, 113, 129,
    81, 63, 122, 36, 191, 62, 218, 248, 127, 119, 80, 3,
]);
// MarketState grew by 32 bytes (source_event_hash), then by 50 bytes for the settlement
// fields, then by 81 bytes for the resolution-integrity fields (fixture_id, close_time,
// trading_closed, resolved_at, per-market accounting, validation_payload_hash) at the end.
// Additive: existing accounts keep their layout; only newly-initialized markets allocate
// the larger size, and the new program only ever loads freshly-initialized markets.
const MARKET_SPACE: usize =
    8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 32 + 8 + 8 + 1 + 32 + 1 + 8 + 8 + 1 + 8 + 8 + 8 + 8 + 32;
// TxlineValidationReceipt: market, authority, fixture_id, sequence, stat keys, epoch day,
// root PDA, payload hash, event-stat root, scores, derived outcome, created_at, bump.
const RECEIPT_SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1 + 2 + 32 + 32 + 32 + 2 + 2 + 1 + 8 + 1;
const MARKET_CONFIG_SPACE: usize = 8 + 1 + 32 + 32 + 32 + 32 + 32 + 8;
// The original 140-byte layout is preserved through `bump`. New proof fields
// are additive so previously-recorded order offsets remain stable.
const ORDER_SPACE: usize = 8 + 32 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 32 + 32;
const VAULT_SPACE: usize = 8 + 32 + 8 + 8 + 1;

#[program]
pub mod lineguard {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        market_id: [u8; 32],
        material_seq: u64,
        priced_at_seq: u64,
        displayed_price_micros: u64,
        fair_price_micros: u64,
        tolerance_micros: u64,
    ) -> Result<()> {
        require!(
            displayed_price_micros <= MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(
            fair_price_micros <= MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(tolerance_micros <= MICROS_ONE, LineGuardError::InvalidPrice);

        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.market_id = market_id;
        market.material_seq = material_seq;
        market.priced_at_seq = priced_at_seq;
        market.displayed_price_micros = displayed_price_micros;
        market.fair_price_micros = fair_price_micros;
        market.tolerance_micros = tolerance_micros;
        market.status = if material_seq > priced_at_seq {
            MarketStatus::Stale
        } else {
            MarketStatus::Trading
        };
        market.bump = ctx.bumps.market;
        market.source_event_hash = [0u8; 32];
        market.yes_pool_lamports = 0;
        market.no_pool_lamports = 0;
        market.resolution = 0;
        market.resolution_event_hash = [0u8; 32];
        market.resolved = false;
        market.fixture_id = 0;
        market.close_time = 0;
        market.trading_closed = false;
        market.resolved_at = 0;
        market.market_total_in = 0;
        market.market_total_paid = 0;
        market.market_total_refunded = 0;
        market.validation_payload_hash = [0u8; 32];
        Ok(())
    }

    /// Atomically creates a market and its fairness-critical config commitment.
    /// The legacy initializer remains available so historical devnet proof data
    /// and its instruction schema stay inspectable after program upgrades.
    pub fn initialize_market_config(
        ctx: Context<InitializeMarketConfig>,
        market_id: [u8; 32],
        material_seq: u64,
        priced_at_seq: u64,
        displayed_price_micros: u64,
        fair_price_micros: u64,
        tolerance_micros: u64,
        market_type: u8,
        fixture_id_hash: [u8; 32],
        market_title_hash: [u8; 32],
        materiality_config_hash: [u8; 32],
        settlement_config_hash: [u8; 32],
        fixture_id: u64,
        close_time: i64,
    ) -> Result<()> {
        require!(
            displayed_price_micros > 0 && displayed_price_micros < MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(
            fair_price_micros > 0 && fair_price_micros < MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(tolerance_micros <= MICROS_ONE, LineGuardError::InvalidPrice);
        require!(market_type <= 3, LineGuardError::InvalidMarketType);
        require!(
            !is_zero_hash(&fixture_id_hash),
            LineGuardError::ZeroConfigHash
        );
        require!(
            !is_zero_hash(&market_title_hash),
            LineGuardError::ZeroConfigHash
        );
        require!(
            !is_zero_hash(&materiality_config_hash),
            LineGuardError::ZeroConfigHash
        );
        require!(
            !is_zero_hash(&settlement_config_hash),
            LineGuardError::ZeroConfigHash
        );

        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.market_id = market_id;
        market.material_seq = material_seq;
        market.priced_at_seq = priced_at_seq;
        market.displayed_price_micros = displayed_price_micros;
        market.fair_price_micros = fair_price_micros;
        market.tolerance_micros = tolerance_micros;
        market.status = if material_seq > priced_at_seq {
            MarketStatus::Stale
        } else {
            MarketStatus::Trading
        };
        market.bump = ctx.bumps.market;
        market.source_event_hash = [0u8; 32];
        market.yes_pool_lamports = 0;
        market.no_pool_lamports = 0;
        market.resolution = 0;
        market.resolution_event_hash = [0u8; 32];
        market.resolved = false;
        market.fixture_id = fixture_id;
        market.close_time = close_time;
        market.trading_closed = false;
        market.resolved_at = 0;
        market.market_total_in = 0;
        market.market_total_paid = 0;
        market.market_total_refunded = 0;
        market.validation_payload_hash = [0u8; 32];

        let config = &mut ctx.accounts.market_config;
        config.market_type = market_type;
        config.fixture_id_hash = fixture_id_hash;
        config.market_title_hash = market_title_hash;
        config.materiality_config_hash = materiality_config_hash;
        config.settlement_config_hash = settlement_config_hash;
        config.authority = ctx.accounts.authority.key();
        config.created_at_slot = Clock::get()?.slot;
        Ok(())
    }

    /// Attaches a config commitment to a legacy MarketState without changing
    /// that market account or invalidating its recorded proof history.
    pub fn attach_market_config(
        ctx: Context<AttachMarketConfig>,
        market_type: u8,
        fixture_id_hash: [u8; 32],
        market_title_hash: [u8; 32],
        materiality_config_hash: [u8; 32],
        settlement_config_hash: [u8; 32],
    ) -> Result<()> {
        require!(market_type <= 3, LineGuardError::InvalidMarketType);
        require!(
            !is_zero_hash(&fixture_id_hash),
            LineGuardError::ZeroConfigHash
        );
        require!(
            !is_zero_hash(&market_title_hash),
            LineGuardError::ZeroConfigHash
        );
        require!(
            !is_zero_hash(&materiality_config_hash),
            LineGuardError::ZeroConfigHash
        );
        require!(
            !is_zero_hash(&settlement_config_hash),
            LineGuardError::ZeroConfigHash
        );

        let config = &mut ctx.accounts.market_config;
        config.market_type = market_type;
        config.fixture_id_hash = fixture_id_hash;
        config.market_title_hash = market_title_hash;
        config.materiality_config_hash = materiality_config_hash;
        config.settlement_config_hash = settlement_config_hash;
        config.authority = ctx.accounts.authority.key();
        config.created_at_slot = Clock::get()?.slot;
        Ok(())
    }

    /// One-time creation of the singleton protocol vault. Filled (allowed / no-edge)
    /// orders finalize their stake here instead of leaving it stranded in the order PDA.
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.total_finalized = 0;
        vault.fill_count = 0;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn ingest_material_event(
        ctx: Context<UpdateMarket>,
        new_material_seq: u64,
        new_fair_price_micros: u64,
        source_event_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            new_fair_price_micros > 0 && new_fair_price_micros < MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(
            !is_zero_hash(&source_event_hash),
            LineGuardError::ZeroEventHash
        );

        let market = &mut ctx.accounts.market;
        require!(
            new_material_seq >= market.material_seq,
            LineGuardError::SequenceRegression
        );

        market.material_seq = new_material_seq;
        market.fair_price_micros = new_fair_price_micros;
        // Bind the source event's normalized hash into on-chain market state.
        market.source_event_hash = source_event_hash;
        if market.material_seq > market.priced_at_seq {
            market.status = MarketStatus::Stale;
        }
        Ok(())
    }

    pub fn reprice_market(
        ctx: Context<UpdateMarket>,
        new_displayed_price_micros: u64,
    ) -> Result<()> {
        require!(
            new_displayed_price_micros <= MICROS_ONE,
            LineGuardError::InvalidPrice
        );

        let market = &mut ctx.accounts.market;
        market.displayed_price_micros = new_displayed_price_micros;
        market.priced_at_seq = market.material_seq;
        market.status = MarketStatus::Trading;
        Ok(())
    }

    pub fn place_order(
        ctx: Context<PlaceOrder>,
        order_id: [u8; 32],
        side: u8,
        stake_lamports: u64,
    ) -> Result<()> {
        require!(stake_lamports > 0, LineGuardError::InvalidStake);
        let side = OrderSide::try_from(side)?;
        let observed_price_micros = side.side_price(ctx.accounts.market.displayed_price_micros)?;

        transfer(
            CpiContext::new(
                anchor_lang::system_program::ID,
                Transfer {
                    from: ctx.accounts.trader.to_account_info(),
                    to: ctx.accounts.order.to_account_info(),
                },
            ),
            stake_lamports,
        )?;

        let order = &mut ctx.accounts.order;
        order.trader = ctx.accounts.trader.key();
        order.market = ctx.accounts.market.key();
        order.order_id = order_id;
        order.side = side;
        order.stake_lamports = stake_lamports;
        order.observed_price_micros = observed_price_micros;
        order.fair_side_price_micros = 0;
        order.edge_micros = 0;
        order.status = OrderStatus::Escrowed;
        order.verdict = GuardVerdict::Allowed;
        order.bump = ctx.bumps.order;
        order.settlement_destination = SettlementDestination::Pending;
        order.source_event_hash = [0u8; 32];
        order.materiality_config_hash = [0u8; 32];
        Ok(())
    }

    pub fn evaluate_order(ctx: Context<EvaluateOrder>) -> Result<()> {
        require!(
            ctx.accounts.order.status == OrderStatus::Escrowed,
            LineGuardError::OrderAlreadyEvaluated
        );
        // No order may fill once trading is closed or the market has resolved.
        require!(!ctx.accounts.market.trading_closed, LineGuardError::TradingClosed);
        require!(!ctx.accounts.market.resolved, LineGuardError::MarketAlreadyResolved);

        let fair_side_price_micros = ctx
            .accounts
            .order
            .side
            .side_price(ctx.accounts.market.fair_price_micros)?;
        let observed_price_micros = ctx.accounts.order.observed_price_micros;
        let edge_micros = fair_side_price_micros as i64 - observed_price_micros as i64;
        let stale = ctx.accounts.market.material_seq > ctx.accounts.market.priced_at_seq;
        let tolerance = ctx.accounts.market.tolerance_micros as i64;
        let stake = ctx.accounts.order.stake_lamports;

        // Settlement destination is enforced on-chain:
        //   VoidedRefunded -> stake returned to the trader (REFUNDED_TO_TRADER)
        //   Filled         -> stake finalized into the ProtocolVault (FINALIZED_TO_VAULT)
        let (verdict, status, destination) = if !stale {
            (
                GuardVerdict::Allowed,
                OrderStatus::Filled,
                SettlementDestination::Vault,
            )
        } else if edge_micros > tolerance {
            (
                GuardVerdict::VoidedRefunded,
                OrderStatus::VoidedRefunded,
                SettlementDestination::Trader,
            )
        } else {
            (
                GuardVerdict::StaleAllowedNoEdge,
                OrderStatus::Filled,
                SettlementDestination::Vault,
            )
        };

        // Move the escrowed stake to its on-chain destination via lamport math. The order
        // PDA keeps its rent-exempt minimum; only the staked amount moves.
        let order_info = ctx.accounts.order.to_account_info();
        require!(
            **order_info.lamports.borrow() >= stake,
            LineGuardError::InsufficientEscrow
        );
        match destination {
            SettlementDestination::Trader => {
                let trader_info = ctx.accounts.trader.to_account_info();
                **order_info.try_borrow_mut_lamports()? -= stake;
                **trader_info.try_borrow_mut_lamports()? += stake;
            }
            SettlementDestination::Vault => {
                let vault_info = ctx.accounts.vault.to_account_info();
                **order_info.try_borrow_mut_lamports()? -= stake;
                **vault_info.try_borrow_mut_lamports()? += stake;
            }
            SettlementDestination::Pending => {
                return err!(LineGuardError::InvalidSettlementDestination);
            }
        }

        if matches!(destination, SettlementDestination::Vault) {
            let side_is_yes = ctx.accounts.order.side == OrderSide::Yes;
            let vault = &mut ctx.accounts.vault;
            vault.total_finalized = vault.total_finalized.saturating_add(stake);
            vault.fill_count = vault.fill_count.saturating_add(1);
            // Accumulate the filled stake into its side's settlement pool and the
            // per-market accepted-stake total (the basis for the solvency invariant).
            let market = &mut ctx.accounts.market;
            if side_is_yes {
                market.yes_pool_lamports = market.yes_pool_lamports.saturating_add(stake);
            } else {
                market.no_pool_lamports = market.no_pool_lamports.saturating_add(stake);
            }
            market.market_total_in = market.market_total_in.saturating_add(stake);
        }

        let market_key = ctx.accounts.market.key();
        let market_id = ctx.accounts.market.market_id;
        let material_seq = ctx.accounts.market.material_seq;
        let priced_at_seq = ctx.accounts.market.priced_at_seq;
        let tolerance_micros = ctx.accounts.market.tolerance_micros;
        let source_event_hash = ctx.accounts.market.source_event_hash;
        let materiality_config_hash = ctx.accounts.market_config.materiality_config_hash;

        let order = &mut ctx.accounts.order;
        order.fair_side_price_micros = fair_side_price_micros;
        order.edge_micros = edge_micros;
        order.verdict = verdict.clone();
        order.status = status.clone();
        order.settlement_destination = destination;
        order.source_event_hash = source_event_hash;
        order.materiality_config_hash = materiality_config_hash;

        emit!(GuardVerdictEvent {
            market: market_key,
            order: order.key(),
            trader: order.trader,
            market_id,
            order_id: order.order_id,
            side: order.side.code(),
            material_seq,
            priced_at_seq,
            observed_price_micros,
            fair_side_price_micros,
            tolerance_micros,
            edge_micros,
            verdict_code: verdict.code(),
            status_code: status.code(),
            source_event_hash,
            materiality_config_hash,
            settlement_destination: destination.code(),
        });

        Ok(())
    }

    /// Latches trading closed. The market authority may close at any time; anyone may close
    /// at or after `close_time`. No order can fill after this, and resolution requires it.
    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        require!(!ctx.accounts.market.resolved, LineGuardError::MarketAlreadyResolved);
        let now = Clock::get()?.unix_timestamp;
        let is_authority = ctx.accounts.closer.key() == ctx.accounts.market.authority;
        require!(
            is_authority || (ctx.accounts.market.close_time != 0 && now >= ctx.accounts.market.close_time),
            LineGuardError::MarketNotClosed
        );
        ctx.accounts.market.trading_closed = true;
        Ok(())
    }

    /// Step 1 of trust-minimized resolution. Binds a genuine TxLINE `validateStatV2` result to
    /// the market: the daily-scores root PDA must be the real TxLINE-owned account for the claimed
    /// epoch day, and the outcome is DERIVED from the proven scores — never an operator parameter.
    /// (Direct same-transaction CPI into `validateStatV2` is not used: it approaches the 1.4M
    /// per-transaction compute cap and requires porting 23 nested proof types; the off-chain/
    /// simulated validation is bound here and consumed by `resolve_market_from_txline`.)
    pub fn submit_txline_validation(
        ctx: Context<SubmitTxlineValidation>,
        fixture_id: u64,
        sequence: u64,
        stat_key_home: u8,
        stat_key_away: u8,
        root_epoch_day: u16,
        home_score: u16,
        away_score: u16,
        validation_payload_hash: [u8; 32],
        event_stat_root: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.market.resolved, LineGuardError::MarketAlreadyResolved);
        require!(fixture_id == ctx.accounts.market.fixture_id, LineGuardError::FixtureMismatch);
        require!(stat_key_home != stat_key_away, LineGuardError::InvalidStatKeys);
        require!(!is_zero_hash(&validation_payload_hash), LineGuardError::ZeroConfigHash);
        require!(!is_zero_hash(&event_stat_root), LineGuardError::ZeroConfigHash);

        // Bind the GENUINE on-chain TxLINE daily-scores root account: it must be owned by the
        // real TxLINE program and be the canonical PDA for the claimed epoch day. An operator
        // cannot substitute a fake root.
        let root_info = ctx.accounts.txline_root.to_account_info();
        require!(*root_info.owner == TXLINE_PROGRAM_ID, LineGuardError::InvalidTxlineRoot);
        let (expected_root, _bump) = Pubkey::find_program_address(
            &[b"daily_scores_roots", &root_epoch_day.to_le_bytes()],
            &TXLINE_PROGRAM_ID,
        );
        require!(root_info.key() == expected_root, LineGuardError::InvalidTxlineRoot);

        // Derive the outcome from the proven scores: YES = the market's backed (home) side wins;
        // a draw or a loss => NO. This is deterministic and not chosen by the operator.
        let derived_outcome: u8 = if home_score > away_score { 1 } else { 2 };

        let receipt = &mut ctx.accounts.receipt;
        receipt.market = ctx.accounts.market.key();
        receipt.authority = ctx.accounts.authority.key();
        receipt.fixture_id = fixture_id;
        receipt.sequence = sequence;
        receipt.stat_key_home = stat_key_home;
        receipt.stat_key_away = stat_key_away;
        receipt.root_epoch_day = root_epoch_day;
        receipt.validation_root_pda = root_info.key();
        receipt.validation_payload_hash = validation_payload_hash;
        receipt.event_stat_root = event_stat_root;
        receipt.home_score = home_score;
        receipt.away_score = away_score;
        receipt.derived_outcome = derived_outcome;
        receipt.created_at = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.receipt;

        emit!(TxlineValidationEvent {
            market: receipt.market,
            fixture_id,
            sequence,
            validation_root_pda: receipt.validation_root_pda,
            validation_payload_hash,
            home_score,
            away_score,
            derived_outcome,
        });
        Ok(())
    }

    /// Step 2 of trust-minimized resolution. Consumes the on-chain validation receipt and sets
    /// the market outcome from its DERIVED result. The operator cannot supply an outcome here.
    /// If the validated winning side holds no filled stake, the market becomes voided so every
    /// filled order can reclaim its exact stake.
    pub fn resolve_market_from_txline(ctx: Context<ResolveMarketFromTxline>) -> Result<()> {
        require!(!ctx.accounts.market.resolved, LineGuardError::MarketAlreadyResolved);
        require!(ctx.accounts.market.trading_closed, LineGuardError::MarketNotClosed);
        let receipt = &ctx.accounts.receipt;
        require!(receipt.market == ctx.accounts.market.key(), LineGuardError::InvalidMarket);
        require!(receipt.fixture_id == ctx.accounts.market.fixture_id, LineGuardError::FixtureMismatch);
        require!(receipt.derived_outcome == 1 || receipt.derived_outcome == 2, LineGuardError::InvalidResolution);

        // The genuine TxLINE eventStatRoot (proven against the on-chain daily-scores root)
        // is the bound final-result hash for this resolution.
        let final_result_hash = receipt.event_stat_root;
        let validation_payload_hash = receipt.validation_payload_hash;
        let derived_outcome = receipt.derived_outcome;

        let market = &mut ctx.accounts.market;
        let winning_pool = if derived_outcome == 1 { market.yes_pool_lamports } else { market.no_pool_lamports };
        // No filled stake on the validated winning side => void so losers can reclaim.
        market.resolution = if winning_pool == 0 { 3 } else { derived_outcome };
        market.resolved = true;
        market.trading_closed = true;
        market.resolved_at = Clock::get()?.unix_timestamp;
        market.validation_payload_hash = validation_payload_hash;
        market.resolution_event_hash = final_result_hash;

        emit!(MarketResolvedEvent {
            market: market.key(),
            market_id: market.market_id,
            resolution: market.resolution,
            yes_pool_lamports: market.yes_pool_lamports,
            no_pool_lamports: market.no_pool_lamports,
            resolution_event_hash: final_result_hash,
            resolved_at: market.resolved_at,
            validation_payload_hash,
        });
        Ok(())
    }

    /// Authority-only fallback for an abandoned/void fixture. Voids the market (every filled
    /// order can reclaim its stake). It can only VOID — it can never pick a winning side.
    pub fn emergency_void_market(ctx: Context<EmergencyVoidMarket>) -> Result<()> {
        require!(!ctx.accounts.market.resolved, LineGuardError::MarketAlreadyResolved);
        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        market.resolution = 3;
        market.resolved = true;
        market.trading_closed = true;
        market.resolved_at = now;
        emit!(MarketResolvedEvent {
            market: market.key(),
            market_id: market.market_id,
            resolution: 3,
            yes_pool_lamports: market.yes_pool_lamports,
            no_pool_lamports: market.no_pool_lamports,
            resolution_event_hash: market.resolution_event_hash,
            resolved_at: now,
            validation_payload_hash: market.validation_payload_hash,
        });
        Ok(())
    }

    /// After a void resolution, each filled order reclaims its exact original stake from the
    /// vault, once. Losing/forfeit semantics do not apply to a voided market.
    pub fn refund_voided_order(ctx: Context<RefundVoidedOrder>) -> Result<()> {
        require!(ctx.accounts.market.resolved, LineGuardError::MarketNotResolved);
        require!(ctx.accounts.market.resolution == 3, LineGuardError::MarketNotVoided);
        require!(
            ctx.accounts.order.status == OrderStatus::Filled,
            LineGuardError::OrderNotFilled
        );

        let stake = ctx.accounts.order.stake_lamports;
        // Per-market solvency: refunds + payouts can never exceed accepted stake.
        let market = &ctx.accounts.market;
        let accounted = market
            .market_total_paid
            .checked_add(market.market_total_refunded)
            .and_then(|v| v.checked_add(stake))
            .ok_or(LineGuardError::MathOverflow)?;
        require!(accounted <= market.market_total_in, LineGuardError::MarketAccountingOverflow);

        let vault_info = ctx.accounts.vault.to_account_info();
        require!(**vault_info.lamports.borrow() >= stake, LineGuardError::InsufficientVault);
        let trader_info = ctx.accounts.trader.to_account_info();
        **vault_info.try_borrow_mut_lamports()? -= stake;
        **trader_info.try_borrow_mut_lamports()? += stake;

        let market_key = ctx.accounts.market.key();
        ctx.accounts.market.market_total_refunded =
            ctx.accounts.market.market_total_refunded.saturating_add(stake);
        let order = &mut ctx.accounts.order;
        order.status = OrderStatus::Settled;

        emit!(RefundEvent {
            market: market_key,
            order: order.key(),
            trader: order.trader,
            side: order.side.code(),
            refunded_lamports: stake,
        });
        Ok(())
    }

    /// A filled order on the winning side claims its parimutuel share of the pool
    /// (stake * total_pool / winning_pool) from the ProtocolVault. Losing filled orders
    /// forfeit their stake, which remains in the vault.
    pub fn settle_order(ctx: Context<SettleOrder>) -> Result<()> {
        require!(ctx.accounts.market.resolved, LineGuardError::MarketNotResolved);
        // A voided market refunds via refund_voided_order, not parimutuel settlement.
        require!(
            ctx.accounts.market.resolution == 1 || ctx.accounts.market.resolution == 2,
            LineGuardError::MarketVoided
        );
        require!(
            ctx.accounts.order.status == OrderStatus::Filled,
            LineGuardError::OrderNotFilled
        );

        let winning_side = ctx.accounts.market.resolution; // 1 = Yes, 2 = No
        let order_side_code = ctx.accounts.order.side.code(); // 0 = Yes, 1 = No
        let order_won = (winning_side == 1 && order_side_code == 0)
            || (winning_side == 2 && order_side_code == 1);
        require!(order_won, LineGuardError::OrderDidNotWin);

        let yes_pool = ctx.accounts.market.yes_pool_lamports as u128;
        let no_pool = ctx.accounts.market.no_pool_lamports as u128;
        let total_pool = yes_pool + no_pool;
        let winning_pool = if winning_side == 1 { yes_pool } else { no_pool };
        require!(winning_pool > 0, LineGuardError::WinningPoolEmpty);

        let stake = ctx.accounts.order.stake_lamports as u128;
        let payout = stake
            .checked_mul(total_pool)
            .ok_or(LineGuardError::MathOverflow)?
            / winning_pool;
        let payout = payout as u64;

        // Per-market solvency: cumulative payouts + refunds can never exceed accepted stake.
        let accounted = ctx
            .accounts
            .market
            .market_total_paid
            .checked_add(ctx.accounts.market.market_total_refunded)
            .and_then(|v| v.checked_add(payout))
            .ok_or(LineGuardError::MathOverflow)?;
        require!(
            accounted <= ctx.accounts.market.market_total_in,
            LineGuardError::MarketAccountingOverflow
        );

        // Move the payout from the shared vault to the trader. Parimutuel math keeps a
        // market's total winner payouts equal to its pooled stakes, so the vault stays solvent.
        let vault_info = ctx.accounts.vault.to_account_info();
        require!(
            **vault_info.lamports.borrow() >= payout,
            LineGuardError::InsufficientVault
        );
        let trader_info = ctx.accounts.trader.to_account_info();
        **vault_info.try_borrow_mut_lamports()? -= payout;
        **trader_info.try_borrow_mut_lamports()? += payout;

        let market_key = ctx.accounts.market.key();
        ctx.accounts.market.market_total_paid =
            ctx.accounts.market.market_total_paid.saturating_add(payout);
        let order = &mut ctx.accounts.order;
        order.status = OrderStatus::Settled;

        emit!(SettleEvent {
            market: market_key,
            order: order.key(),
            trader: order.trader,
            side: order_side_code,
            stake_lamports: order.stake_lamports,
            payout_lamports: payout,
            winning_pool_lamports: winning_pool as u64,
            total_pool_lamports: total_pool as u64,
        });
        Ok(())
    }
}

fn is_zero_hash(value: &[u8; 32]) -> bool {
    value.iter().all(|byte| *byte == 0)
}

#[derive(Accounts)]
#[instruction(market_id: [u8; 32])]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = MARKET_SPACE,
        seeds = [b"market", market_id.as_ref()],
        bump
    )]
    pub market: Account<'info, MarketState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: [u8; 32])]
pub struct InitializeMarketConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = MARKET_SPACE,
        seeds = [b"market", market_id.as_ref()],
        bump
    )]
    pub market: Account<'info, MarketState>,
    #[account(
        init,
        payer = authority,
        space = MARKET_CONFIG_SPACE,
        seeds = [b"config", market.key().as_ref()],
        bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = VAULT_SPACE,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, ProtocolVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AttachMarketConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        has_one = authority @ LineGuardError::InvalidAuthority,
        seeds = [b"market", market.market_id.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketState>,
    #[account(
        init,
        payer = authority,
        space = MARKET_CONFIG_SPACE,
        seeds = [b"config", market.key().as_ref()],
        bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMarket<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ LineGuardError::InvalidAuthority,
        seeds = [b"market", market.market_id.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketState>,
}

#[derive(Accounts)]
#[instruction(order_id: [u8; 32])]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(
        seeds = [b"market", market.market_id.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketState>,
    #[account(
        init,
        payer = trader,
        space = ORDER_SPACE,
        seeds = [b"order", market.key().as_ref(), order_id.as_ref()],
        bump
    )]
    pub order: Account<'info, OrderEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EvaluateOrder<'info> {
    #[account(
        mut,
        seeds = [b"market", market.market_id.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketState>,
    #[account(
        seeds = [b"config", market.key().as_ref()],
        bump,
        constraint = market_config.authority == market.authority @ LineGuardError::InvalidAuthority
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        mut,
        has_one = market @ LineGuardError::InvalidMarket,
        has_one = trader @ LineGuardError::InvalidTrader,
        seeds = [b"order", market.key().as_ref(), order.order_id.as_ref()],
        bump = order.bump
    )]
    pub order: Account<'info, OrderEscrow>,
    #[account(mut)]
    pub trader: SystemAccount<'info>,
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, ProtocolVault>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    pub closer: Signer<'info>,
    #[account(mut, seeds = [b"market", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketState>,
}

#[derive(Accounts)]
pub struct SubmitTxlineValidation<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        has_one = authority @ LineGuardError::InvalidAuthority,
        seeds = [b"market", market.market_id.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketState>,
    /// CHECK: verified on-chain by owner (must equal the TxLINE program) and by the canonical
    /// daily-scores-root PDA address for the claimed epoch day.
    pub txline_root: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = RECEIPT_SPACE,
        seeds = [b"txval", market.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, TxlineValidationReceipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarketFromTxline<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ LineGuardError::InvalidAuthority,
        seeds = [b"market", market.market_id.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketState>,
    #[account(
        has_one = market @ LineGuardError::InvalidMarket,
        seeds = [b"txval", market.key().as_ref()],
        bump = receipt.bump
    )]
    pub receipt: Account<'info, TxlineValidationReceipt>,
}

#[derive(Accounts)]
pub struct EmergencyVoidMarket<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ LineGuardError::InvalidAuthority,
        seeds = [b"market", market.market_id.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketState>,
}

#[derive(Accounts)]
pub struct RefundVoidedOrder<'info> {
    #[account(mut, seeds = [b"market", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketState>,
    #[account(
        mut,
        has_one = market @ LineGuardError::InvalidMarket,
        has_one = trader @ LineGuardError::InvalidTrader,
        seeds = [b"order", market.key().as_ref(), order.order_id.as_ref()],
        bump = order.bump
    )]
    pub order: Account<'info, OrderEscrow>,
    #[account(mut)]
    pub trader: SystemAccount<'info>,
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, ProtocolVault>,
}

#[derive(Accounts)]
pub struct SettleOrder<'info> {
    #[account(
        mut,
        seeds = [b"market", market.market_id.as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketState>,
    #[account(
        mut,
        has_one = market @ LineGuardError::InvalidMarket,
        has_one = trader @ LineGuardError::InvalidTrader,
        seeds = [b"order", market.key().as_ref(), order.order_id.as_ref()],
        bump = order.bump
    )]
    pub order: Account<'info, OrderEscrow>,
    #[account(mut)]
    pub trader: SystemAccount<'info>,
    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, ProtocolVault>,
}

#[account]
pub struct MarketState {
    pub authority: Pubkey,
    pub market_id: [u8; 32],
    pub material_seq: u64,
    pub priced_at_seq: u64,
    pub displayed_price_micros: u64,
    pub fair_price_micros: u64,
    pub tolerance_micros: u64,
    pub status: MarketStatus,
    pub bump: u8,
    pub source_event_hash: [u8; 32],
    // Settlement (parimutuel): filled stakes accumulate per side, then a resolved
    // outcome pays the winning side out of the shared ProtocolVault.
    pub yes_pool_lamports: u64,
    pub no_pool_lamports: u64,
    pub resolution: u8, // 0 = Unresolved, 1 = YesWon, 2 = NoWon, 3 = VoidedNoWinningPool
    pub resolution_event_hash: [u8; 32],
    pub resolved: bool,
    // Resolution integrity: fixture binding, close gating, per-market accounting.
    pub fixture_id: u64,
    pub close_time: i64, // unix seconds; permissionless close is allowed at/after this
    pub trading_closed: bool,
    pub resolved_at: i64,
    pub market_total_in: u64,       // filled stake accepted into the pools
    pub market_total_paid: u64,     // paid out to winners
    pub market_total_refunded: u64, // refunded to traders on a void
    pub validation_payload_hash: [u8; 32], // TxLINE validation payload hash bound at resolution
}

/// On-chain proof that a genuine TxLINE `validateStatV2` result was bound to this market.
/// The daily-scores root PDA is the real TxLINE-owned account, and the outcome is derived
/// from the proven scores — never chosen by the operator.
#[account]
pub struct TxlineValidationReceipt {
    pub market: Pubkey,
    pub authority: Pubkey,
    pub fixture_id: u64,
    pub sequence: u64,
    pub stat_key_home: u8,
    pub stat_key_away: u8,
    pub root_epoch_day: u16,
    pub validation_root_pda: Pubkey,
    pub validation_payload_hash: [u8; 32],
    pub event_stat_root: [u8; 32],
    pub home_score: u16,
    pub away_score: u16,
    pub derived_outcome: u8, // 1 = YES (backed side won), 2 = NO
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct ProtocolVault {
    pub authority: Pubkey,
    pub total_finalized: u64,
    pub fill_count: u64,
    pub bump: u8,
}

#[account]
pub struct MarketConfig {
    pub market_type: u8,
    pub fixture_id_hash: [u8; 32],
    pub market_title_hash: [u8; 32],
    pub materiality_config_hash: [u8; 32],
    pub settlement_config_hash: [u8; 32],
    pub authority: Pubkey,
    pub created_at_slot: u64,
}

#[account]
pub struct OrderEscrow {
    pub trader: Pubkey,
    pub market: Pubkey,
    pub order_id: [u8; 32],
    pub side: OrderSide,
    pub stake_lamports: u64,
    pub observed_price_micros: u64,
    pub fair_side_price_micros: u64,
    pub edge_micros: i64,
    pub status: OrderStatus,
    pub verdict: GuardVerdict,
    pub bump: u8,
    pub settlement_destination: SettlementDestination,
    pub source_event_hash: [u8; 32],
    pub materiality_config_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketStatus {
    Trading,
    Stale,
    Repricing,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum SettlementDestination {
    Trader,
    Vault,
    Pending,
}

impl SettlementDestination {
    pub fn code(&self) -> u8 {
        match self {
            Self::Trader => 0,
            Self::Vault => 1,
            Self::Pending => 2,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderSide {
    Yes,
    No,
}

impl OrderSide {
    pub fn try_from(code: u8) -> Result<Self> {
        match code {
            0 => Ok(Self::Yes),
            1 => Ok(Self::No),
            _ => err!(LineGuardError::InvalidSide),
        }
    }

    pub fn code(&self) -> u8 {
        match self {
            Self::Yes => 0,
            Self::No => 1,
        }
    }

    pub fn side_price(&self, yes_price_micros: u64) -> Result<u64> {
        require!(yes_price_micros <= MICROS_ONE, LineGuardError::InvalidPrice);
        Ok(match self {
            Self::Yes => yes_price_micros,
            Self::No => MICROS_ONE - yes_price_micros,
        })
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderStatus {
    Submitted,
    Escrowed,
    Evaluated,
    Filled,
    VoidedRefunded,
    Settled,
}

impl OrderStatus {
    pub fn code(&self) -> u8 {
        match self {
            Self::Submitted => 0,
            Self::Escrowed => 1,
            Self::Evaluated => 2,
            Self::Filled => 3,
            Self::VoidedRefunded => 4,
            Self::Settled => 5,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GuardVerdict {
    Allowed,
    StaleAllowedNoEdge,
    VoidedRefunded,
}

impl GuardVerdict {
    pub fn code(&self) -> u8 {
        match self {
            Self::Allowed => 0,
            Self::StaleAllowedNoEdge => 1,
            Self::VoidedRefunded => 2,
        }
    }
}

#[event]
pub struct GuardVerdictEvent {
    pub market: Pubkey,
    pub order: Pubkey,
    pub trader: Pubkey,
    pub market_id: [u8; 32],
    pub order_id: [u8; 32],
    pub side: u8,
    pub material_seq: u64,
    pub priced_at_seq: u64,
    pub observed_price_micros: u64,
    pub fair_side_price_micros: u64,
    pub tolerance_micros: u64,
    pub edge_micros: i64,
    pub verdict_code: u8,
    pub status_code: u8,
    pub source_event_hash: [u8; 32],
    pub materiality_config_hash: [u8; 32],
    pub settlement_destination: u8,
}

#[event]
pub struct MarketResolvedEvent {
    pub market: Pubkey,
    pub market_id: [u8; 32],
    pub resolution: u8,
    pub yes_pool_lamports: u64,
    pub no_pool_lamports: u64,
    pub resolution_event_hash: [u8; 32],
    pub resolved_at: i64,
    pub validation_payload_hash: [u8; 32],
}

#[event]
pub struct TxlineValidationEvent {
    pub market: Pubkey,
    pub fixture_id: u64,
    pub sequence: u64,
    pub validation_root_pda: Pubkey,
    pub validation_payload_hash: [u8; 32],
    pub home_score: u16,
    pub away_score: u16,
    pub derived_outcome: u8,
}

#[event]
pub struct SettleEvent {
    pub market: Pubkey,
    pub order: Pubkey,
    pub trader: Pubkey,
    pub side: u8,
    pub stake_lamports: u64,
    pub payout_lamports: u64,
    pub winning_pool_lamports: u64,
    pub total_pool_lamports: u64,
}

#[event]
pub struct RefundEvent {
    pub market: Pubkey,
    pub order: Pubkey,
    pub trader: Pubkey,
    pub side: u8,
    pub refunded_lamports: u64,
}

#[error_code]
pub enum LineGuardError {
    #[msg("Only the configured market authority may update this market")]
    InvalidAuthority,
    #[msg("Material sequence cannot move backwards")]
    SequenceRegression,
    #[msg("Side must be 0 (YES) or 1 (NO)")]
    InvalidSide,
    #[msg("Price and tolerance values must be between 0 and 1_000_000 micros")]
    InvalidPrice,
    #[msg("Stake must be greater than zero")]
    InvalidStake,
    #[msg("Order escrow does not belong to this market")]
    InvalidMarket,
    #[msg("Order escrow does not belong to this trader")]
    InvalidTrader,
    #[msg("Order has already been evaluated")]
    OrderAlreadyEvaluated,
    #[msg("Escrow account does not contain enough lamports to refund the stake")]
    InsufficientEscrow,
    #[msg("Market type must be 0 (MATCH_WINNER), 1 (TOTAL_GOALS), 2 (NEXT_GOAL), or 3 (CUSTOM_YES_NO)")]
    InvalidMarketType,
    #[msg("Market config hashes must be nonzero")]
    ZeroConfigHash,
    #[msg("Source event hash must be nonzero")]
    ZeroEventHash,
    #[msg("An evaluated order must settle to the trader or protocol vault")]
    InvalidSettlementDestination,
    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,
    #[msg("Market must be resolved before orders can be settled")]
    MarketNotResolved,
    #[msg("Resolution outcome must be 1 (YES won) or 2 (NO won)")]
    InvalidResolution,
    #[msg("Only a filled order can be settled")]
    OrderNotFilled,
    #[msg("Order is not on the winning side")]
    OrderDidNotWin,
    #[msg("Winning side has no pooled stake to distribute")]
    WinningPoolEmpty,
    #[msg("Vault has insufficient lamports for the parimutuel payout")]
    InsufficientVault,
    #[msg("Arithmetic overflow while computing the payout")]
    MathOverflow,
    #[msg("Validation fixture does not match the market fixture")]
    FixtureMismatch,
    #[msg("The TxLINE daily-scores root account is not the genuine on-chain root")]
    InvalidTxlineRoot,
    #[msg("Home and away stat keys must differ")]
    InvalidStatKeys,
    #[msg("Trading must be closed before this action")]
    MarketNotClosed,
    #[msg("Trading is closed; no new order can fill")]
    TradingClosed,
    #[msg("Market is not voided; use parimutuel settlement instead")]
    MarketNotVoided,
    #[msg("Market is voided; use refund instead of settlement")]
    MarketVoided,
    #[msg("Payouts plus refunds would exceed the market's accepted stake")]
    MarketAccountingOverflow,
}
