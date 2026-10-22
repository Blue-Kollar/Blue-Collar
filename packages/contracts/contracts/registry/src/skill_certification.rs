//! Skill certification rules for the registry.
//!
//! Owns how a worker's skill certifications are recorded, revoked and judged
//! valid. The contract entry points in `lib.rs` keep the authorisation, pause
//! and worker-existence checks and delegate everything else to this module,
//! which exposes `certify` and `is_certified` as its narrow interface.

use bluecollar_types::ContractError;
use soroban_sdk::{symbol_short, Address, Env, Symbol, Vec};

use crate::storage::{CertifiedSkill, DataKey};

fn load(env: &Env, worker_id: &Symbol) -> Vec<CertifiedSkill> {
    env.storage()
        .persistent()
        .get(&DataKey::CertifiedSkills(worker_id.clone()))
        .unwrap_or(Vec::new(env))
}

fn save(env: &Env, worker_id: &Symbol, skills: &Vec<CertifiedSkill>) {
    env.storage()
        .persistent()
        .set(&DataKey::CertifiedSkills(worker_id.clone()), skills);
}

/// Record `skill` as certified for `worker_id`, replacing any existing entry
/// for the same skill. `expires_at == 0` means the certification never expires.
pub fn certify(env: &Env, caller: &Address, worker_id: &Symbol, skill: &Symbol, expires_at: u64) {
    let entry = CertifiedSkill {
        skill: skill.clone(),
        certified_by: caller.clone(),
        certified_at: env.ledger().timestamp(),
        expires_at,
    };
    let mut updated: Vec<CertifiedSkill> = Vec::new(env);
    let mut found = false;
    for s in load(env, worker_id).iter() {
        if s.skill == *skill {
            updated.push_back(entry.clone());
            found = true;
        } else {
            updated.push_back(s);
        }
    }
    if !found {
        updated.push_back(entry);
    }
    save(env, worker_id, &updated);
    env.events().publish(
        (symbol_short!("SkillCert"), worker_id.clone(), skill.clone()),
        (caller.clone(), expires_at),
    );
}

/// Remove the certification for `skill`. Fails with `SkillNotFound` if the
/// worker does not hold it.
pub fn revoke(
    env: &Env,
    caller: &Address,
    worker_id: &Symbol,
    skill: &Symbol,
) -> Result<(), ContractError> {
    let mut updated: Vec<CertifiedSkill> = Vec::new(env);
    let mut removed = false;
    for s in load(env, worker_id).iter() {
        if s.skill == *skill {
            removed = true;
        } else {
            updated.push_back(s);
        }
    }
    if !removed {
        return Err(ContractError::SkillNotFound);
    }
    save(env, worker_id, &updated);
    env.events().publish(
        (symbol_short!("SkillRvkd"), worker_id.clone(), skill.clone()),
        caller.clone(),
    );
    Ok(())
}

/// Whether `worker_id` holds a non-expired certification for `skill`.
pub fn is_certified(env: &Env, worker_id: &Symbol, skill: &Symbol) -> bool {
    let now = env.ledger().timestamp();
    load(env, worker_id)
        .iter()
        .any(|s| s.skill == *skill && (s.expires_at == 0 || s.expires_at > now))
}

/// All certification entries for `worker_id`, including expired ones.
pub fn list(env: &Env, worker_id: &Symbol) -> Vec<CertifiedSkill> {
    load(env, worker_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::RegistryContract;
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn setup() -> (Env, Address, Symbol, Symbol) {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let caller = Address::generate(&env);
        let worker = Symbol::new(&env, "worker1");
        let skill = Symbol::new(&env, "plumbing");
        (env, caller, worker, skill)
    }

    #[test]
    fn certify_then_is_certified() {
        let (env, caller, worker, skill) = setup();
        let contract = env.register_contract(None, RegistryContract);
        env.as_contract(&contract, || {
            assert!(!is_certified(&env, &worker, &skill));
            certify(&env, &caller, &worker, &skill, 0);
            assert!(is_certified(&env, &worker, &skill));
        });
    }

    #[test]
    fn expired_certification_is_not_certified() {
        let (env, caller, worker, skill) = setup();
        let contract = env.register_contract(None, RegistryContract);
        env.as_contract(&contract, || {
            certify(&env, &caller, &worker, &skill, 2_000);
            assert!(is_certified(&env, &worker, &skill));
            env.ledger().set_timestamp(2_000);
            assert!(!is_certified(&env, &worker, &skill));
            // Expired entries remain listed for audit purposes
            assert_eq!(list(&env, &worker).len(), 1);
        });
    }

    #[test]
    fn certify_replaces_existing_entry_for_same_skill() {
        let (env, caller, worker, skill) = setup();
        let contract = env.register_contract(None, RegistryContract);
        env.as_contract(&contract, || {
            certify(&env, &caller, &worker, &skill, 1_500);
            certify(&env, &caller, &worker, &skill, 0);
            let entries = list(&env, &worker);
            assert_eq!(entries.len(), 1);
            assert_eq!(entries.get(0).unwrap().expires_at, 0);
        });
    }

    #[test]
    fn revoke_removes_certification() {
        let (env, caller, worker, skill) = setup();
        let contract = env.register_contract(None, RegistryContract);
        env.as_contract(&contract, || {
            certify(&env, &caller, &worker, &skill, 0);
            revoke(&env, &caller, &worker, &skill).unwrap();
            assert!(!is_certified(&env, &worker, &skill));
        });
    }

    #[test]
    fn revoke_missing_skill_returns_error() {
        let (env, caller, worker, skill) = setup();
        let contract = env.register_contract(None, RegistryContract);
        env.as_contract(&contract, || {
            assert_eq!(
                revoke(&env, &caller, &worker, &skill),
                Err(ContractError::SkillNotFound)
            );
        });
    }
}
