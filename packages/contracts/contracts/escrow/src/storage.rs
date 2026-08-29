//! # Escrow — Storage Layer
//!
//! All persistent/instance storage reads and writes for the escrow contract.
//! No business logic lives here — only raw get/set/has operations plus the
//! type definitions and TTL extension helpers.

use bluecollar_types::storage::extend_ttl;
use soroban_sdk::{contracttype, Address, Env, Symbol, Vec};

// =============================================================================
// TTL Constants
// =============================================================================

pub use bluecollar_types::storage::{TTL_EXTEND_TO, TTL_THRESHOLD};

// =============================================================================
// Types
// =============================================================================

/// Escrow lifecycle state.
#[contracttype]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EscrowState {
    /// Funds locked; awaiting release or cancellation.
    Active = 0,
    /// Funds released to the beneficiary.
    Released = 1,
    /// Funds refunded to the depositor.
    Cancelled = 2,
    /// Dispute filed; awaiting arbitrator decision.
    Disputed = 3,
}

/// On-chain escrow record.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowRecord {
    /// Unique escrow identifier.
    pub id: Symbol,
    /// Address that deposited funds.
    pub depositor: Address,
    /// Address that receives funds on release.
    pub beneficiary: Address,
    /// Token contract address.
    pub token: Address,
    /// Locked amount in smallest token units.
    pub amount: i128,
    /// Unix timestamp after which depositor may cancel unilaterally.
    pub expiry: u64,
    /// Current state.
    pub state: EscrowState,
    /// Ledger sequence when escrow was created.
    pub created_at: u32,
    /// Ledger sequence of last state change.
    pub updated_at: u32,
}

/// Storage keys.
#[contracttype]
pub enum DataKey {
    /// Instance — initialisation flag.
    Initialized,
    /// Instance — paused flag.
    Paused,
    /// Persistent — admin address.
    Admin,
    /// Persistent — role member lists.
    RoleMembers(u64),
    /// Persistent — escrow record by id.
    Escrow(Symbol),
    /// Persistent — ordered list of all escrow ids.
    EscrowList,
    /// Persistent — schema version.
    SchemaVersion,
}

// =============================================================================
// Storage accessors
// =============================================================================

/// Load an escrow record by id. Returns `None` if not found.
pub fn load_escrow(env: &Env, id: &Symbol) -> Option<EscrowRecord> {
    env.storage().persistent().get(&DataKey::Escrow(id.clone()))
}

/// Write an escrow record and extend its TTL.
/// Optimized: combines write and TTL extension into single operation.
pub fn save_escrow(env: &Env, record: &EscrowRecord) {
    let key = DataKey::Escrow(record.id.clone());
    env.storage().persistent().set(&key, record);
    extend_ttl(env, &key);
}

/// Extend the TTL on an escrow entry. A missing entry is a no-op.
pub fn extend_escrow_ttl(env: &Env, id: &Symbol) {
    extend_ttl(env, &DataKey::Escrow(id.clone()));
}

/// Load the global escrow id list.
pub fn load_escrow_list(env: &Env) -> Vec<Symbol> {
    env.storage()
        .persistent()
        .get(&DataKey::EscrowList)
        .unwrap_or_else(|| Vec::new(env))
}

/// Write the global escrow id list and extend its TTL.
/// Optimized: includes TTL extension for durability.
pub fn save_escrow_list(env: &Env, list: &Vec<Symbol>) {
    let key = DataKey::EscrowList;
    env.storage().persistent().set(&key, list);
    // Extend TTL to prevent eviction of escrow registry
    extend_ttl(env, &key);
}

/// Read the admin address.
pub fn load_admin(env: &Env) -> Option<Address> {
    env.storage().persistent().get(&DataKey::Admin)
}

/// Write the admin address and extend its TTL.
/// Optimized: includes TTL extension for durability of admin state.
pub fn save_admin(env: &Env, admin: &Address) {
    let key = DataKey::Admin;
    env.storage().persistent().set(&key, admin);
    // Extend TTL to ensure admin state persists
    extend_ttl(env, &key);
}

/// Read the role member list for a given role id.
pub fn load_role_members(env: &Env, role_id: u64) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::RoleMembers(role_id))
        .unwrap_or_else(|| Vec::new(env))
}

/// Write the role member list and extend its TTL.
/// Optimized: includes TTL extension for durability of access control state.
pub fn save_role_members(env: &Env, role_id: u64, members: &Vec<Address>) {
    let key = DataKey::RoleMembers(role_id);
    env.storage().persistent().set(&key, members);
    // Extend TTL to persist access control role data
    extend_ttl(env, &key);
}

/// Return `true` if the contract has been initialised.
pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Initialized)
}

/// Mark the contract as initialised.
pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&DataKey::Initialized, &true);
}

/// Return `true` if the contract is paused.
pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<_, bool>(&DataKey::Paused)
        .unwrap_or(false)
}

/// Set the paused flag.
pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
}
