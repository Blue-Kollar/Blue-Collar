//! # BlueCollar Fee Distribution Contract
//!
//! Manages protocol fee collection and distribution to multiple recipients
//! with percentage-based splits.

#![no_std]

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

    /// Grant a role to an address.
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

    /// Revoke a role from an address.
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

    /// Pause the contract.
    pub fn pause(env: Env, caller: Address) -> Result<(), ContractError> {
        let pauser_role = Symbol::new(&env, ROLE_PAUSER);
        Self::require_role(&env, &pauser_role, &caller)?;
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("Paused"), caller), ());
        Ok(())
    }

    /// Unpause the contract.
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
        let mut total_bps: u32 = 0;
        for recipient in recipients.iter() {
            total_bps = total_bps.saturating_add(recipient.percentage_bps);
        }
        if total_bps != MAX_FEE_BPS {
            return Err(ContractError::InvalidFeeSplit);
        }

        env.storage()
            .persistent()
            .set(&DataKey::FeeRecipients, &recipients);
        env.events()
            .publish((symbol_short!("FeeRcp"), recipients.len() as u32), ());
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

        collection.total_amount = collection.total_amount.saturating_add(amount);
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

        let available = collection.total_amount - collection.distributed_amount;
        if available <= 0 {
            return Err(ContractError::NoFeesToDistribute);
        }

        let token_client = token::Client::new(&env, &token);

        for recipient in recipients.iter() {
            let share = (available as u128)
                .saturating_mul(recipient.percentage_bps as u128)
                .saturating_div(MAX_FEE_BPS as u128) as i128;

            if share > 0 {
                token_client.transfer(&env.current_contract_address(), &recipient.address, &share);
                env.events().publish(
                    (symbol_short!("FeeDistr"), recipient.address.clone(), share),
                    (),
                );
            }
        }

        collection.distributed_amount = collection.total_amount;
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
