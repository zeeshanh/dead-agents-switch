use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("DAS1111111111111111111111111111111111111111");

/// Dead Agent's Switch - Digital wills for the agent economy
/// 
/// Agents and humans register conditional actions that execute
/// automatically if they stop checking in.

#[program]
pub mod dead_agents_switch {
    use super::*;

    /// Create a new will with specified beneficiaries and timeout
    pub fn create_will(
        ctx: Context<CreateWill>,
        timeout_seconds: i64,
        message: String,
    ) -> Result<()> {
        require!(timeout_seconds >= 86400, ErrorCode::TimeoutTooShort); // Min 1 day
        require!(timeout_seconds <= 31536000, ErrorCode::TimeoutTooLong); // Max 1 year
        require!(message.len() <= 500, ErrorCode::MessageTooLong);

        let will = &mut ctx.accounts.will;
        let clock = Clock::get()?;
        
        will.owner = ctx.accounts.owner.key();
        will.timeout_seconds = timeout_seconds;
        will.last_heartbeat = clock.unix_timestamp;
        will.created_at = clock.unix_timestamp;
        will.message = message;
        will.is_active = true;
        will.is_triggered = false;
        will.beneficiary_count = 0;
        will.bump = ctx.bumps.will;

        emit!(WillCreated {
            will: will.key(),
            owner: will.owner,
            timeout_seconds,
            created_at: will.created_at,
        });

        Ok(())
    }

    /// Add a beneficiary to the will with their share percentage
    pub fn add_beneficiary(
        ctx: Context<AddBeneficiary>,
        share_bps: u16, // Basis points (100 = 1%)
    ) -> Result<()> {
        require!(share_bps > 0 && share_bps <= 10000, ErrorCode::InvalidShare);
        
        let will = &mut ctx.accounts.will;
        require!(will.is_active, ErrorCode::WillNotActive);
        require!(!will.is_triggered, ErrorCode::WillAlreadyTriggered);
        require!(will.beneficiary_count < 10, ErrorCode::TooManyBeneficiaries);

        let beneficiary = &mut ctx.accounts.beneficiary;
        beneficiary.will = will.key();
        beneficiary.recipient = ctx.accounts.recipient.key();
        beneficiary.share_bps = share_bps;
        beneficiary.has_claimed = false;
        beneficiary.bump = ctx.bumps.beneficiary;

        will.beneficiary_count += 1;

        emit!(BeneficiaryAdded {
            will: will.key(),
            recipient: beneficiary.recipient,
            share_bps,
        });

        Ok(())
    }

    /// Send a heartbeat to prove liveness and reset the timer
    pub fn heartbeat(ctx: Context<Heartbeat>) -> Result<()> {
        let will = &mut ctx.accounts.will;
        require!(will.is_active, ErrorCode::WillNotActive);
        require!(!will.is_triggered, ErrorCode::WillAlreadyTriggered);

        let clock = Clock::get()?;
        will.last_heartbeat = clock.unix_timestamp;

        emit!(HeartbeatSent {
            will: will.key(),
            owner: will.owner,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Trigger the will if the timeout has passed
    /// Anyone can call this to execute the will
    pub fn trigger_will(ctx: Context<TriggerWill>) -> Result<()> {
        let will = &mut ctx.accounts.will;
        require!(will.is_active, ErrorCode::WillNotActive);
        require!(!will.is_triggered, ErrorCode::WillAlreadyTriggered);

        let clock = Clock::get()?;
        let time_since_heartbeat = clock.unix_timestamp - will.last_heartbeat;
        
        require!(
            time_since_heartbeat >= will.timeout_seconds,
            ErrorCode::TimeoutNotReached
        );

        will.is_triggered = true;
        will.triggered_at = Some(clock.unix_timestamp);

        emit!(WillTriggered {
            will: will.key(),
            owner: will.owner,
            triggered_at: clock.unix_timestamp,
            time_since_heartbeat,
            message: will.message.clone(),
        });

        Ok(())
    }

    /// Claim inheritance as a beneficiary after will is triggered
    pub fn claim_inheritance(ctx: Context<ClaimInheritance>) -> Result<()> {
        let will = &ctx.accounts.will;
        let beneficiary = &mut ctx.accounts.beneficiary;
        
        require!(will.is_triggered, ErrorCode::WillNotTriggered);
        require!(!beneficiary.has_claimed, ErrorCode::AlreadyClaimed);

        // Calculate share
        let vault_balance = ctx.accounts.vault.amount;
        let share_amount = (vault_balance as u128)
            .checked_mul(beneficiary.share_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        // Transfer from vault to beneficiary
        let seeds = &[
            b"will",
            will.owner.as_ref(),
            &[will.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.will.to_account_info(),
            },
            signer_seeds,
        );

        token::transfer(transfer_ctx, share_amount)?;
        beneficiary.has_claimed = true;

        emit!(InheritanceClaimed {
            will: will.key(),
            beneficiary: beneficiary.recipient,
            amount: share_amount,
        });

        Ok(())
    }

    /// Cancel the will (only owner can do this while alive)
    pub fn cancel_will(ctx: Context<CancelWill>) -> Result<()> {
        let will = &mut ctx.accounts.will;
        require!(will.is_active, ErrorCode::WillNotActive);
        require!(!will.is_triggered, ErrorCode::WillAlreadyTriggered);

        will.is_active = false;

        emit!(WillCancelled {
            will: will.key(),
            owner: will.owner,
        });

        Ok(())
    }

    /// Update the timeout period
    pub fn update_timeout(ctx: Context<UpdateWill>, new_timeout: i64) -> Result<()> {
        require!(new_timeout >= 86400, ErrorCode::TimeoutTooShort);
        require!(new_timeout <= 31536000, ErrorCode::TimeoutTooLong);

        let will = &mut ctx.accounts.will;
        require!(will.is_active, ErrorCode::WillNotActive);
        require!(!will.is_triggered, ErrorCode::WillAlreadyTriggered);

        will.timeout_seconds = new_timeout;

        emit!(WillUpdated {
            will: will.key(),
            new_timeout,
        });

        Ok(())
    }

    /// Update the final message
    pub fn update_message(ctx: Context<UpdateWill>, new_message: String) -> Result<()> {
        require!(new_message.len() <= 500, ErrorCode::MessageTooLong);

        let will = &mut ctx.accounts.will;
        require!(will.is_active, ErrorCode::WillNotActive);
        require!(!will.is_triggered, ErrorCode::WillAlreadyTriggered);

        will.message = new_message.clone();

        emit!(MessageUpdated {
            will: will.key(),
            new_message,
        });

        Ok(())
    }

    /// Deposit SOL into the will's vault
    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        let will = &ctx.accounts.will;
        require!(will.is_active, ErrorCode::WillNotActive);
        require!(!will.is_triggered, ErrorCode::WillAlreadyTriggered);

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &ctx.accounts.vault.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.vault.to_account_info(),
            ],
        )?;

        emit!(SolDeposited {
            will: will.key(),
            amount,
        });

        Ok(())
    }
}

// === ACCOUNTS ===

#[derive(Accounts)]
pub struct CreateWill<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Will::INIT_SPACE,
        seeds = [b"will", owner.key().as_ref()],
        bump
    )]
    pub will: Account<'info, Will>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddBeneficiary<'info> {
    #[account(
        mut,
        seeds = [b"will", will.owner.as_ref()],
        bump = will.bump,
        has_one = owner,
    )]
    pub will: Account<'info, Will>,

    #[account(
        init,
        payer = owner,
        space = 8 + Beneficiary::INIT_SPACE,
        seeds = [b"beneficiary", will.key().as_ref(), recipient.key().as_ref()],
        bump
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    /// CHECK: The recipient of the inheritance
    pub recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Heartbeat<'info> {
    #[account(
        mut,
        seeds = [b"will", owner.key().as_ref()],
        bump = will.bump,
        has_one = owner,
    )]
    pub will: Account<'info, Will>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct TriggerWill<'info> {
    #[account(
        mut,
        seeds = [b"will", will.owner.as_ref()],
        bump = will.bump,
    )]
    pub will: Account<'info, Will>,

    /// Anyone can trigger a will if timeout is reached
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimInheritance<'info> {
    #[account(
        seeds = [b"will", will.owner.as_ref()],
        bump = will.bump,
    )]
    pub will: Account<'info, Will>,

    #[account(
        mut,
        seeds = [b"beneficiary", will.key().as_ref(), beneficiary.recipient.as_ref()],
        bump = beneficiary.bump,
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub claimer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelWill<'info> {
    #[account(
        mut,
        seeds = [b"will", owner.key().as_ref()],
        bump = will.bump,
        has_one = owner,
    )]
    pub will: Account<'info, Will>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateWill<'info> {
    #[account(
        mut,
        seeds = [b"will", owner.key().as_ref()],
        bump = will.bump,
        has_one = owner,
    )]
    pub will: Account<'info, Will>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(
        seeds = [b"will", owner.key().as_ref()],
        bump = will.bump,
        has_one = owner,
    )]
    pub will: Account<'info, Will>,

    /// CHECK: PDA vault for holding SOL
    #[account(
        mut,
        seeds = [b"vault", will.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// === STATE ===

#[account]
#[derive(InitSpace)]
pub struct Will {
    pub owner: Pubkey,
    pub timeout_seconds: i64,
    pub last_heartbeat: i64,
    pub created_at: i64,
    #[max_len(500)]
    pub message: String,
    pub is_active: bool,
    pub is_triggered: bool,
    pub triggered_at: Option<i64>,
    pub beneficiary_count: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Beneficiary {
    pub will: Pubkey,
    pub recipient: Pubkey,
    pub share_bps: u16,
    pub has_claimed: bool,
    pub bump: u8,
}

// === EVENTS ===

#[event]
pub struct WillCreated {
    pub will: Pubkey,
    pub owner: Pubkey,
    pub timeout_seconds: i64,
    pub created_at: i64,
}

#[event]
pub struct BeneficiaryAdded {
    pub will: Pubkey,
    pub recipient: Pubkey,
    pub share_bps: u16,
}

#[event]
pub struct HeartbeatSent {
    pub will: Pubkey,
    pub owner: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WillTriggered {
    pub will: Pubkey,
    pub owner: Pubkey,
    pub triggered_at: i64,
    pub time_since_heartbeat: i64,
    pub message: String,
}

#[event]
pub struct InheritanceClaimed {
    pub will: Pubkey,
    pub beneficiary: Pubkey,
    pub amount: u64,
}

#[event]
pub struct WillCancelled {
    pub will: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct WillUpdated {
    pub will: Pubkey,
    pub new_timeout: i64,
}

#[event]
pub struct MessageUpdated {
    pub will: Pubkey,
    pub new_message: String,
}

#[event]
pub struct SolDeposited {
    pub will: Pubkey,
    pub amount: u64,
}

// === ERRORS ===

#[error_code]
pub enum ErrorCode {
    #[msg("Timeout must be at least 1 day (86400 seconds)")]
    TimeoutTooShort,
    #[msg("Timeout cannot exceed 1 year (31536000 seconds)")]
    TimeoutTooLong,
    #[msg("Message cannot exceed 500 characters")]
    MessageTooLong,
    #[msg("Share must be between 1 and 10000 basis points")]
    InvalidShare,
    #[msg("Will is not active")]
    WillNotActive,
    #[msg("Will has already been triggered")]
    WillAlreadyTriggered,
    #[msg("Maximum 10 beneficiaries allowed")]
    TooManyBeneficiaries,
    #[msg("Timeout has not been reached yet")]
    TimeoutNotReached,
    #[msg("Will has not been triggered yet")]
    WillNotTriggered,
    #[msg("Beneficiary has already claimed their inheritance")]
    AlreadyClaimed,
}
