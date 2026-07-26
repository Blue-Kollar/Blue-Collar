//! BlueCollar Registry Contract
//! Deployed on Stellar (Soroban) — manages worker registrations on-chain.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec};

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
    Worker(Symbol),
    WorkerList,
    Admin,
}

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    /// Initialise the contract with an admin. Must be called once before `upgrade`.
    pub fn initialize(env: Env, admin: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::Admin),
            "Already initialized"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Register a new worker on-chain, or update your own existing registration.
    ///
    /// A worker id already owned by a different address cannot be
    /// re-registered out from under its owner — only the existing owner may
    /// overwrite their own entry.
    pub fn register(env: Env, id: Symbol, owner: Address, name: String, category: Symbol) {
        owner.require_auth();

        let existing: Option<Worker> = env.storage().persistent().get(&DataKey::Worker(id.clone()));
        match &existing {
            Some(worker) => assert!(worker.owner == owner, "Not authorized"),
            None => {
                let mut list: Vec<Symbol> = env
                    .storage()
                    .persistent()
                    .get(&DataKey::WorkerList)
                    .unwrap_or(Vec::new(&env));
                list.push_back(id.clone());
                env.storage().persistent().set(&DataKey::WorkerList, &list);
            }
        }

        let worker = Worker {
            id: id.clone(),
            owner: owner.clone(),
            name,
            category,
            is_active: true,
            wallet: owner,
        };
        env.storage().persistent().set(&DataKey::Worker(id), &worker);
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
        env.storage().persistent().set(&DataKey::Worker(id), &worker);
    }

    /// List all registered worker ids
    pub fn list_workers(env: Env) -> Vec<Symbol> {
        env.storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env))
    }

    /// Upgrade the contract WASM (admin only)
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: soroban_sdk::BytesN<32>) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        assert!(stored_admin == admin, "Unauthorized");
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod test;
