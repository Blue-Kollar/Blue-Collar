//! # BlueCollar Dispute Resolution Contract
//!
//! Manages the full dispute lifecycle:
//!   open → evidence → decision → settle
//!
//! ## Lifecycle
//! 1. `file_dispute`     — disputer opens the case and locks tokens in contract.
//! 2. `submit_evidence`  — respondent (or disputer) attaches an off-chain evidence hash.
//! 3. `decide`           — authorised arbitrator records the outcome.
//! 4. `settle`           — anyone calls to execute the token transfer per the decision.
//!
//! ## Access Control
//! - **Admin**: Set once at `initialize`. Can add/remove arbitrators.
//! - **Arbitrators**: Approved addresses that may call `decide`.
//! - **Disputer / Respondent**: The two parties; only they submit evidence.
//!
//! ## Modules
//! - `storage` — persisted data model and typed storage accessors.
//! - `logic`   — validation, state transitions, and token movement.
//!
//! This file only wires the public contract interface to `logic`; it holds
//! no business logic of its own so the interface stays stable independent
//! of how the implementation is organised.

#![no_std]

mod logic;
mod storage;

use bluecollar_types::ContractError;
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Symbol, Vec};

pub use storage::{DataKey, Dispute, DisputeOutcome, DisputeStatus, TTL_EXTEND_TO, TTL_THRESHOLD};

/// Event schema version — bump when adding/removing/renaming events.
pub const VERSION: u32 = 1;

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct DisputeContract;

#[contractimpl]
impl DisputeContract {
    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------

    /// Initialise the contract. May only be called once.
    ///
    /// # Events
    /// Emits `("Init", admin)`.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        logic::initialize(&env, &admin)
    }

    /// Return the admin address.
    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        storage::get_admin(&env)
    }

    /// Return the event schema version.
    pub fn version(_env: Env) -> Result<u32, ContractError> {
        Ok(VERSION)
    }

    // -------------------------------------------------------------------------
    // Pause / Unpause
    // -------------------------------------------------------------------------

    /// Pause the contract (admin only).
    pub fn pause(env: Env, admin: Address) -> Result<(), ContractError> {
        logic::pause(&env, &admin)
    }

    /// Unpause the contract (admin only).
    pub fn unpause(env: Env, admin: Address) -> Result<(), ContractError> {
        logic::unpause(&env, &admin)
    }

    // -------------------------------------------------------------------------
    // Arbitrator management
    // -------------------------------------------------------------------------

    /// Add an arbitrator (admin only). Idempotent.
    ///
    /// # Events
    /// Emits `("ArbAdd", arbitrator)`.
    pub fn add_arbitrator(
        env: Env,
        admin: Address,
        arbitrator: Address,
    ) -> Result<(), ContractError> {
        logic::add_arbitrator(&env, &admin, &arbitrator)
    }

    /// Remove an arbitrator (admin only).
    ///
    /// # Events
    /// Emits `("ArbRem", arbitrator)`.
    pub fn remove_arbitrator(
        env: Env,
        admin: Address,
        arbitrator: Address,
    ) -> Result<(), ContractError> {
        logic::remove_arbitrator(&env, &admin, &arbitrator)
    }

    /// Return all approved arbitrators.
    pub fn list_arbitrators(env: Env) -> Result<Vec<Address>, ContractError> {
        Ok(storage::get_arbitrators(&env))
    }

    // -------------------------------------------------------------------------
    // Dispute lifecycle — Step 1: Open
    // -------------------------------------------------------------------------

    /// File a dispute and lock `amount` tokens in this contract.
    ///
    /// Tokens are transferred from `disputer` to the contract immediately.
    pub fn file_dispute(
        env: Env,
        id: Symbol,
        disputer: Address,
        respondent: Address,
        token: Address,
        amount: i128,
        evidence_hash: String,
    ) -> Result<(), ContractError> {
        logic::file_dispute(&env, id, disputer, respondent, token, amount, evidence_hash)
    }

    // -------------------------------------------------------------------------
    // Dispute lifecycle — Step 2: Evidence
    // -------------------------------------------------------------------------

    /// Submit evidence for an open dispute.
    pub fn submit_evidence(
        env: Env,
        dispute_id: Symbol,
        caller: Address,
        evidence_hash: String,
    ) -> Result<(), ContractError> {
        logic::submit_evidence(&env, dispute_id, caller, evidence_hash)
    }

    // -------------------------------------------------------------------------
    // Dispute lifecycle — Step 3: Decision
    // -------------------------------------------------------------------------

    /// Record an arbitrator's decision. Does NOT transfer tokens yet.
    pub fn decide(
        env: Env,
        dispute_id: Symbol,
        arbitrator: Address,
        outcome: DisputeOutcome,
        split_bps: u32,
    ) -> Result<(), ContractError> {
        logic::decide(&env, dispute_id, arbitrator, outcome, split_bps)
    }

    // -------------------------------------------------------------------------
    // Dispute lifecycle — Step 4: Settle
    // -------------------------------------------------------------------------

    /// Execute token settlement according to the arbitrator's decision.
    pub fn settle(env: Env, dispute_id: Symbol) -> Result<(), ContractError> {
        logic::settle(&env, dispute_id)
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// Get a dispute by id.
    pub fn get_dispute(env: Env, dispute_id: Symbol) -> Result<Option<Dispute>, ContractError> {
        Ok(storage::get_dispute(&env, &dispute_id))
    }

    /// List all dispute ids.
    pub fn list_disputes(env: Env) -> Result<Vec<Symbol>, ContractError> {
        Ok(storage::get_dispute_list(&env))
    }

    // -------------------------------------------------------------------------
    // Upgrade
    // -------------------------------------------------------------------------

    /// Upgrade the contract WASM. Admin only.
    pub fn upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        logic::upgrade(&env, &admin, new_wasm_hash)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod test;

#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env, String, Symbol,
    };

    struct T {
        env: Env,
        contract: Address,
        admin: Address,
        disputer: Address,
        respondent: Address,
        arbitrator: Address,
        token: Address,
    }

    impl T {
        fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let disputer = Address::generate(&env);
            let respondent = Address::generate(&env);
            let arbitrator = Address::generate(&env);

            let token_id = env.register_stellar_asset_contract_v2(admin.clone());
            let token = token_id.address();
            StellarAssetClient::new(&env, &token).mint(&disputer, &1_000_000);

            let contract = env.register_contract(None, DisputeContract);
            let client = DisputeContractClient::new(&env, &contract);
            client.initialize(&admin);
            client.add_arbitrator(&admin, &arbitrator);

            T {
                env,
                contract,
                admin,
                disputer,
                respondent,
                arbitrator,
                token,
            }
        }

        fn client(&self) -> DisputeContractClient {
            DisputeContractClient::new(&self.env, &self.contract)
        }

        fn id(&self) -> Symbol {
            Symbol::new(&self.env, "d1")
        }

        fn hash(&self, s: &str) -> String {
            String::from_str(&self.env, s)
        }

        fn balance(&self, addr: &Address) -> i128 {
            TokenClient::new(&self.env, &self.token).balance(addr)
        }

        fn open(&self) {
            self.client().file_dispute(
                &self.id(),
                &self.disputer,
                &self.respondent,
                &self.token,
                &100_000,
                &self.hash("abc123"),
            );
        }
    }

    #[test]
    fn test_initialize_sets_admin() {
        let t = T::new();
        assert_eq!(t.client().get_admin(), t.admin);
    }

    #[test]
    fn test_double_initialize_panics() {
        let t = T::new();
        assert_eq!(
            t.client().try_initialize(&t.admin),
            Err(Ok(ContractError::AlreadyInitialized))
        );
    }

    #[test]
    fn test_file_dispute_locks_tokens() {
        let t = T::new();
        t.open();
        assert_eq!(t.balance(&t.contract), 100_000);
        assert_eq!(t.balance(&t.disputer), 900_000);
        let d = t.client().get_dispute(&t.id()).unwrap();
        assert_eq!(d.status, DisputeStatus::Open);
    }

    #[test]
    fn test_duplicate_dispute_panics() {
        let t = T::new();
        t.open();
        assert_eq!(
            t.client().try_file_dispute(
                &t.id(),
                &t.disputer,
                &t.respondent,
                &t.token,
                &100_000,
                &t.hash("abc123"),
            ),
            Err(Ok(ContractError::DisputeIdAlreadyExists))
        );
    }

    #[test]
    fn test_submit_evidence_advances_status() {
        let t = T::new();
        t.open();
        t.client()
            .submit_evidence(&t.id(), &t.respondent, &t.hash("def456"));
        let d = t.client().get_dispute(&t.id()).unwrap();
        assert_eq!(d.status, DisputeStatus::Evidence);
        assert!(d.respondent_evidence.is_some());
    }

    #[test]
    fn test_submit_evidence_stranger_panics() {
        let t = T::new();
        t.open();
        let stranger = Address::generate(&t.env);
        assert_eq!(
            t.client()
                .try_submit_evidence(&t.id(), &stranger, &t.hash("xyz")),
            Err(Ok(ContractError::NotAParty))
        );
    }

    #[test]
    fn test_decide_records_outcome() {
        let t = T::new();
        t.open();
        t.client().decide(
            &t.id(),
            &t.arbitrator,
            &DisputeOutcome::ReleaseRespondent,
            &0,
        );
        let d = t.client().get_dispute(&t.id()).unwrap();
        assert_eq!(d.status, DisputeStatus::Decided);
        assert_eq!(d.outcome, DisputeOutcome::ReleaseRespondent);
        assert_eq!(d.arbitrator, Some(t.arbitrator.clone()));
    }

    #[test]
    fn test_decide_non_arbitrator_panics() {
        let t = T::new();
        t.open();
        let stranger = Address::generate(&t.env);
        assert_eq!(
            t.client()
                .try_decide(&t.id(), &stranger, &DisputeOutcome::RefundDisputer, &0),
            Err(Ok(ContractError::NotAnArbitrator))
        );
    }

    #[test]
    fn test_settle_before_decide_panics() {
        let t = T::new();
        t.open();
        assert_eq!(
            t.client().try_settle(&t.id()),
            Err(Ok(ContractError::NotDecidedYet))
        );
    }

    #[test]
    fn test_settle_refund_disputer() {
        let t = T::new();
        t.open();
        t.client()
            .decide(&t.id(), &t.arbitrator, &DisputeOutcome::RefundDisputer, &0);
        t.client().settle(&t.id());
        assert_eq!(t.balance(&t.disputer), 1_000_000);
        assert_eq!(t.balance(&t.contract), 0);
        assert_eq!(
            t.client().get_dispute(&t.id()).unwrap().status,
            DisputeStatus::Settled
        );
    }

    #[test]
    fn test_settle_release_respondent() {
        let t = T::new();
        t.open();
        t.client().decide(
            &t.id(),
            &t.arbitrator,
            &DisputeOutcome::ReleaseRespondent,
            &0,
        );
        t.client().settle(&t.id());
        assert_eq!(t.balance(&t.respondent), 100_000);
        assert_eq!(t.balance(&t.contract), 0);
    }

    #[test]
    fn test_settle_split_50_50() {
        let t = T::new();
        t.open();
        // respondent gets 50% (5000 bps)
        t.client()
            .decide(&t.id(), &t.arbitrator, &DisputeOutcome::Split, &5_000);
        t.client().settle(&t.id());
        assert_eq!(t.balance(&t.respondent), 50_000);
        assert_eq!(t.balance(&t.disputer), 950_000); // 900k initial + 50k back
        assert_eq!(t.balance(&t.contract), 0);
    }

    #[test]
    fn test_settle_twice_panics() {
        let t = T::new();
        t.open();
        t.client()
            .decide(&t.id(), &t.arbitrator, &DisputeOutcome::RefundDisputer, &0);
        t.client().settle(&t.id());
        assert_eq!(
            t.client().try_settle(&t.id()),
            Err(Ok(ContractError::NotDecidedYet))
        );
    }

    #[test]
    fn test_version_returns_constant() {
        let t = T::new();
        assert_eq!(t.client().version(), VERSION);
    }

    #[test]
    fn test_list_disputes() {
        let t = T::new();
        t.open();
        let ids = t.client().list_disputes();
        assert_eq!(ids.len(), 1);
        assert_eq!(ids.get(0).unwrap(), t.id());
    }

    #[test]
    fn test_pause_blocks_file_dispute() {
        let t = T::new();
        t.client().pause(&t.admin);
        t.client().unpause(&t.admin);
        t.open(); // should succeed after unpause
    }
}

// =============================================================================
// Reentrancy regression tests (#1022)
//
// `file_dispute` and `settle` both take a caller-supplied `token` address and
// call out to it. A hostile token implementation could try to re-enter the
// dispute contract from inside its own `transfer` function while the
// dispute's state hasn't been committed yet. These tests stand in a minimal
// malicious "token" contract to prove that the checks-effects-interactions
// ordering in `logic.rs` blocks that class of attack.
// =============================================================================

#[cfg(test)]
mod reentrancy_tests {
    extern crate std;
    use super::*;
    use soroban_sdk::{
        contract, contractimpl, contracttype, testutils::Address as _, Address, Env, String, Symbol,
    };

    #[contracttype]
    #[derive(Clone, Copy, PartialEq, Eq)]
    enum ReentryMode {
        None = 0,
        Settle = 1,
        FileDispute = 2,
    }

    #[contracttype]
    enum ReentryKey {
        Target,
        DisputeId,
        Mode,
    }

    /// A "token" whose `transfer` tries to call back into the dispute
    /// contract instead of moving any balance. Standing in for a hostile
    /// token contract supplied by a disputer.
    #[contract]
    struct MaliciousToken;

    #[contractimpl]
    impl MaliciousToken {
        pub fn setup(env: Env, target: Address, dispute_id: Symbol, mode: ReentryMode) {
            env.storage().instance().set(&ReentryKey::Target, &target);
            env.storage()
                .instance()
                .set(&ReentryKey::DisputeId, &dispute_id);
            env.storage().instance().set(&ReentryKey::Mode, &mode);
        }

        pub fn transfer(env: Env, from: Address, _to: Address, _amount: i128) {
            let mode: ReentryMode = env
                .storage()
                .instance()
                .get(&ReentryKey::Mode)
                .unwrap_or(ReentryMode::None);
            if mode == ReentryMode::None {
                return;
            }
            let target: Address = env.storage().instance().get(&ReentryKey::Target).unwrap();
            let dispute_id: Symbol = env
                .storage()
                .instance()
                .get(&ReentryKey::DisputeId)
                .unwrap();
            let client = DisputeContractClient::new(&env, &target);
            match mode {
                ReentryMode::Settle => {
                    assert!(client.try_settle(&dispute_id).is_err());
                }
                ReentryMode::FileDispute => {
                    let token_addr = env.current_contract_address();
                    assert!(client
                        .try_file_dispute(
                            &dispute_id,
                            &from,
                            &from,
                            &token_addr,
                            &1,
                            &String::from_str(&env, "reentry"),
                        )
                        .is_err());
                }
                ReentryMode::None => {}
            }
        }
    }

    #[test]
    fn settle_reentrancy_is_blocked() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        let arbitrator = Address::generate(&env);

        let contract = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract);
        client.initialize(&admin);
        client.add_arbitrator(&admin, &arbitrator);

        let malicious_token = env.register_contract(None, MaliciousToken);
        let token_client = MaliciousTokenClient::new(&env, &malicious_token);

        let id = Symbol::new(&env, "re1");
        token_client.setup(&contract, &id, &ReentryMode::None);

        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &malicious_token,
            &100_000,
            &String::from_str(&env, "abc"),
        );
        client.decide(&id, &arbitrator, &DisputeOutcome::RefundDisputer, &0);

        // Arm the reentrant call now that the dispute is `Decided`.
        token_client.setup(&contract, &id, &ReentryMode::Settle);

        // `settle` commits `Settled` before calling the malicious token's
        // `transfer`, so the token's attempted reentrant `settle` call must
        // see status != Decided and fail with NotDecidedYet.
        client.settle(&id);
    }

    #[test]
    fn file_dispute_reentrancy_is_blocked() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);

        let contract = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract);
        client.initialize(&admin);

        let malicious_token = env.register_contract(None, MaliciousToken);
        let token_client = MaliciousTokenClient::new(&env, &malicious_token);

        let id = Symbol::new(&env, "re2");
        token_client.setup(&contract, &id, &ReentryMode::FileDispute);

        // The malicious token's `transfer` re-enters `file_dispute` with the
        // same id. Since the dispute record is persisted *before* the token
        // call, the duplicate-id check catches the reentrant attempt.
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &malicious_token,
            &100_000,
            &String::from_str(&env, "abc"),
        );
    }
}
