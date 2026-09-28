//! # BlueCollar Fee Distribution Contract
//!
//! Manages protocol fee collection and distribution to multiple recipients
//! with percentage-based splits.

#![no_std]
// Lint policy: clippy::pedantic enabled at workspace level (issue #1254).
// Blanket Soroban exceptions (needless_pass_by_value, must_use_candidate, etc.)
// are configured in the workspace Cargo.toml; per-function overrides go here.

use bluecollar_types::{helpers, ContractError};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, Symbol, Vec,
};

/// Maximum allowed fee: 10000 bps = 100%.
pub const MAX_FEE_BPS: u32 = 10000;

/// Event schema version — bump when adding/removing/renaming events.
pub const VERSION: u32 = 1;

// =============================================================================
// Roles
// =============================================================================

pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_PAUSER: &str = "pauser";
pub const ROLE_FEE_MANAGER: &str = "fee_mgr";
pub const ROLE_UPGRADER: &str = "upgrader";

// =============================================================================
// Types
// =============================================================================

/// Fee recipient with percentage split.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct FeeRecipient {
    /// Address to receive fees.
    pub address: Address,
    /// Percentage in basis points (e.g., 5000 = 50%).
    pub percentage_bps: u32,
}

/// Fee collection record.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct FeeCollection {
    /// Token contract address.
    pub token: Address,
    /// Total amount collected.
    pub total_amount: i128,
    /// Amount already distributed.
    pub distributed_amount: i128,
}

/// Storage keys.
#[contracttype]
pub enum DataKey {
    /// Instance storage — admin address.
    Admin,
    /// Instance storage — paused flag.
    Paused,
    /// Persistent storage — role members.
    RoleMembers(Symbol),
    /// Persistent storage — fee recipients list.
    FeeRecipients,
    /// Persistent storage — fee collection by token.
    FeeCollection(Address),
}

// =============================================================================
// Distribution math
// =============================================================================

/// Sum of all recipient percentages in basis points.
///
/// Uses checked arithmetic so an oversized configuration fails with
/// [`ContractError::ArithmeticOverflow`] instead of silently clamping the
/// running total.
///
/// # Errors
/// - [`ContractError::ArithmeticOverflow`] if the total exceeds `u32::MAX`.
pub fn total_percentage_bps(recipients: &Vec<FeeRecipient>) -> Result<u32, ContractError> {
    let mut total: u32 = 0;
    for recipient in recipients.iter() {
        total = total
            .checked_add(recipient.percentage_bps)
            .ok_or(ContractError::ArithmeticOverflow)?;
    }
    Ok(total)
}

/// Floor share of `available` owed to a party weighted at `percentage_bps`.
///
/// # Errors
/// - [`ContractError::ArithmeticOverflow`] if `available` is negative or the
///   intermediate `available * bps` product does not fit in `u128`.
fn share_of(available: i128, percentage_bps: u32) -> Result<i128, ContractError> {
    let available = u128::try_from(available).map_err(|_| ContractError::ArithmeticOverflow)?;
    let numerator = available
        .checked_mul(u128::from(percentage_bps))
        .ok_or(ContractError::ArithmeticOverflow)?;
    let floored = numerator
        .checked_div(u128::from(MAX_FEE_BPS))
        .ok_or(ContractError::ArithmeticOverflow)?;
    i128::try_from(floored).map_err(|_| ContractError::ArithmeticOverflow)
}

/// Plan the exact per-recipient payouts for `available`.
///
/// ## Dust / remainder policy
/// Each recipient is first awarded `floor(available * bps / 10_000)`. Because
/// the basis points must total exactly [`MAX_FEE_BPS`], those floor amounts can
/// never exceed `available`. The leftover remainder (the dust created by the
/// per-recipient truncation) is credited to the **first** recipient, so the
/// planned shares always sum to `available` exactly: no dust is stranded in the
/// collection and no stroop is paid out twice.
///
/// # Parameters
/// - `env`         — environment used to allocate the returned `Vec`.
/// - `available`   — undistributed balance to split (`total - distributed`).
/// - `recipients`  — configured recipients; must total [`MAX_FEE_BPS`].
///
/// # Errors
/// - [`ContractError::InvalidFeeSplit`] if the basis points do not total
///   exactly [`MAX_FEE_BPS`] (including the empty list).
/// - [`ContractError::ArithmeticOverflow`] on overflow/underflow, or if
///   `available` is negative.
pub fn plan_distribution(
    env: &Env,
    available: i128,
    recipients: &Vec<FeeRecipient>,
) -> Result<Vec<i128>, ContractError> {
    if total_percentage_bps(recipients)? != MAX_FEE_BPS {
        return Err(ContractError::InvalidFeeSplit);
    }

    let mut shares: Vec<i128> = Vec::new(env);
    let mut planned: i128 = 0;
    for recipient in recipients.iter() {
        let share = share_of(available, recipient.percentage_bps)?;
        planned = planned
            .checked_add(share)
            .ok_or(ContractError::ArithmeticOverflow)?;
        shares.push_back(share);
    }

    // Invariant: `planned <= available`, so this never underflows for a valid
    // split; if stored state is corrupt we surface a typed error rather than
    // silently losing or duplicating value.
    let remainder = available
        .checked_sub(planned)
        .ok_or(ContractError::ArithmeticOverflow)?;
    if remainder > 0 {
        let first = shares.get(0).unwrap_or(0);
        let bumped = first
            .checked_add(remainder)
            .ok_or(ContractError::ArithmeticOverflow)?;
        shares.set(0, bumped);
    }
    Ok(shares)
}

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct FeeDistributionContract;

#[contractimpl]
impl FeeDistributionContract {
    /// Initialize the contract with an admin.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        let role = Symbol::new(&env, ROLE_ADMIN);
        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(admin.clone());
        env.storage()
            .persistent()
            .set(&DataKey::RoleMembers(role.clone()), &members);
        env.events()
            .publish((symbol_short!("Init"), admin.clone()), ());
        Ok(())
    }

    /// Get role members.
    fn get_role_members(env: &Env, role: &Symbol) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::RoleMembers(role.clone()))
            .unwrap_or(Vec::new(env))
    }

    /// Require role authorization.
    fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> {
        let members = Self::get_role_members(env, role);
        helpers::require_role(caller, &members)
    }

    /// Require contract not paused.
    fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        helpers::require_not_paused(paused)
    }

    /// Grant a role to an address. Caller must hold [`ROLE_ADMIN`].
    ///
    /// Idempotent — calling this twice for the same `(role, account)` pair is
    /// a no-op after the first successful grant.
    ///
    /// # Parameters
    /// - `caller`  — must hold `ROLE_ADMIN` and have authorised this call.
    /// - `role`    — symbolic role identifier (e.g. `Symbol::new(env, "fee_mgr")`).
    /// - `account` — address to be added to the role's member list.
    ///
    /// # Errors
    /// - [`ContractError::MissingRole`] if `caller` does not hold `ROLE_ADMIN`.
    /// - [`ContractError::ContractIsPaused`] if the contract is paused.
    pub fn grant_role(
        env: Env,
        caller: Address,
        role: Symbol,
        account: Address,
    ) -> Result<(), ContractError> {
        let admin_role = Symbol::new(&env, ROLE_ADMIN);
        Self::require_role(&env, &admin_role, &caller)?;
        Self::require_not_paused(&env)?;

        let mut members = Self::get_role_members(&env, &role);
        if members.iter().all(|m| m != account) {
            members.push_back(account.clone());
            env.storage()
                .persistent()
                .set(&DataKey::RoleMembers(role.clone()), &members);
        }
        env.events()
            .publish((symbol_short!("RlGrnt"), role, account), ());
        Ok(())
    }

    /// Revoke a role from an address. Caller must hold [`ROLE_ADMIN`].
    ///
    /// # Parameters
    /// - `caller`  — must hold `ROLE_ADMIN` and have authorised this call.
    /// - `role`    — symbolic role identifier.
    /// - `account` — address to be removed from the role's member list.
    ///
    /// # Errors
    /// - [`ContractError::MissingRole`] if `caller` does not hold `ROLE_ADMIN`.
    /// - [`ContractError::ContractIsPaused`] if the contract is paused.
    /// - [`ContractError::AccountDoesNotHoldRole`] if `account` is not in the role.
    pub fn revoke_role(
        env: Env,
        caller: Address,
        role: Symbol,
        account: Address,
    ) -> Result<(), ContractError> {
        let admin_role = Symbol::new(&env, ROLE_ADMIN);
        Self::require_role(&env, &admin_role, &caller)?;
        Self::require_not_paused(&env)?;

        let members = Self::get_role_members(&env, &role);
        let mut updated: Vec<Address> = Vec::new(&env);
        let mut found = false;
        for m in members.iter() {
            if m == account {
                found = true;
            } else {
                updated.push_back(m);
            }
        }
        if !found {
            return Err(ContractError::AccountDoesNotHoldRole);
        }
        env.storage()
            .persistent()
            .set(&DataKey::RoleMembers(role.clone()), &updated);
        env.events()
            .publish((symbol_short!("RlRvkd"), role, account), ());
        Ok(())
    }

    /// Pause the contract, blocking all state-mutating operations.
    ///
    /// # Parameters
    /// - `caller` — must hold [`ROLE_PAUSER`] and have authorised this call.
    ///
    /// # Errors
    /// - [`ContractError::MissingRole`] if `caller` does not hold `ROLE_PAUSER`.
    pub fn pause(env: Env, caller: Address) -> Result<(), ContractError> {
        let pauser_role = Symbol::new(&env, ROLE_PAUSER);
        Self::require_role(&env, &pauser_role, &caller)?;
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("Paused"), caller), ());
        Ok(())
    }

    /// Unpause the contract, re-enabling all state-mutating operations.
    ///
    /// # Parameters
    /// - `caller` — must hold [`ROLE_ADMIN`] and have authorised this call.
    ///
    /// # Errors
    /// - [`ContractError::MissingRole`] if `caller` does not hold `ROLE_ADMIN`.
    pub fn unpause(env: Env, caller: Address) -> Result<(), ContractError> {
        let admin_role = Symbol::new(&env, ROLE_ADMIN);
        Self::require_role(&env, &admin_role, &caller)?;
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((symbol_short!("Unpaused"), caller), ());
        Ok(())
    }

    /// Set fee recipients with percentage splits.
    pub fn set_fee_recipients(
        env: Env,
        caller: Address,
        recipients: Vec<FeeRecipient>,
    ) -> Result<(), ContractError> {
        let fee_mgr_role = Symbol::new(&env, ROLE_FEE_MANAGER);
        Self::require_role(&env, &fee_mgr_role, &caller)?;
        Self::require_not_paused(&env)?;

        // Validate total percentage equals 10000 (100%)
        if total_percentage_bps(&recipients)? != MAX_FEE_BPS {
            return Err(ContractError::InvalidFeeSplit);
        }

        env.storage()
            .persistent()
            .set(&DataKey::FeeRecipients, &recipients);
        env.events()
            .publish((symbol_short!("FeeRcp"), recipients.len()), ());
        Ok(())
    }

    /// Get current fee recipients.
    pub fn get_fee_recipients(env: Env) -> Result<Vec<FeeRecipient>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::FeeRecipients)
            .unwrap_or(Vec::new(&env)))
    }

    /// Collect fees from a token.
    pub fn collect_fees(
        env: Env,
        from: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        from.require_auth();
        Self::require_not_paused(&env)?;
        if amount <= 0 {
            return Err(ContractError::AmountMustBePositive);
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer_from(
            &env.current_contract_address(),
            &from,
            &env.current_contract_address(),
            &amount,
        );

        let mut collection: FeeCollection = env
            .storage()
            .persistent()
            .get(&DataKey::FeeCollection(token.clone()))
            .unwrap_or(FeeCollection {
                token: token.clone(),
                total_amount: 0,
                distributed_amount: 0,
            });

        collection.total_amount = collection
            .total_amount
            .checked_add(amount)
            .ok_or(ContractError::ArithmeticOverflow)?;
        env.storage()
            .persistent()
            .set(&DataKey::FeeCollection(token.clone()), &collection);

        env.events()
            .publish((symbol_short!("FeeColl"), token, amount), ());
        Ok(())
    }

    /// Distribute collected fees to recipients.
    pub fn distribute_fees(env: Env, caller: Address, token: Address) -> Result<(), ContractError> {
        let fee_mgr_role = Symbol::new(&env, ROLE_FEE_MANAGER);
        Self::require_role(&env, &fee_mgr_role, &caller)?;
        Self::require_not_paused(&env)?;

        let recipients = Self::get_fee_recipients(env.clone())?;
        if recipients.is_empty() {
            return Err(ContractError::NoFeeRecipientsConfigured);
        }

        let mut collection: FeeCollection = env
            .storage()
            .persistent()
            .get(&DataKey::FeeCollection(token.clone()))
            .unwrap_or_else(|| FeeCollection {
                token: token.clone(),
                total_amount: 0,
                distributed_amount: 0,
            });

        let available = collection
            .total_amount
            .checked_sub(collection.distributed_amount)
            .ok_or(ContractError::ArithmeticOverflow)?;
        if available <= 0 {
            return Err(ContractError::NoFeesToDistribute);
        }

        // Exact split plan: floor shares plus the truncation remainder credited
        // to the first recipient, so `Σ shares == available`.
        let shares = plan_distribution(&env, available, &recipients)?;

        let token_client = token::Client::new(&env, &token);
        let contract = env.current_contract_address();

        let mut distributed: i128 = 0;
        for (recipient, share) in recipients.iter().zip(shares.iter()) {
            if share > 0 {
                token_client.transfer(&contract, &recipient.address, &share);
                env.events().publish(
                    (symbol_short!("FeeDistr"), recipient.address.clone(), share),
                    (),
                );
            }
            distributed = distributed
                .checked_add(share)
                .ok_or(ContractError::ArithmeticOverflow)?;
        }

        // Track what was actually handed out rather than assuming the full
        // collection moved; with the dust policy above this equals
        // `total_amount`, and it can never exceed it.
        collection.distributed_amount = collection
            .distributed_amount
            .checked_add(distributed)
            .ok_or(ContractError::ArithmeticOverflow)?;
        env.storage()
            .persistent()
            .set(&DataKey::FeeCollection(token.clone()), &collection);
        Ok(())
    }

    /// Get fee collection status for a token.
    pub fn get_fee_collection(env: Env, token: Address) -> Result<FeeCollection, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::FeeCollection(token.clone()))
            .unwrap_or(FeeCollection {
                token,
                total_amount: 0,
                distributed_amount: 0,
            }))
    }

    /// Withdraw unclaimed fees (emergency function).
    pub fn withdraw_fees(
        env: Env,
        caller: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        let admin_role = Symbol::new(&env, ROLE_ADMIN);
        Self::require_role(&env, &admin_role, &caller)?;
        if amount <= 0 {
            return Err(ContractError::AmountMustBePositive);
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &caller, &amount);

        env.events()
            .publish((symbol_short!("FeeWdraw"), token, amount), ());
        Ok(())
    }

    /// Return the event schema version.
    pub fn version(_env: Env) -> Result<u32, ContractError> {
        Ok(VERSION)
    }

    /// Upgrade contract WASM.
    pub fn upgrade(
        env: Env,
        caller: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        let upgrader_role = Symbol::new(&env, ROLE_UPGRADER);
        Self::require_role(&env, &upgrader_role, &caller)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        env.events().publish((symbol_short!("Upgrade"), caller), ());
        Ok(())
    }
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract = env.register_contract(None, FeeDistributionContract);
        let client = FeeDistributionContractClient::new(&env, &contract);
        client.initialize(&admin);
        assert!(env.as_contract(&contract, || {
            env.storage().instance().has(&DataKey::Admin)
        }));
    }
}
