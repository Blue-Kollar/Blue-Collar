//! # Payment — Storage Layer
//!
//! All persistent/instance storage reads and writes for the payment contract.
//! No business logic lives here — only raw get/set/has operations plus the
//! type definitions and TTL helpers.

use bluecollar_types::storage::extend_ttl;
use soroban_sdk::{contracttype, Address, Env, Symbol, Vec};

// =============================================================================
// Constants
// =============================================================================

/// Maximum protocol fee: 500 bps = 5 %.
pub const MAX_FEE_BPS: u32 = 500;

/// Approximate TTL extension target (~1 year at 5 s/ledger).
pub const TTL_EXTEND_TO: u32 = 535_000;
/// Extend TTL only when it drops below this threshold (~6 months).
pub const TTL_THRESHOLD: u32 = 267_500;

// =============================================================================
// Roles
// =============================================================================

pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_FEE_MGR: &str = "fee_mgr";
pub const ROLE_PAUSER: &str = "pauser";
pub const ROLE_UPGRADER: &str = "upgrader";

pub const ROLE_ADMIN_ID: u64 = 0;
pub const ROLE_FEE_MGR_ID: u64 = 1;
pub const ROLE_PAUSER_ID: u64 = 2;
pub const ROLE_UPGRADER_ID: u64 = 3;

// =============================================================================
// Types
// =============================================================================

/// Protocol configuration stored in instance storage.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Config {
    /// Protocol fee in basis points (0–500).
    pub fee_bps: u32,
    /// Address that receives collected protocol fees.
    pub fee_recipient: Address,
}

/// Status of a locked payment.
#[contracttype]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentStatus {
    /// Funds locked; awaiting release or refund.
    Locked = 0,
    /// Funds released to the worker.
    Released = 1,
    /// Funds refunded to the client.
    Refunded = 2,
}

/// A locked payment record stored in persistent storage.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct LockedPayment {
    /// Unique identifier (caller-supplied).
    pub id: Symbol,
    /// Client that locked the funds.
    pub client: Address,
    /// Worker that will receive funds on release.
    pub worker: Address,
    /// Token contract address.
    pub token: Address,
    /// Locked amount in smallest token units.
    pub amount: i128,
    /// Unix timestamp after which client may self-refund without admin.
    pub expiry: u64,
    /// Current status.
    pub status: PaymentStatus,
}

/// Storage keys.
#[contracttype]
pub enum DataKey {
    /// Instance — config (fee_bps, fee_recipient).
    Config,
    /// Instance — paused flag.
    Paused,
    /// Persistent — admin address.
    Admin,
    /// Persistent — role member lists.
    RoleMembers(u64),
    /// Persistent — locked payment record.
    Payment(Symbol),
    /// Persistent — schema version.
    SchemaVersion,
}

// =============================================================================
// Role helpers
// =============================================================================

/// Map a role `Symbol` to its compact storage id.
pub fn role_to_id(env: &Env, role: &Symbol) -> u64 {
    if *role == Symbol::new(env, ROLE_ADMIN) {
        ROLE_ADMIN_ID
    } else if *role == Symbol::new(env, ROLE_FEE_MGR) {
        ROLE_FEE_MGR_ID
    } else if *role == Symbol::new(env, ROLE_PAUSER) {
        ROLE_PAUSER_ID
    } else if *role == Symbol::new(env, ROLE_UPGRADER) {
        ROLE_UPGRADER_ID
    } else {
        u64::MAX
    }
}

// =============================================================================
// Storage accessors
// =============================================================================

/// Read the role member list for `role_id`.
pub fn load_role_members(env: &Env, role_id: u64) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::RoleMembers(role_id))
        .unwrap_or_else(|| Vec::new(env))
}

/// Write the role member list for `role_id`.
pub fn save_role_members(env: &Env, role_id: u64, members: &Vec<Address>) {
    env.storage()
        .persistent()
        .set(&DataKey::RoleMembers(role_id), members);
}

/// Return `true` if the contract has been initialised.
pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Config)
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

/// Load the protocol config.
pub fn load_config(env: &Env) -> Option<Config> {
    env.storage().instance().get(&DataKey::Config)
}

/// Save the protocol config.
pub fn save_config(env: &Env, config: &Config) {
    env.storage().instance().set(&DataKey::Config, config);
}

/// Load the admin address.
pub fn load_admin(env: &Env) -> Option<Address> {
    env.storage().persistent().get(&DataKey::Admin)
}

/// Save the admin address.
pub fn save_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
}

/// Load a locked payment record by id.
pub fn load_payment(env: &Env, id: &Symbol) -> Option<LockedPayment> {
    env.storage().persistent().get(&DataKey::Payment(id.clone()))
}

/// Write a locked payment record and extend its TTL.
pub fn save_payment(env: &Env, record: &LockedPayment) {
    let key = DataKey::Payment(record.id.clone());
    env.storage().persistent().set(&key, record);
    extend_ttl(env, &key);
}

/// Load the schema version (defaults to 1).
pub fn get_schema_version(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::SchemaVersion)
        .unwrap_or(1u32)
}

/// Save the schema version.
pub fn set_schema_version(env: &Env, version: u32) {
    env.storage()
        .persistent()
        .set(&DataKey::SchemaVersion, &version);
}
