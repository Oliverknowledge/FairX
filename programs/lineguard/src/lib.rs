use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{get_return_data, invoke},
};
use anchor_lang::system_program::{transfer, Transfer};
use solana_sha256_hasher::hash;

declare_id!("6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe");

const MICROS_ONE: u64 = 1_000_000;
const MATCH_WINNER_HOME: u8 = 0;
const MATCH_WINNER_HOME_V1: u16 = 1;
const PRICING_MODEL_VERSION_V1: u16 = 1;
const AUTHORITY_TIMELOCK_SECONDS: i64 = 86_400;
const TXLINE_VALIDATE_STAT_V2_DISCRIMINATOR: [u8; 8] = [208, 215, 194, 214, 241, 71, 246, 178];
const MAX_SCORE: u16 = 99;
// Controlled devnet bootstrap authority. This prevents a third party from claiming the
// one-time authorities-v2 PDA in the verification window after the program upgrade.
const BOOTSTRAP_ADMIN_ID: Pubkey = Pubkey::new_from_array([
    198, 44, 96, 106, 50, 224, 149, 244, 185, 210, 223, 241, 133, 36, 164, 188, 116, 203, 42, 163,
    48, 49, 80, 148, 59, 202, 6, 143, 18, 31, 132, 8,
]);
// The official TxLINE (TxOdds) devnet oracle program. The genuine on-chain daily-scores
// root PDA is owned by this program; resolution binds submitted scores to that root identity.
// 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J (base58) as its raw 32-byte pubkey.
const TXLINE_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    86, 117, 159, 44, 144, 95, 120, 96, 200, 99, 119, 20, 191, 36, 145, 48, 157, 192, 113, 129, 81,
    63, 122, 36, 191, 62, 218, 248, 127, 119, 80, 3,
]);
// MarketState grew by 32 bytes (source_event_hash), then by 50 bytes for the settlement
// fields, then by 81 bytes for the resolution-integrity fields (fixture_id, close_time,
// trading_closed, resolved_at, per-market accounting, validation_payload_hash) at the end.
// Additive: existing accounts keep their layout; only newly-initialized markets allocate
// the larger size, and the new program only ever loads freshly-initialized markets.
const MARKET_SPACE: usize = 8
    + 32
    + 32
    + 8
    + 8
    + 8
    + 8
    + 8
    + 1
    + 1
    + 32
    + 8
    + 8
    + 1
    + 32
    + 1
    + 8
    + 8
    + 1
    + 8
    + 8
    + 8
    + 8
    + 32;
// TxlineValidationReceipt: market, authority, fixture id + commitment, sequence, stat keys,
// rule, epoch day, root PDA, payload/event hashes, scores/outcome, lifecycle fields, bump.
const RECEIPT_SPACE: usize =
    8 + 32 + 32 + 8 + 32 + 8 + 2 + 2 + 1 + 2 + 32 + 32 + 32 + 2 + 2 + 1 + 1 + 8 + 8 + 1;
// MarketConfig: existing commitments plus machine-readable resolution semantics.
const MARKET_CONFIG_SPACE: usize = 8 + 1 + 32 + 32 + 32 + 32 + 32 + 8 + 1 + 2 + 2 + 32 + 32;
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
        resolution_rule: u8,
        home_stat_key: u16,
        away_stat_key: u16,
        home_team_hash: [u8; 32],
        away_team_hash: [u8; 32],
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
        require!(
            market_type == MATCH_WINNER_HOME,
            LineGuardError::UnsupportedSettlementMarketType
        );
        ResolutionRule::try_from(resolution_rule)?;
        require!(
            home_stat_key != away_stat_key,
            LineGuardError::InvalidStatKeys
        );
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
        require!(
            !is_zero_hash(&home_team_hash),
            LineGuardError::ZeroConfigHash
        );
        require!(
            !is_zero_hash(&away_team_hash),
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
        config.resolution_rule = resolution_rule;
        config.home_stat_key = home_stat_key;
        config.away_stat_key = away_stat_key;
        config.home_team_hash = home_team_hash;
        config.away_team_hash = away_team_hash;
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
        resolution_rule: u8,
        home_stat_key: u16,
        away_stat_key: u16,
        home_team_hash: [u8; 32],
        away_team_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            market_type == MATCH_WINNER_HOME,
            LineGuardError::UnsupportedSettlementMarketType
        );
        ResolutionRule::try_from(resolution_rule)?;
        require!(
            home_stat_key != away_stat_key,
            LineGuardError::InvalidStatKeys
        );
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
        require!(
            !is_zero_hash(&home_team_hash),
            LineGuardError::ZeroConfigHash
        );
        require!(
            !is_zero_hash(&away_team_hash),
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
        config.resolution_rule = resolution_rule;
        config.home_stat_key = home_stat_key;
        config.away_stat_key = away_stat_key;
        config.home_team_hash = home_team_hash;
        config.away_team_hash = away_team_hash;
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
        require!(
            !ctx.accounts.market.trading_closed,
            LineGuardError::TradingClosed
        );
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );

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
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );
        let now = Clock::get()?.unix_timestamp;
        let is_authority = ctx.accounts.closer.key() == ctx.accounts.market.authority;
        require!(
            is_authority
                || (ctx.accounts.market.close_time != 0 && now >= ctx.accounts.market.close_time),
            LineGuardError::MarketNotClosed
        );
        ctx.accounts.market.trading_closed = true;
        Ok(())
    }

    /// Stores or replaces an unconfirmed validation draft. Scores remain operator-submitted;
    /// `validateStatV2` proof validation happens separately. This instruction binds the draft to
    /// a genuine TxLINE-owned root account and derives the outcome from committed market rules.
    pub fn submit_txline_validation(
        ctx: Context<SubmitTxlineValidation>,
        fixture_id: u64,
        sequence: u64,
        root_epoch_day: u16,
        home_score: u16,
        away_score: u16,
        validation_payload_hash: [u8; 32],
        event_stat_root: [u8; 32],
    ) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );
        require!(
            ctx.accounts.market.trading_closed,
            LineGuardError::MarketNotClosed
        );
        require!(
            fixture_id == ctx.accounts.market.fixture_id,
            LineGuardError::FixtureMismatch
        );
        let config = &ctx.accounts.market_config;
        require!(
            config.market_type == MATCH_WINNER_HOME,
            LineGuardError::UnsupportedSettlementMarketType
        );
        let rule = ResolutionRule::try_from(config.resolution_rule)?;
        require!(
            !is_zero_hash(&config.fixture_id_hash),
            LineGuardError::FixtureCommitmentMismatch
        );
        require!(
            config.home_stat_key != config.away_stat_key,
            LineGuardError::InvalidStatKeys
        );
        require!(
            home_score <= MAX_SCORE && away_score <= MAX_SCORE,
            LineGuardError::InvalidScore
        );
        require!(
            !is_zero_hash(&validation_payload_hash),
            LineGuardError::ZeroValidationPayloadHash
        );
        require!(
            !is_zero_hash(&event_stat_root),
            LineGuardError::ZeroConfigHash
        );

        // Bind the GENUINE on-chain TxLINE daily-scores root account: it must be owned by the
        // real TxLINE program and be the canonical PDA for the claimed epoch day. An operator
        // cannot substitute a fake root.
        let root_info = ctx.accounts.txline_root.to_account_info();
        require!(
            *root_info.owner == TXLINE_PROGRAM_ID,
            LineGuardError::InvalidTxlineRoot
        );
        let (expected_root, _bump) = Pubkey::find_program_address(
            &[b"daily_scores_roots", &root_epoch_day.to_le_bytes()],
            &TXLINE_PROGRAM_ID,
        );
        require!(
            root_info.key() == expected_root,
            LineGuardError::InvalidTxlineRoot
        );

        let derived_outcome = rule.derive(home_score, away_score);

        let receipt = &mut ctx.accounts.receipt;
        require!(
            !receipt.confirmed,
            LineGuardError::ValidationAlreadyConfirmed
        );
        if receipt.market != Pubkey::default() {
            require!(
                receipt.market == ctx.accounts.market.key(),
                LineGuardError::InvalidMarket
            );
            require!(
                receipt.authority == ctx.accounts.authority.key(),
                LineGuardError::InvalidAuthority
            );
        }
        receipt.market = ctx.accounts.market.key();
        receipt.authority = ctx.accounts.authority.key();
        receipt.fixture_id = fixture_id;
        receipt.fixture_id_hash = config.fixture_id_hash;
        receipt.sequence = sequence;
        receipt.home_stat_key = config.home_stat_key;
        receipt.away_stat_key = config.away_stat_key;
        receipt.resolution_rule = config.resolution_rule;
        receipt.root_epoch_day = root_epoch_day;
        receipt.validation_root_pda = root_info.key();
        receipt.validation_payload_hash = validation_payload_hash;
        receipt.event_stat_root = event_stat_root;
        receipt.home_score = home_score;
        receipt.away_score = away_score;
        receipt.derived_outcome = derived_outcome;
        receipt.confirmed = false;
        receipt.updated_at = Clock::get()?.unix_timestamp;
        receipt.confirmed_at = 0;
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

    /// Freezes a validation draft. Only confirmed receipts may resolve a market.
    pub fn confirm_validation(ctx: Context<ConfirmValidation>) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );
        require!(
            ctx.accounts.market.trading_closed,
            LineGuardError::MarketNotClosed
        );
        let receipt = &mut ctx.accounts.receipt;
        require!(
            !receipt.confirmed,
            LineGuardError::ValidationAlreadyConfirmed
        );
        verify_receipt_against_config(
            receipt,
            ctx.accounts.market.key(),
            &ctx.accounts.market,
            &ctx.accounts.market_config,
        )?;
        receipt.confirmed = true;
        receipt.confirmed_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Consumes a confirmed receipt and sets the market outcome from its derived result.
    /// If the validated winning side holds no filled stake, the market becomes voided so every
    /// filled order can reclaim its exact stake.
    pub fn resolve_market_from_txline(ctx: Context<ResolveMarketFromTxline>) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );
        require!(
            ctx.accounts.market.trading_closed,
            LineGuardError::MarketNotClosed
        );
        let receipt = &ctx.accounts.receipt;
        require!(receipt.confirmed, LineGuardError::ValidationNotConfirmed);
        verify_receipt_against_config(
            receipt,
            ctx.accounts.market.key(),
            &ctx.accounts.market,
            &ctx.accounts.market_config,
        )?;

        // The genuine TxLINE eventStatRoot (proven against the on-chain daily-scores root)
        // is the bound final-result hash for this resolution.
        let final_result_hash = receipt.event_stat_root;
        let validation_payload_hash = receipt.validation_payload_hash;
        let derived_outcome = receipt.derived_outcome;

        let market = &mut ctx.accounts.market;
        let winning_pool = match derived_outcome {
            1 => market.yes_pool_lamports,
            2 => market.no_pool_lamports,
            3 => 0,
            _ => return err!(LineGuardError::InvalidResolution),
        };
        // A draw, or no filled stake on the derived winning side, voids safely.
        market.resolution = if derived_outcome == 3 || winning_pool == 0 {
            3
        } else {
            derived_outcome
        };
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
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );
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
        require!(
            ctx.accounts.market.resolved,
            LineGuardError::MarketNotResolved
        );
        require!(
            ctx.accounts.market.resolution == 3,
            LineGuardError::MarketNotVoided
        );
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
        require!(
            accounted <= market.market_total_in,
            LineGuardError::MarketAccountingOverflow
        );

        let vault_info = ctx.accounts.vault.to_account_info();
        require!(
            **vault_info.lamports.borrow() >= stake,
            LineGuardError::InsufficientVault
        );
        let trader_info = ctx.accounts.trader.to_account_info();
        **vault_info.try_borrow_mut_lamports()? -= stake;
        **trader_info.try_borrow_mut_lamports()? += stake;

        let market_key = ctx.accounts.market.key();
        ctx.accounts.market.market_total_refunded = ctx
            .accounts
            .market
            .market_total_refunded
            .saturating_add(stake);
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
        require!(
            ctx.accounts.market.resolved,
            LineGuardError::MarketNotResolved
        );
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

    // ---------------------------------------------------------------------
    // Isolated v2 devnet market path. These accounts use new discriminators
    // and PDA seeds so the legacy canonical evidence above remains readable.

    pub fn initialize_authorities(
        ctx: Context<InitializeAuthorities>,
        feed_authority: Pubkey,
        pricing_authority: Pubkey,
        resolution_authorities: [Pubkey; 3],
        emergency_authority: Pubkey,
        threshold: u8,
    ) -> Result<()> {
        validate_authority_set(
            feed_authority,
            pricing_authority,
            &resolution_authorities,
            emergency_authority,
            threshold,
        )?;
        let config = &mut ctx.accounts.authority_config;
        config.admin = ctx.accounts.admin.key();
        config.feed_authority = feed_authority;
        config.pricing_authority = pricing_authority;
        config.resolution_authorities = resolution_authorities;
        config.emergency_authority = emergency_authority;
        config.threshold = threshold;
        config.pending = false;
        config.pending_feed_authority = Pubkey::default();
        config.pending_pricing_authority = Pubkey::default();
        config.pending_resolution_authorities = [Pubkey::default(); 3];
        config.pending_emergency_authority = Pubkey::default();
        config.pending_threshold = 0;
        config.execute_after = 0;
        config.bump = ctx.bumps.authority_config;
        Ok(())
    }

    pub fn propose_authority_update(
        ctx: Context<ProposeAuthorityUpdate>,
        feed_authority: Pubkey,
        pricing_authority: Pubkey,
        resolution_authorities: [Pubkey; 3],
        emergency_authority: Pubkey,
        threshold: u8,
    ) -> Result<()> {
        validate_authority_set(
            feed_authority,
            pricing_authority,
            &resolution_authorities,
            emergency_authority,
            threshold,
        )?;
        let config = &mut ctx.accounts.authority_config;
        let now = Clock::get()?.unix_timestamp;
        config.pending = true;
        config.pending_feed_authority = feed_authority;
        config.pending_pricing_authority = pricing_authority;
        config.pending_resolution_authorities = resolution_authorities;
        config.pending_emergency_authority = emergency_authority;
        config.pending_threshold = threshold;
        config.execute_after = now
            .checked_add(AUTHORITY_TIMELOCK_SECONDS)
            .ok_or(LineGuardError::MathOverflow)?;
        emit!(AuthorityUpdateProposedEvent {
            authority_config: config.key(),
            execute_after: config.execute_after,
        });
        Ok(())
    }

    pub fn execute_authority_update(ctx: Context<ExecuteAuthorityUpdate>) -> Result<()> {
        let config = &mut ctx.accounts.authority_config;
        require!(config.pending, LineGuardError::NoPendingAuthorityUpdate);
        require!(
            Clock::get()?.unix_timestamp >= config.execute_after,
            LineGuardError::AuthorityTimelockActive
        );
        config.feed_authority = config.pending_feed_authority;
        config.pricing_authority = config.pending_pricing_authority;
        config.resolution_authorities = config.pending_resolution_authorities;
        config.emergency_authority = config.pending_emergency_authority;
        config.threshold = config.pending_threshold;
        config.pending = false;
        emit!(AuthorityUpdateExecutedEvent {
            authority_config: config.key(),
            feed_authority: config.feed_authority,
            pricing_authority: config.pricing_authority,
            emergency_authority: config.emergency_authority,
            threshold: config.threshold,
        });
        Ok(())
    }

    pub fn initialize_market_v2(
        ctx: Context<InitializeMarketV2>,
        args: InitializeMarketV2Args,
    ) -> Result<()> {
        require!(
            args.template_id == MATCH_WINNER_HOME_V1,
            LineGuardError::UnsupportedTemplate
        );
        require!(
            args.resolution_rule == 0,
            LineGuardError::InvalidResolutionRule
        );
        require!(args.fixture_id > 0, LineGuardError::FixtureMismatch);
        require!(
            args.home_stat_key != args.away_stat_key,
            LineGuardError::InvalidStatKeys
        );
        require!(
            args.close_time > Clock::get()?.unix_timestamp,
            LineGuardError::InvalidCloseTime
        );
        require!(
            args.displayed_price_micros > 0 && args.displayed_price_micros < MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(
            args.fair_price_micros > 0 && args.fair_price_micros < MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(
            args.tolerance_micros <= MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(
            args.priced_at_seq <= args.material_seq,
            LineGuardError::SequenceRegression
        );
        require!(
            args.pricing_model_version == PRICING_MODEL_VERSION_V1,
            LineGuardError::UnsupportedPricingModel
        );
        for hash in [
            &args.fixture_id_hash,
            &args.home_team_hash,
            &args.away_team_hash,
            &args.materiality_config_hash,
            &args.pricing_config_hash,
            &args.pricing_model_hash,
            &args.odds_payload_hash,
        ] {
            require!(!is_zero_hash(hash), LineGuardError::ZeroConfigHash);
        }

        let market = &mut ctx.accounts.market;
        market.authority_config = ctx.accounts.authority_config.key();
        market.market_id = args.market_id;
        market.fixture_id = args.fixture_id;
        market.template_id = args.template_id;
        market.fixture_id_hash = args.fixture_id_hash;
        market.home_team_hash = args.home_team_hash;
        market.away_team_hash = args.away_team_hash;
        market.home_stat_key = args.home_stat_key;
        market.away_stat_key = args.away_stat_key;
        market.resolution_rule = args.resolution_rule;
        market.materiality_config_hash = args.materiality_config_hash;
        market.pricing_config_hash = args.pricing_config_hash;
        market.pricing_model_hash = args.pricing_model_hash;
        market.pricing_model_version = args.pricing_model_version;
        market.odds_payload_hash = args.odds_payload_hash;
        market.odds_sequence = args.odds_sequence;
        market.material_seq = args.material_seq;
        market.priced_at_seq = args.priced_at_seq;
        market.displayed_price_micros = args.displayed_price_micros;
        market.fair_price_micros = args.fair_price_micros;
        market.tolerance_micros = args.tolerance_micros;
        market.source_event_hash = [0u8; 32];
        market.close_time = args.close_time;
        market.claim_deadline = args.claim_deadline;
        market.yes_pool_lamports = 0;
        market.no_pool_lamports = 0;
        market.claimed_winning_lamports = 0;
        market.resolution = 0;
        market.trading_closed = false;
        market.resolved = false;
        market.resolved_at = 0;
        market.validation_payload_hash = [0u8; 32];
        market.resolution_event_hash = [0u8; 32];
        market.bump = ctx.bumps.market;

        let vault = &mut ctx.accounts.market_vault;
        vault.market = market.key();
        vault.total_deposited = 0;
        vault.total_refunded = 0;
        vault.total_accepted = 0;
        vault.total_paid = 0;
        vault.total_claimable = 0;
        vault.rounding_dust = 0;
        vault.bump = ctx.bumps.market_vault;

        emit!(MarketV2InitializedEvent {
            market: market.key(),
            market_vault: vault.key(),
            fixture_id: market.fixture_id,
            template_id: market.template_id,
            odds_payload_hash: market.odds_payload_hash,
        });
        Ok(())
    }

    pub fn ingest_material_event_v2(
        ctx: Context<FeedUpdateV2>,
        new_material_seq: u64,
        source_event_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.feed_authority.key() == ctx.accounts.authority_config.feed_authority,
            LineGuardError::InvalidFeedAuthority
        );
        require!(
            !is_zero_hash(&source_event_hash),
            LineGuardError::ZeroEventHash
        );
        require!(
            new_material_seq > ctx.accounts.market.material_seq,
            LineGuardError::SequenceRegression
        );
        require!(
            !ctx.accounts.market.trading_closed && !ctx.accounts.market.resolved,
            LineGuardError::TradingClosed
        );
        ctx.accounts.market.material_seq = new_material_seq;
        ctx.accounts.market.source_event_hash = source_event_hash;
        Ok(())
    }

    pub fn commit_txline_odds_v2(
        ctx: Context<PricingUpdateV2>,
        odds_sequence: u64,
        fair_price_micros: u64,
        odds_payload_hash: [u8; 32],
        pricing_model_version: u16,
        pricing_model_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.pricing_authority.key() == ctx.accounts.authority_config.pricing_authority,
            LineGuardError::InvalidPricingAuthority
        );
        require!(
            !ctx.accounts.market.trading_closed && !ctx.accounts.market.resolved,
            LineGuardError::TradingClosed
        );
        require!(
            odds_sequence > ctx.accounts.market.odds_sequence,
            LineGuardError::OddsSequenceRegression
        );
        require!(
            fair_price_micros > 0 && fair_price_micros < MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(
            !is_zero_hash(&odds_payload_hash),
            LineGuardError::ZeroOddsPayloadHash
        );
        require!(
            pricing_model_version == ctx.accounts.market.pricing_model_version,
            LineGuardError::UnsupportedPricingModel
        );
        require!(
            pricing_model_hash == ctx.accounts.market.pricing_model_hash,
            LineGuardError::PricingModelMismatch
        );
        let market = &mut ctx.accounts.market;
        market.odds_sequence = odds_sequence;
        market.odds_payload_hash = odds_payload_hash;
        market.fair_price_micros = fair_price_micros;
        emit!(OddsPriceCommittedEvent {
            market: market.key(),
            odds_sequence,
            odds_payload_hash,
            pricing_model_hash,
            fair_price_micros,
        });
        Ok(())
    }

    pub fn reprice_market_v2(ctx: Context<PricingUpdateV2>) -> Result<()> {
        require!(
            ctx.accounts.pricing_authority.key() == ctx.accounts.authority_config.pricing_authority,
            LineGuardError::InvalidPricingAuthority
        );
        require!(
            !ctx.accounts.market.trading_closed && !ctx.accounts.market.resolved,
            LineGuardError::TradingClosed
        );
        let market = &mut ctx.accounts.market;
        market.displayed_price_micros = market.fair_price_micros;
        market.priced_at_seq = market.material_seq;
        Ok(())
    }

    pub fn place_order_v2(
        ctx: Context<PlaceOrderV2>,
        order_id: [u8; 32],
        side: u8,
        stake_lamports: u64,
        max_accepted_edge_micros: u64,
    ) -> Result<()> {
        require!(stake_lamports > 0, LineGuardError::InvalidStake);
        require!(
            max_accepted_edge_micros <= MICROS_ONE,
            LineGuardError::InvalidPrice
        );
        require!(
            !ctx.accounts.market.trading_closed && !ctx.accounts.market.resolved,
            LineGuardError::TradingClosed
        );
        require!(
            Clock::get()?.unix_timestamp < ctx.accounts.market.close_time,
            LineGuardError::TradingClosed
        );
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
        let position = &mut ctx.accounts.position;
        if position.market == Pubkey::default() {
            position.market = ctx.accounts.market.key();
            position.trader = ctx.accounts.trader.key();
            position.side = side.code();
            position.deposited_lamports = 0;
            position.accepted_lamports = 0;
            position.shares_or_pool_weight = 0;
            position.entry_price_micros = 0;
            position.status = PositionStatus::Open as u8;
            position.claimed = false;
            position.bump = ctx.bumps.position;
        }
        require!(
            position.market == ctx.accounts.market.key(),
            LineGuardError::InvalidMarket
        );
        require!(
            position.trader == ctx.accounts.trader.key(),
            LineGuardError::InvalidTrader
        );
        require!(position.side == side.code(), LineGuardError::InvalidSide);
        require!(!position.claimed, LineGuardError::PositionAlreadyClaimed);
        position.deposited_lamports = position
            .deposited_lamports
            .checked_add(stake_lamports)
            .ok_or(LineGuardError::MathOverflow)?;

        let order = &mut ctx.accounts.order;
        order.market = ctx.accounts.market.key();
        order.trader = ctx.accounts.trader.key();
        order.position = position.key();
        order.order_id = order_id;
        order.side = side.code();
        order.stake_lamports = stake_lamports;
        order.observed_price_micros = observed_price_micros;
        order.fair_side_price_micros = 0;
        order.edge_micros = 0;
        order.max_accepted_edge_micros = max_accepted_edge_micros;
        order.material_seq = ctx.accounts.market.material_seq;
        order.priced_at_seq = ctx.accounts.market.priced_at_seq;
        order.odds_sequence = ctx.accounts.market.odds_sequence;
        order.odds_payload_hash = ctx.accounts.market.odds_payload_hash;
        order.status = OrderV2Status::Escrowed as u8;
        order.bump = ctx.bumps.order;
        Ok(())
    }

    pub fn evaluate_order_v2(ctx: Context<EvaluateOrderV2>) -> Result<()> {
        require!(
            ctx.accounts.order.status == OrderV2Status::Escrowed as u8,
            LineGuardError::OrderAlreadyEvaluated
        );
        require!(
            !ctx.accounts.market.trading_closed && !ctx.accounts.market.resolved,
            LineGuardError::TradingClosed
        );
        require!(
            ctx.accounts.position.key() == ctx.accounts.order.position,
            LineGuardError::InvalidPosition
        );
        let fair_side = if ctx.accounts.order.side == 0 {
            ctx.accounts.market.fair_price_micros
        } else {
            MICROS_ONE
                .checked_sub(ctx.accounts.market.fair_price_micros)
                .ok_or(LineGuardError::MathOverflow)?
        };
        let edge = fair_side as i64 - ctx.accounts.order.observed_price_micros as i64;
        let stale = ctx.accounts.market.material_seq > ctx.accounts.order.priced_at_seq;
        let accepted_edge = ctx
            .accounts
            .order
            .max_accepted_edge_micros
            .min(ctx.accounts.market.tolerance_micros) as i64;
        let refund = stale && edge > accepted_edge;
        let stake = ctx.accounts.order.stake_lamports;
        ctx.accounts.market_vault.total_deposited = ctx
            .accounts
            .market_vault
            .total_deposited
            .checked_add(stake)
            .ok_or(LineGuardError::MathOverflow)?;
        let order_info = ctx.accounts.order.to_account_info();
        require!(
            **order_info.lamports.borrow() >= stake,
            LineGuardError::InsufficientEscrow
        );

        if refund {
            **order_info.try_borrow_mut_lamports()? -= stake;
            **ctx
                .accounts
                .trader
                .to_account_info()
                .try_borrow_mut_lamports()? += stake;
            ctx.accounts.market_vault.total_refunded = ctx
                .accounts
                .market_vault
                .total_refunded
                .checked_add(stake)
                .ok_or(LineGuardError::MathOverflow)?;
            ctx.accounts.order.status = OrderV2Status::Refunded as u8;
        } else {
            **order_info.try_borrow_mut_lamports()? -= stake;
            **ctx
                .accounts
                .market_vault
                .to_account_info()
                .try_borrow_mut_lamports()? += stake;
            let vault = &mut ctx.accounts.market_vault;
            vault.total_accepted = vault
                .total_accepted
                .checked_add(stake)
                .ok_or(LineGuardError::MathOverflow)?;
            vault.total_claimable = vault
                .total_claimable
                .checked_add(stake)
                .ok_or(LineGuardError::MathOverflow)?;
            let market = &mut ctx.accounts.market;
            if ctx.accounts.order.side == 0 {
                market.yes_pool_lamports = market
                    .yes_pool_lamports
                    .checked_add(stake)
                    .ok_or(LineGuardError::MathOverflow)?;
            } else {
                market.no_pool_lamports = market
                    .no_pool_lamports
                    .checked_add(stake)
                    .ok_or(LineGuardError::MathOverflow)?;
            }
            let position = &mut ctx.accounts.position;
            let old = position.accepted_lamports as u128;
            let next = old
                .checked_add(stake as u128)
                .ok_or(LineGuardError::MathOverflow)?;
            let weighted = (position.entry_price_micros as u128)
                .checked_mul(old)
                .and_then(|v| {
                    v.checked_add(
                        (ctx.accounts.order.observed_price_micros as u128) * stake as u128,
                    )
                })
                .ok_or(LineGuardError::MathOverflow)?;
            position.accepted_lamports = next as u64;
            position.shares_or_pool_weight = next as u64;
            position.entry_price_micros = (weighted / next) as u64;
            ctx.accounts.order.status = OrderV2Status::PositionOpened as u8;
        }
        ctx.accounts.order.fair_side_price_micros = fair_side;
        ctx.accounts.order.edge_micros = edge;
        assert_vault_invariant(&ctx.accounts.market_vault)?;
        emit!(OrderV2EvaluatedEvent {
            market: ctx.accounts.market.key(),
            order: ctx.accounts.order.key(),
            trader: ctx.accounts.order.trader,
            position: ctx.accounts.position.key(),
            status: ctx.accounts.order.status,
            stake_lamports: stake,
            edge_micros: edge,
        });
        Ok(())
    }

    pub fn close_market_v2(ctx: Context<CloseMarketV2>) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );
        let authorized_feed =
            ctx.accounts.closer.key() == ctx.accounts.authority_config.feed_authority;
        require!(
            authorized_feed || Clock::get()?.unix_timestamp >= ctx.accounts.market.close_time,
            LineGuardError::MarketNotClosed
        );
        ctx.accounts.market.trading_closed = true;
        Ok(())
    }

    pub fn prove_resolution_with_txline_v2(
        ctx: Context<ProveResolutionWithTxlineV2>,
        validation_payload_hash: [u8; 32],
        payload: StatValidationInput,
    ) -> Result<()> {
        require!(
            ctx.accounts.market.trading_closed,
            LineGuardError::MarketNotClosed
        );
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );
        require!(
            ctx.accounts.market.template_id == MATCH_WINNER_HOME_V1,
            LineGuardError::UnsupportedTemplate
        );
        require!(
            !is_zero_hash(&validation_payload_hash),
            LineGuardError::ZeroValidationPayloadHash
        );
        let mut encoded_payload = Vec::new();
        payload
            .serialize(&mut encoded_payload)
            .map_err(|_| error!(LineGuardError::TxlineSerializationFailed))?;
        require!(
            hash(&encoded_payload).to_bytes() == validation_payload_hash,
            LineGuardError::ValidationPayloadMismatch
        );
        let authority_index = resolution_authority_index(
            &ctx.accounts.authority_config,
            ctx.accounts.proposer.key(),
        )?;
        require!(
            payload.fixture_summary.fixture_id == ctx.accounts.market.fixture_id as i64,
            LineGuardError::FixtureMismatch
        );
        require!(payload.stats.len() == 2, LineGuardError::InvalidStatKeys);
        require!(
            !is_zero_hash(&payload.event_stat_root),
            LineGuardError::ZeroConfigHash
        );

        let mut home_score: Option<u16> = None;
        let mut away_score: Option<u16> = None;
        for leaf in &payload.stats {
            require!(leaf.stat.period == 4, LineGuardError::InvalidStatPeriod);
            require!(
                leaf.stat.value >= 0 && leaf.stat.value <= MAX_SCORE as i32,
                LineGuardError::InvalidScore
            );
            if leaf.stat.key == ctx.accounts.market.home_stat_key as u32 {
                home_score = Some(leaf.stat.value as u16);
            } else if leaf.stat.key == ctx.accounts.market.away_stat_key as u32 {
                away_score = Some(leaf.stat.value as u16);
            } else {
                return err!(LineGuardError::StatKeyCommitmentMismatch);
            }
        }
        let home_score = home_score.ok_or(LineGuardError::StatKeyCommitmentMismatch)?;
        let away_score = away_score.ok_or(LineGuardError::StatKeyCommitmentMismatch)?;
        let strategy = NDimensionalStrategy {
            geometric_targets: vec![],
            distance_predicate: None,
            discrete_predicates: vec![
                StatPredicate::Single {
                    index: 0,
                    predicate: TraderPredicate {
                        threshold: payload.stats[0].stat.value,
                        comparison: Comparison::EqualTo,
                    },
                },
                StatPredicate::Single {
                    index: 1,
                    predicate: TraderPredicate {
                        threshold: payload.stats[1].stat.value,
                        comparison: Comparison::EqualTo,
                    },
                },
            ],
        };
        invoke_txline_validate_stat_v2(
            &ctx.accounts.txline_root.to_account_info(),
            &ctx.accounts.txline_program.to_account_info(),
            &payload,
            &strategy,
        )?;

        let derived_outcome = ResolutionRule::HomeTeamWins.derive(home_score, away_score);
        let receipt = &mut ctx.accounts.validation_receipt;
        receipt.market = ctx.accounts.market.key();
        receipt.fixture_id = ctx.accounts.market.fixture_id;
        receipt.sequence = ctx.accounts.market.material_seq;
        receipt.validation_root_pda = ctx.accounts.txline_root.key();
        receipt.validation_payload_hash = validation_payload_hash;
        receipt.event_stat_root = payload.event_stat_root;
        receipt.home_score = home_score;
        receipt.away_score = away_score;
        receipt.derived_outcome = derived_outcome;
        receipt.direct_cpi_verified = true;
        receipt.bump = ctx.bumps.validation_receipt;

        let proposal = &mut ctx.accounts.resolution_proposal;
        proposal.market = ctx.accounts.market.key();
        proposal.validation_receipt = receipt.key();
        proposal.validation_payload_hash = validation_payload_hash;
        proposal.derived_outcome = derived_outcome;
        proposal.approvals_mask = 1u8 << authority_index;
        proposal.executed = false;
        proposal.bump = ctx.bumps.resolution_proposal;
        emit!(TxlineCpiVerifiedEvent {
            market: ctx.accounts.market.key(),
            validation_receipt: receipt.key(),
            fixture_id: receipt.fixture_id,
            home_score,
            away_score,
            derived_outcome,
            validation_payload_hash,
        });
        Ok(())
    }

    pub fn approve_resolution_v2(ctx: Context<ApproveResolutionV2>) -> Result<()> {
        require!(
            !ctx.accounts.resolution_proposal.executed,
            LineGuardError::ProposalAlreadyExecuted
        );
        let index = resolution_authority_index(
            &ctx.accounts.authority_config,
            ctx.accounts.approver.key(),
        )?;
        let mask = 1u8 << index;
        require!(
            ctx.accounts.resolution_proposal.approvals_mask & mask == 0,
            LineGuardError::DuplicateApproval
        );
        ctx.accounts.resolution_proposal.approvals_mask |= mask;
        emit!(ResolutionApprovedEvent {
            market: ctx.accounts.market.key(),
            approver: ctx.accounts.approver.key(),
            approvals: ctx.accounts.resolution_proposal.approvals_mask.count_ones() as u8,
        });
        Ok(())
    }

    pub fn execute_resolution_v2(ctx: Context<ExecuteResolutionV2>) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );
        require!(
            ctx.accounts.validation_receipt.direct_cpi_verified,
            LineGuardError::TxlineCpiValidationFailed
        );
        require!(
            !ctx.accounts.resolution_proposal.executed,
            LineGuardError::ProposalAlreadyExecuted
        );
        require!(
            ctx.accounts.resolution_proposal.approvals_mask.count_ones() as u8
                >= ctx.accounts.authority_config.threshold,
            LineGuardError::ResolutionThresholdNotMet
        );
        require!(
            ctx.accounts.resolution_proposal.validation_payload_hash
                == ctx.accounts.validation_receipt.validation_payload_hash,
            LineGuardError::ValidationPayloadMismatch
        );
        require!(
            ctx.accounts.resolution_proposal.derived_outcome
                == ctx.accounts.validation_receipt.derived_outcome,
            LineGuardError::DerivedOutcomeMismatch
        );
        let market = &mut ctx.accounts.market;
        let winning_pool = if ctx.accounts.validation_receipt.derived_outcome == 1 {
            market.yes_pool_lamports
        } else if ctx.accounts.validation_receipt.derived_outcome == 2 {
            market.no_pool_lamports
        } else {
            0
        };
        market.resolution =
            if ctx.accounts.validation_receipt.derived_outcome == 3 || winning_pool == 0 {
                3
            } else {
                ctx.accounts.validation_receipt.derived_outcome
            };
        market.resolved = true;
        market.trading_closed = true;
        market.resolved_at = Clock::get()?.unix_timestamp;
        market.validation_payload_hash = ctx.accounts.validation_receipt.validation_payload_hash;
        market.resolution_event_hash = ctx.accounts.validation_receipt.event_stat_root;
        ctx.accounts.resolution_proposal.executed = true;
        emit!(MarketV2ResolvedEvent {
            market: market.key(),
            resolution: market.resolution,
            direct_cpi_verified: true,
            approvals: ctx.accounts.resolution_proposal.approvals_mask.count_ones() as u8,
        });
        Ok(())
    }

    pub fn emergency_void_market_v2(ctx: Context<EmergencyVoidMarketV2>) -> Result<()> {
        require!(
            ctx.accounts.emergency_authority.key()
                == ctx.accounts.authority_config.emergency_authority,
            LineGuardError::InvalidEmergencyAuthority
        );
        require!(
            !ctx.accounts.market.resolved,
            LineGuardError::MarketAlreadyResolved
        );
        ctx.accounts.market.resolution = 3;
        ctx.accounts.market.resolved = true;
        ctx.accounts.market.trading_closed = true;
        ctx.accounts.market.resolved_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn claim_position_v2(ctx: Context<ClaimPositionV2>) -> Result<()> {
        require!(
            ctx.accounts.market.resolved,
            LineGuardError::MarketNotResolved
        );
        require!(
            !ctx.accounts.position.claimed,
            LineGuardError::PositionAlreadyClaimed
        );
        require!(
            ctx.accounts.position.accepted_lamports > 0,
            LineGuardError::PositionHasNoAcceptedStake
        );
        let accepted = ctx.accounts.position.accepted_lamports;
        let resolution = ctx.accounts.market.resolution;
        let payout = if resolution == 3 {
            accepted
        } else {
            let won = (resolution == 1 && ctx.accounts.position.side == 0)
                || (resolution == 2 && ctx.accounts.position.side == 1);
            require!(won, LineGuardError::PositionDidNotWin);
            let winning_pool = if resolution == 1 {
                ctx.accounts.market.yes_pool_lamports
            } else {
                ctx.accounts.market.no_pool_lamports
            };
            require!(winning_pool > 0, LineGuardError::WinningPoolEmpty);
            let next_claimed = ctx
                .accounts
                .market
                .claimed_winning_lamports
                .checked_add(accepted)
                .ok_or(LineGuardError::MathOverflow)?;
            require!(
                next_claimed <= winning_pool,
                LineGuardError::MarketAccountingOverflow
            );
            let payout = if next_claimed == winning_pool {
                ctx.accounts.market_vault.total_claimable
            } else {
                ((accepted as u128)
                    .checked_mul(ctx.accounts.market_vault.total_accepted as u128)
                    .ok_or(LineGuardError::MathOverflow)?
                    / winning_pool as u128) as u64
            };
            ctx.accounts.market.claimed_winning_lamports = next_claimed;
            payout
        };
        require!(
            payout <= ctx.accounts.market_vault.total_claimable,
            LineGuardError::MarketAccountingOverflow
        );
        let rent = Rent::get()?.minimum_balance(8 + MarketVault::INIT_SPACE);
        let available = ctx
            .accounts
            .market_vault
            .to_account_info()
            .lamports()
            .saturating_sub(rent);
        require!(available >= payout, LineGuardError::InsufficientVault);
        **ctx
            .accounts
            .market_vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= payout;
        **ctx
            .accounts
            .trader
            .to_account_info()
            .try_borrow_mut_lamports()? += payout;
        ctx.accounts.market_vault.total_paid = ctx
            .accounts
            .market_vault
            .total_paid
            .checked_add(payout)
            .ok_or(LineGuardError::MathOverflow)?;
        ctx.accounts.market_vault.total_claimable = ctx
            .accounts
            .market_vault
            .total_claimable
            .checked_sub(payout)
            .ok_or(LineGuardError::MathOverflow)?;
        ctx.accounts.position.claimed = true;
        ctx.accounts.position.status = PositionStatus::Claimed as u8;
        assert_vault_invariant(&ctx.accounts.market_vault)?;
        emit!(PositionClaimedEvent {
            market: ctx.accounts.market.key(),
            position: ctx.accounts.position.key(),
            trader: ctx.accounts.trader.key(),
            payout_lamports: payout,
        });
        Ok(())
    }
}

fn is_zero_hash(value: &[u8; 32]) -> bool {
    value.iter().all(|byte| *byte == 0)
}

fn verify_receipt_against_config(
    receipt: &TxlineValidationReceipt,
    market_key: Pubkey,
    market: &MarketState,
    config: &MarketConfig,
) -> Result<()> {
    require!(receipt.market == market_key, LineGuardError::InvalidMarket);
    require!(
        receipt.fixture_id == market.fixture_id,
        LineGuardError::FixtureMismatch
    );
    require!(
        receipt.fixture_id_hash == config.fixture_id_hash,
        LineGuardError::FixtureCommitmentMismatch
    );
    require!(
        config.market_type == MATCH_WINNER_HOME,
        LineGuardError::UnsupportedSettlementMarketType
    );
    require!(
        receipt.home_stat_key == config.home_stat_key,
        LineGuardError::StatKeyCommitmentMismatch
    );
    require!(
        receipt.away_stat_key == config.away_stat_key,
        LineGuardError::StatKeyCommitmentMismatch
    );
    require!(
        receipt.resolution_rule == config.resolution_rule,
        LineGuardError::ResolutionRuleMismatch
    );
    require!(
        receipt.home_score <= MAX_SCORE && receipt.away_score <= MAX_SCORE,
        LineGuardError::InvalidScore
    );
    require!(
        !is_zero_hash(&receipt.validation_payload_hash),
        LineGuardError::ZeroValidationPayloadHash
    );
    let rule = ResolutionRule::try_from(config.resolution_rule)?;
    require!(
        receipt.derived_outcome == rule.derive(receipt.home_score, receipt.away_score),
        LineGuardError::DerivedOutcomeMismatch
    );
    Ok(())
}

fn validate_authority_set(
    feed: Pubkey,
    pricing: Pubkey,
    resolution: &[Pubkey; 3],
    emergency: Pubkey,
    threshold: u8,
) -> Result<()> {
    require!(
        feed != Pubkey::default() && pricing != Pubkey::default() && emergency != Pubkey::default(),
        LineGuardError::InvalidAuthority
    );
    require!(
        (1..=3).contains(&threshold),
        LineGuardError::InvalidThreshold
    );
    for key in resolution {
        require!(*key != Pubkey::default(), LineGuardError::InvalidAuthority);
        require!(
            *key != feed && *key != pricing && *key != emergency,
            LineGuardError::AuthorityRolesNotSeparated
        );
    }
    require!(
        resolution[0] != resolution[1]
            && resolution[0] != resolution[2]
            && resolution[1] != resolution[2],
        LineGuardError::DuplicateResolutionAuthority
    );
    require!(
        feed != pricing && feed != emergency && pricing != emergency,
        LineGuardError::AuthorityRolesNotSeparated
    );
    Ok(())
}

fn resolution_authority_index(config: &AuthorityConfig, signer: Pubkey) -> Result<u8> {
    config
        .resolution_authorities
        .iter()
        .position(|key| *key == signer)
        .map(|index| index as u8)
        .ok_or_else(|| error!(LineGuardError::InvalidResolutionAuthority))
}

fn assert_vault_invariant(vault: &MarketVault) -> Result<()> {
    let accounted = vault
        .total_refunded
        .checked_add(vault.total_paid)
        .and_then(|v| v.checked_add(vault.total_claimable))
        .and_then(|v| v.checked_add(vault.rounding_dust))
        .ok_or(LineGuardError::MathOverflow)?;
    require!(
        vault.total_deposited == accounted,
        LineGuardError::VaultInvariantViolation
    );
    require!(
        vault.total_paid <= vault.total_accepted,
        LineGuardError::MarketAccountingOverflow
    );
    Ok(())
}

fn invoke_txline_validate_stat_v2<'info>(
    root: &AccountInfo<'info>,
    txline_program: &AccountInfo<'info>,
    payload: &StatValidationInput,
    strategy: &NDimensionalStrategy,
) -> Result<()> {
    require!(
        txline_program.key() == TXLINE_PROGRAM_ID,
        LineGuardError::InvalidTxlineProgram
    );
    require!(
        txline_program.executable,
        LineGuardError::InvalidTxlineProgram
    );
    require!(
        *root.owner == TXLINE_PROGRAM_ID,
        LineGuardError::InvalidTxlineRoot
    );
    let mut data = TXLINE_VALIDATE_STAT_V2_DISCRIMINATOR.to_vec();
    payload
        .serialize(&mut data)
        .map_err(|_| error!(LineGuardError::TxlineSerializationFailed))?;
    strategy
        .serialize(&mut data)
        .map_err(|_| error!(LineGuardError::TxlineSerializationFailed))?;
    let instruction = Instruction {
        program_id: TXLINE_PROGRAM_ID,
        accounts: vec![AccountMeta::new_readonly(root.key(), false)],
        data,
    };
    invoke(&instruction, &[root.clone(), txline_program.clone()])?;
    let (returning_program, return_bytes) =
        get_return_data().ok_or(LineGuardError::TxlineCpiReturnMissing)?;
    require!(
        returning_program == TXLINE_PROGRAM_ID,
        LineGuardError::InvalidTxlineProgram
    );
    require!(
        return_bytes.as_slice() == [1u8],
        LineGuardError::TxlineCpiValidationFailed
    );
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeMarketV2Args {
    pub market_id: [u8; 32],
    pub fixture_id: u64,
    pub template_id: u16,
    pub fixture_id_hash: [u8; 32],
    pub home_team_hash: [u8; 32],
    pub away_team_hash: [u8; 32],
    pub home_stat_key: u16,
    pub away_stat_key: u16,
    pub resolution_rule: u8,
    pub materiality_config_hash: [u8; 32],
    pub pricing_config_hash: [u8; 32],
    pub pricing_model_hash: [u8; 32],
    pub pricing_model_version: u16,
    pub odds_payload_hash: [u8; 32],
    pub odds_sequence: u64,
    pub material_seq: u64,
    pub priced_at_seq: u64,
    pub displayed_price_micros: u64,
    pub fair_price_micros: u64,
    pub tolerance_micros: u64,
    pub close_time: i64,
    pub claim_deadline: i64,
}

// Exact Borsh-compatible subset of the official TxLINE devnet validateStatV2 ABI.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatLeaf {
    pub stat: ScoreStat,
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatValidationInput {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub event_stat_root: [u8; 32],
    pub stats: Vec<StatLeaf>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum StatPredicate {
    Single {
        index: u8,
        predicate: TraderPredicate,
    },
    Binary {
        index_a: u8,
        index_b: u8,
        op: BinaryExpression,
        predicate: TraderPredicate,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GeometricTarget {
    pub stat_index: u8,
    pub prediction: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NDimensionalStrategy {
    pub geometric_targets: Vec<GeometricTarget>,
    pub distance_predicate: Option<TraderPredicate>,
    pub discrete_predicates: Vec<StatPredicate>,
}

#[derive(Accounts)]
pub struct InitializeAuthorities<'info> {
    #[account(mut, address = BOOTSTRAP_ADMIN_ID @ LineGuardError::InvalidAuthority)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + AuthorityConfig::INIT_SPACE, seeds = [b"authorities-v2"], bump)]
    pub authority_config: Box<Account<'info, AuthorityConfig>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeAuthorityUpdate<'info> {
    pub admin: Signer<'info>,
    #[account(mut, has_one = admin @ LineGuardError::InvalidAuthority, seeds = [b"authorities-v2"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfig>,
}

#[derive(Accounts)]
pub struct ExecuteAuthorityUpdate<'info> {
    #[account(mut, seeds = [b"authorities-v2"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfig>,
}

#[derive(Accounts)]
#[instruction(args: InitializeMarketV2Args)]
pub struct InitializeMarketV2<'info> {
    pub admin: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [b"authorities-v2"],
        bump = authority_config.bump,
        has_one = admin @ LineGuardError::InvalidAuthority
    )]
    pub authority_config: Account<'info, AuthorityConfig>,
    #[account(init, payer = payer, space = 8 + MarketV2::INIT_SPACE, seeds = [b"market-v2", args.market_id.as_ref()], bump)]
    pub market: Box<Account<'info, MarketV2>>,
    #[account(init, payer = payer, space = 8 + MarketVault::INIT_SPACE, seeds = [b"market-vault", market.key().as_ref()], bump)]
    pub market_vault: Box<Account<'info, MarketVault>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FeedUpdateV2<'info> {
    pub feed_authority: Signer<'info>,
    #[account(seeds = [b"authorities-v2"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfig>,
    #[account(mut, has_one = authority_config @ LineGuardError::InvalidAuthority, seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, MarketV2>>,
}

#[derive(Accounts)]
pub struct PricingUpdateV2<'info> {
    pub pricing_authority: Signer<'info>,
    #[account(seeds = [b"authorities-v2"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfig>,
    #[account(mut, has_one = authority_config @ LineGuardError::InvalidAuthority, seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV2>,
}

#[derive(Accounts)]
#[instruction(order_id: [u8; 32], side: u8)]
pub struct PlaceOrderV2<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV2>,
    #[account(mut, has_one = market @ LineGuardError::InvalidMarket, seeds = [b"market-vault", market.key().as_ref()], bump = market_vault.bump)]
    pub market_vault: Account<'info, MarketVault>,
    #[account(init, payer = trader, space = 8 + OrderEscrowV2::INIT_SPACE, seeds = [b"order-v2", market.key().as_ref(), order_id.as_ref()], bump)]
    pub order: Account<'info, OrderEscrowV2>,
    #[account(init_if_needed, payer = trader, space = 8 + Position::INIT_SPACE, seeds = [b"position", market.key().as_ref(), trader.key().as_ref(), &[side]], bump)]
    pub position: Account<'info, Position>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EvaluateOrderV2<'info> {
    #[account(mut, seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, MarketV2>>,
    #[account(mut, has_one = market @ LineGuardError::InvalidMarket, seeds = [b"market-vault", market.key().as_ref()], bump = market_vault.bump)]
    pub market_vault: Box<Account<'info, MarketVault>>,
    #[account(mut, has_one = market @ LineGuardError::InvalidMarket, has_one = trader @ LineGuardError::InvalidTrader, seeds = [b"order-v2", market.key().as_ref(), order.order_id.as_ref()], bump = order.bump)]
    pub order: Box<Account<'info, OrderEscrowV2>>,
    #[account(mut)]
    pub trader: SystemAccount<'info>,
    #[account(mut, has_one = market @ LineGuardError::InvalidMarket, has_one = trader @ LineGuardError::InvalidTrader, seeds = [b"position", market.key().as_ref(), trader.key().as_ref(), &[position.side]], bump = position.bump)]
    pub position: Box<Account<'info, Position>>,
}

#[derive(Accounts)]
pub struct CloseMarketV2<'info> {
    pub closer: Signer<'info>,
    #[account(seeds = [b"authorities-v2"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfig>,
    #[account(mut, has_one = authority_config @ LineGuardError::InvalidAuthority, seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV2>,
}

#[derive(Accounts)]
pub struct ProveResolutionWithTxlineV2<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(seeds = [b"authorities-v2"], bump = authority_config.bump)]
    pub authority_config: Box<Account<'info, AuthorityConfig>>,
    #[account(seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, MarketV2>>,
    /// CHECK: owner and TxLINE CPI validate this canonical daily root account.
    pub txline_root: UncheckedAccount<'info>,
    /// CHECK: constrained to the fixed executable TxLINE devnet program in the handler.
    pub txline_program: UncheckedAccount<'info>,
    #[account(init, payer = proposer, space = 8 + TxlineValidationReceiptV2::INIT_SPACE, seeds = [b"txval-v2", market.key().as_ref()], bump)]
    pub validation_receipt: Box<Account<'info, TxlineValidationReceiptV2>>,
    #[account(init, payer = proposer, space = 8 + ResolutionProposal::INIT_SPACE, seeds = [b"resolution-v2", market.key().as_ref()], bump)]
    pub resolution_proposal: Box<Account<'info, ResolutionProposal>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveResolutionV2<'info> {
    pub approver: Signer<'info>,
    #[account(seeds = [b"authorities-v2"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfig>,
    #[account(seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV2>,
    #[account(mut, has_one = market @ LineGuardError::InvalidMarket, seeds = [b"resolution-v2", market.key().as_ref()], bump = resolution_proposal.bump)]
    pub resolution_proposal: Account<'info, ResolutionProposal>,
}

#[derive(Accounts)]
pub struct ExecuteResolutionV2<'info> {
    #[account(seeds = [b"authorities-v2"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfig>,
    #[account(mut, has_one = authority_config @ LineGuardError::InvalidAuthority, seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV2>,
    #[account(has_one = market @ LineGuardError::InvalidMarket, seeds = [b"txval-v2", market.key().as_ref()], bump = validation_receipt.bump)]
    pub validation_receipt: Account<'info, TxlineValidationReceiptV2>,
    #[account(mut, has_one = market @ LineGuardError::InvalidMarket, has_one = validation_receipt @ LineGuardError::ValidationPayloadMismatch, seeds = [b"resolution-v2", market.key().as_ref()], bump = resolution_proposal.bump)]
    pub resolution_proposal: Account<'info, ResolutionProposal>,
}

#[derive(Accounts)]
pub struct EmergencyVoidMarketV2<'info> {
    pub emergency_authority: Signer<'info>,
    #[account(seeds = [b"authorities-v2"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfig>,
    #[account(mut, has_one = authority_config @ LineGuardError::InvalidAuthority, seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV2>,
}

#[derive(Accounts)]
pub struct ClaimPositionV2<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(mut, seeds = [b"market-v2", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV2>,
    #[account(mut, has_one = market @ LineGuardError::InvalidMarket, seeds = [b"market-vault", market.key().as_ref()], bump = market_vault.bump)]
    pub market_vault: Account<'info, MarketVault>,
    #[account(mut, has_one = market @ LineGuardError::InvalidMarket, has_one = trader @ LineGuardError::InvalidTrader, seeds = [b"position", market.key().as_ref(), trader.key().as_ref(), &[position.side]], bump = position.bump)]
    pub position: Account<'info, Position>,
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
    #[account(
        seeds = [b"config", market.key().as_ref()],
        bump,
        constraint = market_config.authority == market.authority @ LineGuardError::InvalidAuthority
    )]
    pub market_config: Account<'info, MarketConfig>,
    /// CHECK: checked by owner (must equal the TxLINE program) and by the canonical
    /// daily-scores-root PDA address for the claimed epoch day.
    pub txline_root: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        space = RECEIPT_SPACE,
        seeds = [b"txval", market.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, TxlineValidationReceipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfirmValidation<'info> {
    pub authority: Signer<'info>,
    #[account(
        has_one = authority @ LineGuardError::InvalidAuthority,
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
        has_one = authority @ LineGuardError::InvalidAuthority,
        seeds = [b"txval", market.key().as_ref()],
        bump = receipt.bump
    )]
    pub receipt: Account<'info, TxlineValidationReceipt>,
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
        seeds = [b"config", market.key().as_ref()],
        bump,
        constraint = market_config.authority == market.authority @ LineGuardError::InvalidAuthority
    )]
    pub market_config: Account<'info, MarketConfig>,
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

/// On-chain receipt for operator-submitted scores bound to a genuine TxLINE root account.
/// TxLINE `validateStatV2` proof validation remains a separate operation.
#[account]
pub struct TxlineValidationReceipt {
    pub market: Pubkey,
    pub authority: Pubkey,
    pub fixture_id: u64,
    pub fixture_id_hash: [u8; 32],
    pub sequence: u64,
    pub home_stat_key: u16,
    pub away_stat_key: u16,
    pub resolution_rule: u8,
    pub root_epoch_day: u16,
    pub validation_root_pda: Pubkey,
    pub validation_payload_hash: [u8; 32],
    pub event_stat_root: [u8; 32],
    pub home_score: u16,
    pub away_score: u16,
    pub derived_outcome: u8, // 1 = YES, 2 = NO, 3 = voided draw
    pub confirmed: bool,
    pub updated_at: i64,
    pub confirmed_at: i64,
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
    pub resolution_rule: u8,
    pub home_stat_key: u16,
    pub away_stat_key: u16,
    pub home_team_hash: [u8; 32],
    pub away_team_hash: [u8; 32],
}

#[account]
#[derive(InitSpace)]
pub struct AuthorityConfig {
    pub admin: Pubkey,
    pub feed_authority: Pubkey,
    pub pricing_authority: Pubkey,
    pub resolution_authorities: [Pubkey; 3],
    pub emergency_authority: Pubkey,
    pub threshold: u8,
    pub pending: bool,
    pub pending_feed_authority: Pubkey,
    pub pending_pricing_authority: Pubkey,
    pub pending_resolution_authorities: [Pubkey; 3],
    pub pending_emergency_authority: Pubkey,
    pub pending_threshold: u8,
    pub execute_after: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MarketV2 {
    pub authority_config: Pubkey,
    pub market_id: [u8; 32],
    pub fixture_id: u64,
    pub template_id: u16,
    pub fixture_id_hash: [u8; 32],
    pub home_team_hash: [u8; 32],
    pub away_team_hash: [u8; 32],
    pub home_stat_key: u16,
    pub away_stat_key: u16,
    pub resolution_rule: u8,
    pub materiality_config_hash: [u8; 32],
    pub pricing_config_hash: [u8; 32],
    pub pricing_model_hash: [u8; 32],
    pub pricing_model_version: u16,
    pub odds_payload_hash: [u8; 32],
    pub odds_sequence: u64,
    pub material_seq: u64,
    pub priced_at_seq: u64,
    pub displayed_price_micros: u64,
    pub fair_price_micros: u64,
    pub tolerance_micros: u64,
    pub source_event_hash: [u8; 32],
    pub close_time: i64,
    pub claim_deadline: i64,
    pub yes_pool_lamports: u64,
    pub no_pool_lamports: u64,
    pub claimed_winning_lamports: u64,
    pub resolution: u8,
    pub trading_closed: bool,
    pub resolved: bool,
    pub resolved_at: i64,
    pub validation_payload_hash: [u8; 32],
    pub resolution_event_hash: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MarketVault {
    pub market: Pubkey,
    pub total_deposited: u64,
    pub total_refunded: u64,
    pub total_accepted: u64,
    pub total_paid: u64,
    pub total_claimable: u64,
    pub rounding_dust: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub trader: Pubkey,
    pub side: u8,
    pub deposited_lamports: u64,
    pub accepted_lamports: u64,
    pub shares_or_pool_weight: u64,
    pub entry_price_micros: u64,
    pub status: u8,
    pub claimed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OrderEscrowV2 {
    pub market: Pubkey,
    pub trader: Pubkey,
    pub position: Pubkey,
    pub order_id: [u8; 32],
    pub side: u8,
    pub stake_lamports: u64,
    pub observed_price_micros: u64,
    pub fair_side_price_micros: u64,
    pub edge_micros: i64,
    pub max_accepted_edge_micros: u64,
    pub material_seq: u64,
    pub priced_at_seq: u64,
    pub odds_sequence: u64,
    pub odds_payload_hash: [u8; 32],
    pub status: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TxlineValidationReceiptV2 {
    pub market: Pubkey,
    pub fixture_id: u64,
    pub sequence: u64,
    pub validation_root_pda: Pubkey,
    pub validation_payload_hash: [u8; 32],
    pub event_stat_root: [u8; 32],
    pub home_score: u16,
    pub away_score: u16,
    pub derived_outcome: u8,
    pub direct_cpi_verified: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ResolutionProposal {
    pub market: Pubkey,
    pub validation_receipt: Pubkey,
    pub validation_payload_hash: [u8; 32],
    pub derived_outcome: u8,
    pub approvals_mask: u8,
    pub executed: bool,
    pub bump: u8,
}

#[repr(u8)]
pub enum PositionStatus {
    Open = 0,
    Claimable = 1,
    Claimed = 2,
}

#[repr(u8)]
pub enum OrderV2Status {
    Escrowed = 0,
    PositionOpened = 1,
    Refunded = 2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
pub enum ResolutionRule {
    HomeTeamWins = 0,
}

impl ResolutionRule {
    pub fn try_from(code: u8) -> Result<Self> {
        match code {
            0 => Ok(Self::HomeTeamWins),
            _ => err!(LineGuardError::InvalidResolutionRule),
        }
    }

    pub fn derive(&self, home_score: u16, away_score: u16) -> u8 {
        match self {
            Self::HomeTeamWins => match home_score.cmp(&away_score) {
                std::cmp::Ordering::Greater => 1,
                std::cmp::Ordering::Less => 2,
                std::cmp::Ordering::Equal => 3,
            },
        }
    }
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

#[event]
pub struct AuthorityUpdateProposedEvent {
    pub authority_config: Pubkey,
    pub execute_after: i64,
}

#[event]
pub struct AuthorityUpdateExecutedEvent {
    pub authority_config: Pubkey,
    pub feed_authority: Pubkey,
    pub pricing_authority: Pubkey,
    pub emergency_authority: Pubkey,
    pub threshold: u8,
}

#[event]
pub struct MarketV2InitializedEvent {
    pub market: Pubkey,
    pub market_vault: Pubkey,
    pub fixture_id: u64,
    pub template_id: u16,
    pub odds_payload_hash: [u8; 32],
}

#[event]
pub struct OddsPriceCommittedEvent {
    pub market: Pubkey,
    pub odds_sequence: u64,
    pub odds_payload_hash: [u8; 32],
    pub pricing_model_hash: [u8; 32],
    pub fair_price_micros: u64,
}

#[event]
pub struct OrderV2EvaluatedEvent {
    pub market: Pubkey,
    pub order: Pubkey,
    pub trader: Pubkey,
    pub position: Pubkey,
    pub status: u8,
    pub stake_lamports: u64,
    pub edge_micros: i64,
}

#[event]
pub struct TxlineCpiVerifiedEvent {
    pub market: Pubkey,
    pub validation_receipt: Pubkey,
    pub fixture_id: u64,
    pub home_score: u16,
    pub away_score: u16,
    pub derived_outcome: u8,
    pub validation_payload_hash: [u8; 32],
}

#[event]
pub struct ResolutionApprovedEvent {
    pub market: Pubkey,
    pub approver: Pubkey,
    pub approvals: u8,
}

#[event]
pub struct MarketV2ResolvedEvent {
    pub market: Pubkey,
    pub resolution: u8,
    pub direct_cpi_verified: bool,
    pub approvals: u8,
}

#[event]
pub struct PositionClaimedEvent {
    pub market: Pubkey,
    pub position: Pubkey,
    pub trader: Pubkey,
    pub payout_lamports: u64,
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
    #[msg("Only MATCH_WINNER_HOME is supported for on-chain settlement")]
    UnsupportedSettlementMarketType,
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
    #[msg("Resolution rule is not implemented")]
    InvalidResolutionRule,
    #[msg("Submitted scores must be between 0 and 99")]
    InvalidScore,
    #[msg("Validation payload hash must be nonzero")]
    ZeroValidationPayloadHash,
    #[msg("Validation fixture commitment does not match MarketConfig")]
    FixtureCommitmentMismatch,
    #[msg("Validation stat keys do not match MarketConfig")]
    StatKeyCommitmentMismatch,
    #[msg("Validation resolution rule does not match MarketConfig")]
    ResolutionRuleMismatch,
    #[msg("Validation outcome does not follow from the committed rule and scores")]
    DerivedOutcomeMismatch,
    #[msg("Validation receipt is already confirmed and immutable")]
    ValidationAlreadyConfirmed,
    #[msg("Validation receipt must be confirmed before resolution")]
    ValidationNotConfirmed,
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
    #[msg("Only the configured feed authority may ingest material events")]
    InvalidFeedAuthority,
    #[msg("Only the configured pricing authority may commit TxLINE odds")]
    InvalidPricingAuthority,
    #[msg("Signer is not a configured resolution authority")]
    InvalidResolutionAuthority,
    #[msg("Only the configured emergency authority may void a v2 market")]
    InvalidEmergencyAuthority,
    #[msg("Resolution threshold must be between one and three")]
    InvalidThreshold,
    #[msg("Resolution authorities must be unique")]
    DuplicateResolutionAuthority,
    #[msg("Feed, pricing, and emergency roles must use separate keys")]
    AuthorityRolesNotSeparated,
    #[msg("No authority update is pending")]
    NoPendingAuthorityUpdate,
    #[msg("The authority update timelock has not elapsed")]
    AuthorityTimelockActive,
    #[msg("Only MATCH_WINNER_HOME_V1 is supported")]
    UnsupportedTemplate,
    #[msg("Market close time must be in the future")]
    InvalidCloseTime,
    #[msg("Only deterministic TxLINE pricing model v1 is supported")]
    UnsupportedPricingModel,
    #[msg("Pricing model hash does not match the market commitment")]
    PricingModelMismatch,
    #[msg("TxLINE odds sequence must strictly increase")]
    OddsSequenceRegression,
    #[msg("TxLINE odds payload hash must be nonzero")]
    ZeroOddsPayloadHash,
    #[msg("Position account does not match the order")]
    InvalidPosition,
    #[msg("Position has already claimed")]
    PositionAlreadyClaimed,
    #[msg("Position contains no accepted stake")]
    PositionHasNoAcceptedStake,
    #[msg("Position is not on the winning side")]
    PositionDidNotWin,
    #[msg("Market-vault accounting invariant failed")]
    VaultInvariantViolation,
    #[msg("TxLINE stat period must be Total (4)")]
    InvalidStatPeriod,
    #[msg("TxLINE program account is not the fixed executable devnet program")]
    InvalidTxlineProgram,
    #[msg("Failed to serialize the TxLINE validateStatV2 CPI")]
    TxlineSerializationFailed,
    #[msg("TxLINE validateStatV2 did not return validation data")]
    TxlineCpiReturnMissing,
    #[msg("TxLINE validateStatV2 did not return true")]
    TxlineCpiValidationFailed,
    #[msg("Resolution proposal has already executed")]
    ProposalAlreadyExecuted,
    #[msg("Resolution authority has already approved this proposal")]
    DuplicateApproval,
    #[msg("Resolution approval threshold has not been met")]
    ResolutionThresholdNotMet,
    #[msg("Resolution proposal does not match the validation receipt")]
    ValidationPayloadMismatch,
}
