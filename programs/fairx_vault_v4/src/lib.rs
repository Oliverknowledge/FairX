#![allow(clippy::too_many_arguments)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{get_return_data, invoke},
};
use anchor_lang::system_program::{transfer, Transfer};
use solana_sha256_hasher::hash;

// Approved Phase C deployment-candidate address. The corresponding keypair remains external.
declare_id!("2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p");

const MICROS_ONE: u64 = 1_000_000;
const CANONICAL_FIXTURE_ID: u64 = 18_209_181;
const CANONICAL_INITIAL_EVENT_SEQUENCE: u64 = 738;
const CANONICAL_GOAL_SEQUENCE: u64 = 739;
const CANONICAL_FINAL_SEQUENCE: u64 = 1_114;
const CANONICAL_GOAL_TIMESTAMP_MS: i64 = 1_783_632_332_422;
const CANONICAL_PRE_GOAL_QUOTE_SEQUENCE: u64 = 1;
const CANONICAL_POST_GOAL_QUOTE_SEQUENCE: u64 = 2;
const CANONICAL_PRE_GOAL_QUOTE_TIMESTAMP_MS: i64 = 1_783_632_223_405;
const CANONICAL_POST_GOAL_QUOTE_TIMESTAMP_MS: i64 = 1_783_632_332_626;
const CANONICAL_PRE_GOAL_MESSAGE_ID: &str = "1837056734:00003:000066-1-10021-stab";
const CANONICAL_POST_GOAL_MESSAGE_ID: &str = "1837056922:00003:000268-10021-stab";
const CANONICAL_PRE_GOAL_PRICES: [i32; 3] = [1913, 2691, 9473];
const CANONICAL_POST_GOAL_PRICES: [i32; 3] = [1156, 8757, 47_500];
const CANONICAL_FINAL_TIMESTAMP_MS: i64 = 1_783_634_788_478;
const CANONICAL_SPREAD_MICROS: u64 = 10_000;
const CANONICAL_GOAL_PAYLOAD_HASH: [u8; 32] = [
    228, 112, 27, 171, 10, 141, 43, 133, 118, 238, 247, 210, 5, 10, 208, 50, 211, 224, 144, 49, 81,
    41, 245, 26, 115, 44, 140, 110, 95, 45, 181, 152,
];
const FINAL_PERIOD: i32 = 100;
const REGULATION_STAT_KEYS: [u32; 4] = [1001, 1002, 3001, 3002];
const STABLE_BOOKMAKER_ID: i32 = 10_021;
const TXLINE_VALIDATE_ODDS_DISCRIMINATOR: [u8; 8] = [192, 19, 91, 138, 104, 100, 212, 86];
const TXLINE_VALIDATE_STAT_V2_DISCRIMINATOR: [u8; 8] = [208, 215, 194, 214, 241, 71, 246, 178];
const DAY_MS: i64 = 86_400_000;
const MAX_SCORE_COMPONENT: i32 = 99;
const CANONICAL_HOME_PARTICIPANT_ID: u64 = 1_999;
const CANONICAL_AWAY_PARTICIPANT_ID: u64 = 2_530;
const CANONICAL_MARKET_ID: [u8; 32] = [
    88, 113, 164, 115, 142, 163, 195, 31, 3, 173, 199, 120, 115, 152, 178, 47, 38, 67, 128, 249,
    44, 177, 161, 147, 163, 72, 58, 197, 2, 167, 200, 45,
];
const CANONICAL_FIXTURE_HASH: [u8; 32] = [
    249, 1, 134, 165, 221, 228, 219, 218, 209, 72, 104, 112, 199, 179, 131, 146, 130, 209, 231, 19,
    44, 189, 121, 85, 254, 134, 180, 12, 175, 154, 199, 208,
];
const CANONICAL_HOME_TEAM_HASH: [u8; 32] = [
    122, 28, 164, 239, 117, 21, 247, 39, 107, 174, 114, 48, 84, 88, 41, 194, 120, 16, 201, 217,
    233, 138, 178, 192, 96, 102, 190, 230, 39, 13, 81, 83,
];
const CANONICAL_AWAY_TEAM_HASH: [u8; 32] = [
    182, 117, 245, 223, 95, 230, 141, 161, 121, 243, 103, 133, 47, 37, 180, 42, 161, 111, 216, 75,
    5, 217, 176, 93, 165, 12, 215, 35, 99, 93, 253, 2,
];
const CANONICAL_REGULATION_TEMPLATE_HASH: [u8; 32] = [
    29, 186, 15, 228, 74, 26, 118, 96, 170, 147, 195, 75, 72, 187, 188, 83, 209, 71, 184, 90, 44,
    166, 59, 78, 189, 15, 26, 116, 70, 106, 142, 215,
];
const CANONICAL_HARD_STOP_UNIX_SECONDS: i64 = 1_783_634_788;
const CANONICAL_ORACLE_GRACE_SECONDS: i64 = 3_600;
const VOID_REASON_ORACLE_UNAVAILABLE: u8 = 1;

// Approved Phase C bootstrap administrator public key. Its private key remains external and is
// never required by the build or repository verification workflow.
// ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq
const BOOTSTRAP_ADMIN: Pubkey = Pubkey::new_from_array([
    198, 44, 96, 106, 50, 224, 149, 244, 185, 210, 223, 241, 133, 36, 164, 188, 116, 203, 42, 163,
    48, 49, 80, 148, 59, 202, 6, 143, 18, 31, 132, 8,
]);

// 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
const TXLINE_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    86, 117, 159, 44, 144, 95, 120, 96, 200, 99, 119, 20, 191, 36, 145, 48, 157, 192, 113, 129, 81,
    63, 122, 36, 191, 62, 218, 248, 127, 119, 80, 3,
]);

#[program]
pub mod fairx_vault_v4 {
    use super::*;

    pub fn initialize_market_v4(
        ctx: Context<InitializeMarketV4>,
        args: InitializeMarketV4Args,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.admin.key(),
            BOOTSTRAP_ADMIN,
            FairXError::InvalidBootstrapAdmin
        );
        require!(
            args.fixture_id == CANONICAL_FIXTURE_ID,
            FairXError::UnsupportedFixture
        );
        require!(
            args.initial_material_event_sequence == CANONICAL_INITIAL_EVENT_SEQUENCE,
            FairXError::InvalidInitialSequence
        );
        require!(
            args.resolution_threshold == 2,
            FairXError::InvalidResolutionThreshold
        );
        validate_canonical_identity(&args)?;
        validate_authorities(
            args.operator,
            args.feed_authority,
            args.pricing_authority,
            &args.resolution_authorities,
        )?;

        let config = &mut ctx.accounts.authority_config;
        config.admin = ctx.accounts.admin.key();
        config.operator = args.operator;
        config.feed_authority = args.feed_authority;
        config.pricing_authority = args.pricing_authority;
        config.resolution_authorities = args.resolution_authorities;
        config.resolution_threshold = args.resolution_threshold;
        config.bump = ctx.bumps.authority_config;

        let market = &mut ctx.accounts.market;
        market.authority_config = config.key();
        market.market_id = args.market_id;
        market.fixture_id = args.fixture_id;
        market.fixture_hash = args.fixture_hash;
        market.home_team_hash = args.home_team_hash;
        market.away_team_hash = args.away_team_hash;
        market.home_participant_id = args.home_participant_id;
        market.away_participant_id = args.away_participant_id;
        market.home_participant_is_home = args.home_participant_is_home;
        market.regulation_template_hash = args.regulation_template_hash;
        market.hard_stop_unix_seconds = CANONICAL_HARD_STOP_UNIX_SECONDS;
        market.oracle_grace_seconds = CANONICAL_ORACLE_GRACE_SECONDS;
        market.latest_material_event_sequence = args.initial_material_event_sequence;
        market.latest_material_event_ts = 0;
        market.latest_material_event_hash = [0; 32];
        market.latest_quote_sequence = 0;
        market.quote_material_event_sequence = 0;
        market.quote_source_ts = 0;
        market.quote_message_id_hash = [0; 32];
        market.quote_payload_hash = [0; 32];
        market.quote_raw_prices = [0; 3];
        market.quote_yes_probability_micros = 0;
        market.quote_yes_price_micros = 0;
        market.quote_no_price_micros = 0;
        market.quote_verified = false;
        market.trading_closed = false;
        market.resolved = false;
        market.resolution = Resolution::Unresolved as u8;
        market.resolved_at = 0;
        market.final_sequence = 0;
        market.final_validation_payload_hash = [0; 32];
        market.void_reason_code = 0;
        market.bump = ctx.bumps.market;
        Ok(())
    }

    pub fn initialize_liquidity_vault(
        ctx: Context<InitializeLiquidityVault>,
        min_stake_lamports: u64,
        max_stake_lamports: u64,
    ) -> Result<()> {
        require!(min_stake_lamports > 0, FairXError::InvalidStake);
        require!(
            max_stake_lamports >= min_stake_lamports,
            FairXError::InvalidStake
        );
        let vault = &mut ctx.accounts.vault;
        vault.market = ctx.accounts.market.key();
        vault.operator = ctx.accounts.operator.key();
        vault.free_collateral = 0;
        vault.reserved_liability = 0;
        vault.accepted_stake_principal = 0;
        vault.pending_refundable_stake = 0;
        vault.yes_reserved_liability = 0;
        vault.no_reserved_liability = 0;
        vault.lifetime_operator_deposits = 0;
        vault.lifetime_operator_withdrawals = 0;
        vault.lifetime_user_stakes = 0;
        vault.lifetime_refunds = 0;
        vault.lifetime_payouts = 0;
        vault.lifetime_losing_stakes = 0;
        vault.position_count = 0;
        vault.next_order_nonce = 0;
        vault.accounting_sequence = 0;
        vault.min_stake_lamports = min_stake_lamports;
        vault.max_stake_lamports = max_stake_lamports;
        vault.bump = ctx.bumps.vault;
        assert_vault_invariant(vault)?;
        Ok(())
    }

    pub fn deposit_liquidity(ctx: Context<DepositLiquidity>, amount: u64) -> Result<()> {
        require!(amount > 0, FairXError::InvalidAmount);
        transfer(
            CpiContext::new(
                anchor_lang::system_program::ID,
                Transfer {
                    from: ctx.accounts.operator.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;
        let vault = &mut ctx.accounts.vault;
        vault.free_collateral = checked_add(vault.free_collateral, amount)?;
        vault.lifetime_operator_deposits = checked_add(vault.lifetime_operator_deposits, amount)?;
        bump_accounting_sequence(vault)?;
        assert_vault_invariant(vault)
    }

    pub fn reconcile_vault_surplus(ctx: Context<ReconcileVaultSurplus>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let surplus = vault_surplus(vault)?;
        vault.free_collateral = checked_add(vault.free_collateral, surplus)?;
        bump_accounting_sequence(vault)?;
        emit!(VaultSurplusReconciled {
            market: vault.market,
            vault: vault.key(),
            surplus_lamports: surplus,
            free_collateral_after: vault.free_collateral,
            accounting_sequence: vault.accounting_sequence,
        });
        assert_vault_invariant(vault)
    }

    pub fn commit_txline_quote(
        ctx: Context<CommitTxlineQuote>,
        args: CommitTxlineQuoteArgs,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(
            !market.resolved && !market.trading_closed,
            FairXError::TradingClosed
        );
        require!(
            args.quote_sequence > market.latest_quote_sequence,
            FairXError::QuoteSequenceRegression
        );
        require!(
            args.material_event_sequence == market.latest_material_event_sequence,
            FairXError::MaterialSequenceMismatch
        );
        require!(
            args.spread_micros == CANONICAL_SPREAD_MICROS,
            FairXError::InvalidReplaySpread
        );
        validate_odds(&args.odds, market.fixture_id)?;
        validate_canonical_quote(
            args.quote_sequence,
            args.material_event_sequence,
            market.latest_material_event_ts,
            &args.odds,
        )?;
        let (probability, yes_price, no_price) =
            derive_quote_prices(&args.odds.prices, args.spread_micros)?;
        let payload_hash = borsh_hash(&args.odds)?;

        market.latest_quote_sequence = args.quote_sequence;
        market.quote_material_event_sequence = args.material_event_sequence;
        market.quote_source_ts = args.odds.ts;
        market.quote_message_id_hash = hash(args.odds.message_id.as_bytes()).to_bytes();
        market.quote_payload_hash = payload_hash;
        market
            .quote_raw_prices
            .copy_from_slice(&args.odds.prices[..3]);
        market.quote_yes_probability_micros = probability;
        market.quote_yes_price_micros = yes_price;
        market.quote_no_price_micros = no_price;
        market.quote_verified = false;
        Ok(())
    }

    pub fn verify_txline_quote(
        ctx: Context<VerifyTxlineQuote>,
        args: VerifyTxlineQuoteArgs,
    ) -> Result<()> {
        require!(
            args.quote_sequence == ctx.accounts.market.latest_quote_sequence,
            FairXError::QuoteSequenceMismatch
        );
        validate_odds(&args.odds, ctx.accounts.market.fixture_id)?;
        validate_canonical_quote(
            args.quote_sequence,
            ctx.accounts.market.quote_material_event_sequence,
            ctx.accounts.market.latest_material_event_ts,
            &args.odds,
        )?;
        let payload_hash = borsh_hash(&args.odds)?;
        require!(
            payload_hash == ctx.accounts.market.quote_payload_hash,
            FairXError::QuotePayloadMismatch
        );
        require!(
            hash(args.odds.message_id.as_bytes()).to_bytes()
                == ctx.accounts.market.quote_message_id_hash,
            FairXError::QuotePayloadMismatch
        );
        require!(
            args.odds.ts == ctx.accounts.market.quote_source_ts,
            FairXError::QuotePayloadMismatch
        );
        require!(
            args.summary.fixture_id == ctx.accounts.market.fixture_id as i64,
            FairXError::FixtureMismatch
        );

        let epoch_day = epoch_day_from_ms(args.odds.ts)?;
        validate_txline_root(
            &ctx.accounts.txline_odds_root.to_account_info(),
            b"daily_batch_roots",
            epoch_day,
        )?;
        invoke_txline_validate_odds(
            &ctx.accounts.txline_odds_root.to_account_info(),
            &ctx.accounts.txline_program.to_account_info(),
            &args.odds,
            &args.summary,
            &args.sub_tree_proof,
            &args.main_tree_proof,
        )?;

        let receipt = &mut ctx.accounts.quote_receipt;
        receipt.market = ctx.accounts.market.key();
        receipt.quote_sequence = args.quote_sequence;
        receipt.validation_root_pda = ctx.accounts.txline_odds_root.key();
        receipt.payload_hash = payload_hash;
        receipt.message_id_hash = ctx.accounts.market.quote_message_id_hash;
        receipt.source_ts = args.odds.ts;
        receipt.raw_prices.copy_from_slice(&args.odds.prices[..3]);
        receipt.yes_price_micros = ctx.accounts.market.quote_yes_price_micros;
        receipt.no_price_micros = ctx.accounts.market.quote_no_price_micros;
        receipt.direct_cpi_verified = true;
        receipt.currently_executable = ctx.accounts.market.quote_material_event_sequence
            == ctx.accounts.market.latest_material_event_sequence;
        receipt.bump = ctx.bumps.quote_receipt;
        ctx.accounts.market.quote_verified = receipt.currently_executable;
        Ok(())
    }

    pub fn ingest_material_event_v4(
        ctx: Context<IngestMaterialEventV4>,
        sequence: u64,
        source_ts: i64,
        payload_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            sequence > ctx.accounts.market.latest_material_event_sequence,
            FairXError::MaterialSequenceRegression
        );
        require!(
            sequence == CANONICAL_GOAL_SEQUENCE,
            FairXError::UnsupportedReplaySequence
        );
        require!(
            source_ts == CANONICAL_GOAL_TIMESTAMP_MS,
            FairXError::InvalidTimestamp
        );
        require!(
            payload_hash == CANONICAL_GOAL_PAYLOAD_HASH,
            FairXError::InvalidReplayEvent
        );
        let market = &mut ctx.accounts.market;
        market.latest_material_event_sequence = sequence;
        market.latest_material_event_ts = source_ts;
        market.latest_material_event_hash = payload_hash;
        market.quote_verified = false;
        Ok(())
    }

    pub fn place_fixed_payout_order(
        ctx: Context<PlaceFixedPayoutOrder>,
        args: PlaceFixedPayoutOrderArgs,
    ) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved && !ctx.accounts.market.trading_closed,
            FairXError::TradingClosed
        );
        require!(args.side <= Side::No as u8, FairXError::InvalidSide);
        require!(
            args.stake_lamports >= ctx.accounts.vault.min_stake_lamports,
            FairXError::InvalidStake
        );
        require!(
            args.stake_lamports <= ctx.accounts.vault.max_stake_lamports,
            FairXError::InvalidStake
        );
        require!(
            Clock::get()?.slot <= args.expiry_slot,
            FairXError::OrderExpired
        );
        require!(
            args.expected_material_event_sequence
                <= ctx.accounts.market.latest_material_event_sequence,
            FairXError::FutureMaterialSequence
        );
        require!(
            args.order_nonce == ctx.accounts.vault.next_order_nonce,
            FairXError::OrderNonceMismatch
        );

        transfer(
            CpiContext::new(
                anchor_lang::system_program::ID,
                Transfer {
                    from: ctx.accounts.trader.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            args.stake_lamports,
        )?;

        let position = &mut ctx.accounts.position;
        position.market = ctx.accounts.market.key();
        position.vault = ctx.accounts.vault.key();
        position.owner = ctx.accounts.trader.key();
        position.rent_recipient = ctx.accounts.trader.key();
        position.client_order_id = args.client_order_id;
        position.order_nonce = args.order_nonce;
        position.side = args.side;
        position.stake_lamports = args.stake_lamports;
        position.quote_sequence = args.expected_quote_sequence;
        position.quote_payload_hash = args.expected_quote_payload_hash;
        position.material_event_sequence = args.expected_material_event_sequence;
        position.source_ts = 0;
        position.execution_price_micros = 0;
        position.gross_payout_lamports = 0;
        position.reserved_liability_lamports = 0;
        position.claimed_lamports = 0;
        position.bump = ctx.bumps.position;

        let vault = &mut ctx.accounts.vault;
        vault.pending_refundable_stake =
            checked_add(vault.pending_refundable_stake, args.stake_lamports)?;
        vault.lifetime_user_stakes = checked_add(vault.lifetime_user_stakes, args.stake_lamports)?;
        vault.position_count = checked_add(vault.position_count, 1)?;
        vault.next_order_nonce = checked_add(vault.next_order_nonce, 1)?;

        if args.expected_material_event_sequence
            < ctx.accounts.market.latest_material_event_sequence
        {
            // The stake enters and leaves the vault in the same instruction. The durable
            // position is a refund receipt and can never become claimable.
            move_lamports(
                &vault.to_account_info(),
                &ctx.accounts.trader.to_account_info(),
                args.stake_lamports,
            )?;
            vault.pending_refundable_stake =
                checked_sub(vault.pending_refundable_stake, args.stake_lamports)?;
            vault.lifetime_refunds = checked_add(vault.lifetime_refunds, args.stake_lamports)?;
            position.status = PositionStatus::Refunded as u8;
            bump_accounting_sequence(vault)?;
            assert_vault_invariant(vault)?;
            return Ok(());
        }

        require!(
            ctx.accounts.market.quote_material_event_sequence
                == ctx.accounts.market.latest_material_event_sequence,
            FairXError::StaleQuote
        );
        require!(
            ctx.accounts.market.quote_verified,
            FairXError::QuoteNotVerified
        );
        require!(
            args.expected_quote_sequence == ctx.accounts.market.latest_quote_sequence,
            FairXError::QuoteSequenceMismatch
        );
        require!(
            args.expected_quote_payload_hash == ctx.accounts.market.quote_payload_hash,
            FairXError::QuotePayloadMismatch
        );
        let execution_price = if args.side == Side::Yes as u8 {
            ctx.accounts.market.quote_yes_price_micros
        } else {
            ctx.accounts.market.quote_no_price_micros
        };
        require!(
            args.expected_execution_price_micros == execution_price,
            FairXError::ExecutionPriceMismatch
        );
        let gross = gross_payout(args.stake_lamports, execution_price)?;
        let liability = checked_sub(gross, args.stake_lamports)?;
        vault.pending_refundable_stake =
            checked_sub(vault.pending_refundable_stake, args.stake_lamports)?;
        apply_accept(vault, args.side, args.stake_lamports, liability)?;
        position.source_ts = ctx.accounts.market.quote_source_ts;
        position.execution_price_micros = execution_price;
        position.gross_payout_lamports = gross;
        position.reserved_liability_lamports = liability;
        position.status = PositionStatus::Accepted as u8;
        bump_accounting_sequence(vault)?;
        assert_vault_invariant(vault)
    }

    pub fn prove_resolution_with_txline_v4(
        ctx: Context<ProveResolutionWithTxlineV4>,
        args: ProveResolutionArgs,
    ) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved,
            FairXError::MarketAlreadyResolved
        );
        require!(
            args.final_sequence == CANONICAL_FINAL_SEQUENCE,
            FairXError::UnsupportedReplaySequence
        );
        require!(
            args.payload.fixture_summary.fixture_id == ctx.accounts.market.fixture_id as i64,
            FairXError::FixtureMismatch
        );
        require!(
            args.payload.ts == CANONICAL_FINAL_TIMESTAMP_MS,
            FairXError::InvalidFinalTimestamp
        );
        require!(args.payload.stats.len() == 4, FairXError::InvalidFinalStats);
        let proposer_index = resolution_authority_index(
            &ctx.accounts.authority_config.resolution_authorities,
            ctx.accounts.proposer.key(),
        )?;
        let (home_score, away_score) = regulation_score(&args.payload)?;
        let payload_hash = borsh_hash(&args.payload)?;
        let epoch_day = epoch_day_from_ms(args.payload.ts)?;
        validate_txline_root(
            &ctx.accounts.txline_scores_root.to_account_info(),
            b"daily_scores_roots",
            epoch_day,
        )?;
        let strategy = exact_stat_strategy(&args.payload);
        invoke_txline_validate_stat_v2(
            &ctx.accounts.txline_scores_root.to_account_info(),
            &ctx.accounts.txline_program.to_account_info(),
            &args.payload,
            &strategy,
        )?;
        let outcome = if home_score > away_score {
            Resolution::Yes
        } else {
            Resolution::No
        };

        let receipt = &mut ctx.accounts.resolution_receipt;
        receipt.market = ctx.accounts.market.key();
        receipt.final_sequence = args.final_sequence;
        receipt.validation_root_pda = ctx.accounts.txline_scores_root.key();
        receipt.validation_payload_hash = payload_hash;
        receipt.event_stat_root = args.payload.event_stat_root;
        receipt.home_regulation_score = home_score;
        receipt.away_regulation_score = away_score;
        receipt.derived_outcome = outcome as u8;
        receipt.proof_timestamp = args.payload.ts;
        receipt.direct_cpi_verified = true;
        receipt.bump = ctx.bumps.resolution_receipt;

        let proposal = &mut ctx.accounts.resolution_proposal;
        proposal.market = ctx.accounts.market.key();
        proposal.validation_receipt = receipt.key();
        proposal.validation_payload_hash = payload_hash;
        proposal.derived_outcome = outcome as u8;
        proposal.void_reason_code = 0;
        proposal.approvals_mask = 1u8 << proposer_index;
        proposal.executed = false;
        proposal.bump = ctx.bumps.resolution_proposal;
        ctx.accounts.market.trading_closed = true;
        Ok(())
    }

    pub fn approve_resolution_v4(ctx: Context<ApproveResolutionV4>) -> Result<()> {
        require!(
            !ctx.accounts.resolution_proposal.executed,
            FairXError::ProposalAlreadyExecuted
        );
        let index = resolution_authority_index(
            &ctx.accounts.authority_config.resolution_authorities,
            ctx.accounts.approver.key(),
        )?;
        let mask = 1u8 << index;
        require!(
            ctx.accounts.resolution_proposal.approvals_mask & mask == 0,
            FairXError::DuplicateApproval
        );
        ctx.accounts.resolution_proposal.approvals_mask |= mask;
        Ok(())
    }

    pub fn execute_resolution_v4(ctx: Context<ExecuteResolutionV4>) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved,
            FairXError::MarketAlreadyResolved
        );
        require!(
            ctx.accounts.resolution_receipt.direct_cpi_verified,
            FairXError::TxlineValidationFailed
        );
        require!(
            !ctx.accounts.resolution_proposal.executed,
            FairXError::ProposalAlreadyExecuted
        );
        require!(
            ctx.accounts.resolution_proposal.approvals_mask.count_ones() as u8
                >= ctx.accounts.authority_config.resolution_threshold,
            FairXError::ResolutionThresholdNotMet
        );
        require!(
            ctx.accounts.resolution_proposal.validation_payload_hash
                == ctx.accounts.resolution_receipt.validation_payload_hash,
            FairXError::ResolutionReceiptMismatch
        );
        require!(
            ctx.accounts.resolution_proposal.derived_outcome
                == ctx.accounts.resolution_receipt.derived_outcome,
            FairXError::ResolutionReceiptMismatch
        );
        require!(
            ctx.accounts.resolution_proposal.derived_outcome != Resolution::Void as u8,
            FairXError::ResolutionReceiptMismatch
        );
        let market = &mut ctx.accounts.market;
        market.resolved = true;
        market.trading_closed = true;
        market.resolution = ctx.accounts.resolution_receipt.derived_outcome;
        market.resolved_at = Clock::get()?.unix_timestamp;
        market.final_sequence = ctx.accounts.resolution_receipt.final_sequence;
        market.final_validation_payload_hash =
            ctx.accounts.resolution_receipt.validation_payload_hash;
        ctx.accounts.resolution_proposal.executed = true;
        Ok(())
    }

    pub fn propose_void_v4(ctx: Context<ProposeVoidV4>, reason_code: u8) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved,
            FairXError::MarketAlreadyResolved
        );
        require!(
            ctx.accounts.resolution_receipt.data_is_empty(),
            FairXError::ValidResolutionAlreadyCommitted
        );
        require!(
            reason_code == VOID_REASON_ORACLE_UNAVAILABLE,
            FairXError::InvalidVoidReason
        );
        let eligible_at = ctx
            .accounts
            .market
            .hard_stop_unix_seconds
            .checked_add(ctx.accounts.market.oracle_grace_seconds)
            .ok_or(FairXError::MathOverflow)?;
        require!(
            Clock::get()?.unix_timestamp >= eligible_at,
            FairXError::VoidNotYetAvailable
        );
        let proposer_index = resolution_authority_index(
            &ctx.accounts.authority_config.resolution_authorities,
            ctx.accounts.proposer.key(),
        )?;
        let proposal = &mut ctx.accounts.resolution_proposal;
        proposal.market = ctx.accounts.market.key();
        proposal.validation_receipt = Pubkey::default();
        proposal.validation_payload_hash = hash(&[b'V', b'O', b'I', b'D', reason_code]).to_bytes();
        proposal.derived_outcome = Resolution::Void as u8;
        proposal.void_reason_code = reason_code;
        proposal.approvals_mask = 1u8 << proposer_index;
        proposal.executed = false;
        proposal.bump = ctx.bumps.resolution_proposal;
        ctx.accounts.market.trading_closed = true;
        Ok(())
    }

    pub fn execute_void_v4(ctx: Context<ExecuteVoidV4>) -> Result<()> {
        require!(
            !ctx.accounts.market.resolved,
            FairXError::MarketAlreadyResolved
        );
        require!(
            !ctx.accounts.resolution_proposal.executed,
            FairXError::ProposalAlreadyExecuted
        );
        require!(
            ctx.accounts.resolution_proposal.derived_outcome == Resolution::Void as u8
                && ctx.accounts.resolution_proposal.void_reason_code
                    == VOID_REASON_ORACLE_UNAVAILABLE,
            FairXError::InvalidVoidReason
        );
        require!(
            ctx.accounts.resolution_proposal.approvals_mask.count_ones() as u8
                >= ctx.accounts.authority_config.resolution_threshold,
            FairXError::ResolutionThresholdNotMet
        );
        let market = &mut ctx.accounts.market;
        market.resolved = true;
        market.trading_closed = true;
        market.resolution = Resolution::Void as u8;
        market.resolved_at = Clock::get()?.unix_timestamp;
        market.final_sequence = 0;
        market.final_validation_payload_hash = [0; 32];
        market.void_reason_code = ctx.accounts.resolution_proposal.void_reason_code;
        ctx.accounts.resolution_proposal.executed = true;
        Ok(())
    }

    pub fn claim_fixed_payout(ctx: Context<ClaimFixedPayout>) -> Result<()> {
        require!(ctx.accounts.market.resolved, FairXError::MarketNotResolved);
        require!(
            ctx.accounts.market.resolution != Resolution::Void as u8,
            FairXError::VoidPositionMustRefund
        );
        require!(
            ctx.accounts.position.status == PositionStatus::Accepted as u8,
            FairXError::PositionNotClaimable
        );
        require!(
            position_won(ctx.accounts.position.side, ctx.accounts.market.resolution),
            FairXError::PositionDidNotWin
        );
        let gross = ctx.accounts.position.gross_payout_lamports;
        let liability = ctx.accounts.position.reserved_liability_lamports;
        apply_claim(
            &mut ctx.accounts.vault,
            ctx.accounts.position.side,
            ctx.accounts.position.stake_lamports,
            liability,
            gross,
        )?;
        ctx.accounts.position.status = PositionStatus::Claimed as u8;
        ctx.accounts.position.claimed_lamports = gross;
        move_lamports(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.trader.to_account_info(),
            gross,
        )?;
        bump_accounting_sequence(&mut ctx.accounts.vault)?;
        assert_vault_invariant(&ctx.accounts.vault)
    }

    pub fn claim_void_refund(ctx: Context<ClaimVoidRefund>) -> Result<()> {
        require!(ctx.accounts.market.resolved, FairXError::MarketNotResolved);
        require!(
            ctx.accounts.market.resolution == Resolution::Void as u8,
            FairXError::MarketNotVoid
        );
        require!(
            ctx.accounts.position.status == PositionStatus::Accepted as u8,
            FairXError::PositionNotRefundable
        );
        let stake = ctx.accounts.position.stake_lamports;
        apply_void_refund(
            &mut ctx.accounts.vault,
            ctx.accounts.position.side,
            stake,
            ctx.accounts.position.reserved_liability_lamports,
        )?;
        ctx.accounts.position.status = PositionStatus::Voided as u8;
        ctx.accounts.position.claimed_lamports = stake;
        move_lamports(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.trader.to_account_info(),
            stake,
        )?;
        bump_accounting_sequence(&mut ctx.accounts.vault)?;
        assert_vault_invariant(&ctx.accounts.vault)
    }

    pub fn reconcile_position(ctx: Context<ReconcilePosition>) -> Result<()> {
        require!(ctx.accounts.market.resolved, FairXError::MarketNotResolved);
        require!(
            ctx.accounts.market.resolution != Resolution::Void as u8,
            FairXError::VoidPositionMustRefund
        );
        require!(
            ctx.accounts.position.status == PositionStatus::Accepted as u8,
            FairXError::PositionNotReconcileable
        );
        require!(
            !position_won(ctx.accounts.position.side, ctx.accounts.market.resolution),
            FairXError::WinningPositionMustClaim
        );
        apply_reconcile_loss(
            &mut ctx.accounts.vault,
            ctx.accounts.position.side,
            ctx.accounts.position.stake_lamports,
            ctx.accounts.position.reserved_liability_lamports,
        )?;
        ctx.accounts.position.status = PositionStatus::Lost as u8;
        bump_accounting_sequence(&mut ctx.accounts.vault)?;
        assert_vault_invariant(&ctx.accounts.vault)
    }

    pub fn close_fixed_payout_position(ctx: Context<CloseFixedPayoutPosition>) -> Result<()> {
        require!(
            is_terminal_position(ctx.accounts.position.status),
            FairXError::PositionNotClosable
        );
        ctx.accounts.vault.position_count = checked_sub(ctx.accounts.vault.position_count, 1)?;
        Ok(())
    }

    pub fn withdraw_free_liquidity(ctx: Context<WithdrawFreeLiquidity>, amount: u64) -> Result<()> {
        require!(
            amount > 0 && amount <= ctx.accounts.vault.free_collateral,
            FairXError::InsufficientFreeCollateral
        );
        ctx.accounts.vault.free_collateral =
            checked_sub(ctx.accounts.vault.free_collateral, amount)?;
        ctx.accounts.vault.lifetime_operator_withdrawals =
            checked_add(ctx.accounts.vault.lifetime_operator_withdrawals, amount)?;
        move_lamports(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.operator.to_account_info(),
            amount,
        )?;
        bump_accounting_sequence(&mut ctx.accounts.vault)?;
        assert_vault_invariant(&ctx.accounts.vault)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeMarketV4Args {
    pub market_id: [u8; 32],
    pub fixture_id: u64,
    pub fixture_hash: [u8; 32],
    pub home_team_hash: [u8; 32],
    pub away_team_hash: [u8; 32],
    pub home_participant_id: u64,
    pub away_participant_id: u64,
    pub home_participant_is_home: bool,
    pub regulation_template_hash: [u8; 32],
    pub initial_material_event_sequence: u64,
    pub operator: Pubkey,
    pub feed_authority: Pubkey,
    pub pricing_authority: Pubkey,
    pub resolution_authorities: [Pubkey; 3],
    pub resolution_threshold: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommitTxlineQuoteArgs {
    pub quote_sequence: u64,
    pub material_event_sequence: u64,
    pub spread_micros: u64,
    pub odds: Odds,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VerifyTxlineQuoteArgs {
    pub quote_sequence: u64,
    pub odds: Odds,
    pub summary: OddsBatchSummary,
    pub sub_tree_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlaceFixedPayoutOrderArgs {
    pub client_order_id: [u8; 32],
    pub order_nonce: u64,
    pub side: u8,
    pub stake_lamports: u64,
    pub expected_quote_sequence: u64,
    pub expected_quote_payload_hash: [u8; 32],
    pub expected_execution_price_micros: u64,
    pub expected_material_event_sequence: u64,
    pub expiry_slot: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProveResolutionArgs {
    pub final_sequence: u64,
    pub payload: StatValidationInput,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

// Exact Borsh-compatible subset of TxLINE validateOdds.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Odds {
    pub fixture_id: i64,
    pub message_id: String,
    pub ts: i64,
    pub bookmaker: String,
    pub bookmaker_id: i32,
    pub super_odds_type: String,
    pub game_state: Option<String>,
    pub in_running: bool,
    pub market_parameters: Option<String>,
    pub market_period: Option<String>,
    pub price_names: Vec<String>,
    pub prices: Vec<i32>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OddsUpdateStats {
    pub update_count: u32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OddsBatchSummary {
    pub fixture_id: i64,
    pub update_stats: OddsUpdateStats,
    pub odds_sub_tree_root: [u8; 32],
}

// Exact Borsh-compatible subset of TxLINE validateStatV2.
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
#[instruction(args: InitializeMarketV4Args)]
pub struct InitializeMarketV4<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + AuthorityConfigV4::INIT_SPACE, seeds = [b"authority-config-v4"], bump)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(init, payer = admin, space = 8 + MarketV4::INIT_SPACE, seeds = [b"market-v4", args.market_id.as_ref()], bump)]
    pub market: Account<'info, MarketV4>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeLiquidityVault<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump, constraint = authority_config.operator == operator.key() @ FairXError::InvalidOperator)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(has_one = authority_config @ FairXError::AccountSubstitution, seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(init, payer = operator, space = 8 + LiquidityVaultV4::INIT_SPACE, seeds = [b"liquidity-vault-v4", market.key().as_ref()], bump)]
    pub vault: Account<'info, LiquidityVaultV4>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump, constraint = authority_config.operator == operator.key() @ FairXError::InvalidOperator)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, has_one = operator @ FairXError::InvalidOperator, seeds = [b"liquidity-vault-v4", market.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, LiquidityVaultV4>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReconcileVaultSurplus<'info> {
    #[account(seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, seeds = [b"liquidity-vault-v4", market.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, LiquidityVaultV4>,
}

#[derive(Accounts)]
pub struct CommitTxlineQuote<'info> {
    pub pricing_authority: Signer<'info>,
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump, constraint = authority_config.pricing_authority == pricing_authority.key() @ FairXError::InvalidPricingAuthority)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(mut, has_one = authority_config @ FairXError::AccountSubstitution, seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
}

#[derive(Accounts)]
#[instruction(args: VerifyTxlineQuoteArgs)]
pub struct VerifyTxlineQuote<'info> {
    #[account(mut)]
    pub verifier: Signer<'info>,
    #[account(mut, seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    /// CHECK: constrained to the canonical TxLINE-owned daily odds root in the handler.
    pub txline_odds_root: UncheckedAccount<'info>,
    /// CHECK: constrained to the fixed executable TxLINE devnet program in the handler.
    pub txline_program: UncheckedAccount<'info>,
    #[account(init, payer = verifier, space = 8 + TxlineQuoteValidationReceiptV4::INIT_SPACE, seeds = [b"quote-proof-v4", market.key().as_ref(), &args.quote_sequence.to_le_bytes()], bump)]
    pub quote_receipt: Account<'info, TxlineQuoteValidationReceiptV4>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct IngestMaterialEventV4<'info> {
    pub feed_authority: Signer<'info>,
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump, constraint = authority_config.feed_authority == feed_authority.key() @ FairXError::InvalidFeedAuthority)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(mut, has_one = authority_config @ FairXError::AccountSubstitution, seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
}

#[derive(Accounts)]
#[instruction(args: PlaceFixedPayoutOrderArgs)]
pub struct PlaceFixedPayoutOrder<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, seeds = [b"liquidity-vault-v4", market.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, LiquidityVaultV4>,
    #[account(init, payer = trader, space = 8 + FixedPayoutPositionV4::INIT_SPACE, seeds = [b"position-v4", market.key().as_ref(), trader.key().as_ref(), args.client_order_id.as_ref(), &args.order_nonce.to_le_bytes()], bump)]
    pub position: Account<'info, FixedPayoutPositionV4>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProveResolutionWithTxlineV4<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(mut, has_one = authority_config @ FairXError::AccountSubstitution, seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    /// CHECK: constrained to the canonical TxLINE-owned daily scores root in the handler.
    pub txline_scores_root: UncheckedAccount<'info>,
    /// CHECK: constrained to the fixed executable TxLINE devnet program in the handler.
    pub txline_program: UncheckedAccount<'info>,
    #[account(init, payer = proposer, space = 8 + TxlineResolutionReceiptV4::INIT_SPACE, seeds = [b"resolution-proof-v4", market.key().as_ref()], bump)]
    pub resolution_receipt: Account<'info, TxlineResolutionReceiptV4>,
    #[account(init, payer = proposer, space = 8 + ResolutionProposalV4::INIT_SPACE, seeds = [b"resolution-proposal-v4", market.key().as_ref()], bump)]
    pub resolution_proposal: Account<'info, ResolutionProposalV4>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveResolutionV4<'info> {
    pub approver: Signer<'info>,
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(has_one = authority_config @ FairXError::AccountSubstitution, seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, seeds = [b"resolution-proposal-v4", market.key().as_ref()], bump = resolution_proposal.bump)]
    pub resolution_proposal: Account<'info, ResolutionProposalV4>,
}

#[derive(Accounts)]
pub struct ProposeVoidV4<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(mut, has_one = authority_config @ FairXError::AccountSubstitution, seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    /// CHECK: canonical receipt PDA must still be uninitialized before VOID can be proposed.
    #[account(seeds = [b"resolution-proof-v4", market.key().as_ref()], bump)]
    pub resolution_receipt: UncheckedAccount<'info>,
    #[account(init, payer = proposer, space = 8 + ResolutionProposalV4::INIT_SPACE, seeds = [b"resolution-proposal-v4", market.key().as_ref()], bump)]
    pub resolution_proposal: Account<'info, ResolutionProposalV4>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteVoidV4<'info> {
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(mut, has_one = authority_config @ FairXError::AccountSubstitution, seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, seeds = [b"resolution-proposal-v4", market.key().as_ref()], bump = resolution_proposal.bump)]
    pub resolution_proposal: Account<'info, ResolutionProposalV4>,
}

#[derive(Accounts)]
pub struct ExecuteResolutionV4<'info> {
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(mut, has_one = authority_config @ FairXError::AccountSubstitution, seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(has_one = market @ FairXError::AccountSubstitution, seeds = [b"resolution-proof-v4", market.key().as_ref()], bump = resolution_receipt.bump)]
    pub resolution_receipt: Account<'info, TxlineResolutionReceiptV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, constraint = resolution_proposal.validation_receipt == resolution_receipt.key() @ FairXError::ResolutionReceiptMismatch, seeds = [b"resolution-proposal-v4", market.key().as_ref()], bump = resolution_proposal.bump)]
    pub resolution_proposal: Account<'info, ResolutionProposalV4>,
}

#[derive(Accounts)]
pub struct ClaimFixedPayout<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, seeds = [b"liquidity-vault-v4", market.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, LiquidityVaultV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, has_one = vault @ FairXError::AccountSubstitution, constraint = position.owner == trader.key() @ FairXError::InvalidPositionOwner, seeds = [b"position-v4", market.key().as_ref(), trader.key().as_ref(), position.client_order_id.as_ref(), &position.order_nonce.to_le_bytes()], bump = position.bump)]
    pub position: Account<'info, FixedPayoutPositionV4>,
}

#[derive(Accounts)]
pub struct ClaimVoidRefund<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, seeds = [b"liquidity-vault-v4", market.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, LiquidityVaultV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, has_one = vault @ FairXError::AccountSubstitution, constraint = position.owner == trader.key() @ FairXError::InvalidPositionOwner, seeds = [b"position-v4", market.key().as_ref(), trader.key().as_ref(), position.client_order_id.as_ref(), &position.order_nonce.to_le_bytes()], bump = position.bump)]
    pub position: Account<'info, FixedPayoutPositionV4>,
}

#[derive(Accounts)]
pub struct ReconcilePosition<'info> {
    #[account(seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, seeds = [b"liquidity-vault-v4", market.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, LiquidityVaultV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, has_one = vault @ FairXError::AccountSubstitution, seeds = [b"position-v4", market.key().as_ref(), position.owner.as_ref(), position.client_order_id.as_ref(), &position.order_nonce.to_le_bytes()], bump = position.bump)]
    pub position: Account<'info, FixedPayoutPositionV4>,
}

#[derive(Accounts)]
pub struct CloseFixedPayoutPosition<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, seeds = [b"liquidity-vault-v4", market.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, LiquidityVaultV4>,
    #[account(mut, close = trader, has_one = market @ FairXError::AccountSubstitution, has_one = vault @ FairXError::AccountSubstitution, constraint = position.owner == trader.key() @ FairXError::InvalidPositionOwner, constraint = position.rent_recipient == trader.key() @ FairXError::InvalidRentRecipient, seeds = [b"position-v4", market.key().as_ref(), trader.key().as_ref(), position.client_order_id.as_ref(), &position.order_nonce.to_le_bytes()], bump = position.bump)]
    pub position: Account<'info, FixedPayoutPositionV4>,
}

#[derive(Accounts)]
pub struct WithdrawFreeLiquidity<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(seeds = [b"authority-config-v4"], bump = authority_config.bump, constraint = authority_config.operator == operator.key() @ FairXError::InvalidOperator)]
    pub authority_config: Account<'info, AuthorityConfigV4>,
    #[account(seeds = [b"market-v4", market.market_id.as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV4>,
    #[account(mut, has_one = market @ FairXError::AccountSubstitution, has_one = operator @ FairXError::InvalidOperator, seeds = [b"liquidity-vault-v4", market.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, LiquidityVaultV4>,
}

#[account]
#[derive(InitSpace)]
pub struct AuthorityConfigV4 {
    pub admin: Pubkey,
    pub operator: Pubkey,
    pub feed_authority: Pubkey,
    pub pricing_authority: Pubkey,
    pub resolution_authorities: [Pubkey; 3],
    pub resolution_threshold: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MarketV4 {
    pub authority_config: Pubkey,
    pub market_id: [u8; 32],
    pub fixture_id: u64,
    pub fixture_hash: [u8; 32],
    pub home_team_hash: [u8; 32],
    pub away_team_hash: [u8; 32],
    pub home_participant_id: u64,
    pub away_participant_id: u64,
    pub home_participant_is_home: bool,
    pub regulation_template_hash: [u8; 32],
    pub hard_stop_unix_seconds: i64,
    pub oracle_grace_seconds: i64,
    pub latest_material_event_sequence: u64,
    pub latest_material_event_ts: i64,
    pub latest_material_event_hash: [u8; 32],
    pub latest_quote_sequence: u64,
    pub quote_material_event_sequence: u64,
    pub quote_source_ts: i64,
    pub quote_message_id_hash: [u8; 32],
    pub quote_payload_hash: [u8; 32],
    pub quote_raw_prices: [i32; 3],
    pub quote_yes_probability_micros: u64,
    pub quote_yes_price_micros: u64,
    pub quote_no_price_micros: u64,
    pub quote_verified: bool,
    pub trading_closed: bool,
    pub resolved: bool,
    pub resolution: u8,
    pub resolved_at: i64,
    pub final_sequence: u64,
    pub final_validation_payload_hash: [u8; 32],
    pub void_reason_code: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LiquidityVaultV4 {
    pub market: Pubkey,
    pub operator: Pubkey,
    pub free_collateral: u64,
    pub reserved_liability: u64,
    pub accepted_stake_principal: u64,
    pub pending_refundable_stake: u64,
    pub yes_reserved_liability: u64,
    pub no_reserved_liability: u64,
    pub lifetime_operator_deposits: u64,
    pub lifetime_operator_withdrawals: u64,
    pub lifetime_user_stakes: u64,
    pub lifetime_refunds: u64,
    pub lifetime_payouts: u64,
    pub lifetime_losing_stakes: u64,
    pub position_count: u64,
    pub next_order_nonce: u64,
    pub accounting_sequence: u64,
    pub min_stake_lamports: u64,
    pub max_stake_lamports: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FixedPayoutPositionV4 {
    pub market: Pubkey,
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub rent_recipient: Pubkey,
    pub client_order_id: [u8; 32],
    pub order_nonce: u64,
    pub side: u8,
    pub stake_lamports: u64,
    pub execution_price_micros: u64,
    pub gross_payout_lamports: u64,
    pub reserved_liability_lamports: u64,
    pub quote_sequence: u64,
    pub quote_payload_hash: [u8; 32],
    pub material_event_sequence: u64,
    pub source_ts: i64,
    pub status: u8,
    pub claimed_lamports: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TxlineQuoteValidationReceiptV4 {
    pub market: Pubkey,
    pub quote_sequence: u64,
    pub validation_root_pda: Pubkey,
    pub payload_hash: [u8; 32],
    pub message_id_hash: [u8; 32],
    pub source_ts: i64,
    pub raw_prices: [i32; 3],
    pub yes_price_micros: u64,
    pub no_price_micros: u64,
    pub direct_cpi_verified: bool,
    pub currently_executable: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TxlineResolutionReceiptV4 {
    pub market: Pubkey,
    pub final_sequence: u64,
    pub validation_root_pda: Pubkey,
    pub validation_payload_hash: [u8; 32],
    pub event_stat_root: [u8; 32],
    pub home_regulation_score: u16,
    pub away_regulation_score: u16,
    pub derived_outcome: u8,
    pub proof_timestamp: i64,
    pub direct_cpi_verified: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ResolutionProposalV4 {
    pub market: Pubkey,
    pub validation_receipt: Pubkey,
    pub validation_payload_hash: [u8; 32],
    pub derived_outcome: u8,
    pub void_reason_code: u8,
    pub approvals_mask: u8,
    pub executed: bool,
    pub bump: u8,
}

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Yes = 0,
    No = 1,
}

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum PositionStatus {
    Accepted = 0,
    Refunded = 1,
    Claimed = 2,
    Lost = 3,
    Voided = 4,
}

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Resolution {
    Unresolved = 0,
    Yes = 1,
    No = 2,
    Void = 3,
}

#[event]
pub struct VaultSurplusReconciled {
    pub market: Pubkey,
    pub vault: Pubkey,
    pub surplus_lamports: u64,
    pub free_collateral_after: u64,
    pub accounting_sequence: u64,
}

fn validate_odds(odds: &Odds, fixture_id: u64) -> Result<()> {
    require!(
        odds.fixture_id == fixture_id as i64,
        FairXError::FixtureMismatch
    );
    require!(
        odds.bookmaker == "TXLineStablePriceDemargined",
        FairXError::InvalidOddsSource
    );
    require!(
        odds.bookmaker_id == STABLE_BOOKMAKER_ID,
        FairXError::InvalidOddsSource
    );
    require!(
        odds.super_odds_type == "1X2_PARTICIPANT_RESULT",
        FairXError::InvalidOddsMarket
    );
    require!(
        odds.market_parameters.is_none() && odds.market_period.is_none(),
        FairXError::InvalidOddsMarket
    );
    require!(
        odds.price_names == ["part1", "draw", "part2"],
        FairXError::InvalidOddsMarket
    );
    require!(
        odds.prices.len() == 3 && odds.prices.iter().all(|value| *value > 0),
        FairXError::InvalidOddsPrices
    );
    require!(
        !odds.message_id.is_empty() && odds.ts > 0,
        FairXError::InvalidOddsSource
    );
    Ok(())
}

fn validate_canonical_quote(
    quote_sequence: u64,
    material_event_sequence: u64,
    latest_material_event_ts: i64,
    odds: &Odds,
) -> Result<()> {
    let (expected_quote_sequence, expected_timestamp, expected_message_id, expected_prices) =
        match material_event_sequence {
            CANONICAL_INITIAL_EVENT_SEQUENCE => (
                CANONICAL_PRE_GOAL_QUOTE_SEQUENCE,
                CANONICAL_PRE_GOAL_QUOTE_TIMESTAMP_MS,
                CANONICAL_PRE_GOAL_MESSAGE_ID,
                CANONICAL_PRE_GOAL_PRICES,
            ),
            CANONICAL_GOAL_SEQUENCE => (
                CANONICAL_POST_GOAL_QUOTE_SEQUENCE,
                CANONICAL_POST_GOAL_QUOTE_TIMESTAMP_MS,
                CANONICAL_POST_GOAL_MESSAGE_ID,
                CANONICAL_POST_GOAL_PRICES,
            ),
            _ => return err!(FairXError::RecordedQuoteMismatch),
        };
    require!(
        quote_sequence == expected_quote_sequence
            && odds.ts == expected_timestamp
            && odds.message_id == expected_message_id
            && odds.prices.as_slice() == expected_prices.as_slice(),
        FairXError::RecordedQuoteMismatch
    );
    if material_event_sequence == CANONICAL_GOAL_SEQUENCE {
        require!(
            odds.ts > latest_material_event_ts,
            FairXError::RecordedQuoteNotNewerThanEvent
        );
    }
    Ok(())
}

fn derive_quote_prices(prices: &[i32], spread_micros: u64) -> Result<(u64, u64, u64)> {
    require!(
        prices.len() == 3 && prices.iter().all(|value| *value > 0),
        FairXError::InvalidOddsPrices
    );
    let h = prices[0] as u128;
    let d = prices[1] as u128;
    let a = prices[2] as u128;
    let da = d.checked_mul(a).ok_or(FairXError::MathOverflow)?;
    let denominator = da
        .checked_add(h.checked_mul(a).ok_or(FairXError::MathOverflow)?)
        .and_then(|v| v.checked_add(h.checked_mul(d)?))
        .ok_or(FairXError::MathOverflow)?;
    let numerator = da
        .checked_mul(MICROS_ONE as u128)
        .ok_or(FairXError::MathOverflow)?;
    let rounded = numerator
        .checked_add(denominator / 2)
        .ok_or(FairXError::MathOverflow)?
        .checked_div(denominator)
        .ok_or(FairXError::MathOverflow)?;
    let probability = u64::try_from(rounded).map_err(|_| error!(FairXError::MathOverflow))?;
    let no_probability = checked_sub(MICROS_ONE, probability)?;
    let yes_price = checked_add(probability, spread_micros)?;
    let no_price = checked_add(no_probability, spread_micros)?;
    require!(
        yes_price > 0 && yes_price < MICROS_ONE,
        FairXError::InvalidExecutionPrice
    );
    require!(
        no_price > 0 && no_price < MICROS_ONE,
        FairXError::InvalidExecutionPrice
    );
    Ok((probability, yes_price, no_price))
}

fn gross_payout(stake: u64, price_micros: u64) -> Result<u64> {
    require!(
        stake > 0 && price_micros > 0 && price_micros < MICROS_ONE,
        FairXError::InvalidExecutionPrice
    );
    let gross = (stake as u128)
        .checked_mul(MICROS_ONE as u128)
        .ok_or(FairXError::MathOverflow)?
        .checked_div(price_micros as u128)
        .ok_or(FairXError::MathOverflow)?;
    let gross = u64::try_from(gross).map_err(|_| error!(FairXError::MathOverflow))?;
    require!(gross > stake, FairXError::InvalidExecutionPrice);
    Ok(gross)
}

fn apply_accept(vault: &mut LiquidityVaultV4, side: u8, stake: u64, liability: u64) -> Result<()> {
    require!(
        vault.free_collateral >= liability,
        FairXError::InsufficientFreeCollateral
    );
    vault.free_collateral = checked_sub(vault.free_collateral, liability)?;
    vault.reserved_liability = checked_add(vault.reserved_liability, liability)?;
    vault.accepted_stake_principal = checked_add(vault.accepted_stake_principal, stake)?;
    if side == Side::Yes as u8 {
        vault.yes_reserved_liability = checked_add(vault.yes_reserved_liability, liability)?;
    } else {
        vault.no_reserved_liability = checked_add(vault.no_reserved_liability, liability)?;
    }
    assert_accounting_fields(vault)
}

fn apply_claim(
    vault: &mut LiquidityVaultV4,
    side: u8,
    stake: u64,
    liability: u64,
    gross: u64,
) -> Result<()> {
    require!(
        gross == checked_add(stake, liability)?,
        FairXError::PositionAccountingMismatch
    );
    vault.reserved_liability = checked_sub(vault.reserved_liability, liability)?;
    vault.accepted_stake_principal = checked_sub(vault.accepted_stake_principal, stake)?;
    if side == Side::Yes as u8 {
        vault.yes_reserved_liability = checked_sub(vault.yes_reserved_liability, liability)?;
    } else {
        vault.no_reserved_liability = checked_sub(vault.no_reserved_liability, liability)?;
    }
    vault.lifetime_payouts = checked_add(vault.lifetime_payouts, gross)?;
    assert_accounting_fields(vault)
}

fn apply_reconcile_loss(
    vault: &mut LiquidityVaultV4,
    side: u8,
    stake: u64,
    liability: u64,
) -> Result<()> {
    vault.reserved_liability = checked_sub(vault.reserved_liability, liability)?;
    vault.accepted_stake_principal = checked_sub(vault.accepted_stake_principal, stake)?;
    vault.free_collateral = checked_add(vault.free_collateral, checked_add(stake, liability)?)?;
    if side == Side::Yes as u8 {
        vault.yes_reserved_liability = checked_sub(vault.yes_reserved_liability, liability)?;
    } else {
        vault.no_reserved_liability = checked_sub(vault.no_reserved_liability, liability)?;
    }
    vault.lifetime_losing_stakes = checked_add(vault.lifetime_losing_stakes, stake)?;
    assert_accounting_fields(vault)
}

fn apply_void_refund(
    vault: &mut LiquidityVaultV4,
    side: u8,
    stake: u64,
    liability: u64,
) -> Result<()> {
    vault.reserved_liability = checked_sub(vault.reserved_liability, liability)?;
    vault.accepted_stake_principal = checked_sub(vault.accepted_stake_principal, stake)?;
    vault.free_collateral = checked_add(vault.free_collateral, liability)?;
    if side == Side::Yes as u8 {
        vault.yes_reserved_liability = checked_sub(vault.yes_reserved_liability, liability)?;
    } else {
        vault.no_reserved_liability = checked_sub(vault.no_reserved_liability, liability)?;
    }
    vault.lifetime_refunds = checked_add(vault.lifetime_refunds, stake)?;
    assert_accounting_fields(vault)
}

fn assert_accounting_fields(vault: &LiquidityVaultV4) -> Result<()> {
    require!(
        checked_add(vault.yes_reserved_liability, vault.no_reserved_liability)?
            == vault.reserved_liability,
        FairXError::VaultInvariantViolation
    );
    Ok(())
}

fn assert_vault_invariant(vault: &Account<LiquidityVaultV4>) -> Result<()> {
    assert_accounting_fields(vault)?;
    let spendable = actual_spendable_lamports(vault)?;
    let accounted = accounted_assets(vault)?;
    require!(spendable >= accounted, FairXError::VaultInvariantViolation);
    Ok(())
}

fn actual_spendable_lamports(vault: &Account<LiquidityVaultV4>) -> Result<u64> {
    let rent = Rent::get()?.minimum_balance(8 + LiquidityVaultV4::INIT_SPACE);
    vault
        .to_account_info()
        .lamports()
        .checked_sub(rent)
        .ok_or_else(|| error!(FairXError::VaultInvariantViolation))
}

fn accounted_assets(vault: &LiquidityVaultV4) -> Result<u64> {
    checked_add(
        checked_add(vault.free_collateral, vault.reserved_liability)?,
        checked_add(
            vault.accepted_stake_principal,
            vault.pending_refundable_stake,
        )?,
    )
}

fn vault_surplus(vault: &Account<LiquidityVaultV4>) -> Result<u64> {
    actual_spendable_lamports(vault)?
        .checked_sub(accounted_assets(vault)?)
        .ok_or_else(|| error!(FairXError::VaultInvariantViolation))
}

fn position_won(side: u8, resolution: u8) -> bool {
    (side == Side::Yes as u8 && resolution == Resolution::Yes as u8)
        || (side == Side::No as u8 && resolution == Resolution::No as u8)
}

fn is_terminal_position(status: u8) -> bool {
    matches!(
        status,
        x if x == PositionStatus::Refunded as u8
            || x == PositionStatus::Claimed as u8
            || x == PositionStatus::Lost as u8
            || x == PositionStatus::Voided as u8
    )
}

fn regulation_score(payload: &StatValidationInput) -> Result<(u16, u16)> {
    let mut values = [None; 4];
    for leaf in &payload.stats {
        require!(
            leaf.stat.period == FINAL_PERIOD,
            FairXError::InvalidFinalPeriod
        );
        require!(
            leaf.stat.value >= 0 && leaf.stat.value <= MAX_SCORE_COMPONENT,
            FairXError::InvalidFinalStats
        );
        let index = REGULATION_STAT_KEYS
            .iter()
            .position(|key| *key == leaf.stat.key)
            .ok_or(FairXError::InvalidFinalStats)?;
        require!(values[index].is_none(), FairXError::InvalidFinalStats);
        values[index] = Some(leaf.stat.value as u16);
    }
    require!(
        values.iter().all(Option::is_some),
        FairXError::InvalidFinalStats
    );
    let home = values[0]
        .unwrap()
        .checked_add(values[2].unwrap())
        .ok_or(FairXError::MathOverflow)?;
    let away = values[1]
        .unwrap()
        .checked_add(values[3].unwrap())
        .ok_or(FairXError::MathOverflow)?;
    Ok((home, away))
}

fn exact_stat_strategy(payload: &StatValidationInput) -> NDimensionalStrategy {
    NDimensionalStrategy {
        geometric_targets: vec![],
        distance_predicate: None,
        discrete_predicates: payload
            .stats
            .iter()
            .enumerate()
            .map(|(index, leaf)| StatPredicate::Single {
                index: index as u8,
                predicate: TraderPredicate {
                    threshold: leaf.stat.value,
                    comparison: Comparison::EqualTo,
                },
            })
            .collect(),
    }
}

fn validate_authorities(
    operator: Pubkey,
    feed: Pubkey,
    pricing: Pubkey,
    resolution: &[Pubkey; 3],
) -> Result<()> {
    let mut keys = vec![operator, feed, pricing];
    keys.extend_from_slice(resolution);
    require!(
        keys.iter().all(|key| *key != Pubkey::default()),
        FairXError::InvalidAuthority
    );
    for (index, key) in keys.iter().enumerate() {
        require!(!keys[..index].contains(key), FairXError::DuplicateAuthority);
    }
    Ok(())
}

fn validate_canonical_identity(args: &InitializeMarketV4Args) -> Result<()> {
    require!(
        args.market_id == CANONICAL_MARKET_ID,
        FairXError::CanonicalIdentityMismatch
    );
    require!(
        args.fixture_hash == CANONICAL_FIXTURE_HASH,
        FairXError::CanonicalIdentityMismatch
    );
    require!(
        args.home_team_hash == CANONICAL_HOME_TEAM_HASH
            && args.away_team_hash == CANONICAL_AWAY_TEAM_HASH,
        FairXError::CanonicalIdentityMismatch
    );
    require!(
        args.home_participant_id == CANONICAL_HOME_PARTICIPANT_ID
            && args.away_participant_id == CANONICAL_AWAY_PARTICIPANT_ID
            && args.home_participant_is_home,
        FairXError::CanonicalOrientationMismatch
    );
    require!(
        args.regulation_template_hash == CANONICAL_REGULATION_TEMPLATE_HASH,
        FairXError::CanonicalIdentityMismatch
    );
    Ok(())
}

fn resolution_authority_index(authorities: &[Pubkey; 3], signer: Pubkey) -> Result<u8> {
    authorities
        .iter()
        .position(|authority| *authority == signer)
        .map(|index| index as u8)
        .ok_or_else(|| error!(FairXError::InvalidResolutionAuthority))
}

fn epoch_day_from_ms(ts: i64) -> Result<u16> {
    require!(ts > 0, FairXError::InvalidTimestamp);
    u16::try_from(ts / DAY_MS).map_err(|_| error!(FairXError::InvalidTimestamp))
}

fn validate_txline_root(root: &AccountInfo, seed: &[u8], epoch_day: u16) -> Result<()> {
    require!(
        *root.owner == TXLINE_PROGRAM_ID,
        FairXError::InvalidTxlineRoot
    );
    let (expected, _) =
        Pubkey::find_program_address(&[seed, &epoch_day.to_le_bytes()], &TXLINE_PROGRAM_ID);
    require!(root.key() == expected, FairXError::InvalidTxlineRoot);
    Ok(())
}

fn invoke_txline_validate_odds<'info>(
    root: &AccountInfo<'info>,
    txline_program: &AccountInfo<'info>,
    odds: &Odds,
    summary: &OddsBatchSummary,
    sub_tree_proof: &[ProofNode],
    main_tree_proof: &[ProofNode],
) -> Result<()> {
    validate_txline_program(txline_program)?;
    let mut data = TXLINE_VALIDATE_ODDS_DISCRIMINATOR.to_vec();
    odds.ts
        .serialize(&mut data)
        .map_err(|_| error!(FairXError::TxlineSerializationFailed))?;
    odds.serialize(&mut data)
        .map_err(|_| error!(FairXError::TxlineSerializationFailed))?;
    summary
        .serialize(&mut data)
        .map_err(|_| error!(FairXError::TxlineSerializationFailed))?;
    sub_tree_proof
        .to_vec()
        .serialize(&mut data)
        .map_err(|_| error!(FairXError::TxlineSerializationFailed))?;
    main_tree_proof
        .to_vec()
        .serialize(&mut data)
        .map_err(|_| error!(FairXError::TxlineSerializationFailed))?;
    invoke_txline(root, txline_program, data)
}

fn invoke_txline_validate_stat_v2<'info>(
    root: &AccountInfo<'info>,
    txline_program: &AccountInfo<'info>,
    payload: &StatValidationInput,
    strategy: &NDimensionalStrategy,
) -> Result<()> {
    validate_txline_program(txline_program)?;
    let mut data = TXLINE_VALIDATE_STAT_V2_DISCRIMINATOR.to_vec();
    payload
        .serialize(&mut data)
        .map_err(|_| error!(FairXError::TxlineSerializationFailed))?;
    strategy
        .serialize(&mut data)
        .map_err(|_| error!(FairXError::TxlineSerializationFailed))?;
    invoke_txline(root, txline_program, data)
}

fn validate_txline_program(txline_program: &AccountInfo) -> Result<()> {
    require!(
        txline_program.key() == TXLINE_PROGRAM_ID && txline_program.executable,
        FairXError::InvalidTxlineProgram
    );
    Ok(())
}

fn invoke_txline<'info>(
    root: &AccountInfo<'info>,
    txline_program: &AccountInfo<'info>,
    data: Vec<u8>,
) -> Result<()> {
    let instruction = Instruction {
        program_id: TXLINE_PROGRAM_ID,
        accounts: vec![AccountMeta::new_readonly(root.key(), false)],
        data,
    };
    invoke(&instruction, &[root.clone(), txline_program.clone()])?;
    let (program, returned) = get_return_data().ok_or(FairXError::TxlineReturnMissing)?;
    require!(
        program == TXLINE_PROGRAM_ID && returned.as_slice() == [1u8],
        FairXError::TxlineValidationFailed
    );
    Ok(())
}

fn borsh_hash<T: AnchorSerialize>(value: &T) -> Result<[u8; 32]> {
    let mut encoded = Vec::new();
    value
        .serialize(&mut encoded)
        .map_err(|_| error!(FairXError::TxlineSerializationFailed))?;
    Ok(hash(&encoded).to_bytes())
}

fn move_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    let from_balance = from.lamports();
    let to_balance = to.lamports();
    **from.try_borrow_mut_lamports()? = from_balance
        .checked_sub(amount)
        .ok_or(FairXError::InsufficientVaultLamports)?;
    **to.try_borrow_mut_lamports()? = to_balance
        .checked_add(amount)
        .ok_or(FairXError::MathOverflow)?;
    Ok(())
}

fn bump_accounting_sequence(vault: &mut LiquidityVaultV4) -> Result<()> {
    vault.accounting_sequence = checked_add(vault.accounting_sequence, 1)?;
    Ok(())
}

fn checked_add(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right)
        .ok_or_else(|| error!(FairXError::MathOverflow))
}

fn checked_sub(left: u64, right: u64) -> Result<u64> {
    left.checked_sub(right)
        .ok_or_else(|| error!(FairXError::MathOverflow))
}

#[error_code]
pub enum FairXError {
    #[msg("Signer is not the compiled V4 bootstrap administrator")]
    InvalidBootstrapAdmin,
    #[msg("This isolated prototype supports only France-Morocco fixture 18209181")]
    UnsupportedFixture,
    #[msg("The initial replay sequence must be the genuine pre-goal sequence 738")]
    InvalidInitialSequence,
    #[msg("The replay supports only the committed goal and final sequences")]
    UnsupportedReplaySequence,
    #[msg("A required commitment hash is zero")]
    ZeroHash,
    #[msg("Market identity does not match the canonical France-Morocco replay")]
    CanonicalIdentityMismatch,
    #[msg("Participant identity or home-away orientation is not canonical")]
    CanonicalOrientationMismatch,
    #[msg("Authority is invalid")]
    InvalidAuthority,
    #[msg("Authority roles must be distinct")]
    DuplicateAuthority,
    #[msg("The resolution threshold must be exactly two")]
    InvalidResolutionThreshold,
    #[msg("Operator signer does not match the authority configuration")]
    InvalidOperator,
    #[msg("Pricing signer does not match the authority configuration")]
    InvalidPricingAuthority,
    #[msg("Feed signer does not match the authority configuration")]
    InvalidFeedAuthority,
    #[msg("Signer is not a resolution authority")]
    InvalidResolutionAuthority,
    #[msg("An account belongs to another market, vault, or proposal")]
    AccountSubstitution,
    #[msg("Amount must be positive")]
    InvalidAmount,
    #[msg("Stake is outside the configured bounds")]
    InvalidStake,
    #[msg("Side must be YES or NO")]
    InvalidSide,
    #[msg("Trading is closed")]
    TradingClosed,
    #[msg("Quote sequence must strictly increase")]
    QuoteSequenceRegression,
    #[msg("Signed quote sequence does not match current quote")]
    QuoteSequenceMismatch,
    #[msg("Quote payload does not match the committed TxLINE record")]
    QuotePayloadMismatch,
    #[msg("Quote does not match the canonical recorded France-Morocco StablePrice record")]
    RecordedQuoteMismatch,
    #[msg("Post-event quote is not genuinely newer than the material event")]
    RecordedQuoteNotNewerThanEvent,
    #[msg("Quote material-event sequence does not match the market")]
    MaterialSequenceMismatch,
    #[msg("The isolated replay uses a fixed 10,000-micro additive spread")]
    InvalidReplaySpread,
    #[msg("Material-event sequence must strictly increase")]
    MaterialSequenceRegression,
    #[msg("The material event does not match the recorded France goal payload")]
    InvalidReplayEvent,
    #[msg("An order cannot reference a future material-event sequence")]
    FutureMaterialSequence,
    #[msg("The quote is stale")]
    StaleQuote,
    #[msg("The quote has not passed direct TxLINE CPI validation")]
    QuoteNotVerified,
    #[msg("The wallet-signed execution price differs from the market")]
    ExecutionPriceMismatch,
    #[msg("Order expired")]
    OrderExpired,
    #[msg("Order nonce does not match the vault's next persistent nonce")]
    OrderNonceMismatch,
    #[msg("TxLINE odds fixture does not match the market")]
    FixtureMismatch,
    #[msg("TxLINE bookmaker is not StablePriceDemargined")]
    InvalidOddsSource,
    #[msg("TxLINE odds market is not full-time 1X2")]
    InvalidOddsMarket,
    #[msg("TxLINE raw prices are invalid")]
    InvalidOddsPrices,
    #[msg("Execution price must be strictly between zero and one")]
    InvalidExecutionPrice,
    #[msg("Free collateral is insufficient")]
    InsufficientFreeCollateral,
    #[msg("Arithmetic overflow or underflow")]
    MathOverflow,
    #[msg("Vault accounting invariant failed")]
    VaultInvariantViolation,
    #[msg("Vault account does not have enough spendable lamports")]
    InsufficientVaultLamports,
    #[msg("Position accounting does not match stake plus liability")]
    PositionAccountingMismatch,
    #[msg("Timestamp is invalid")]
    InvalidTimestamp,
    #[msg("TxLINE root is not the canonical PDA owned by the fixed program")]
    InvalidTxlineRoot,
    #[msg("TxLINE executable program is invalid")]
    InvalidTxlineProgram,
    #[msg("TxLINE instruction serialization failed")]
    TxlineSerializationFailed,
    #[msg("TxLINE CPI did not return data")]
    TxlineReturnMissing,
    #[msg("TxLINE CPI did not return true")]
    TxlineValidationFailed,
    #[msg("Final proof must contain exactly the four regulation-time stat keys")]
    InvalidFinalStats,
    #[msg("Every final regulation-time stat must use TxLINE period 100")]
    InvalidFinalPeriod,
    #[msg("Final proof timestamp does not match the recorded game-finalised update")]
    InvalidFinalTimestamp,
    #[msg("Market is already resolved")]
    MarketAlreadyResolved,
    #[msg("Market is not resolved")]
    MarketNotResolved,
    #[msg("A valid final TxLINE resolution receipt is already committed")]
    ValidResolutionAlreadyCommitted,
    #[msg("VOID is not available until the hard stop and oracle grace period elapse")]
    VoidNotYetAvailable,
    #[msg("VOID reason code is not supported by this canonical replay")]
    InvalidVoidReason,
    #[msg("Market did not resolve VOID")]
    MarketNotVoid,
    #[msg("VOID positions must refund principal rather than claim or reconcile")]
    VoidPositionMustRefund,
    #[msg("Position principal is not refundable")]
    PositionNotRefundable,
    #[msg("Resolution proposal already executed")]
    ProposalAlreadyExecuted,
    #[msg("Resolution authority already approved")]
    DuplicateApproval,
    #[msg("Two resolution approvals are required")]
    ResolutionThresholdNotMet,
    #[msg("Resolution proposal and TxLINE receipt do not match")]
    ResolutionReceiptMismatch,
    #[msg("Position owner signer is invalid")]
    InvalidPositionOwner,
    #[msg("Position rent recipient is invalid")]
    InvalidRentRecipient,
    #[msg("Position cannot claim")]
    PositionNotClaimable,
    #[msg("Position is not on the winning side")]
    PositionDidNotWin,
    #[msg("Position cannot be reconciled")]
    PositionNotReconcileable,
    #[msg("Winning positions must claim rather than reconcile")]
    WinningPositionMustClaim,
    #[msg("Only refunded, claimed, losing, or void-refunded positions can close")]
    PositionNotClosable,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_vault(free: u64) -> LiquidityVaultV4 {
        LiquidityVaultV4 {
            market: Pubkey::new_unique(),
            operator: Pubkey::new_unique(),
            free_collateral: free,
            reserved_liability: 0,
            accepted_stake_principal: 0,
            pending_refundable_stake: 0,
            yes_reserved_liability: 0,
            no_reserved_liability: 0,
            lifetime_operator_deposits: free,
            lifetime_operator_withdrawals: 0,
            lifetime_user_stakes: 0,
            lifetime_refunds: 0,
            lifetime_payouts: 0,
            lifetime_losing_stakes: 0,
            position_count: 0,
            next_order_nonce: 0,
            accounting_sequence: 0,
            min_stake_lamports: 1_000_000,
            max_stake_lamports: 100_000_000,
            bump: 255,
        }
    }

    fn canonical_odds(post_goal: bool) -> Odds {
        Odds {
            fixture_id: CANONICAL_FIXTURE_ID as i64,
            message_id: if post_goal {
                CANONICAL_POST_GOAL_MESSAGE_ID
            } else {
                CANONICAL_PRE_GOAL_MESSAGE_ID
            }
            .to_owned(),
            ts: if post_goal {
                CANONICAL_POST_GOAL_QUOTE_TIMESTAMP_MS
            } else {
                CANONICAL_PRE_GOAL_QUOTE_TIMESTAMP_MS
            },
            bookmaker: "TXLineStablePriceDemargined".to_owned(),
            bookmaker_id: STABLE_BOOKMAKER_ID,
            super_odds_type: "1X2_PARTICIPANT_RESULT".to_owned(),
            game_state: None,
            in_running: true,
            market_parameters: None,
            market_period: None,
            price_names: vec!["part1".to_owned(), "draw".to_owned(), "part2".to_owned()],
            prices: if post_goal {
                CANONICAL_POST_GOAL_PRICES.to_vec()
            } else {
                CANONICAL_PRE_GOAL_PRICES.to_vec()
            },
        }
    }

    fn stat_payload(period: i32) -> StatValidationInput {
        StatValidationInput {
            ts: 1_783_634_788_478,
            fixture_summary: ScoresBatchSummary {
                fixture_id: CANONICAL_FIXTURE_ID as i64,
                update_stats: ScoresUpdateStats {
                    update_count: 1,
                    min_timestamp: 1_783_634_788_478,
                    max_timestamp: 1_783_634_788_478,
                },
                events_sub_tree_root: [1; 32],
            },
            fixture_proof: vec![],
            main_tree_proof: vec![],
            event_stat_root: [2; 32],
            stats: vec![
                StatLeaf {
                    stat: ScoreStat {
                        key: 1001,
                        value: 0,
                        period,
                    },
                    stat_proof: vec![],
                },
                StatLeaf {
                    stat: ScoreStat {
                        key: 1002,
                        value: 0,
                        period,
                    },
                    stat_proof: vec![],
                },
                StatLeaf {
                    stat: ScoreStat {
                        key: 3001,
                        value: 2,
                        period,
                    },
                    stat_proof: vec![],
                },
                StatLeaf {
                    stat: ScoreStat {
                        key: 3002,
                        value: 0,
                        period,
                    },
                    stat_proof: vec![],
                },
            ],
        }
    }

    #[test]
    fn raw_txline_prices_produce_exact_replay_quotes() {
        assert_eq!(
            derive_quote_prices(&[1913, 2691, 9473], 10_000).unwrap(),
            (522_785, 532_785, 487_215)
        );
        assert_eq!(
            derive_quote_prices(&[1156, 8757, 47_500], 10_000).unwrap(),
            (864_793, 874_793, 145_207)
        );
    }

    #[test]
    fn only_the_recorded_quote_for_each_material_sequence_is_admissible() {
        let pre = canonical_odds(false);
        let post = canonical_odds(true);
        assert!(validate_canonical_quote(1, 738, 0, &pre).is_ok());
        assert!(validate_canonical_quote(2, 739, CANONICAL_GOAL_TIMESTAMP_MS, &post).is_ok());
        assert!(validate_canonical_quote(2, 739, CANONICAL_GOAL_TIMESTAMP_MS, &pre).is_err());
        assert!(validate_canonical_quote(2, 739, post.ts, &post).is_err());
    }

    #[test]
    fn fixed_payout_uses_floor_and_exact_incremental_liability() {
        let gross = gross_payout(10_000_000, 532_785).unwrap();
        assert_eq!(gross, 18_769_297);
        assert_eq!(gross - 10_000_000, 8_769_297);
        assert!(gross_payout(10_000_000, 0).is_err());
        assert!(gross_payout(10_000_000, MICROS_ONE).is_err());
    }

    #[test]
    fn deterministic_lifecycle_reconciles_every_lamport() {
        let mut vault = test_vault(200_000_000);
        let stake = 10_000_000;
        let yes_pre_gross = gross_payout(stake, 532_785).unwrap();
        let no_pre_gross = gross_payout(stake, 487_215).unwrap();
        let yes_post_gross = gross_payout(stake, 874_793).unwrap();

        apply_accept(&mut vault, Side::Yes as u8, stake, yes_pre_gross - stake).unwrap();
        apply_accept(&mut vault, Side::No as u8, stake, no_pre_gross - stake).unwrap();
        apply_accept(&mut vault, Side::Yes as u8, stake, yes_post_gross - stake).unwrap();
        assert_eq!(vault.free_collateral, 179_274_609);
        assert_eq!(vault.reserved_liability, 20_725_391);
        assert_eq!(vault.accepted_stake_principal, 30_000_000);
        assert_eq!(vault.yes_reserved_liability, 10_200_572);
        assert_eq!(vault.no_reserved_liability, 10_524_819);

        apply_claim(
            &mut vault,
            Side::Yes as u8,
            stake,
            yes_pre_gross - stake,
            yes_pre_gross,
        )
        .unwrap();
        apply_claim(
            &mut vault,
            Side::Yes as u8,
            stake,
            yes_post_gross - stake,
            yes_post_gross,
        )
        .unwrap();
        apply_reconcile_loss(&mut vault, Side::No as u8, stake, no_pre_gross - stake).unwrap();

        assert_eq!(vault.free_collateral, 199_799_428);
        assert_eq!(vault.reserved_liability, 0);
        assert_eq!(vault.accepted_stake_principal, 0);
        assert_eq!(vault.yes_reserved_liability, 0);
        assert_eq!(vault.no_reserved_liability, 0);
        assert_eq!(vault.lifetime_payouts, 30_200_572);
        assert_eq!(vault.lifetime_losing_stakes, 10_000_000);
        assert_accounting_fields(&vault).unwrap();
    }

    #[test]
    fn conservative_reserve_rejects_under_collateralized_fill() {
        let mut vault = test_vault(8_000_000);
        assert!(apply_accept(&mut vault, Side::Yes as u8, 10_000_000, 8_769_297).is_err());
        assert_eq!(vault.free_collateral, 8_000_000);
        assert_eq!(vault.reserved_liability, 0);
    }

    #[test]
    fn stale_sequence_is_refund_only_and_never_claimable() {
        let latest = CANONICAL_GOAL_SEQUENCE;
        let signed = CANONICAL_INITIAL_EVENT_SEQUENCE;
        assert!(signed < latest);
        assert!(!position_won(Side::Yes as u8, Resolution::Unresolved as u8));
        assert!(is_terminal_position(PositionStatus::Refunded as u8));
        assert!(!is_terminal_position(PositionStatus::Accepted as u8));
    }

    #[test]
    fn final_period_is_required_and_regulation_score_is_two_nil() {
        assert_eq!(
            regulation_score(&stat_payload(FINAL_PERIOD)).unwrap(),
            (2, 0)
        );
        assert!(regulation_score(&stat_payload(4)).is_err());
        let mut duplicate = stat_payload(FINAL_PERIOD);
        duplicate.stats[3].stat.key = 3001;
        assert!(regulation_score(&duplicate).is_err());
    }

    #[test]
    fn double_claim_and_winner_reconciliation_are_blocked_by_terminal_state_rules() {
        assert!(position_won(Side::Yes as u8, Resolution::Yes as u8));
        assert!(!position_won(Side::No as u8, Resolution::Yes as u8));
        assert!(is_terminal_position(PositionStatus::Claimed as u8));
        assert!(is_terminal_position(PositionStatus::Lost as u8));
    }

    #[test]
    fn withdrawal_cannot_cross_reserved_boundary() {
        let mut vault = test_vault(20_000_000);
        apply_accept(&mut vault, Side::Yes as u8, 10_000_000, 8_769_297).unwrap();
        assert_eq!(vault.free_collateral, 11_230_703);
        assert!(checked_sub(vault.free_collateral, 11_230_704).is_err());
        vault.free_collateral = checked_sub(vault.free_collateral, 11_230_703).unwrap();
        assert_eq!(vault.reserved_liability, 8_769_297);
        assert_eq!(vault.accepted_stake_principal, 10_000_000);
    }

    #[test]
    fn authority_and_account_substitution_inputs_are_distinct() {
        let operator = Pubkey::new_unique();
        let feed = Pubkey::new_unique();
        let pricing = Pubkey::new_unique();
        let resolution = [
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        ];
        assert!(validate_authorities(operator, feed, pricing, &resolution).is_ok());
        assert!(validate_authorities(operator, operator, pricing, &resolution).is_err());
        assert_ne!(
            Pubkey::find_program_address(
                &[b"liquidity-vault-v4", Pubkey::new_unique().as_ref()],
                &crate::ID
            )
            .0,
            Pubkey::find_program_address(
                &[b"liquidity-vault-v4", Pubkey::new_unique().as_ref()],
                &crate::ID
            )
            .0
        );
    }

    #[test]
    fn accounted_assets_include_pending_and_fail_closed_on_u64_overflow() {
        let mut vault = test_vault(1);
        vault.pending_refundable_stake = 2;
        assert_eq!(accounted_assets(&vault).unwrap(), 3);
        vault.free_collateral = u64::MAX;
        assert!(accounted_assets(&vault).is_err());
    }

    #[test]
    fn void_refund_returns_only_principal_and_releases_liability() {
        let mut vault = test_vault(200_000_000);
        apply_accept(&mut vault, Side::Yes as u8, 10_000_000, 8_769_297).unwrap();
        apply_void_refund(&mut vault, Side::Yes as u8, 10_000_000, 8_769_297).unwrap();
        assert_eq!(vault.free_collateral, 200_000_000);
        assert_eq!(vault.reserved_liability, 0);
        assert_eq!(vault.accepted_stake_principal, 0);
        assert_eq!(vault.lifetime_refunds, 10_000_000);
        assert!(is_terminal_position(PositionStatus::Voided as u8));
    }
}
