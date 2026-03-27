//! BlueCollar Registry Contract
//! Deployed on Stellar (Soroban) — manages worker registrations on-chain.

#![no_std]

use bluecollar_types::Worker;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec};

/// ~1 year in ledgers (5s per ledger)
const TTL_EXTEND_TO: u32 = 535_000;
/// Extend when TTL drops below ~6 months
const TTL_THRESHOLD: u32 = 267_500;

#[contracttype]
pub enum DataKey {
    Worker(Symbol),
    WorkerList,
    Admin,
}

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    /// Initialise the contract and set the admin address
    pub fn initialize(env: Env, admin: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::Admin),
            "Already initialized"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Return the admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).expect("Not initialized")
    }

    /// Register a new worker on-chain
    pub fn register(env: Env, id: Symbol, owner: Address, name: String, category: Symbol) {
        owner.require_auth();

        let worker = Worker {
            id: id.clone(),
            owner: owner.clone(),
            name,
            category,
            is_active: true,
            wallet: owner,
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
        list.push_back(id);
        env.storage().persistent().set(&list_key, &list);
        env.storage().persistent().extend_ttl(&list_key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    /// Get a worker by id
    pub fn get_worker(env: Env, id: Symbol) -> Option<Worker> {
        env.storage().persistent().get(&DataKey::Worker(id))
    }

    /// Toggle a worker's active status (owner only)
    pub fn toggle(env: Env, id: Symbol, caller: Address) {
        caller.require_auth();
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .expect("Worker not found");
        assert!(worker.owner == caller, "Not authorized");
        worker.is_active = !worker.is_active;
        let key = DataKey::Worker(id);
        env.storage().persistent().set(&key, &worker);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    /// List all registered worker ids
    pub fn list_workers(env: Env) -> Vec<Symbol> {
        env.storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env))
    }

    /// Extend the TTL of a worker entry — callable by anyone to keep data alive
    pub fn extend_worker_ttl(env: Env, id: Symbol) {
        let key = DataKey::Worker(id);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    /// Upgrade the contract WASM (admin only)
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: soroban_sdk::BytesN<32>) {
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_get_admin() {
        let env = Env::default();
        let contract_id = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);
        assert_eq!(client.get_admin(), admin);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_initialize_twice_panics() {
        let env = Env::default();
        let contract_id = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.initialize(&admin);
    }
}

#[cfg(test)]
mod test;
