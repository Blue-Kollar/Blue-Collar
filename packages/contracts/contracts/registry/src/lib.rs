//! BlueCollar Registry Contract
//! Deployed on Stellar (Soroban) — manages worker registrations on-chain.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, Vec,
};

// =============================================================================
// Data types
// =============================================================================

#[contracttype]
#[derive(Clone)]
pub struct Worker {
    pub id: Symbol,
    pub owner: Address,
    pub name: String,
    pub category: Symbol,
    pub is_active: bool,
    pub wallet: Address,
}

#[contracttype]
pub enum DataKey {
    /// Instance storage — set once at initialize
    Admin,
    /// Persistent storage — set of curator addresses
    Curators,
    /// Persistent storage — worker record keyed by id
    Worker(Symbol),
    /// Persistent storage — ordered list of worker ids
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
    // Initialise
    // -------------------------------------------------------------------------

    /// Set the contract admin. Must be called once before any other function.
    pub fn initialize(env: Env, admin: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::Admin),
            "Already initialized"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // -------------------------------------------------------------------------
    // Admin helpers
    // -------------------------------------------------------------------------

    fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Not initialized")
    }

    fn require_admin(env: &Env, caller: &Address) {
        caller.require_auth();
        assert!(*caller == Self::get_admin(env), "Admin only");
    }

    fn get_curators(env: &Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Curators)
            .unwrap_or(Vec::new(env))
    }

    // -------------------------------------------------------------------------
    // Curator management
    // -------------------------------------------------------------------------

    /// Add a curator (admin only).
    /// Emits: CuratorAdded
    pub fn add_curator(env: Env, admin: Address, curator: Address) {
        Self::require_admin(&env, &admin);

        let mut curators = Self::get_curators(&env);
        // Idempotent — skip if already present
        if curators.iter().all(|c| c != curator) {
            curators.push_back(curator.clone());
            env.storage().persistent().set(&DataKey::Curators, &curators);
        }

        // topics: ("CurAdd", admin, curator)  data: ()
        env.events().publish(
            (symbol_short!("CurAdd"), admin, curator),
            (),
        );
    }

    /// Remove a curator (admin only).
    /// Emits: CuratorRemoved
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

        // topics: ("CurRem", admin, curator)  data: ()
        env.events().publish(
            (symbol_short!("CurRem"), admin, curator),
            (),
        );
    }

    /// Check whether an address is a curator.
    pub fn is_curator(env: Env, addr: Address) -> bool {
        Self::get_curators(&env).iter().any(|c| c == addr)
    }

    // -------------------------------------------------------------------------
    // Worker registration (curator-gated)
    // -------------------------------------------------------------------------

    /// Register a new worker on-chain. Caller must be an authorised curator.
    /// Emits: WorkerRegistered
    pub fn register(env: Env, id: Symbol, owner: Address, name: String, category: Symbol, curator: Address) {
        curator.require_auth();

        // Curator gate
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
        };

        env.storage().persistent().set(&DataKey::Worker(id.clone()), &worker);

        let mut list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env));
        list.push_back(id.clone());
        env.storage().persistent().set(&DataKey::WorkerList, &list);

        // topics: ("WrkReg", id, owner)  data: (curator, category)
        env.events().publish(
            (symbol_short!("WrkReg"), id, owner),
            (curator, category),
        );
    }

    // -------------------------------------------------------------------------
    // Worker management
    // -------------------------------------------------------------------------

    /// Toggle a worker's active status (worker owner only).
    /// Emits: WorkerToggled
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

        // topics: ("WrkTgl", id)  data: is_active
        env.events().publish(
            (symbol_short!("WrkTgl"), id),
            new_status,
        );
    }

    /// Update a worker's name and category (worker owner only).
    /// Emits: WorkerUpdated
    pub fn update(env: Env, id: Symbol, caller: Address, name: String, category: Symbol) {
        caller.require_auth();
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");
        assert!(worker.owner == caller, "Not authorized");
        worker.name = name.clone();
        worker.category = category.clone();
        env.storage().persistent().set(&DataKey::Worker(id.clone()), &worker);

        // topics: ("WrkUpd", id)  data: (name, category)
        env.events().publish(
            (symbol_short!("WrkUpd"), id),
            (name, category),
        );
    }

    /// Deregister a worker (worker owner only).
    /// Emits: WorkerDeregistered
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

        // topics: ("WrkDrg", id)  data: caller
        env.events().publish(
            (symbol_short!("WrkDrg"), id),
            caller,
        );
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// Get a worker by id.
    pub fn get_worker(env: Env, id: Symbol) -> Option<Worker> {
        env.storage().persistent().get(&DataKey::Worker(id))
    }

    /// List all registered worker ids.
    pub fn list_workers(env: Env) -> Vec<Symbol> {
        env.storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env))
    }

    /// Get the current admin address.
    pub fn get_admin_addr(env: Env) -> Address {
        Self::get_admin(&env)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        Address, Env, String, Symbol,
    };

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

        fn register_worker(&self, curator: &Address) {
            self.client().register(
                &self.worker_id(),
                &self.owner,
                &String::from_str(&self.env, "Alice"),
                &Symbol::new(&self.env, "plumber"),
                curator,
            );
        }
    }

    // -------------------------------------------------------------------------
    // initialize
    // -------------------------------------------------------------------------

    #[test]
    fn test_initialize_sets_admin() {
        let t = TestEnv::new();
        assert_eq!(t.client().get_admin_addr(), t.admin);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_initialize_twice_panics() {
        let t = TestEnv::new();
        t.client().initialize(&t.admin);
    }

    // -------------------------------------------------------------------------
    // add_curator / remove_curator
    // -------------------------------------------------------------------------

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
        t.client().add_curator(&t.admin, &t.curator); // second call is a no-op
        // Still exactly one entry — verify by removing and checking it's gone
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
    #[should_panic(expected = "Admin only")]
    fn test_remove_curator_non_admin_panics() {
        let t = TestEnv::new();
        let stranger = Address::generate(&t.env);
        t.client().add_curator(&t.admin, &t.curator);
        t.client().remove_curator(&stranger, &t.curator);
    }

    // -------------------------------------------------------------------------
    // register (curator-gated)
    // -------------------------------------------------------------------------

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
    #[should_panic(expected = "Caller is not a curator")]
    fn test_register_by_non_curator_panics() {
        let t = TestEnv::new();
        // curator not added — should fail
        t.register_worker(&t.curator);
    }

    #[test]
    #[should_panic(expected = "Caller is not a curator")]
    fn test_register_after_curator_removed_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.client().remove_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
    }

    #[test]
    fn test_register_appears_in_list() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let list = t.client().list_workers();
        assert_eq!(list.len(), 1);
        assert_eq!(list.get(0).unwrap(), t.worker_id());
    }

    #[test]
    fn test_multiple_curators_can_register() {
        let t = TestEnv::new();
        let curator2 = Address::generate(&t.env);
        t.client().add_curator(&t.admin, &t.curator);
        t.client().add_curator(&t.admin, &curator2);

        // curator registers worker1
        t.client().register(
            &Symbol::new(&t.env, "worker1"),
            &t.owner,
            &String::from_str(&t.env, "Alice"),
            &Symbol::new(&t.env, "plumber"),
            &t.curator,
        );
        // curator2 registers worker2
        let owner2 = Address::generate(&t.env);
        t.client().register(
            &Symbol::new(&t.env, "worker2"),
            &owner2,
            &String::from_str(&t.env, "Bob"),
            &Symbol::new(&t.env, "electrician"),
            &curator2,
        );

        assert_eq!(t.client().list_workers().len(), 2);
    }

    // -------------------------------------------------------------------------
    // toggle / update / deregister still work for worker owner
    // -------------------------------------------------------------------------

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
}

#[cfg(test)]
mod test;
