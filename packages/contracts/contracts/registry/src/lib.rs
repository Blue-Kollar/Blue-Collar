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
use bluecollar_types::Worker;

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
}

/// Storage keys used throughout the contract.
#[contracttype]
pub enum DataKey {
    /// Instance storage — admin address, set once at [`RegistryContract::initialize`].
    Admin,
    /// Persistent storage — ordered list of approved curator [`Address`]es.
    Curators,
    /// Persistent storage — [`Worker`] record keyed by its `id` [`Symbol`].
    Worker(Symbol),
    /// Persistent storage — ordered list of all registered worker id [`Symbol`]s.
    WorkerList,
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
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// Assert that `caller` is the admin and has authorised this call.
    ///
    /// # Panics
    /// Panics with `"Admin only"` if `caller` is not the stored admin.
    fn require_admin(env: &Env, caller: &Address) {
        caller.require_auth();
        assert!(*caller == Self::get_admin(env.clone()), "Admin only");
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
        Self::require_admin(&env, &admin);

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
        Self::require_admin(&env, &admin);

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
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");
        assert!(worker.owner == caller, "Not authorized");
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
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");
        assert!(worker.owner == caller, "Not authorized");

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

        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");

        assert!(worker.owner == caller, "Not authorized");

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
        admin.require_auth();
        assert!(admin == Self::get_admin(env.clone()), "Admin only");
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String, Symbol};

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
    #[should_panic(expected = "Admin only")]
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
}
