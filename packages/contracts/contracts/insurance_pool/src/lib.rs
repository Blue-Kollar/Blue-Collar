//! # BlueCollar Insurance Pool Contract
//!
//! On-chain insurance pool for protecting worker payments.
//! Manages contributions, claims, and pool rebalancing.

#![no_std]

use bluecollar_types::{helpers, ContractError};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, String,
    Symbol, Vec,
};

/// Maximum allowed premium: 10000 bps = 100%.
pub const MAX_PREMIUM_BPS: u32 = 10000;

/// Event schema version — bump when adding/removing/renaming events.
pub const VERSION: u32 = 1;

// =============================================================================
// Roles
// =============================================================================

pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_PAUSER: &str = "pauser";
pub const ROLE_CLAIMS_MGR: &str = "claims_mgr";
pub const ROLE_UPGRADER: &str = "upgrader";

// =============================================================================
// Types
// =============================================================================

/// Insurance pool member.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PoolMember {
    /// Member address.
    pub address: Address,
    /// Contribution amount.
    pub contribution: i128,
    /// Timestamp of last contribution.
    pub last_contribution_at: u64,
}

/// Insurance claim.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Claim {
    /// Claim ID.
    pub id: Symbol,
    /// Claimant address.
    pub claimant: Address,
    /// Claim amount.
    pub amount: i128,
    /// Claim status: "pending", "approved", "rejected", "paid".
    pub status: String,
    /// Timestamp when claim was filed.
    pub filed_at: u64,
    /// Timestamp when claim was resolved.
    pub resolved_at: u64,
}

/// Pool statistics.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PoolStats {
    /// Token contract address.
    pub token: Address,
    /// Total pool balance.
    pub total_balance: i128,
    /// Total contributions.
    pub total_contributions: i128,
    /// Total claims paid.
    pub total_claims_paid: i128,
    /// Premium rate in basis points.
    pub premium_bps: u32,
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
    /// Persistent storage — pool members.
    PoolMembers,
    /// Persistent storage — pool statistics.
    PoolStats(Address),
    /// Persistent storage — claims list.
    Claims,
    /// Persistent storage — individual claim.
    Claim(Symbol),
}

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct InsurancePoolContract;

#[contractimpl]
impl InsurancePoolContract {
    /// Initialize the contract with an admin and token.
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        premium_bps: u32,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        if premium_bps > MAX_PREMIUM_BPS {
            return Err(ContractError::PremiumExceedsMaximum);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        let role = Symbol::new(&env, ROLE_ADMIN);
        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(admin.clone());
        env.storage()
            .persistent()
            .set(&DataKey::RoleMembers(role.clone()), &members);

        let stats = PoolStats {
            token: token.clone(),
            total_balance: 0,
            total_contributions: 0,
            total_claims_paid: 0,
            premium_bps,
        };
        env.storage()
            .persistent()
            .set(&DataKey::PoolStats(token.clone()), &stats);

        env.events()
            .publish((symbol_short!("Init"), admin, premium_bps), ());
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

    /// Contribute to the insurance pool.
    pub fn contribute(
        env: Env,
        contributor: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        if amount <= 0 {
            return Err(ContractError::AmountMustBePositive);
        }

        contributor.require_auth();

        let token_client = token::Client::new(&env, &token);
        token_client.transfer_from(
            &env.current_contract_address(),
            &contributor,
            &env.current_contract_address(),
            &amount,
        );

        let mut members: Vec<PoolMember> = env
            .storage()
            .persistent()
            .get(&DataKey::PoolMembers)
            .unwrap_or(Vec::new(&env));

        let mut found = false;
        for i in 0..members.len() {
            let mut member = members.get(i).unwrap();
            if member.address == contributor {
                member.contribution = member.contribution.saturating_add(amount);
                member.last_contribution_at = env.ledger().timestamp();
                members.set(i, member);
                found = true;
                break;
            }
        }

        if !found {
            members.push_back(PoolMember {
                address: contributor.clone(),
                contribution: amount,
                last_contribution_at: env.ledger().timestamp(),
            });
        }

        env.storage()
            .persistent()
            .set(&DataKey::PoolMembers, &members);

        let mut stats: PoolStats = env
            .storage()
            .persistent()
            .get(&DataKey::PoolStats(token.clone()))
            .unwrap_or_else(|| PoolStats {
                token: token.clone(),
                total_balance: 0,
                total_contributions: 0,
                total_claims_paid: 0,
                premium_bps: 0,
            });

        stats.total_balance = stats.total_balance.saturating_add(amount);
        stats.total_contributions = stats.total_contributions.saturating_add(amount);
        env.storage()
            .persistent()
            .set(&DataKey::PoolStats(token.clone()), &stats);

        env.events()
            .publish((symbol_short!("Contrib"), contributor, amount), ());
        Ok(())
    }

    /// File an insurance claim.
    pub fn file_claim(
        env: Env,
        claimant: Address,
        claim_id: Symbol,
        amount: i128,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        if amount <= 0 {
            return Err(ContractError::AmountMustBePositive);
        }

        claimant.require_auth();

        let claim = Claim {
            id: claim_id.clone(),
            claimant: claimant.clone(),
            amount,
            status: String::from_slice(&env, "pending"),
            filed_at: env.ledger().timestamp(),
            resolved_at: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Claim(claim_id.clone()), &claim);

        let mut claims: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::Claims)
            .unwrap_or(Vec::new(&env));
        claims.push_back(claim_id.clone());
        env.storage().persistent().set(&DataKey::Claims, &claims);

        env.events()
            .publish((symbol_short!("ClmFile"), claimant, amount), ());
        Ok(())
    }

    /// Approve an insurance claim.
    pub fn approve_claim(env: Env, caller: Address, claim_id: Symbol) -> Result<(), ContractError> {
        let claims_mgr_role = Symbol::new(&env, ROLE_CLAIMS_MGR);
        Self::require_role(&env, &claims_mgr_role, &caller)?;
        Self::require_not_paused(&env)?;

        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&DataKey::Claim(claim_id.clone()))
            .ok_or(ContractError::ClaimNotFound)?;

        if claim.status != String::from_slice(&env, "pending") {
            return Err(ContractError::ClaimNotPending);
        }

        claim.status = String::from_slice(&env, "approved");
        claim.resolved_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::Claim(claim_id.clone()), &claim);

        env.events()
            .publish((symbol_short!("ClmAppr"), claim_id, claim.amount), ());
        Ok(())
    }

    /// Reject an insurance claim.
    pub fn reject_claim(env: Env, caller: Address, claim_id: Symbol) -> Result<(), ContractError> {
        let claims_mgr_role = Symbol::new(&env, ROLE_CLAIMS_MGR);
        Self::require_role(&env, &claims_mgr_role, &caller)?;
        Self::require_not_paused(&env)?;

        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&DataKey::Claim(claim_id.clone()))
            .ok_or(ContractError::ClaimNotFound)?;

        if claim.status != String::from_slice(&env, "pending") {
            return Err(ContractError::ClaimNotPending);
        }

        claim.status = String::from_slice(&env, "rejected");
        claim.resolved_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::Claim(claim_id.clone()), &claim);

        env.events()
            .publish((symbol_short!("ClmRej"), claim_id, claim.amount), ());
        Ok(())
    }

    /// Pay out an approved claim.
    pub fn pay_claim(
        env: Env,
        caller: Address,
        claim_id: Symbol,
        token: Address,
    ) -> Result<(), ContractError> {
        let claims_mgr_role = Symbol::new(&env, ROLE_CLAIMS_MGR);
        Self::require_role(&env, &claims_mgr_role, &caller)?;
        Self::require_not_paused(&env)?;

        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&DataKey::Claim(claim_id.clone()))
            .ok_or(ContractError::ClaimNotFound)?;

        if claim.status != String::from_slice(&env, "approved") {
            return Err(ContractError::ClaimNotApproved);
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(
            &env.current_contract_address(),
            &claim.claimant,
            &claim.amount,
        );

        claim.status = String::from_slice(&env, "paid");
        env.storage()
            .persistent()
            .set(&DataKey::Claim(claim_id.clone()), &claim);

        let mut stats: PoolStats = env
            .storage()
            .persistent()
            .get(&DataKey::PoolStats(token.clone()))
            .ok_or(ContractError::PoolStatsNotFound)?;

        stats.total_balance = stats.total_balance.saturating_sub(claim.amount);
        stats.total_claims_paid = stats.total_claims_paid.saturating_add(claim.amount);
        env.storage()
            .persistent()
            .set(&DataKey::PoolStats(token.clone()), &stats);

        env.events()
            .publish((symbol_short!("ClmPay"), claim_id, claim.amount), ());
        Ok(())
    }

    /// Get pool statistics.
    pub fn get_pool_stats(env: Env, token: Address) -> Result<PoolStats, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::PoolStats(token.clone()))
            .unwrap_or(PoolStats {
                token,
                total_balance: 0,
                total_contributions: 0,
                total_claims_paid: 0,
                premium_bps: 0,
            }))
    }

    /// Get pool members.
    pub fn get_pool_members(env: Env) -> Result<Vec<PoolMember>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::PoolMembers)
            .unwrap_or(Vec::new(&env)))
    }

    /// Get a specific claim.
    pub fn get_claim(env: Env, claim_id: Symbol) -> Result<Claim, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Claim(claim_id))
            .ok_or(ContractError::ClaimNotFound)
    }

    /// Rebalance pool by adjusting premium.
    pub fn rebalance_pool(
        env: Env,
        caller: Address,
        token: Address,
        new_premium_bps: u32,
    ) -> Result<(), ContractError> {
        let admin_role = Symbol::new(&env, ROLE_ADMIN);
        Self::require_role(&env, &admin_role, &caller)?;
        if new_premium_bps > MAX_PREMIUM_BPS {
            return Err(ContractError::PremiumExceedsMaximum);
        }

        let mut stats: PoolStats = env
            .storage()
            .persistent()
            .get(&DataKey::PoolStats(token.clone()))
            .ok_or(ContractError::PoolStatsNotFound)?;

        stats.premium_bps = new_premium_bps;
        env.storage()
            .persistent()
            .set(&DataKey::PoolStats(token.clone()), &stats);

        env.events()
            .publish((symbol_short!("Rebal"), token, new_premium_bps as i128), ());
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
        let token = Address::generate(&env);
        env.register_stellar_asset_contract_v2(token.clone());
        let contract = env.register_contract(None, InsurancePoolContract);
        let client = InsurancePoolContractClient::new(&env, &contract);
        client.initialize(&admin, &token, &100);
        assert!(env.as_contract(&contract, || {
            env.storage().instance().has(&DataKey::Admin)
        }));
    }
}
