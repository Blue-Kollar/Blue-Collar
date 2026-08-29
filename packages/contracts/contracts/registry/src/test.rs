//! Contract-upgrade testing framework for the Registry contract.
//!
//! This module is the home of the upgrade test framework requested in the
//! "smart-contract upgrade testing" work. It is organized into four pillars
//! that together give a contract administrator confidence that an upgrade
//! preserves data and behavior:
//!
//! 1. [`state_migration`]      — `migrate` preserves all stored data and
//!                               advances the schema version correctly.
//! 2. [`backward_compat`]      — storage written by the old code is still
//!                               readable, and entry points keep their shapes.
//! 3. [`perf_regression`]      — core operations stay within a CPU/memory
//!                               budget, so an upgrade cannot silently regress
//!                               gas cost.
//! 4. [`security_regression`]  — upgrade/migration entry points keep enforcing
//!                               their authorization and timelock guards.
//!
//! A real WASM-swap upgrade (uploading new bytecode and calling `upgrade`) is
//! exercised separately in the `wasm-upgrade-tests` feature build and by the
//! `fuzz_migrate` libFuzzer target, because the in-process host cannot install
//! a WASM blob from a dummy hash.
#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::Address as _, token::StellarAssetClient, Address, BytesN, Env, String, Symbol, Vec,
};

// ===========================================================================
// 5. Reputation system tests (#677)
// ===========================================================================

mod reputation_system {
    use super::*;

    fn setup() -> UpgradeFixture {
        let f = UpgradeFixture::new();
        f.client().add_curator(&f.admin, &f.curator);
        f
    }

    #[test]
    fn submit_review_updates_reputation_and_avg_rating() {
        let f = setup();
        let id = f.register("worker1");
        let reviewer = Address::generate(&f.env);

        f.client().submit_review(&reviewer, &id, &8_000);

        let w = f.client().get_worker(&id).unwrap();
        assert_eq!(w.avg_rating, 8_000);
        assert_eq!(w.review_count, 1);
        assert!(
            w.reputation > 0,
            "reputation should be non-zero after review"
        );
    }

    #[test]
    fn submit_multiple_reviews_weighted_average() {
        let f = setup();
        let id = f.register("worker1");
        let r1 = Address::generate(&f.env);
        let r2 = Address::generate(&f.env);

        f.client().submit_review(&r1, &id, &6_000);
        f.client().submit_review(&r2, &id, &8_000);

        let w = f.client().get_worker(&id).unwrap();
        // avg = (6000 + 8000) / 2 = 7000
        assert_eq!(w.avg_rating, 7_000);
        assert_eq!(w.review_count, 2);
    }

    #[test]
    fn submit_review_out_of_range_panics() {
        let f = setup();
        let id = f.register("worker1");
        let reviewer = Address::generate(&f.env);
        assert_eq!(
            f.client().try_submit_review(&reviewer, &id, &10_001),
            Err(Ok(ContractError::RatingOutOfRange))
        );
    }

    #[test]
    fn record_job_completion_increments_tip_count_and_score() {
        let f = setup();
        let id = f.register("worker1");

        f.client().record_job_completion(&f.admin, &id);

        let inputs = f.client().get_reputation_inputs(&id).unwrap();
        assert_eq!(inputs.tip_count, 1);

        let w = f.client().get_worker(&id).unwrap();
        assert!(w.reputation > 0);
    }

    #[test]
    fn record_multiple_completions_saturate_volume_score() {
        let f = setup();
        let id = f.register("worker1");

        // Record MAX_TIP_VOLUME completions to saturate the volume component
        for _ in 0..50 {
            f.client().record_job_completion(&f.admin, &id);
        }
        let inputs = f.client().get_reputation_inputs(&id).unwrap();
        assert_eq!(inputs.tip_count, 50);
    }

    #[test]
    fn record_job_completion_requires_rep_mgr() {
        let f = setup();
        let id = f.register("worker1");
        let stranger = Address::generate(&f.env);
        assert_eq!(
            f.client().try_record_job_completion(&stranger, &id),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn slash_reputation_reduces_score() {
        let f = setup();
        let id = f.register("worker1");
        // Set a baseline reputation first
        f.client().update_reputation(&f.admin, &id, &5_000);

        f.client().slash_reputation(&f.admin, &id, &2_000);

        let w = f.client().get_worker(&id).unwrap();
        assert_eq!(w.reputation, 3_000);
    }

    #[test]
    fn slash_reputation_floors_at_zero() {
        let f = setup();
        let id = f.register("worker1");
        f.client().update_reputation(&f.admin, &id, &500);

        f.client().slash_reputation(&f.admin, &id, &2_000);

        let w = f.client().get_worker(&id).unwrap();
        assert_eq!(w.reputation, 0);
    }

    #[test]
    fn slash_reputation_out_of_range_panics() {
        let f = setup();
        let id = f.register("worker1");
        assert_eq!(
            f.client().try_slash_reputation(&f.admin, &id, &10_001),
            Err(Ok(ContractError::ScoreOutOfRange))
        );
    }

    #[test]
    fn slash_requires_rep_mgr() {
        let f = setup();
        let id = f.register("worker1");
        let stranger = Address::generate(&f.env);
        assert_eq!(
            f.client().try_slash_reputation(&stranger, &id, &1_000),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn reputation_history_is_recorded_on_review() {
        let f = setup();
        let id = f.register("worker1");
        let reviewer = Address::generate(&f.env);

        f.client().submit_review(&reviewer, &id, &8_000);
        let history = f.client().get_reputation_history(&id);
        assert!(history.len() >= 1, "history should have at least one entry");

        let entry = history.get(history.len() - 1).unwrap();
        assert_eq!(entry.previous_score, 0);
    }

    #[test]
    fn reputation_history_recorded_on_slash() {
        let f = setup();
        let id = f.register("worker1");
        f.client().update_reputation(&f.admin, &id, &4_000);
        f.client().slash_reputation(&f.admin, &id, &1_000);

        let history = f.client().get_reputation_history(&id);
        let last = history.get(history.len() - 1).unwrap();
        assert_eq!(last.new_score, 3_000);
    }

    #[test]
    fn reputation_history_recorded_on_job_completion() {
        let f = setup();
        let id = f.register("worker1");

        f.client().record_job_completion(&f.admin, &id);
        let history = f.client().get_reputation_history(&id);
        assert!(history.len() >= 1);
    }

    #[test]
    fn auto_slash_triggered_on_low_avg_rating() {
        let f = setup();
        let id = f.register("worker1");
        let r1 = Address::generate(&f.env);
        let r2 = Address::generate(&f.env);
        let r3 = Address::generate(&f.env);

        // Three reviews averaging below 3000 bps (SLASH_THRESHOLD_RATING)
        f.client().submit_review(&r1, &id, &1_000);
        f.client().submit_review(&r2, &id, &2_000);
        f.client().submit_review(&r3, &id, &1_500);

        let w = f.client().get_worker(&id).unwrap();
        // avg = (1000+2000+1500)/3 = 1500 — below threshold → auto-slashed
        assert!(w.avg_rating < 3_000);
        // reputation should have been halved from the auto-slash
        let history = f.client().get_reputation_history(&id);
        let has_slash = history
            .iter()
            .any(|e| e.reason == Symbol::new(&f.env, "slash"));
        assert!(has_slash, "expected a slash event in history");
    }

    #[test]
    fn get_reputation_inputs_returns_none_for_new_worker() {
        let f = setup();
        let id = f.register("worker1");
        assert!(f.client().get_reputation_inputs(&id).is_none());
    }

    #[test]
    fn get_reputation_history_empty_for_new_worker() {
        let f = setup();
        let id = f.register("worker1");
        assert_eq!(f.client().get_reputation_history(&id).len(), 0);
    }
}

/// A registry contract with the bootstrap admin holding every operational role.
struct UpgradeFixture {
    env: Env,
    contract: Address,
    admin: Address,
    curator: Address,
    owner: Address,
}

impl UpgradeFixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let curator = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &contract);
        client.initialize(&admin);

        client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);
        client.grant_role(&admin, &Symbol::new(&env, ROLE_CURATOR_MGR), &admin);
        client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &admin);
        client.grant_role(&admin, &Symbol::new(&env, ROLE_UPGRADER), &admin);

        UpgradeFixture {
            env,
            contract,
            admin,
            curator,
            owner,
        }
    }

    fn client(&self) -> RegistryContractClient {
        RegistryContractClient::new(&self.env, &self.contract)
    }

    fn zero_hash(&self) -> BytesN<32> {
        BytesN::from_array(&self.env, &[0u8; 32])
    }

    /// Register a worker `id` owned by the fixture's `owner`.
    fn register(&self, id: &str) -> Symbol {
        let sym = Symbol::new(&self.env, id);
        self.client().add_curator(&self.admin, &self.curator);
        self.client().register(
            &sym,
            &self.owner,
            &String::from_str(&self.env, "Alice"),
            &Symbol::new(&self.env, "plumber"),
            &self.zero_hash(),
            &self.zero_hash(),
            &self.curator,
        );
        sym
    }
}

// ===========================================================================
// 1. State migration testing
// ===========================================================================

mod state_migration {
    use super::*;

    /// A migration must not alter any field of an existing worker record.
    #[test]
    fn migration_preserves_all_worker_fields() {
        let f = UpgradeFixture::new();
        let id = f.register("worker1");
        f.client().update_reputation(&f.admin, &id, &7_500);

        let before = f.client().get_worker(&id).unwrap();
        let count_before = f.client().worker_count();

        f.client().migrate(&f.admin, &1u32);

        let after = f.client().get_worker(&id).unwrap();
        assert_eq!(after.owner, before.owner);
        assert_eq!(after.name, before.name);
        assert_eq!(after.category, before.category);
        assert_eq!(after.reputation, before.reputation);
        assert_eq!(after.is_active, before.is_active);
        assert_eq!(f.client().worker_count(), count_before);
    }

    /// The schema version starts at 1 and advances by exactly one per migration.
    #[test]
    fn migration_advances_version_by_one() {
        let f = UpgradeFixture::new();
        assert_eq!(f.client().get_schema_version(), 1);
        f.client().migrate(&f.admin, &1u32);
        assert_eq!(f.client().get_schema_version(), 2);
        f.client().migrate(&f.admin, &2u32);
        assert_eq!(f.client().get_schema_version(), 3);
    }

    /// Replaying a migration for an already-applied version is rejected, so a
    /// migration can never run twice against the same schema.
    #[test]
    fn migration_is_not_replayable() {
        let f = UpgradeFixture::new();
        f.client().migrate(&f.admin, &1u32);
        assert_eq!(
            f.client().try_migrate(&f.admin, &1u32),
            Err(Ok(ContractError::WrongSchemaVersion))
        );
    }

    /// Migrating with the wrong `expected_version` is rejected (no out-of-order
    /// migrations).
    #[test]
    fn migration_rejects_out_of_order_version() {
        let f = UpgradeFixture::new();
        assert_eq!(
            f.client().try_migrate(&f.admin, &5u32),
            Err(Ok(ContractError::WrongSchemaVersion))
        );
    }

    /// Data registered before a migration is fully intact across several
    /// sequential migrations (multi-version upgrade simulation).
    #[test]
    fn data_survives_multiple_sequential_migrations() {
        let f = UpgradeFixture::new();
        let id = f.register("worker1");
        let original = f.client().get_worker(&id).unwrap();

        for v in 1..=4u32 {
            f.client().migrate(&f.admin, &v);
            let now = f.client().get_worker(&id).unwrap();
            assert_eq!(now.name, original.name, "name lost at schema v{}", v + 1);
            assert_eq!(now.owner, original.owner, "owner lost at schema v{}", v + 1);
        }
        assert_eq!(f.client().get_schema_version(), 5);
    }
}

// ===========================================================================
// 2. Backward compatibility verification
// ===========================================================================

mod backward_compat {
    use super::*;

    /// Records and role memberships written before an upgrade remain readable
    /// after a migration (storage-key/layout compatibility).
    #[test]
    fn pre_upgrade_state_is_readable_after_migration() {
        let f = UpgradeFixture::new();
        let id = f.register("worker1");
        assert!(f.client().is_curator(&f.curator));

        f.client().migrate(&f.admin, &1u32);

        // Worker record still present and correct.
        let w = f.client().get_worker(&id).unwrap();
        assert_eq!(w.owner, f.owner);
        // Role membership preserved.
        assert!(f.client().is_curator(&f.curator));
    }

    /// A fresh deployment reports schema version 1, the baseline old clients
    /// expect. This pins the starting point for backward-compatible reads.
    #[test]
    fn fresh_deploy_reports_baseline_version() {
        let f = UpgradeFixture::new();
        assert_eq!(f.client().get_schema_version(), 1);
    }

    /// The `upgrade`, `migrate`, and timelock entry points keep the exact
    /// argument shapes external tooling depends on. This is a compile-time
    /// contract: if a signature changed, this test would fail to build.
    #[test]
    fn upgrade_entry_point_signatures_are_stable() {
        let f = UpgradeFixture::new();
        let hash = BytesN::from_array(&f.env, &[1u8; 32]);

        // migrate(admin, expected_version)
        let _migrate: fn(&RegistryContractClient, &Address, &u32) = |c, a, v| {
            c.migrate(a, v);
        };
        // propose_upgrade(admin, wasm_hash) / get_pending_upgrade()
        f.client().propose_upgrade(&f.admin, &hash);
        let pending = f.client().get_pending_upgrade().unwrap();
        assert_eq!(pending.wasm_hash, hash);
        f.client().cancel_upgrade(&f.admin);
        let _ = _migrate;
    }
}

// ===========================================================================
// 3. Performance regression testing
// ===========================================================================
//
// Each test resets the budget to real network limits, runs an operation, and
// asserts the CPU/memory cost stays under a ceiling. The ceilings are set with
// generous headroom over observed costs; a future change that materially
// regresses gas usage will trip them.

mod perf_regression {
    use super::*;

    /// Worker registration must stay within a bounded CPU/memory budget.
    #[test]
    fn register_within_budget() {
        let f = UpgradeFixture::new();
        f.client().add_curator(&f.admin, &f.curator);
        let id = Symbol::new(&f.env, "perf1");

        f.env.budget().reset_default();
        f.client().register(
            &id,
            &f.owner,
            &String::from_str(&f.env, "Alice"),
            &Symbol::new(&f.env, "plumber"),
            &f.zero_hash(),
            &f.zero_hash(),
            &f.curator,
        );
        let cpu = f.env.budget().cpu_instruction_cost();
        let mem = f.env.budget().memory_bytes_cost();
        std::println!("register cost: cpu={cpu} mem={mem}");
        // Observed ~183k CPU / ~32k mem; ceilings give ~3-5x headroom so the
        // test flags a material regression without tripping on minor changes.
        assert!(cpu < 1_000_000, "register CPU regression: {cpu}");
        assert!(mem < 200_000, "register memory regression: {mem}");
    }

    /// A schema migration over existing state must stay within budget.
    #[test]
    fn migrate_within_budget() {
        let f = UpgradeFixture::new();
        f.register("worker1");

        f.env.budget().reset_default();
        f.client().migrate(&f.admin, &1u32);
        let cpu = f.env.budget().cpu_instruction_cost();
        let mem = f.env.budget().memory_bytes_cost();
        std::println!("migrate cost: cpu={cpu} mem={mem}");
        // Observed ~73k CPU / ~11k mem; ceilings give generous headroom.
        assert!(cpu < 500_000, "migrate CPU regression: {cpu}");
        assert!(mem < 100_000, "migrate memory regression: {mem}");
    }
}

// ===========================================================================
// 4. Security / authorization regression testing
// ===========================================================================

mod security_regression {
    use super::*;

    /// `upgrade` must reject a stored admin that does not hold ROLE_UPGRADER.
    #[test]
    fn upgrade_requires_upgrader_role() {
        // Bootstrap a contract whose admin was never granted ROLE_UPGRADER.
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &contract);
        client.initialize(&admin);

        let hash = BytesN::from_array(&env, &[1u8; 32]);
        assert_eq!(
            client.try_upgrade(&hash),
            Err(Ok(ContractError::MissingRole))
        );
    }

    /// `migrate` must reject callers without ROLE_ADMIN.
    #[test]
    fn migrate_requires_admin() {
        let f = UpgradeFixture::new();
        let stranger = Address::generate(&f.env);
        assert_eq!(
            f.client().try_migrate(&stranger, &1u32),
            Err(Ok(ContractError::MissingRole))
        );
    }

    /// `propose_upgrade` must reject callers without ROLE_UPGRADER.
    #[test]
    fn propose_upgrade_requires_upgrader_role() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let stranger = Address::generate(&env);
        let contract = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &contract);
        client.initialize(&admin);

        let hash = BytesN::from_array(&env, &[1u8; 32]);
        assert_eq!(
            client.try_propose_upgrade(&stranger, &hash),
            Err(Ok(ContractError::MissingRole))
        );
    }

    /// A proposed upgrade cannot be executed before its timelock expires.
    #[test]
    fn timelocked_upgrade_cannot_execute_early() {
        let f = UpgradeFixture::new();
        let hash = BytesN::from_array(&f.env, &[9u8; 32]);
        f.client().propose_upgrade(&f.admin, &hash);
        assert_eq!(
            f.client().try_execute_upgrade(),
            Err(Ok(ContractError::TimelockNotExpired))
        );
    }

    /// Only one upgrade may be pending at a time (no proposal overwrite).
    #[test]
    fn cannot_double_propose_upgrade() {
        let f = UpgradeFixture::new();
        let hash = BytesN::from_array(&f.env, &[9u8; 32]);
        f.client().propose_upgrade(&f.admin, &hash);
        assert_eq!(
            f.client().try_propose_upgrade(&f.admin, &hash),
            Err(Ok(ContractError::UpgradeAlreadyPending))
        );
    }
}

// ===========================================================================
// 6. Verification levels & certified skills (#778)
// ===========================================================================

mod verification_levels {
    use super::*;

    fn setup() -> UpgradeFixture {
        let f = UpgradeFixture::new();
        f.client().add_curator(&f.admin, &f.curator);
        f
    }

    #[test]
    fn set_and_get_verification_level() {
        let f = setup();
        let id = f.register("worker1");

        assert_eq!(
            f.client().get_verification_level(&id),
            VerificationLevel::None
        );

        f.client()
            .set_verification_level(&f.admin, &id, &VerificationLevel::Verified);

        assert_eq!(
            f.client().get_verification_level(&id),
            VerificationLevel::Verified
        );
    }

    #[test]
    fn set_verification_level_can_upgrade_and_downgrade() {
        let f = setup();
        let id = f.register("w1");

        f.client()
            .set_verification_level(&f.admin, &id, &VerificationLevel::Expert);
        assert_eq!(
            f.client().get_verification_level(&id),
            VerificationLevel::Expert
        );

        f.client()
            .set_verification_level(&f.admin, &id, &VerificationLevel::Basic);
        assert_eq!(
            f.client().get_verification_level(&id),
            VerificationLevel::Basic
        );
    }

    #[test]
    fn set_verification_level_requires_curator_mgr() {
        let f = setup();
        let id = f.register("w1");
        let stranger = Address::generate(&f.env);
        assert_eq!(
            f.client()
                .try_set_verification_level(&stranger, &id, &VerificationLevel::Basic),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn set_verification_level_unknown_worker_panics() {
        let f = setup();
        let bad_id = Symbol::new(&f.env, "nobody");
        assert_eq!(
            f.client()
                .try_set_verification_level(&f.admin, &bad_id, &VerificationLevel::Basic),
            Err(Ok(ContractError::WorkerNotFound))
        );
    }

    #[test]
    fn add_certified_skill_stores_and_queryable() {
        let f = setup();
        let id = f.register("w1");
        let skill = Symbol::new(&f.env, "arc_welding");

        f.client().add_certified_skill(&f.admin, &id, &skill, &0);

        let skills = f.client().get_certified_skills(&id);
        assert_eq!(skills.len(), 1);
        assert_eq!(skills.get(0).unwrap().skill, skill);
    }

    #[test]
    fn add_certified_skill_replaces_existing() {
        let f = setup();
        let id = f.register("w1");
        let skill = Symbol::new(&f.env, "pipe_fitting");

        f.client().add_certified_skill(&f.admin, &id, &skill, &0);
        f.client().add_certified_skill(&f.admin, &id, &skill, &9999);

        let skills = f.client().get_certified_skills(&id);
        assert_eq!(skills.len(), 1);
        assert_eq!(skills.get(0).unwrap().expires_at, 9999);
    }

    #[test]
    fn add_multiple_distinct_skills() {
        let f = setup();
        let id = f.register("w1");

        f.client()
            .add_certified_skill(&f.admin, &id, &Symbol::new(&f.env, "skill_a"), &0);
        f.client()
            .add_certified_skill(&f.admin, &id, &Symbol::new(&f.env, "skill_b"), &0);

        assert_eq!(f.client().get_certified_skills(&id).len(), 2);
    }

    #[test]
    fn add_certified_skill_requires_curator_mgr() {
        let f = setup();
        let id = f.register("w1");
        let stranger = Address::generate(&f.env);
        assert_eq!(
            f.client()
                .try_add_certified_skill(&stranger, &id, &Symbol::new(&f.env, "skill_a"), &0,),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn revoke_certified_skill_removes_entry() {
        let f = setup();
        let id = f.register("w1");
        let skill = Symbol::new(&f.env, "arc_welding");

        f.client().add_certified_skill(&f.admin, &id, &skill, &0);
        f.client().revoke_certified_skill(&f.admin, &id, &skill);

        assert_eq!(f.client().get_certified_skills(&id).len(), 0);
    }

    #[test]
    fn revoke_nonexistent_skill_panics() {
        let f = setup();
        let id = f.register("w1");
        assert_eq!(
            f.client().try_revoke_certified_skill(
                &f.admin,
                &id,
                &Symbol::new(&f.env, "nonexistent"),
            ),
            Err(Ok(ContractError::SkillNotFound))
        );
    }

    #[test]
    fn get_certified_skills_empty_for_new_worker() {
        let f = setup();
        let id = f.register("w1");
        assert_eq!(f.client().get_certified_skills(&id).len(), 0);
    }
}

// ===========================================================================
// 7. Auth-failure tests for remaining role-gated functions
// ===========================================================================

mod auth_failures {
    use super::*;

    // -- Role-management auth failures --

    #[test]
    fn grant_role_requires_admin() {
        let f = UpgradeFixture::new();
        let role = Symbol::new(&f.env, ROLE_PAUSER);
        assert_eq!(
            f.client()
                .try_grant_role(&f.owner, &role, &Address::generate(&f.env)),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn revoke_role_requires_admin() {
        let f = UpgradeFixture::new();
        let role = Symbol::new(&f.env, ROLE_PAUSER);
        assert_eq!(
            f.client().try_revoke_role(&f.owner, &role, &f.admin),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn pause_requires_pauser() {
        let f = UpgradeFixture::new();
        assert_eq!(
            f.client().try_pause(&f.curator),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn unpause_requires_pauser() {
        let f = UpgradeFixture::new();
        // admin holds PAUSER, curator does not
        f.client().pause(&f.admin);
        assert_eq!(
            f.client().try_unpause(&f.curator),
            Err(Ok(ContractError::MissingRole))
        );
    }

    // -- Curator management auth failures --

    #[test]
    fn add_curator_requires_curator_mgr() {
        let f = UpgradeFixture::new();
        assert_eq!(
            f.client()
                .try_add_curator(&f.curator, &Address::generate(&f.env)),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn remove_curator_requires_curator_mgr() {
        let f = UpgradeFixture::new();
        f.client().add_curator(&f.admin, &f.curator);
        assert_eq!(
            f.client().try_remove_curator(&f.curator, &f.curator),
            Err(Ok(ContractError::MissingRole))
        );
    }

    // -- Worker registration auth failures --

    #[test]
    fn register_requires_curator() {
        let f = UpgradeFixture::new();
        let res = f.client().try_register(
            &Symbol::new(&f.env, "w1"),
            &f.owner,
            &String::from_str(&f.env, "Alice"),
            &Symbol::new(&f.env, "plumber"),
            &f.zero_hash(),
            &f.zero_hash(),
            &f.owner, // owner is not a curator
        );
        assert_eq!(res, Err(Ok(ContractError::CallerIsNotCurator)));
    }

    #[test]
    fn batch_toggle_requires_curator() {
        let f = UpgradeFixture::new();
        let ids = Vec::from_array(&f.env, [Symbol::new(&f.env, "w1")]);
        assert_eq!(
            f.client().try_batch_toggle(&f.owner, &ids),
            Err(Ok(ContractError::CallerIsNotCurator))
        );
    }

    #[test]
    fn batch_register_requires_curator() {
        let f = UpgradeFixture::new();
        let res = f.client().try_batch_register(
            &f.owner,
            &Vec::new(&f.env),
            &Vec::new(&f.env),
            &Vec::new(&f.env),
            &Vec::new(&f.env),
            &Vec::new(&f.env),
            &Vec::new(&f.env),
        );
        assert_eq!(res, Err(Ok(ContractError::CallerIsNotCurator)));
    }

    // -- Worker owner-role auth failures --

    #[test]
    fn toggle_requires_owner() {
        let f = UpgradeFixture::new();
        let id = f.register("toggle_auth");
        assert_eq!(
            f.client().try_toggle(&id, &f.curator),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn deregister_requires_owner() {
        let f = UpgradeFixture::new();
        let id = f.register("dereg_auth");
        assert_eq!(
            f.client().try_deregister(&id, &f.curator),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn stake_requires_owner() {
        let f = UpgradeFixture::new();
        let id = f.register("stake_auth");
        // Use a random token for staking
        let token_id = f.env.register_stellar_asset_contract_v2(f.admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&f.env, &token_addr).mint(&f.owner, &10_000);
        assert_eq!(
            f.client().try_stake(&f.curator, &id, &token_addr, &1_000),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    // -- Reputation management auth failures --

    #[test]
    fn update_reputation_requires_rep_mgr() {
        let f = UpgradeFixture::new();
        let id = f.register("rep_auth");
        assert_eq!(
            f.client().try_update_reputation(&f.curator, &id, &5_000),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn update_reviews_requires_admin() {
        let f = UpgradeFixture::new();
        let id = f.register("rev_auth");
        assert_eq!(
            f.client().try_update_reviews(&f.curator, &id, &10, &8_000),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn update_subscription_requires_admin() {
        let f = UpgradeFixture::new();
        let id = f.register("sub_auth");
        assert_eq!(
            f.client().try_update_subscription(&f.curator, &id, &1, &0),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn update_metrics_requires_rep_mgr() {
        let f = UpgradeFixture::new();
        let id = f.register("metric_auth");
        assert_eq!(
            f.client().try_update_metrics(&f.curator, &id, &5, &8_000),
            Err(Ok(ContractError::MissingRole))
        );
    }

    // -- Category management auth failures --

    #[test]
    fn add_category_requires_admin() {
        let f = UpgradeFixture::new();
        assert_eq!(
            f.client()
                .try_add_category(&f.curator, &Symbol::new(&f.env, "electrician")),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn remove_category_requires_admin() {
        let f = UpgradeFixture::new();
        assert_eq!(
            f.client()
                .try_remove_category(&f.curator, &Symbol::new(&f.env, "plumber")),
            Err(Ok(ContractError::MissingRole))
        );
    }

    // -- Upgrade auth failures --

    #[test]
    fn cancel_upgrade_requires_upgrader() {
        let f = UpgradeFixture::new();
        let hash = BytesN::from_array(&f.env, &[9u8; 32]);
        f.client().propose_upgrade(&f.admin, &hash);
        assert_eq!(
            f.client().try_cancel_upgrade(&f.curator),
            Err(Ok(ContractError::MissingRole))
        );
    }
}
