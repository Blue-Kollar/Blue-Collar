#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Symbol,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup() -> (Env, Address, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_id.address();
    StellarAssetClient::new(&env, &token_addr).mint(&from, &10_000);

    (env, admin, fee_recipient, from, to, token_addr)
}

fn deploy(env: &Env) -> Address {
    env.register_contract(None, MarketContract)
}

fn init(env: &Env, contract: &Address, admin: &Address, fee_bps: u32, fee_recipient: &Address) {
    let client = MarketContractClient::new(env, contract);
    client.initialize(admin, &fee_bps, fee_recipient);
    // Grant fee manager role to admin for update_fee tests
    client.grant_role(admin, &Symbol::new(env, ROLE_FEE_MANAGER), admin);
}

fn set_time(env: &Env, ts: u64) {
    let mut info = env.ledger().get();
    info.timestamp = ts;
    env.ledger().set(info);
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_success() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let config = client.get_config();
    assert_eq!(config.fee_bps, 100);
    // Admin is stored separately from `Config`, not as a field on it.
    assert_eq!(client.get_admin(), admin);
    assert_eq!(config.fee_recipient, fee_recipient);
}

#[test]
fn test_initialize_twice_panics() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);
    assert_eq!(
        MarketContractClient::new(&env, &contract).try_initialize(&admin, &100, &fee_recipient),
        Err(Ok(ContractError::AlreadyInitialized))
    );
}

#[test]
fn test_initialize_fee_too_high() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    assert_eq!(
        MarketContractClient::new(&env, &contract).try_initialize(&admin, &501, &fee_recipient),
        Err(Ok(ContractError::FeeBpsExceedsMaximum))
    );
}

// ---------------------------------------------------------------------------
// tip — Issue #523: multi-token tip with TipSent event
// ---------------------------------------------------------------------------

#[test]
fn test_tip_success_with_fee() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient); // 1%

    MarketContractClient::new(&env, &contract).tip(&from, &to, &token_addr, &1000);

    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&to), 990);
    assert_eq!(token.balance(&fee_recipient), 10);
    assert_eq!(token.balance(&from), 9_000);
}

#[test]
fn test_tip_zero_fee() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    MarketContractClient::new(&env, &contract).tip(&from, &to, &token_addr, &500);

    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&to), 500);
    assert_eq!(token.balance(&fee_recipient), 0);
}

#[test]
fn test_tip_max_fee() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 500, &fee_recipient); // 5%

    MarketContractClient::new(&env, &contract).tip(&from, &to, &token_addr, &1000);

    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&to), 950);
    assert_eq!(token.balance(&fee_recipient), 50);
}

/// Issue #523: tip with a second (custom) token — verifies any SEP-41 token works.
#[test]
fn test_tip_custom_token() {
    let (env, admin, fee_recipient, from, to, _xlm) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    // Deploy a second token and mint to `from`
    let token2_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token2_addr = token2_id.address();
    StellarAssetClient::new(&env, &token2_addr).mint(&from, &5_000);

    MarketContractClient::new(&env, &contract).tip(&from, &to, &token2_addr, &2_000);

    let token2 = TokenClient::new(&env, &token2_addr);
    assert_eq!(token2.balance(&to), 2_000);
    assert_eq!(token2.balance(&from), 3_000);
}

#[test]
fn test_tip_zero_amount() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);
    assert_eq!(
        MarketContractClient::new(&env, &contract).try_tip(&from, &to, &token_addr, &0),
        Err(Ok(ContractError::AmountMustBePositive))
    );
}

#[test]
#[should_panic]
fn test_tip_insufficient_balance() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);
    MarketContractClient::new(&env, &contract).tip(&from, &to, &token_addr, &99_999);
}

// ---------------------------------------------------------------------------
// update_fee
// ---------------------------------------------------------------------------

#[test]
fn test_update_fee_success() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    // `update_fee` reads the admin from storage; it takes only the new fee.
    client.update_fee(&200);
    assert_eq!(client.get_config().fee_bps, 200);
}

#[test]
fn test_update_fee_too_high() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);
    assert_eq!(
        MarketContractClient::new(&env, &contract).try_update_fee(&501),
        Err(Ok(ContractError::FeeBpsExceedsMaximum))
    );
}

// ---------------------------------------------------------------------------
// escrow: create — Issue #521
// ---------------------------------------------------------------------------

#[test]
fn test_create_escrow_success() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.amount, 1000);
    assert_eq!(escrow.expiry, 9999);
    assert!(!escrow.released);
    assert!(!escrow.cancelled);

    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&contract), 1000);
    assert_eq!(token.balance(&from), 9_000);
}

#[test]
fn test_create_escrow_duplicate_id() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &500, &9999);
    assert_eq!(
        client.try_create_escrow(&id, &from, &to, &token_addr, &500, &9999),
        Err(Ok(ContractError::EscrowAlreadyExists))
    );
}

#[test]
fn test_create_escrow_zero_amount() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    let id = Symbol::new(&env, "esc1");
    assert_eq!(
        MarketContractClient::new(&env, &contract).try_create_escrow(
            &id,
            &from,
            &to,
            &token_addr,
            &0,
            &9999
        ),
        Err(Ok(ContractError::AmountMustBePositive))
    );
}

// ---------------------------------------------------------------------------
// escrow: release — Issue #521
// ---------------------------------------------------------------------------

#[test]
fn test_release_escrow_by_payer() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    client.release_escrow(&id, &from);

    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&to), 1000);
    assert_eq!(token.balance(&contract), 0);
    assert!(client.get_escrow(&id).unwrap().released);
}

#[test]
fn test_release_escrow_by_worker() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    client.release_escrow(&id, &to);

    assert_eq!(TokenClient::new(&env, &token_addr).balance(&to), 1000);
    assert!(client.get_escrow(&id).unwrap().released);
}

#[test]
fn test_release_escrow_unauthorized() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    let stranger = Address::generate(&env);
    assert_eq!(
        client.try_release_escrow(&id, &stranger),
        Err(Ok(ContractError::NotAuthorized))
    );
}

#[test]
fn test_release_escrow_twice_panics() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    client.release_escrow(&id, &from);
    assert_eq!(
        client.try_release_escrow(&id, &from),
        Err(Ok(ContractError::AlreadyReleased))
    );
}

// ---------------------------------------------------------------------------
// escrow: cancel — Issue #521
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_escrow_after_expiry() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    set_time(&env, 1000);
    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &2000);

    set_time(&env, 3000);
    client.cancel_escrow(&id, &from);

    assert_eq!(TokenClient::new(&env, &token_addr).balance(&from), 10_000);
    assert_eq!(TokenClient::new(&env, &token_addr).balance(&contract), 0);
    assert!(client.get_escrow(&id).unwrap().cancelled);
}

#[test]
fn test_cancel_escrow_by_worker_panics() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    set_time(&env, 5000);
    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &2000);
    assert_eq!(
        client.try_cancel_escrow(&id, &to),
        Err(Ok(ContractError::NotAuthorized))
    );
}

#[test]
fn test_cancel_escrow_before_expiry_panics() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    set_time(&env, 500);
    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &2000);
    assert_eq!(
        client.try_cancel_escrow(&id, &from),
        Err(Ok(ContractError::EscrowNotYetExpired))
    );
}

#[test]
fn test_cancel_escrow_twice_panics() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    set_time(&env, 5000);
    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &2000);
    client.cancel_escrow(&id, &from);
    assert_eq!(
        client.try_cancel_escrow(&id, &from),
        Err(Ok(ContractError::AlreadyCancelled))
    );
}

#[test]
fn test_release_after_cancel_panics() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    set_time(&env, 5000);
    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &2000);
    client.cancel_escrow(&id, &from);
    assert_eq!(
        client.try_release_escrow(&id, &from),
        Err(Ok(ContractError::EscrowCancelled))
    );
}

// ---------------------------------------------------------------------------
// escrow: cancel_expired — Issue #521
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_expired_escrow_success() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    set_time(&env, 1000);
    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &2000);

    set_time(&env, 3000);
    client.cancel_expired_escrow(&id);

    assert_eq!(TokenClient::new(&env, &token_addr).balance(&from), 10_000);
    assert!(client.get_escrow(&id).unwrap().cancelled);
}

#[test]
fn test_cancel_expired_escrow_not_expired() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    set_time(&env, 500);
    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &2000);
    assert_eq!(
        client.try_cancel_expired_escrow(&id),
        Err(Ok(ContractError::EscrowNotYetExpired))
    );
}

#[test]
fn test_cancel_expired_already_released() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    set_time(&env, 1000);
    let id = Symbol::new(&env, "esc1");
    let client = MarketContractClient::new(&env, &contract);
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &2000);
    client.release_escrow(&id, &from);

    set_time(&env, 3000);
    assert_eq!(
        client.try_cancel_expired_escrow(&id),
        Err(Ok(ContractError::EscrowNotActive))
    );
}

#[test]
fn test_get_escrow_nonexistent_returns_none() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);
    assert!(MarketContractClient::new(&env, &contract)
        .get_escrow(&Symbol::new(&env, "nope"))
        .is_none());
}

// ===========================================================================
// Contract-upgrade testing framework (Market)
// ===========================================================================
//
// Mirrors the Registry upgrade framework in `registry/src/test.rs`:
//   1. state_migration     — escrow state survives a migration; version bumps.
//   2. backward_compat      — pre-upgrade escrows stay readable; signatures stable.
//   3. perf_regression      — core ops stay within a CPU/memory budget.
//   4. security_regression  — upgrade/migrate keep their authorization guards.
//
// A real WASM-swap upgrade is exercised in the `wasm-upgrade-tests` feature
// build, since the in-process host cannot install a WASM blob from a dummy hash.

#[cfg(test)]
mod upgrade_framework {
    use super::*;
    use soroban_sdk::BytesN;

    /// A market contract with a funded token, an open escrow, and the admin
    /// holding ROLE_UPGRADER.
    struct UpgradeFixture {
        env: Env,
        contract: Address,
        admin: Address,
        from: Address,
        to: Address,
        token: Address,
        escrow_id: Symbol,
    }

    impl UpgradeFixture {
        fn new() -> Self {
            let (env, admin, fee_recipient, from, to, token) = setup();
            let contract = deploy(&env);
            init(&env, &contract, &admin, 0, &fee_recipient);

            let client = MarketContractClient::new(&env, &contract);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_UPGRADER), &admin);

            let escrow_id = Symbol::new(&env, "esc1");
            client.create_escrow(&escrow_id, &from, &to, &token, &1_000, &9_999);

            UpgradeFixture {
                env,
                contract,
                admin,
                from,
                to,
                token,
                escrow_id,
            }
        }

        fn client(&self) -> MarketContractClient {
            MarketContractClient::new(&self.env, &self.contract)
        }
    }

    // -- 1. state migration --------------------------------------------------

    #[test]
    fn migration_preserves_escrow_state() {
        let f = UpgradeFixture::new();
        let before = f.client().get_escrow(&f.escrow_id).unwrap();
        assert_eq!(f.client().get_schema_version(), 1);

        f.client().migrate(&f.admin, &1u32);

        let after = f.client().get_escrow(&f.escrow_id).unwrap();
        assert_eq!(after.amount, before.amount);
        assert_eq!(after.expiry, before.expiry);
        assert_eq!(after.released, before.released);
        assert_eq!(after.cancelled, before.cancelled);
        assert_eq!(f.client().get_schema_version(), 2);
    }

    #[test]
    fn migration_is_not_replayable() {
        let f = UpgradeFixture::new();
        f.client().migrate(&f.admin, &1u32);
        assert_eq!(
            f.client().try_migrate(&f.admin, &1u32),
            Err(Ok(ContractError::WrongSchemaVersion))
        );
    }

    // -- 2. backward compatibility ------------------------------------------

    #[test]
    fn escrow_released_after_migration_pays_worker() {
        let f = UpgradeFixture::new();
        f.client().migrate(&f.admin, &1u32);

        // The escrow created pre-migration is still operable post-migration.
        f.client().release_escrow(&f.escrow_id, &f.from);
        assert_eq!(TokenClient::new(&f.env, &f.token).balance(&f.to), 1_000);
        assert!(f.client().get_escrow(&f.escrow_id).unwrap().released);
    }

    // -- 3. performance regression ------------------------------------------

    #[test]
    fn create_escrow_within_budget() {
        let (env, admin, fee_recipient, from, to, token) = setup();
        let contract = deploy(&env);
        init(&env, &contract, &admin, 0, &fee_recipient);
        let client = MarketContractClient::new(&env, &contract);

        env.budget().reset_default();
        client.create_escrow(&Symbol::new(&env, "p1"), &from, &to, &token, &1_000, &9_999);
        let cpu = env.budget().cpu_instruction_cost();
        let mem = env.budget().memory_bytes_cost();
        std::println!("create_escrow cost: cpu={cpu} mem={mem}");
        // Observed ~214k CPU / ~34k mem (includes a token transfer); the
        // ceilings give ~4-6x headroom to flag a material regression.
        assert!(cpu < 1_200_000, "create_escrow CPU regression: {cpu}");
        assert!(mem < 250_000, "create_escrow memory regression: {mem}");
    }

    // -- 4. security / authorization regression -----------------------------

    #[test]
    fn upgrade_requires_upgrader_role() {
        // Admin is initialized with ROLE_ADMIN but never granted ROLE_UPGRADER.
        let (env, admin, fee_recipient, _from, _to, _token) = setup();
        let contract = deploy(&env);
        init(&env, &contract, &admin, 0, &fee_recipient);
        let hash = BytesN::from_array(&env, &[1u8; 32]);
        assert_eq!(
            MarketContractClient::new(&env, &contract).try_upgrade(&hash),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn migrate_requires_admin() {
        let f = UpgradeFixture::new();
        let stranger = Address::generate(&f.env);
        assert_eq!(
            f.client().try_migrate(&stranger, &1u32),
            Err(Ok(ContractError::MissingRole))
        );
    }
}

// ===========================================================================
// Pause / emergency-stop tests (#785)
// ===========================================================================

#[cfg(test)]
mod pause_tests {
    use super::*;

    /// Shared fixture: admin holds ROLE_PAUSER, payer has tokens, one escrow open.
    struct PauseFixture {
        env: Env,
        contract: Address,
        admin: Address,
        from: Address,
        to: Address,
        token: Address,
    }

    impl PauseFixture {
        fn new() -> Self {
            let (env, admin, fee_recipient, from, to, token) = setup();
            let contract = deploy(&env);
            init(&env, &contract, &admin, 0, &fee_recipient);
            let client = MarketContractClient::new(&env, &contract);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);
            PauseFixture {
                env,
                contract,
                admin,
                from,
                to,
                token,
            }
        }
        fn client(&self) -> MarketContractClient {
            MarketContractClient::new(&self.env, &self.contract)
        }
    }

    // -- pause / unpause state ------------------------------------------------

    #[test]
    fn pause_sets_paused_flag() {
        let f = PauseFixture::new();
        assert!(!f.client().is_paused());
        f.client().pause(&f.admin);
        assert!(f.client().is_paused());
    }

    #[test]
    fn unpause_clears_paused_flag() {
        let f = PauseFixture::new();
        f.client().pause(&f.admin);
        f.client().unpause(&f.admin);
        assert!(!f.client().is_paused());
    }

    #[test]
    fn pause_requires_pauser_role() {
        let f = PauseFixture::new();
        let stranger = Address::generate(&f.env);
        assert_eq!(
            f.client().try_pause(&stranger),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn unpause_requires_pauser_role() {
        let f = PauseFixture::new();
        f.client().pause(&f.admin);
        let stranger = Address::generate(&f.env);
        assert_eq!(
            f.client().try_unpause(&stranger),
            Err(Ok(ContractError::MissingRole))
        );
    }

    // -- mutations blocked while paused ---------------------------------------

    #[test]
    fn tip_blocked_when_paused() {
        let f = PauseFixture::new();
        f.client().pause(&f.admin);
        assert_eq!(
            f.client().try_tip(&f.from, &f.to, &f.token, &100),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn create_escrow_blocked_when_paused() {
        let f = PauseFixture::new();
        f.client().pause(&f.admin);
        let id = Symbol::new(&f.env, "esc1");
        assert_eq!(
            f.client()
                .try_create_escrow(&id, &f.from, &f.to, &f.token, &100, &9999),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn release_escrow_blocked_when_paused() {
        let f = PauseFixture::new();
        // Create escrow before pausing
        let id = Symbol::new(&f.env, "esc1");
        f.client()
            .create_escrow(&id, &f.from, &f.to, &f.token, &100, &9999);
        f.client().pause(&f.admin);
        assert_eq!(
            f.client().try_release_escrow(&id, &f.from),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn cancel_escrow_blocked_when_paused() {
        let f = PauseFixture::new();
        set_time(&f.env, 1000);
        let id = Symbol::new(&f.env, "esc1");
        f.client()
            .create_escrow(&id, &f.from, &f.to, &f.token, &100, &2000);
        f.client().pause(&f.admin);
        set_time(&f.env, 3000);
        assert_eq!(
            f.client().try_cancel_escrow(&id, &f.from),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    // -- read-only calls unaffected ------------------------------------------

    #[test]
    fn get_escrow_works_while_paused() {
        let f = PauseFixture::new();
        let id = Symbol::new(&f.env, "esc1");
        f.client()
            .create_escrow(&id, &f.from, &f.to, &f.token, &100, &9999);
        f.client().pause(&f.admin);
        // Should NOT panic
        let escrow = f.client().get_escrow(&id);
        assert!(escrow.is_some());
    }

    #[test]
    fn is_paused_works_while_paused() {
        let f = PauseFixture::new();
        f.client().pause(&f.admin);
        assert!(f.client().is_paused());
    }

    // -- operations succeed after unpause ------------------------------------

    #[test]
    fn tip_succeeds_after_unpause() {
        let f = PauseFixture::new();
        f.client().pause(&f.admin);
        f.client().unpause(&f.admin);
        // Should NOT panic
        f.client().tip(&f.from, &f.to, &f.token, &100);
        assert_eq!(TokenClient::new(&f.env, &f.token).balance(&f.to), 100);
    }
}

// ===========================================================================
// #788 – Multi-asset support & trustline pre-checks
// ===========================================================================
//
// The Market contract accepts any SEP-41 token; the `token::Client` call itself
// acts as the trustline check — a transfer from an account that hasn't
// established a trustline will panic with a host-level error before any state
// is written.  These tests verify:
//   1. XLM, a second custom token (simulating USDC), and a third token all work.
//   2. Using the wrong token address fails gracefully (no partial state write).
//   3. A zero-balance payer fails on the token-contract level, not silently.

#[cfg(test)]
mod multi_asset_tests {
    use super::*;
    use soroban_sdk::token::StellarAssetClient;

    struct AssetFixture {
        env: Env,
        contract: Address,
        admin: Address,
        payer: Address,
        worker: Address,
        xlm: Address,
        usdc: Address,
        custom: Address,
    }

    impl AssetFixture {
        fn new() -> Self {
            let (env, admin, fee_recipient, payer, worker, xlm) = setup();
            let contract = deploy(&env);
            init(&env, &contract, &admin, 0, &fee_recipient);

            // Second token — simulates USDC (same SEP-41 interface, different issuer)
            let usdc_id = env.register_stellar_asset_contract_v2(admin.clone());
            let usdc = usdc_id.address();
            StellarAssetClient::new(&env, &usdc).mint(&payer, &5_000);

            // Third custom token
            let custom_id = env.register_stellar_asset_contract_v2(admin.clone());
            let custom = custom_id.address();
            StellarAssetClient::new(&env, &custom).mint(&payer, &2_000);

            AssetFixture {
                env,
                contract,
                admin,
                payer,
                worker,
                xlm,
                usdc,
                custom,
            }
        }

        fn client(&self) -> MarketContractClient {
            MarketContractClient::new(&self.env, &self.contract)
        }

        fn balance(&self, token: &Address, addr: &Address) -> i128 {
            TokenClient::new(&self.env, token).balance(addr)
        }
    }

    // ── Tip with multiple asset types ────────────────────────────────────────

    #[test]
    fn tip_with_xlm_succeeds() {
        let f = AssetFixture::new();
        f.client().tip(&f.payer, &f.worker, &f.xlm, &1_000);
        assert_eq!(f.balance(&f.xlm, &f.worker), 1_000);
    }

    #[test]
    fn tip_with_usdc_succeeds() {
        let f = AssetFixture::new();
        f.client().tip(&f.payer, &f.worker, &f.usdc, &500);
        assert_eq!(f.balance(&f.usdc, &f.worker), 500);
        assert_eq!(f.balance(&f.usdc, &f.payer), 4_500);
    }

    #[test]
    fn tip_with_custom_token_succeeds() {
        let f = AssetFixture::new();
        f.client().tip(&f.payer, &f.worker, &f.custom, &200);
        assert_eq!(f.balance(&f.custom, &f.worker), 200);
    }

    #[test]
    fn tip_tokens_are_isolated() {
        // Tipping with USDC must not affect XLM balance and vice versa.
        let f = AssetFixture::new();
        f.client().tip(&f.payer, &f.worker, &f.usdc, &300);
        assert_eq!(
            f.balance(&f.xlm, &f.worker),
            0,
            "XLM should be unaffected by USDC tip"
        );
        assert_eq!(f.balance(&f.usdc, &f.worker), 300);
    }

    // ── Escrow with multiple asset types ─────────────────────────────────────

    #[test]
    fn escrow_create_and_release_with_usdc() {
        let f = AssetFixture::new();
        let id = Symbol::new(&f.env, "usdc_esc");
        f.client()
            .create_escrow(&id, &f.payer, &f.worker, &f.usdc, &1_000, &9_999);
        assert_eq!(f.balance(&f.usdc, &f.payer), 4_000);
        assert_eq!(f.balance(&f.usdc, &f.contract), 1_000);

        f.client().release_escrow(&id, &f.payer);
        assert_eq!(f.balance(&f.usdc, &f.worker), 1_000);
        assert_eq!(f.balance(&f.usdc, &f.contract), 0);
    }

    #[test]
    fn escrow_create_and_cancel_with_custom_token() {
        let f = AssetFixture::new();
        set_time(&f.env, 1_000);
        let id = Symbol::new(&f.env, "ctok_esc");
        f.client()
            .create_escrow(&id, &f.payer, &f.worker, &f.custom, &500, &2_000);
        set_time(&f.env, 3_000);
        f.client().cancel_escrow(&id, &f.payer);
        assert_eq!(f.balance(&f.custom, &f.payer), 2_000);
    }

    #[test]
    fn concurrent_escrows_in_different_tokens() {
        // Two open escrows, each in a different asset — releasing one must not
        // affect the other.
        let f = AssetFixture::new();
        let id1 = Symbol::new(&f.env, "e1");
        let id2 = Symbol::new(&f.env, "e2");
        f.client()
            .create_escrow(&id1, &f.payer, &f.worker, &f.usdc, &1_000, &9_999);
        f.client()
            .create_escrow(&id2, &f.payer, &f.worker, &f.custom, &500, &9_999);

        f.client().release_escrow(&id1, &f.payer);
        // id2 (custom) must still be locked
        let esc2 = f.client().get_escrow(&id2).unwrap();
        assert!(!esc2.released);
        assert_eq!(f.balance(&f.usdc, &f.worker), 1_000);
        assert_eq!(f.balance(&f.custom, &f.worker), 0);
    }

    // ── Trustline / insufficient-balance graceful failure ────────────────────
    //
    // On the Stellar network a missing trustline causes the token transfer to
    // fail at the host level. In the test environment this surfaces as a panic
    // from the token contract. We verify that no state is written when the
    // transfer fails (escrow must not exist afterward).

    #[test]
    #[should_panic]
    fn tip_with_zero_balance_token_panics_gracefully() {
        let f = AssetFixture::new();
        // Payer has no balance in `xlm` beyond the initial 10_000, but minting
        // nothing for a brand-new address means that address has 0 balance.
        let broke = Address::generate(&f.env);
        // `broke` holds no USDC — transfer must fail at the token level.
        f.client().tip(&broke, &f.worker, &f.usdc, &1);
    }

    #[test]
    #[should_panic]
    fn create_escrow_insufficient_balance_panics_gracefully() {
        let f = AssetFixture::new();
        let broke = Address::generate(&f.env);
        // No tokens minted for `broke` — create_escrow transfer must fail.
        let id = Symbol::new(&f.env, "broke_esc");
        f.client()
            .create_escrow(&id, &broke, &f.worker, &f.usdc, &1, &9_999);
        // Verify no partial state was written
        assert!(
            f.client().get_escrow(&id).is_none(),
            "escrow must not be stored after failed transfer"
        );
    }

    #[test]
    fn escrow_not_created_on_transfer_failure() {
        // Mirror of the above but uses catch_unwind to assert the escrow key
        // was not written. We verify by confirming get_escrow returns None after
        // the panic is caught.
        let f = AssetFixture::new();
        let id = Symbol::new(&f.env, "fail_esc");
        let broke = Address::generate(&f.env);
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.client()
                .create_escrow(&id, &broke, &f.worker, &f.usdc, &100, &9_999);
        }));
        // The escrow must not exist in storage after a failed create.
        assert!(f.client().get_escrow(&id).is_none());
    }

    // ── Fee deduction works correctly across asset types ──────────────────────

    #[test]
    fn tip_fee_deducted_correctly_for_usdc() {
        let (env, admin, _fee_recipient, payer, worker, _xlm) = setup();
        let treasury = Address::generate(&env);
        let contract = deploy(&env);
        init(&env, &contract, &admin, 200, &treasury); // 2%

        let usdc_id = env.register_stellar_asset_contract_v2(admin.clone());
        let usdc = usdc_id.address();
        StellarAssetClient::new(&env, &usdc).mint(&payer, &10_000);

        MarketContractClient::new(&env, &contract).tip(&payer, &worker, &usdc, &5_000);

        // fee = 5000 * 200 / 10_000 = 100
        assert_eq!(TokenClient::new(&env, &usdc).balance(&worker), 4_900);
        assert_eq!(TokenClient::new(&env, &usdc).balance(&treasury), 100);
    }

    #[test]
    fn escrow_release_fee_deducted_for_custom_token() {
        let (env, admin, _fee_recipient, payer, worker, _xlm) = setup();
        let treasury = Address::generate(&env);
        let contract = deploy(&env);
        init(&env, &contract, &admin, 100, &treasury); // 1%

        let tok_id = env.register_stellar_asset_contract_v2(admin.clone());
        let tok = tok_id.address();
        StellarAssetClient::new(&env, &tok).mint(&payer, &10_000);

        let client = MarketContractClient::new(&env, &contract);
        let id = Symbol::new(&env, "fee_esc");
        client.create_escrow(&id, &payer, &worker, &tok, &2_000, &9_999);
        client.release_escrow(&id, &payer);

        // fee = 2000 * 100 / 10_000 = 20
        assert_eq!(TokenClient::new(&env, &tok).balance(&worker), 1_980);
        assert_eq!(TokenClient::new(&env, &tok).balance(&treasury), 20);
    }
}
