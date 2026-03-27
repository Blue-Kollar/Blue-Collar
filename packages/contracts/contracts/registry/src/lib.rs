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
}

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
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

        env.storage().persistent().set(&DataKey::Worker(id.clone()), &worker);

        let mut list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env));
        list.push_back(id);
        env.storage().persistent().set(&DataKey::WorkerList, &list);
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
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod test;
