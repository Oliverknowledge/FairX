use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe");

const MICROS_ONE: u64 = 1_000_000;
// MarketState grew by 32 bytes (source_event_hash) at the end. Additive: existing
// accounts keep their layout; only newly-initialized markets allocate the larger size.
const MARKET_SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 32;
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
            let vault = &mut ctx.accounts.vault;
            vault.total_finalized = vault.total_finalized.saturating_add(stake);
            vault.fill_count = vault.fill_count.saturating_add(1);
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
}

impl OrderStatus {
    pub fn code(&self) -> u8 {
        match self {
            Self::Submitted => 0,
            Self::Escrowed => 1,
            Self::Evaluated => 2,
            Self::Filled => 3,
            Self::VoidedRefunded => 4,
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
}
