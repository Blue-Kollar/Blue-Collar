//! # BlueCollar Registry Contract
//!
//! Deployed on Stellar (Soroban), this contract manages on-chain worker registrations
//! for the BlueCollar protocol. It provides a trustless, immutable record of worker
//! listings that can be verified by anyone on the network.
//!
//! ## Access Control
//! - **Admin**: Set once at [`initialize`]. Can add/remove curators and upgrade the contract.
//! - **Curators**: Approved addresses that may register workers on behalf of owners.
//! - **Owners**: The worker's on-chain owner address; may toggle, update, or deregister their own worker.
//!
//! ## Storage
//! - Instance storage: `Admin` key (set once).
//! - Persistent storage: `Curators` list, individual `Worker` entries, and `WorkerList` index.
//!
//! ## Privacy
//! Raw PII (location, contact details) is never stored on-chain.
//! Only SHA-256 digests are stored — see `location_hash` and `contact_hash` on [`Worker`].

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, String, Symbol, Vec,
};

/// Approximate TTL extension target (~1 year at 5 s/ledger).
const TTL_EXTEND_TO: u32 = 535_000;
/// Extend TTL only when it drops below this threshold (~6 months).
const TTL_THRESHOLD: u32 = 267_500;

// =============================================================================
// Types
// =============================================================================

/// On-chain worker profile stored in persistent contract storage.
///
/// `location_hash` and `contact_hash` are SHA-256 digests — raw PII is never
/// stored on-chain. See README § Hashing Scheme for the exact input format.
#[contracttype]
#[derive(Clone)]
pub struct Worker {
    /// Unique worker identifier (matches the off-chain database id).
    pub id: Symbol,
    /// Stellar address of the worker's owner account.
    pub owner: Address,
    /// Display name of the worker.
    pub name: String,
    /// Trade/skill category (e.g. `plumber`, `electrician`).
    pub category: Symbol,
    /// Whether the worker is currently accepting work.
    pub is_active: bool,
    /// Stellar wallet address used to receive tips/payments.
    pub wallet: Address,
    /// SHA-256( lowercase(city) + ":" + lowercase(country_iso2) )
    pub location_hash: BytesN<32>,
    /// SHA-256( lowercase(email_or_e164_phone) )
    pub contact_hash: BytesN<32>,
    /// Reputation score in basis points (0–10000, where 10000 = 100.00%).
    /// Updated by the admin via [`RegistryContract::update_reputation`].
    pub reputation: u32,
}

// =============================================================================
// Roles
// =============================================================================

/// Full admin — can grant/revoke any role and call all privileged functions.
pub const ROLE_ADMIN: &str = "admin";
/// May pause and unpause the contract.
pub const ROLE_PAUSER: &str = "pauser";
/// May add and remove curators.
pub const ROLE_CURATOR_MGR: &str = "curator_mgr";
/// May update worker reputation scores.
pub const ROLE_REP_MGR: &str = "rep_mgr";
/// May upgrade the contract WASM.
pub const ROLE_UPGRADER: &str = "upgrader";

/// Storage keys used throughout the contract.
#[contracttype]
pub enum DataKey {
    /// Instance storage — bootstrap admin address, set once at [`RegistryContract::initialize`].
    Admin,
    /// Instance storage — paused flag; when `true` all state-mutating functions revert.
    Paused,
    /// Persistent storage — `Vec<Address>` of members for a given role [`Symbol`].
    RoleMembers(Symbol),
    /// Persistent storage — ordered list of approved curator [`Address`]es.
    Curators,
    /// Persistent storage — [`Worker`] record keyed by its `id` [`Symbol`].
    Worker(Symbol),
    /// Persistent storage — ordered list of all registered worker id [`Symbol`]s.
    WorkerList,
    /// Persistent storage — list of [`Delegate`]s for a worker, keyed by worker id.
    Delegates(Symbol),
}

/// A delegate entry granting a third-party address permission to manage a worker profile.
#[contracttype]
#[derive(Clone)]
pub struct Delegate {
    /// The delegated address.
    pub address: Address,
    /// Unix timestamp after which this delegation expires.
    /// A value of `0` means the delegation never expires.
    pub expires_at: u64,
}

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------

    /// Initialise the contract and set the admin address.
    ///
    /// Grants [`ROLE_ADMIN`] to `admin` automatically.
    ///
    /// # Parameters
    /// - `admin`: The address that will have admin privileges.
    ///
    /// # Panics
    /// Panics with `"Already initialized"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::Admin),
            "Already initialized"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        // Bootstrap: grant ROLE_ADMIN to the initial admin.
        let role = Symbol::new(&env, ROLE_ADMIN);
        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(admin.clone());
        env.storage().persistent().set(&DataKey::RoleMembers(role.clone()), &members);
        env.events().publish((symbol_short!("RlGrnt"), role, admin), ());
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// Return the member list for a role, or empty vec if no members exist.
    fn get_role_members(env: &Env, role: &Symbol) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::RoleMembers(role.clone()))
            .unwrap_or(Vec::new(env))
    }

    /// Assert that `caller` holds `role` and has authorised this call.
    ///
    /// # Panics
    /// Panics with `"Missing role"` if `caller` does not hold the role.
    fn require_role(env: &Env, role: &Symbol, caller: &Address) {
        caller.require_auth();
        let members = Self::get_role_members(env, role);
        assert!(members.iter().any(|m| m == *caller), "Missing role");
    }

    /// Assert that the contract is not paused.
    ///
    /// # Panics
    /// Panics with `"Contract is paused"` if the paused flag is set.
    fn require_not_paused(env: &Env) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        assert!(!paused, "Contract is paused");
    }

    /// Return the delegate list for a worker, or empty vec if none exist.
    fn get_delegates(env: &Env, worker_id: &Symbol) -> Vec<Delegate> {
        env.storage()
            .persistent()
            .get(&DataKey::Delegates(worker_id.clone()))
            .unwrap_or(Vec::new(env))
    }

    /// Assert that `caller` is either the worker's owner or an active (non-expired) delegate.
    ///
    /// # Panics
    /// Panics with `"Not authorized"` if neither condition holds.
    fn require_owner_or_delegate(env: &Env, worker: &Worker, caller: &Address) {
        if worker.owner == *caller {
            return;
        }
        let now = env.ledger().timestamp();
        let delegates = Self::get_delegates(env, &worker.id);
        let is_valid_delegate = delegates.iter().any(|d| {
            d.address == *caller && (d.expires_at == 0 || d.expires_at > now)
        });
        assert!(is_valid_delegate, "Not authorized");
    }

    // -------------------------------------------------------------------------
    // Role management (ROLE_ADMIN only)
    // -------------------------------------------------------------------------

    /// Grant a role to an address. Caller must hold [`ROLE_ADMIN`].
    ///
    /// Idempotent — granting an already-held role is a no-op.
    ///
    /// # Parameters
    /// - `caller`: Must hold `ROLE_ADMIN`; `require_auth()` is enforced.
    /// - `role`: The role symbol to grant (e.g. `Symbol::new(&env, "pauser")`).
    /// - `account`: Address to receive the role.
    ///
    /// # Panics
    /// - `"Missing role"` if `caller` does not hold `ROLE_ADMIN`.
    /// - `"Contract is paused"` if paused.
    ///
    /// # Events
    /// Emits `("RlGrnt", role, account)`.
    pub fn grant_role(env: Env, caller: Address, role: Symbol, account: Address) {
        let admin_role = Symbol::new(&env, ROLE_ADMIN);
        Self::require_role(&env, &admin_role, &caller);
        Self::require_not_paused(&env);

        let mut members = Self::get_role_members(&env, &role);
        if members.iter().all(|m| m != account) {
            members.push_back(account.clone());
            env.storage().persistent().set(&DataKey::RoleMembers(role.clone()), &members);
        }

        env.events().publish((symbol_short!("RlGrnt"), role, account), ());
    }

    /// Revoke a role from an address. Caller must hold [`ROLE_ADMIN`].
    ///
    /// # Parameters
    /// - `caller`: Must hold `ROLE_ADMIN`; `require_auth()` is enforced.
    /// - `role`: The role symbol to revoke.
    /// - `account`: Address to lose the role.
    ///
    /// # Panics
    /// - `"Missing role"` if `caller` does not hold `ROLE_ADMIN`.
    /// - `"Account does not hold role"` if `account` is not a member.
    /// - `"Contract is paused"` if paused.
    ///
    /// # Events
    /// Emits `("RlRvkd", role, account)`.
    pub fn revoke_role(env: Env, caller: Address, role: Symbol, account: Address) {
        let admin_role = Symbol::new(&env, ROLE_ADMIN);
        Self::require_role(&env, &admin_role, &caller);
        Self::require_not_paused(&env);

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
        assert!(found, "Account does not hold role");
        env.storage().persistent().set(&DataKey::RoleMembers(role.clone()), &updated);

        env.events().publish((symbol_short!("RlRvkd"), role, account), ());
    }

    /// Returns `true` if `account` holds `role`.
    pub fn has_role(env: Env, role: Symbol, account: Address) -> bool {
        Self::get_role_members(&env, &role).iter().any(|m| m == account)
    }

    /// Return all members of a role.
    pub fn get_role_members_list(env: Env, role: Symbol) -> Vec<Address> {
        Self::get_role_members(&env, &role)
    }

    // -------------------------------------------------------------------------
    // Delegation management
    // -------------------------------------------------------------------------

    /// Add a delegate for a worker profile. Owner only.
    ///
    /// Idempotent — adding an existing delegate updates its expiry.
    ///
    /// # Parameters
    /// - `id`: The worker's unique identifier.
    /// - `owner`: Must be the worker's owner; `require_auth()` is enforced.
    /// - `delegate`: Address to grant delegation to.
    /// - `expires_at`: Unix timestamp when the delegation expires. Pass `0` for no expiry.
    ///
    /// # Panics
    /// - `"Worker not found"` if no worker exists with the given `id`.
    /// - `"Not authorized"` if `owner` is not the worker's owner.
    /// - `"Contract is paused"` if paused.
    ///
    /// # Events
    /// Emits `("DlgAdd", id, delegate)` with data `expires_at`.
    pub fn add_delegate(env: Env, id: Symbol, owner: Address, delegate: Address, expires_at: u64) {
        owner.require_auth();
        Self::require_not_paused(&env);

        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");
        assert!(worker.owner == owner, "Not authorized");

        let mut delegates = Self::get_delegates(&env, &id);

        // Update expiry if delegate already exists, otherwise push.
        let mut found = false;
        for i in 0..delegates.len() {
            let mut d = delegates.get(i).unwrap();
            if d.address == delegate {
                d.expires_at = expires_at;
                delegates.set(i, d);
                found = true;
                break;
            }
        }
        if !found {
            delegates.push_back(Delegate { address: delegate.clone(), expires_at });
        }

        env.storage().persistent().set(&DataKey::Delegates(id.clone()), &delegates);

        env.events().publish(
            (symbol_short!("DlgAdd"), id, delegate),
            expires_at,
        );
    }

    /// Remove a delegate from a worker profile. Owner only.
    ///
    /// # Parameters
    /// - `id`: The worker's unique identifier.
    /// - `owner`: Must be the worker's owner; `require_auth()` is enforced.
    /// - `delegate`: Address to revoke delegation from.
    ///
    /// # Panics
    /// - `"Worker not found"` if no worker exists with the given `id`.
    /// - `"Not authorized"` if `owner` is not the worker's owner.
    /// - `"Delegate not found"` if `delegate` is not in the list.
    /// - `"Contract is paused"` if paused.
    ///
    /// # Events
    /// Emits `("DlgRem", id, delegate)`.
    pub fn remove_delegate(env: Env, id: Symbol, owner: Address, delegate: Address) {
        owner.require_auth();
        Self::require_not_paused(&env);

        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");
        assert!(worker.owner == owner, "Not authorized");

        let delegates = Self::get_delegates(&env, &id);
        let mut updated: Vec<Delegate> = Vec::new(&env);
        let mut removed = false;
        for d in delegates.iter() {
            if d.address == delegate {
                removed = true;
            } else {
                updated.push_back(d);
            }
        }
        assert!(removed, "Delegate not found");

        env.storage().persistent().set(&DataKey::Delegates(id.clone()), &updated);

        env.events().publish(
            (symbol_short!("DlgRem"), id, delegate),
            (),
        );
    }

    /// Get all delegates for a worker.
    ///
    /// # Returns
    /// A `Vec<Delegate>` (may be empty).
    pub fn get_worker_delegates(env: Env, id: Symbol) -> Vec<Delegate> {
        Self::get_delegates(&env, &id)
    }

    // -------------------------------------------------------------------------
    // Pause / Unpause (admin only)
    // -------------------------------------------------------------------------

    /// Pause the contract, blocking all state-mutating operations.
    ///
    /// # Parameters
    /// - `admin`: Must hold [`ROLE_PAUSER`]; `require_auth()` is enforced.
    ///
    /// # Panics
    /// Panics with `"Missing role"` if `admin` does not hold `ROLE_PAUSER`.
    ///
    /// # Events
    /// Emits `("Paused", admin)`.
    pub fn pause(env: Env, admin: Address) {
        Self::require_role(&env, &Symbol::new(&env, ROLE_PAUSER), &admin);
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("Paused"), admin), ());
    }

    /// Unpause the contract, re-enabling all state-mutating operations.
    ///
    /// # Parameters
    /// - `admin`: Must hold [`ROLE_PAUSER`]; `require_auth()` is enforced.
    ///
    /// # Panics
    /// Panics with `"Missing role"` if `admin` does not hold `ROLE_PAUSER`.
    ///
    /// # Events
    /// Emits `("Unpaused", admin)`.
    pub fn unpause(env: Env, admin: Address) {
        Self::require_role(&env, &Symbol::new(&env, ROLE_PAUSER), &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish((symbol_short!("Unpaused"), admin), ());
    }

    /// Returns `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    /// Return the current curator list, or an empty vec if none have been added yet.
    fn get_curators(env: &Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Curators)
            .unwrap_or(Vec::new(env))
    }

    // -------------------------------------------------------------------------
    // Curator management
    // -------------------------------------------------------------------------

    /// Add a curator (admin only). Idempotent — adding an existing curator is a no-op.
    ///
    /// # Parameters
    /// - `admin`: Must be the contract admin; `require_auth()` is enforced.
    /// - `curator`: Address to grant curator privileges.
    ///
    /// # Panics
    /// Panics with `"Admin only"` if `admin` is not the stored admin.
    ///
    /// # Events
    /// Emits `("CurAdd", admin, curator)`.
    pub fn add_curator(env: Env, admin: Address, curator: Address) {
        Self::require_role(&env, &Symbol::new(&env, ROLE_CURATOR_MGR), &admin);
        Self::require_not_paused(&env);

        let mut curators = Self::get_curators(&env);
        if curators.iter().all(|c| c != curator) {
            curators.push_back(curator.clone());
            env.storage().persistent().set(&DataKey::Curators, &curators);
        }

        env.events().publish((symbol_short!("CurAdd"), admin, curator), ());
    }

    /// Remove a curator (admin only).
    ///
    /// # Parameters
    /// - `admin`: Must be the contract admin; `require_auth()` is enforced.
    /// - `curator`: Address to revoke curator privileges from.
    ///
    /// # Panics
    /// Panics with `"Admin only"` if `admin` is not the stored admin.
    ///
    /// # Events
    /// Emits `("CurRem", admin, curator)`.
    pub fn remove_curator(env: Env, admin: Address, curator: Address) {
        Self::require_role(&env, &Symbol::new(&env, ROLE_CURATOR_MGR), &admin);
        Self::require_not_paused(&env);

        let curators = Self::get_curators(&env);
        let mut updated: Vec<Address> = Vec::new(&env);
        for c in curators.iter() {
            if c != curator {
                updated.push_back(c);
            }
        }
        env.storage().persistent().set(&DataKey::Curators, &updated);

        env.events().publish((symbol_short!("CurRem"), admin, curator), ());
    }

    /// Returns `true` if `addr` is an approved curator.
    ///
    /// # Parameters
    /// - `addr`: The address to check.
    pub fn is_curator(env: Env, addr: Address) -> bool {
        Self::get_curators(&env).iter().any(|c| c == addr)
    }

    // -------------------------------------------------------------------------
    // Worker registration (curator-gated)
    // -------------------------------------------------------------------------

    /// Register a new worker on-chain. Caller must be an authorised curator.
    ///
    /// Automatically extends the TTL of the new worker entry and the worker list
    /// to [`TTL_EXTEND_TO`] ledgers if below [`TTL_THRESHOLD`].
    ///
    /// # Parameters
    /// - `id`: Unique worker identifier (must not already exist).
    /// - `owner`: Stellar address of the worker's owner.
    /// - `name`: Display name.
    /// - `category`: Trade category symbol.
    /// - `location_hash`: SHA-256(lowercase(city) + ":" + lowercase(country_iso2)).
    /// - `contact_hash`: SHA-256(lowercase(email) or E.164 phone).
    /// - `curator`: Must be an approved curator; `require_auth()` is enforced.
    ///
    /// # Panics
    /// Panics with `"Caller is not a curator"` if `curator` is not in the curator list.
    ///
    /// # Events
    /// Emits `("WrkReg", id)` with data `(owner, category)`.
    pub fn register(
        env: Env,
        id: Symbol,
        owner: Address,
        name: String,
        category: Symbol,
        location_hash: BytesN<32>,
        contact_hash: BytesN<32>,
        curator: Address,
    ) {
        curator.require_auth();
        Self::require_not_paused(&env);
        assert!(
            Self::get_curators(&env).iter().any(|c| c == curator),
            "Caller is not a curator"
        );

        let worker = Worker {
            id: id.clone(),
            owner: owner.clone(),
            name,
            category: category.clone(),
            is_active: true,
            wallet: owner.clone(),
            location_hash,
            contact_hash,
            reputation: 0,
        };

        let key = DataKey::Worker(id.clone());
        env.storage().persistent().set(&key, &worker);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);

        let list_key = DataKey::WorkerList;
        let mut list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(Vec::new(&env));
        list.push_back(id.clone());
        env.storage().persistent().set(&list_key, &list);
        env.storage().persistent().extend_ttl(&list_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        env.events().publish(
            (symbol_short!("WrkReg"), id),
            (owner, category),
        );
    }

    // -------------------------------------------------------------------------
    // Worker owner functions
    // -------------------------------------------------------------------------

    /// Toggle a worker's `is_active` status. Only the worker's owner may call this.
    ///
    /// # Parameters
    /// - `id`: The worker's unique identifier.
    /// - `caller`: Must be the worker's `owner`; `require_auth()` is enforced.
    ///
    /// # Panics
    /// - `"Worker not found"` if no worker exists with the given `id`.
    /// - `"Not authorized"` if `caller` is not the worker's owner.
    ///
    /// # Events
    /// Emits `("WrkTgl", id)` with data `new_is_active: bool`.
    pub fn toggle(env: Env, id: Symbol, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(&env);
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");
        Self::require_owner_or_delegate(&env, &worker, &caller);
        worker.is_active = !worker.is_active;
        let new_status = worker.is_active;
        env.storage().persistent().set(&DataKey::Worker(id.clone()), &worker);

        env.events().publish((symbol_short!("WrkTgl"), id), new_status);
    }

    /// Update a worker's name, category, location hash, and contact hash. Owner only.
    ///
    /// Pass existing hash values unchanged if only updating name/category.
    ///
    /// # Parameters
    /// - `id`: The worker's unique identifier.
    /// - `caller`: Must be the worker's `owner`; `require_auth()` is enforced.
    /// - `name`: New display name.
    /// - `category`: New trade category symbol.
    /// - `location_hash`: New or unchanged location hash.
    /// - `contact_hash`: New or unchanged contact hash.
    ///
    /// # Panics
    /// - `"Worker not found"` if no worker exists with the given `id`.
    /// - `"Not authorized"` if `caller` is not the worker's owner.
    ///
    /// # Events
    /// Emits `("WrkUpd", id)` with data `(name, category)`.
    pub fn update(
        env: Env,
        id: Symbol,
        caller: Address,
        name: String,
        category: Symbol,
        location_hash: BytesN<32>,
        contact_hash: BytesN<32>,
    ) {
        caller.require_auth();
        Self::require_not_paused(&env);
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");
        Self::require_owner_or_delegate(&env, &worker, &caller);

        worker.name = name.clone();
        worker.category = category.clone();
        worker.location_hash = location_hash;
        worker.contact_hash = contact_hash;

        env.storage().persistent().set(&DataKey::Worker(id.clone()), &worker);

        env.events().publish(
            (symbol_short!("WrkUpd"), id),
            (name, category),
        );
    }

    /// Update a worker's name, category, and wallet address. Owner only.
    ///
    /// # Parameters
    /// - `id`: The worker's unique identifier.
    /// - `caller`: Must be the worker's `owner`; `require_auth()` is enforced.
    /// - `name`: New display name.
    /// - `category`: New trade category symbol.
    /// - `wallet`: New Stellar wallet address for receiving payments.
    ///
    /// # Panics
    /// - `"Worker not found"` if no worker exists with the given `id`.
    /// - `"Not authorized"` if `caller` is not the worker's owner.
    ///
    /// # Events
    /// Emits `("WrkUpd", id, caller)` with data `(name, category, wallet)`.
    pub fn update_worker(
        env: Env,
        id: Symbol,
        caller: Address,
        name: String,
        category: Symbol,
        wallet: Address,
    ) {
        caller.require_auth();
        Self::require_not_paused(&env);

        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");

        Self::require_owner_or_delegate(&env, &worker, &caller);

        worker.name = name.clone();
        worker.category = category.clone();
        worker.wallet = wallet.clone();
        env.storage().persistent().set(&DataKey::Worker(id.clone()), &worker);

        env.events().publish(
            (symbol_short!("WrkUpd"), id, caller),
            (name, category, wallet),
        );
    }

    /// Permanently remove a worker from the registry. Owner only.
    ///
    /// Removes the worker entry from persistent storage and from the `WorkerList` index.
    ///
    /// # Parameters
    /// - `id`: The worker's unique identifier.
    /// - `caller`: Must be the worker's `owner`; `require_auth()` is enforced.
    ///
    /// # Panics
    /// - `"Worker not found"` if no worker exists with the given `id`.
    /// - `"Not authorized"` if `caller` is not the worker's owner.
    ///
    /// # Events
    /// Emits `("WrkDrg", id, caller)`.
    pub fn deregister(env: Env, id: Symbol, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(&env);
        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");
        assert!(worker.owner == caller, "Not authorized");
        env.storage().persistent().remove(&DataKey::Worker(id.clone()));

        let mut list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env));
        if let Some(pos) = list.iter().position(|x| x == id) {
            list.remove(pos as u32);
        }
        env.storage().persistent().set(&DataKey::WorkerList, &list);

        env.events().publish(
            (symbol_short!("WrkDrg"), id, caller),
            (),
        );
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// Get a worker by id.
    ///
    /// # Parameters
    /// - `id`: The worker's unique identifier.
    ///
    /// # Returns
    /// `Some(Worker)` if found, `None` otherwise.
    pub fn get_worker(env: Env, id: Symbol) -> Option<Worker> {
        env.storage().persistent().get(&DataKey::Worker(id))
    }

    /// List all registered worker ids.
    ///
    /// For large registries, prefer [`list_workers_paginated`] to avoid hitting
    /// Soroban's read-entry limits.
    pub fn list_workers(env: Env) -> Vec<Symbol> {
        env.storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env))
    }

    /// Return a page of worker ids starting at `offset`, up to `limit` items.
    ///
    /// # Parameters
    /// - `offset`: Zero-based index of the first item to return.
    /// - `limit`: Maximum number of items to return.
    ///
    /// # Returns
    /// A [`Vec<Symbol>`] of worker ids. Returns an empty vec if `offset >= total`.
    pub fn list_workers_paginated(env: Env, offset: u32, limit: u32) -> Vec<Symbol> {
        let list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env));

        let total = list.len();
        let mut page: Vec<Symbol> = Vec::new(&env);

        if offset >= total || limit == 0 {
            return page;
        }

        let end = (offset + limit).min(total);
        for i in offset..end {
            page.push_back(list.get(i).unwrap());
        }
        page
    }

    /// Return the total number of registered workers.
    pub fn worker_count(env: Env) -> u32 {
        let list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env));
        list.len()
    }

    /// Returns `true` if the contract has been initialised.
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    /// Get the admin address.
    ///
    /// # Panics
    /// Panics with `"Not initialized"` if [`initialize`] has not been called.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Not initialized")
    }

    // -------------------------------------------------------------------------
    // Reputation
    // -------------------------------------------------------------------------

    /// Update a worker's on-chain reputation score (admin only).
    ///
    /// # Parameters
    /// - `admin`: Must be the contract admin; `require_auth()` is enforced.
    /// - `id`: The worker's unique identifier.
    /// - `score`: New reputation score in basis points (0–10000).
    ///
    /// # Panics
    /// - `"Admin only"` if `admin` is not the stored admin.
    /// - `"Worker not found"` if no worker exists with the given `id`.
    /// - `"Score out of range"` if `score > 10000`.
    ///
    /// # Events
    /// Emits `("RepUpd", id)` with data `score`.
    pub fn update_reputation(env: Env, admin: Address, id: Symbol, score: u32) {
        Self::require_role(&env, &Symbol::new(&env, ROLE_REP_MGR), &admin);
        Self::require_not_paused(&env);
        assert!(score <= 10_000, "Score out of range");

        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");

        worker.reputation = score;
        env.storage().persistent().set(&DataKey::Worker(id.clone()), &worker);

        env.events().publish((symbol_short!("RepUpd"), id), score);
    }

    // -------------------------------------------------------------------------
    // Upgrade
    // -------------------------------------------------------------------------

    /// Upgrade the contract WASM in-place, preserving the contract ID and all storage.
    ///
    /// # Parameters
    /// - `admin`: Must be the contract admin; `require_auth()` is enforced.
    /// - `new_wasm_hash`: The hash returned by `stellar contract install` for the new WASM.
    ///
    /// # Panics
    /// Panics with `"Admin only"` if `admin` is not the stored admin.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        Self::require_role(&env, &Symbol::new(&env, ROLE_UPGRADER), &admin);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger, LedgerInfo}, Address, BytesN, Env, String, Symbol};

    struct TestEnv {
        env: Env,
        contract_id: Address,
        admin: Address,
        curator: Address,
        owner: Address,
    }

    impl TestEnv {
        fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let curator = Address::generate(&env);
            let owner = Address::generate(&env);

            let contract_id = env.register_contract(None, RegistryContract);
            let client = RegistryContractClient::new(&env, &contract_id);
            client.initialize(&admin);

            // Grant all operational roles to the bootstrap admin for convenience in tests.
            client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_CURATOR_MGR), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_UPGRADER), &admin);

            TestEnv { env, contract_id, admin, curator, owner }
        }

        fn client(&self) -> RegistryContractClient {
            RegistryContractClient::new(&self.env, &self.contract_id)
        }

        fn worker_id(&self) -> Symbol {
            Symbol::new(&self.env, "worker1")
        }

        fn zero_hash(&self) -> BytesN<32> {
            BytesN::from_array(&self.env, &[0u8; 32])
        }

        fn register_worker(&self, curator: &Address) {
            self.client().register(
                &self.worker_id(),
                &self.owner,
                &String::from_str(&self.env, "Alice"),
                &Symbol::new(&self.env, "plumber"),
                &self.zero_hash(),
                &self.zero_hash(),
                curator,
            );
        }
    }

    #[test]
    fn test_initialize_sets_admin() {
        let t = TestEnv::new();
        assert_eq!(t.client().get_admin(), t.admin);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_initialize_twice_panics() {
        let t = TestEnv::new();
        t.client().initialize(&t.admin);
    }

    #[test]
    fn test_add_curator() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        assert!(t.client().is_curator(&t.curator));
    }

    #[test]
    fn test_add_curator_idempotent() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.client().add_curator(&t.admin, &t.curator);
        t.client().remove_curator(&t.admin, &t.curator);
        assert!(!t.client().is_curator(&t.curator));
    }

    #[test]
    #[should_panic(expected = "Missing role")]
    fn test_add_curator_non_admin_panics() {
        let t = TestEnv::new();
        let stranger = Address::generate(&t.env);
        t.client().add_curator(&stranger, &t.curator);
    }

    #[test]
    fn test_remove_curator() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.client().remove_curator(&t.admin, &t.curator);
        assert!(!t.client().is_curator(&t.curator));
    }

    #[test]
    fn test_register_by_curator_succeeds() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.owner, t.owner);
        assert!(worker.is_active);
    }

    #[test]
    fn test_register_stores_hashes() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);

        let loc = BytesN::from_array(&t.env, &[1u8; 32]);
        let con = BytesN::from_array(&t.env, &[2u8; 32]);

        t.client().register(
            &t.worker_id(),
            &t.owner,
            &String::from_str(&t.env, "Alice"),
            &Symbol::new(&t.env, "plumber"),
            &loc,
            &con,
            &t.curator,
        );

        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.location_hash, loc);
        assert_eq!(worker.contact_hash, con);
    }

    #[test]
    fn test_update_stores_new_hashes() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let new_loc = BytesN::from_array(&t.env, &[3u8; 32]);
        let new_con = BytesN::from_array(&t.env, &[4u8; 32]);

        t.client().update(
            &t.worker_id(),
            &t.owner,
            &String::from_str(&t.env, "Alice B"),
            &Symbol::new(&t.env, "electrician"),
            &new_loc,
            &new_con,
        );

        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.location_hash, new_loc);
        assert_eq!(worker.contact_hash, new_con);
    }

    #[test]
    #[should_panic(expected = "Caller is not a curator")]
    fn test_register_by_non_curator_panics() {
        let t = TestEnv::new();
        t.register_worker(&t.curator);
    }

    #[test]
    fn test_toggle_by_owner() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        t.client().toggle(&t.worker_id(), &t.owner);
        assert!(!t.client().get_worker(&t.worker_id()).unwrap().is_active);

        t.client().toggle(&t.worker_id(), &t.owner);
        assert!(t.client().get_worker(&t.worker_id()).unwrap().is_active);
    }

    #[test]
    fn test_deregister_by_owner() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        t.client().deregister(&t.worker_id(), &t.owner);
        assert!(t.client().get_worker(&t.worker_id()).is_none());
        assert_eq!(t.client().list_workers().len(), 0);
    }

    #[test]
    fn test_worker_count() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        assert_eq!(t.client().worker_count(), 0);
        t.register_worker(&t.curator);
        assert_eq!(t.client().worker_count(), 1);
    }

    #[test]
    fn test_reputation_defaults_to_zero() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.reputation, 0);
    }

    #[test]
    fn test_update_reputation() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        t.client().update_reputation(&t.admin, &t.worker_id(), &8500);
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.reputation, 8500);
    }

    #[test]
    #[should_panic(expected = "Score out of range")]
    fn test_update_reputation_out_of_range() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        t.client().update_reputation(&t.admin, &t.worker_id(), &10_001);
    }

    #[test]
    #[should_panic(expected = "Missing role")]
    fn test_update_reputation_non_admin_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let stranger = Address::generate(&t.env);
        t.client().update_reputation(&stranger, &t.worker_id(), &5000);
    }    #[test]
    fn test_list_workers_paginated() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);

        for i in 0..5u8 {
            let id = Symbol::new(&t.env, &soroban_sdk::String::from_str(&t.env, &format!("w{i}")));
            t.client().register(
                &id,
                &t.owner,
                &String::from_str(&t.env, "Worker"),
                &Symbol::new(&t.env, "plumber"),
                &t.zero_hash(),
                &t.zero_hash(),
                &t.curator,
            );
        }

        let page = t.client().list_workers_paginated(&0, &3);
        assert_eq!(page.len(), 3);

        let page2 = t.client().list_workers_paginated(&3, &3);
        assert_eq!(page2.len(), 2);
    }

    // -------------------------------------------------------------------------
    // Delegation tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_add_delegate_allows_toggle() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let delegate = Address::generate(&t.env);
        t.client().add_delegate(&t.worker_id(), &t.owner, &delegate, &0);

        // Delegate can toggle the worker
        t.client().toggle(&t.worker_id(), &delegate);
        assert!(!t.client().get_worker(&t.worker_id()).unwrap().is_active);
    }

    #[test]
    fn test_add_delegate_allows_update() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let delegate = Address::generate(&t.env);
        t.client().add_delegate(&t.worker_id(), &t.owner, &delegate, &0);

        let new_loc = BytesN::from_array(&t.env, &[9u8; 32]);
        let new_con = BytesN::from_array(&t.env, &[8u8; 32]);
        t.client().update(
            &t.worker_id(),
            &delegate,
            &String::from_str(&t.env, "Bob"),
            &Symbol::new(&t.env, "electrician"),
            &new_loc,
            &new_con,
        );

        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.location_hash, new_loc);
    }

    #[test]
    fn test_get_worker_delegates_returns_list() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let d1 = Address::generate(&t.env);
        let d2 = Address::generate(&t.env);
        t.client().add_delegate(&t.worker_id(), &t.owner, &d1, &0);
        t.client().add_delegate(&t.worker_id(), &t.owner, &d2, &9999);

        let delegates = t.client().get_worker_delegates(&t.worker_id());
        assert_eq!(delegates.len(), 2);
    }

    #[test]
    fn test_remove_delegate_revokes_access() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let delegate = Address::generate(&t.env);
        t.client().add_delegate(&t.worker_id(), &t.owner, &delegate, &0);
        t.client().remove_delegate(&t.worker_id(), &t.owner, &delegate);

        let delegates = t.client().get_worker_delegates(&t.worker_id());
        assert_eq!(delegates.len(), 0);
    }

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn test_expired_delegate_cannot_toggle() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let delegate = Address::generate(&t.env);
        // expires_at = 1 (already in the past at ledger timestamp 0)
        t.client().add_delegate(&t.worker_id(), &t.owner, &delegate, &1);

        // Advance ledger time past expiry
        t.env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 100,
            protocol_version: 22,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 100_000,
        });

        t.client().toggle(&t.worker_id(), &delegate);
    }

    #[test]
    fn test_add_delegate_updates_expiry() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let delegate = Address::generate(&t.env);
        t.client().add_delegate(&t.worker_id(), &t.owner, &delegate, &100);
        // Update expiry to 0 (no expiry)
        t.client().add_delegate(&t.worker_id(), &t.owner, &delegate, &0);

        let delegates = t.client().get_worker_delegates(&t.worker_id());
        // Still only one entry
        assert_eq!(delegates.len(), 1);
        assert_eq!(delegates.get(0).unwrap().expires_at, 0);
    }

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn test_non_owner_cannot_add_delegate() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let stranger = Address::generate(&t.env);
        let delegate = Address::generate(&t.env);
        t.client().add_delegate(&t.worker_id(), &stranger, &delegate, &0);
    }

    #[test]
    #[should_panic(expected = "Delegate not found")]
    fn test_remove_nonexistent_delegate_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let delegate = Address::generate(&t.env);
        t.client().remove_delegate(&t.worker_id(), &t.owner, &delegate);
    }

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn test_stranger_cannot_toggle_without_delegation() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let stranger = Address::generate(&t.env);
        t.client().toggle(&t.worker_id(), &stranger);
    }

    // -------------------------------------------------------------------------
    // RBAC tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_initialize_grants_admin_role() {
        let t = TestEnv::new();
        assert!(t.client().has_role(&Symbol::new(&t.env, ROLE_ADMIN), &t.admin));
    }

    #[test]
    fn test_grant_role_allows_new_pauser() {
        let t = TestEnv::new();
        let pauser = Address::generate(&t.env);
        t.client().grant_role(&t.admin, &Symbol::new(&t.env, ROLE_PAUSER), &pauser);
        assert!(t.client().has_role(&Symbol::new(&t.env, ROLE_PAUSER), &pauser));
        // New pauser can pause
        t.client().pause(&pauser);
        assert!(t.client().is_paused());
    }

    #[test]
    fn test_revoke_role_removes_access() {
        let t = TestEnv::new();
        let pauser = Address::generate(&t.env);
        t.client().grant_role(&t.admin, &Symbol::new(&t.env, ROLE_PAUSER), &pauser);
        t.client().revoke_role(&t.admin, &Symbol::new(&t.env, ROLE_PAUSER), &pauser);
        assert!(!t.client().has_role(&Symbol::new(&t.env, ROLE_PAUSER), &pauser));
    }

    #[test]
    fn test_grant_role_idempotent() {
        let t = TestEnv::new();
        let mgr = Address::generate(&t.env);
        t.client().grant_role(&t.admin, &Symbol::new(&t.env, ROLE_CURATOR_MGR), &mgr);
        t.client().grant_role(&t.admin, &Symbol::new(&t.env, ROLE_CURATOR_MGR), &mgr);
        let members = t.client().get_role_members_list(&Symbol::new(&t.env, ROLE_CURATOR_MGR));
        // admin + mgr = 2 (admin was granted in new())
        assert_eq!(members.iter().filter(|m| *m == mgr).count(), 1);
    }

    #[test]
    fn test_multiple_admins_can_grant_roles() {
        let t = TestEnv::new();
        let admin2 = Address::generate(&t.env);
        // Grant ROLE_ADMIN to a second admin
        t.client().grant_role(&t.admin, &Symbol::new(&t.env, ROLE_ADMIN), &admin2);
        assert!(t.client().has_role(&Symbol::new(&t.env, ROLE_ADMIN), &admin2));
        // Second admin can grant roles too
        let rep_mgr = Address::generate(&t.env);
        t.client().grant_role(&admin2, &Symbol::new(&t.env, ROLE_REP_MGR), &rep_mgr);
        assert!(t.client().has_role(&Symbol::new(&t.env, ROLE_REP_MGR), &rep_mgr));
    }

    #[test]
    #[should_panic(expected = "Missing role")]
    fn test_non_admin_cannot_grant_role() {
        let t = TestEnv::new();
        let stranger = Address::generate(&t.env);
        t.client().grant_role(&stranger, &Symbol::new(&t.env, ROLE_PAUSER), &stranger);
    }

    #[test]
    #[should_panic(expected = "Account does not hold role")]
    fn test_revoke_nonexistent_role_panics() {
        let t = TestEnv::new();
        let stranger = Address::generate(&t.env);
        t.client().revoke_role(&t.admin, &Symbol::new(&t.env, ROLE_PAUSER), &stranger);
    }

    #[test]
    #[should_panic(expected = "Missing role")]
    fn test_missing_curator_mgr_role_panics() {
        let t = TestEnv::new();
        let stranger = Address::generate(&t.env);
        t.client().add_curator(&stranger, &t.curator);
    }

    #[test]
    fn test_role_based_reputation_update() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let rep_mgr = Address::generate(&t.env);
        t.client().grant_role(&t.admin, &Symbol::new(&t.env, ROLE_REP_MGR), &rep_mgr);
        t.client().update_reputation(&rep_mgr, &t.worker_id(), &7500);

        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.reputation, 7500);
    }
}
