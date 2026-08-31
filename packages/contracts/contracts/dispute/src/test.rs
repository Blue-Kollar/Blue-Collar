#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::storage::Persistent,
    testutils::Address as _,
    testutils::Ledger as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, String, Symbol,
};

struct AuthFixture {
    env: Env,
    contract: Address,
    admin: Address,
    disputer: Address,
    respondent: Address,
    arbitrator: Address,
    stranger: Address,
    token: Address,
}

impl AuthFixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        let arbitrator = Address::generate(&env);
        let stranger = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        StellarAssetClient::new(&env, &token).mint(&disputer, &1_000_000);

        let contract = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract);
        client.initialize(&admin);
        client.add_arbitrator(&admin, &arbitrator);

        AuthFixture {
            env,
            contract,
            admin,
            disputer,
            respondent,
            arbitrator,
            stranger,
            token,
        }
    }

    fn client(&self) -> DisputeContractClient {
        DisputeContractClient::new(&self.env, &self.contract)
    }

    fn open(&self) {
        self.client().file_dispute(
            &Symbol::new(&self.env, "d1"),
            &self.disputer,
            &self.respondent,
            &self.token,
            &100_000,
            &String::from_str(&self.env, "abc123"),
        );
    }
}

fn setup_no_mock() -> (Env, Address, Address, Address, Address, Address, Address) {
    let env = Env::default();

    let admin = Address::generate(&env);
    let disputer = Address::generate(&env);
    let respondent = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let stranger = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token = token_id.address();
    StellarAssetClient::new(&env, &token).mint(&disputer, &1_000_000);

    let contract = env.register_contract(None, DisputeContract);
    (
        env, contract, admin, disputer, respondent, arbitrator, token,
    )
}

fn init_no_mock(env: &Env, contract: &Address, admin: &Address, arbitrator: &Address) {
    let client = DisputeContractClient::new(env, contract);
    // Need to use soroban_sdk auth framework for proper auth
    // For non-mock tests, we use the Address's built-in authorization
    // by calling from a test that doesn't use mock_all_auths
}

// =============================================================================
// Auth-failure tests (role-gated functions)
// =============================================================================

mod auth_failures {
    use super::*;

    #[test]
    fn pause_requires_admin() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_pause(&f.stranger),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn unpause_requires_admin() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_unpause(&f.stranger),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn add_arbitrator_requires_admin() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client()
                .try_add_arbitrator(&f.stranger, &Address::generate(&f.env)),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn remove_arbitrator_requires_admin() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_remove_arbitrator(&f.stranger, &f.arbitrator),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn upgrade_requires_admin() {
        let f = AuthFixture::new();
        let hash = BytesN::from_array(&f.env, &[1u8; 32]);
        assert_eq!(
            f.client().try_upgrade(&f.stranger, &hash),
            Err(Ok(ContractError::NotAuthorized))
        );
    }
}

// =============================================================================
// Paused-state tests
// =============================================================================

mod paused_state {
    use super::*;

    #[test]
    fn file_dispute_while_paused() {
        let f = AuthFixture::new();
        f.client().pause(&f.admin);
        assert_eq!(
            f.client().try_file_dispute(
                &Symbol::new(&f.env, "d2"),
                &f.disputer,
                &f.respondent,
                &f.token,
                &100_000,
                &String::from_str(&f.env, "hash"),
            ),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn submit_evidence_while_paused() {
        let f = AuthFixture::new();
        f.open();
        f.client().pause(&f.admin);
        assert_eq!(
            f.client().try_submit_evidence(
                &Symbol::new(&f.env, "d1"),
                &f.respondent,
                &String::from_str(&f.env, "evidence"),
            ),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn decide_while_paused() {
        let f = AuthFixture::new();
        f.open();
        f.client().pause(&f.admin);
        assert_eq!(
            f.client().try_decide(
                &Symbol::new(&f.env, "d1"),
                &f.arbitrator,
                &DisputeOutcome::RefundDisputer,
                &0,
            ),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn settle_while_paused() {
        let f = AuthFixture::new();
        f.open();
        f.client().decide(
            &Symbol::new(&f.env, "d1"),
            &f.arbitrator,
            &DisputeOutcome::RefundDisputer,
            &0,
        );
        f.client().pause(&f.admin);
        assert_eq!(
            f.client().try_settle(&Symbol::new(&f.env, "d1")),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }
}

// =============================================================================
// Boundary tests
// =============================================================================

mod boundary {
    use super::*;

    #[test]
    fn file_dispute_zero_amount() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_file_dispute(
                &Symbol::new(&f.env, "d_zero"),
                &f.disputer,
                &f.respondent,
                &f.token,
                &0,
                &String::from_str(&f.env, "hash"),
            ),
            Err(Ok(ContractError::AmountMustBePositive))
        );
    }

    #[test]
    fn file_dispute_negative_amount() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_file_dispute(
                &Symbol::new(&f.env, "d_neg"),
                &f.disputer,
                &f.respondent,
                &f.token,
                &(-1),
                &String::from_str(&f.env, "hash"),
            ),
            Err(Ok(ContractError::AmountMustBePositive))
        );
    }

    #[test]
    fn decide_split_bps_exceeds_max() {
        let f = AuthFixture::new();
        f.open();
        assert_eq!(
            f.client().try_decide(
                &Symbol::new(&f.env, "d1"),
                &f.arbitrator,
                &DisputeOutcome::Split,
                &10_001,
            ),
            Err(Ok(ContractError::SplitBpsOutOfRange))
        );
    }

    #[test]
    fn decide_split_bps_at_max() {
        let f = AuthFixture::new();
        f.open();
        f.client().decide(
            &Symbol::new(&f.env, "d1"),
            &f.arbitrator,
            &DisputeOutcome::Split,
            &10_000,
        );
        let d = f.client().get_dispute(&Symbol::new(&f.env, "d1")).unwrap();
        assert_eq!(d.split_bps, 10_000);
        assert_eq!(d.status, DisputeStatus::Decided);
    }

    #[test]
    fn decide_split_bps_at_min() {
        let f = AuthFixture::new();
        f.open();
        f.client().decide(
            &Symbol::new(&f.env, "d1"),
            &f.arbitrator,
            &DisputeOutcome::Split,
            &0,
        );
        let d = f.client().get_dispute(&Symbol::new(&f.env, "d1")).unwrap();
        assert_eq!(d.split_bps, 0);
    }
}

// =============================================================================
// TTL extension tests
// =============================================================================

mod ttl {
    use super::*;

    #[test]
    fn file_dispute_extends_dispute_ttl() {
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

        let id = Symbol::new(&env, "ttl1");
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &token,
            &100_000,
            &String::from_str(&env, "abc"),
        );

        let dispute_key = DataKey::Dispute(id.clone());
        let ttl = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });
        assert!(
            ttl >= TTL_THRESHOLD,
            "dispute entry TTL should be >= threshold after create, got {ttl}"
        );
    }

    #[test]
    fn submit_evidence_renews_ttl() {
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

        let id = Symbol::new(&env, "ttl2");
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &token,
            &100_000,
            &String::from_str(&env, "abc"),
        );

        let dispute_key = DataKey::Dispute(id.clone());
        let ttl_after_create = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });

        client.submit_evidence(&id, &respondent, &String::from_str(&env, "evidence"));

        let ttl_after_evidence = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });
        assert!(
            ttl_after_evidence >= ttl_after_create,
            "TTL should not decrease after evidence submission: {ttl_after_evidence} < {ttl_after_create}"
        );
    }

    #[test]
    fn decide_renews_ttl() {
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

        let id = Symbol::new(&env, "ttl3");
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &token,
            &100_000,
            &String::from_str(&env, "abc"),
        );

        let dispute_key = DataKey::Dispute(id.clone());
        let ttl_before = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });

        client.decide(&id, &arbitrator, &DisputeOutcome::RefundDisputer, &0);

        let ttl_after = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });
        assert!(
            ttl_after >= ttl_before,
            "TTL should not decrease after decide: {ttl_after} < {ttl_before}"
        );
    }

    #[test]
    fn file_dispute_extends_list_ttl() {
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

        let id = Symbol::new(&env, "ttl_list");
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &token,
            &100_000,
            &String::from_str(&env, "abc"),
        );

        let list_key = DataKey::DisputeList;
        let ttl = env.as_contract(&contract, || env.storage().persistent().get_ttl(&list_key));
        assert!(
            ttl >= TTL_THRESHOLD,
            "dispute list TTL should be >= threshold after create, got {ttl}"
        );
    }
}

// =============================================================================
// Settlement tests (settle with different outcomes)
// =============================================================================

mod settlement {
    use super::*;

    #[test]
    fn settle_refund_disputer_transfers_full_amount() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "settle_refund");

        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );
        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::RefundDisputer, &0);

        let disputer_before = TokenClient::new(&f.env, &f.token).balance(&f.disputer);
        f.client().settle(&id);
        let disputer_after = TokenClient::new(&f.env, &f.token).balance(&f.disputer);

        assert_eq!(disputer_after - disputer_before, 100_000);
    }

    #[test]
    fn settle_release_respondent_transfers_full_amount() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "settle_release");

        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );
        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::ReleaseRespondent, &0);

        let respondent_before = TokenClient::new(&f.env, &f.token).balance(&f.respondent);
        f.client().settle(&id);
        let respondent_after = TokenClient::new(&f.env, &f.token).balance(&f.respondent);

        assert_eq!(respondent_after - respondent_before, 100_000);
    }

    #[test]
    fn settle_split_50_50() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "settle_split_50");

        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );
        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::Split, &5_000); // 50%

        let disputer_before = TokenClient::new(&f.env, &f.token).balance(&f.disputer);
        let respondent_before = TokenClient::new(&f.env, &f.token).balance(&f.respondent);

        f.client().settle(&id);

        let disputer_after = TokenClient::new(&f.env, &f.token).balance(&f.disputer);
        let respondent_after = TokenClient::new(&f.env, &f.token).balance(&f.respondent);

        assert_eq!(respondent_after - respondent_before, 50_000);
        assert_eq!(disputer_after - disputer_before, 50_000);
    }

    #[test]
    fn settle_split_75_25() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "settle_split_75");

        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );
        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::Split, &7_500); // 75%

        let disputer_before = TokenClient::new(&f.env, &f.token).balance(&f.disputer);
        let respondent_before = TokenClient::new(&f.env, &f.token).balance(&f.respondent);

        f.client().settle(&id);

        let disputer_after = TokenClient::new(&f.env, &f.token).balance(&f.disputer);
        let respondent_after = TokenClient::new(&f.env, &f.token).balance(&f.respondent);

        assert_eq!(respondent_after - respondent_before, 75_000);
        assert_eq!(disputer_after - disputer_before, 25_000);
    }

    #[test]
    fn settle_split_0_percent() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "settle_split_0");

        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );
        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::Split, &0); // 0% to respondent

        let disputer_before = TokenClient::new(&f.env, &f.token).balance(&f.disputer);
        let respondent_before = TokenClient::new(&f.env, &f.token).balance(&f.respondent);

        f.client().settle(&id);

        let disputer_after = TokenClient::new(&f.env, &f.token).balance(&f.disputer);
        let respondent_after = TokenClient::new(&f.env, &f.token).balance(&f.respondent);

        assert_eq!(respondent_after - respondent_before, 0);
        assert_eq!(disputer_after - disputer_before, 100_000);
    }

    #[test]
    fn settle_split_100_percent() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "settle_split_100");

        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );
        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::Split, &10_000); // 100% to respondent

        let disputer_before = TokenClient::new(&f.env, &f.token).balance(&f.disputer);
        let respondent_before = TokenClient::new(&f.env, &f.token).balance(&f.respondent);

        f.client().settle(&id);

        let disputer_after = TokenClient::new(&f.env, &f.token).balance(&f.disputer);
        let respondent_after = TokenClient::new(&f.env, &f.token).balance(&f.respondent);

        assert_eq!(respondent_after - respondent_before, 100_000);
        assert_eq!(disputer_after - disputer_before, 0);
    }

    #[test]
    fn settle_before_decide_panics() {
        let f = AuthFixture::new();
        f.open();
        assert_eq!(
            f.client().try_settle(&Symbol::new(&f.env, "d1")),
            Err(Ok(ContractError::NotDecidedYet))
        );
    }

    #[test]
    fn settle_twice_panics() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "settle_twice");
        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );
        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::RefundDisputer, &0);
        f.client().settle(&id);
        assert_eq!(
            f.client().try_settle(&id),
            Err(Ok(ContractError::NotDecidedYet))
        );
    }
}

// =============================================================================
// Arbitrator management tests
// =============================================================================

mod arbitrator_management {
    use super::*;

    #[test]
    fn add_arbitrator_requires_admin() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client()
                .try_add_arbitrator(&f.stranger, &Address::generate(&f.env)),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn add_arbitrator_idempotent() {
        let f = AuthFixture::new();
        let new_arb = Address::generate(&f.env);
        let init_count = f.client().list_arbitrators().len();

        f.client().add_arbitrator(&f.admin, &new_arb);
        let count_after_add = f.client().list_arbitrators().len();
        assert_eq!(count_after_add, init_count + 1);

        // Add again — should be idempotent
        f.client().add_arbitrator(&f.admin, &new_arb);
        let count_after_re_add = f.client().list_arbitrators().len();
        assert_eq!(count_after_re_add, count_after_add);
    }

    #[test]
    fn remove_arbitrator_success() {
        let f = AuthFixture::new();
        let arb = Address::generate(&f.env);
        f.client().add_arbitrator(&f.admin, &arb);
        let count_before_remove = f.client().list_arbitrators().len();

        f.client().remove_arbitrator(&f.admin, &arb);
        let count_after_remove = f.client().list_arbitrators().len();
        assert_eq!(count_after_remove, count_before_remove - 1);
    }

    #[test]
    fn remove_arbitrator_requires_admin() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_remove_arbitrator(&f.stranger, &f.arbitrator),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn decide_with_non_arbitrator_panics() {
        let f = AuthFixture::new();
        f.open();
        let non_arb = Address::generate(&f.env);
        assert_eq!(
            f.client().try_decide(
                &Symbol::new(&f.env, "d1"),
                &non_arb,
                &DisputeOutcome::RefundDisputer,
                &0,
            ),
            Err(Ok(ContractError::NotAnArbitrator))
        );
    }

    #[test]
    fn list_arbitrators_returns_all() {
        let f = AuthFixture::new();
        let arb1 = Address::generate(&f.env);
        let arb2 = Address::generate(&f.env);

        f.client().add_arbitrator(&f.admin, &arb1);
        f.client().add_arbitrator(&f.admin, &arb2);

        let arbitrators = f.client().list_arbitrators();
        assert!(arbitrators.len() >= 2);
    }
}

// =============================================================================
// File dispute additional tests
// =============================================================================

mod file_dispute_extended {
    use super::*;

    #[test]
    fn file_dispute_with_large_amount() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        let arbitrator = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        StellarAssetClient::new(&env, &token).mint(&disputer, &i128::MAX);

        let contract = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract);
        client.initialize(&admin);
        client.add_arbitrator(&admin, &arbitrator);

        let id = Symbol::new(&env, "d_large");
        let large_amount = i128::MAX / 2;
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &token,
            &large_amount,
            &String::from_str(&env, "abc"),
        );

        let dispute = client.get_dispute(&id).unwrap();
        assert_eq!(dispute.amount, large_amount);
        assert_eq!(dispute.status, DisputeStatus::Open);
    }

    #[test]
    fn file_dispute_duplicate_id_panics() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "d_dup");
        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );
        assert_eq!(
            f.client().try_file_dispute(
                &id,
                &f.disputer,
                &f.respondent,
                &f.token,
                &100_000,
                &String::from_str(&f.env, "abc"),
            ),
            Err(Ok(ContractError::DisputeIdAlreadyExists))
        );
    }

    #[test]
    fn file_dispute_records_evidence_hash() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "d_evidence");
        let evidence_hash = String::from_str(&f.env, "QmAbc123xyz");

        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &evidence_hash.clone(),
        );

        let dispute = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute.disputer_evidence, Some(evidence_hash));
    }

    #[test]
    fn file_dispute_sets_timestamps() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "d_ts");
        let before = f.env.ledger().timestamp();

        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );

        let after = f.env.ledger().timestamp();
        let dispute = f.client().get_dispute(&id).unwrap();
        assert!(dispute.filed_at >= before && dispute.filed_at <= after);
        assert_eq!(dispute.settled_at, 0);
    }

    #[test]
    fn list_disputes_returns_all() {
        let f = AuthFixture::new();
        for i in 0..3 {
            let id = match i {
                0 => Symbol::new(&f.env, "d_list_0"),
                1 => Symbol::new(&f.env, "d_list_1"),
                _ => Symbol::new(&f.env, "d_list_2"),
            };
            f.client().file_dispute(
                &id,
                &f.disputer,
                &f.respondent,
                &f.token,
                &(100_000 + i as i128),
                &String::from_str(&f.env, "abc"),
            );
        }

        let disputes = f.client().list_disputes();
        assert_eq!(disputes.len(), 3);
    }
}

// =============================================================================
// Evidence submission tests
// =============================================================================

mod evidence {
    use super::*;

    #[test]
    fn submit_evidence_by_stranger_panics() {
        let f = AuthFixture::new();
        f.open();
        assert_eq!(
            f.client().try_submit_evidence(
                &Symbol::new(&f.env, "d1"),
                &f.stranger,
                &String::from_str(&f.env, "evidence"),
            ),
            Err(Ok(ContractError::NotAParty))
        );
    }

    #[test]
    fn submit_evidence_nonexistent_dispute_panics() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_submit_evidence(
                &Symbol::new(&f.env, "d_nonexistent"),
                &f.disputer,
                &String::from_str(&f.env, "evidence"),
            ),
            Err(Ok(ContractError::DisputeNotFound))
        );
    }

    #[test]
    fn submit_evidence_both_parties() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "d_both");
        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "disp_evidence"),
        );

        let dispute_before = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute_before.status, DisputeStatus::Open);

        // Respondent submits evidence
        f.client().submit_evidence(
            &id,
            &f.respondent,
            &String::from_str(&f.env, "resp_evidence"),
        );

        let dispute_after = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute_after.status, DisputeStatus::Evidence);
        assert!(dispute_after.respondent_evidence.is_some());
    }

    #[test]
    fn submit_evidence_disputer_update() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "d_update");
        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "initial"),
        );

        // Disputer updates their evidence
        f.client()
            .submit_evidence(&id, &f.disputer, &String::from_str(&f.env, "updated"));

        let dispute = f.client().get_dispute(&id).unwrap();
        assert_eq!(
            dispute.disputer_evidence,
            Some(String::from_str(&f.env, "updated"))
        );
    }
}

// =============================================================================
// Decision tests
// =============================================================================

mod decision {
    use super::*;

    #[test]
    fn decide_nonexistent_dispute_panics() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_decide(
                &Symbol::new(&f.env, "d_nonexistent"),
                &f.arbitrator,
                &DisputeOutcome::RefundDisputer,
                &0,
            ),
            Err(Ok(ContractError::DisputeNotFound))
        );
    }

    #[test]
    fn decide_sets_arbitrator() {
        let f = AuthFixture::new();
        f.open();
        let id = Symbol::new(&f.env, "d1");

        let dispute_before = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute_before.arbitrator, None);

        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::RefundDisputer, &0);

        let dispute_after = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute_after.arbitrator, Some(f.arbitrator.clone()));
    }

    #[test]
    fn decide_sets_outcome_and_split_bps() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "d_outcome");
        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );

        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::Split, &3_333);

        let dispute = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute.outcome, DisputeOutcome::Split);
        assert_eq!(dispute.split_bps, 3_333);
    }

    #[test]
    fn decide_after_settle_panics() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "d_settled");
        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "abc"),
        );
        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::RefundDisputer, &0);
        f.client().settle(&id);

        // Try to decide again
        assert_eq!(
            f.client()
                .try_decide(&id, &f.arbitrator, &DisputeOutcome::RefundDisputer, &0),
            Err(Ok(ContractError::NotDecidable))
        );
    }
}

// =============================================================================
// View functions tests
// =============================================================================

mod views {
    use super::*;

    #[test]
    fn get_admin_returns_correct_value() {
        let f = AuthFixture::new();
        assert_eq!(f.client().get_admin(), f.admin);
    }

    #[test]
    fn version_returns_correct_value() {
        let f = AuthFixture::new();
        assert_eq!(f.client().version(), VERSION);
    }

    #[test]
    fn get_dispute_nonexistent_returns_none() {
        let f = AuthFixture::new();
        let result = f
            .client()
            .get_dispute(&Symbol::new(&f.env, "d_nonexistent"));
        assert_eq!(result, None);
    }

    #[test]
    fn get_dispute_existing_returns_full_record() {
        let f = AuthFixture::new();
        let id = Symbol::new(&f.env, "d_get");
        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "evidence"),
        );

        let dispute = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute.id, id);
        assert_eq!(dispute.disputer, f.disputer);
        assert_eq!(dispute.respondent, f.respondent);
        assert_eq!(dispute.token, f.token);
        assert_eq!(dispute.amount, 100_000);
        assert_eq!(dispute.status, DisputeStatus::Open);
    }
}

// =============================================================================
// State transition tests
// =============================================================================

mod state_transitions {
    use super::*;

    #[test]
    fn full_dispute_lifecycle() {
        let f = AuthFixture::new();
        let mut info = f.env.ledger().get();
        info.timestamp = 100;
        f.env.ledger().set(info);

        let id = Symbol::new(&f.env, "d_lifecycle");

        // Step 1: File dispute
        f.client().file_dispute(
            &id,
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "disputer_initial"),
        );
        let dispute = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute.status, DisputeStatus::Open);

        // Step 2: Submit evidence
        f.client().submit_evidence(
            &id,
            &f.respondent,
            &String::from_str(&f.env, "respondent_evidence"),
        );
        let dispute = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute.status, DisputeStatus::Evidence);

        // Step 3: Decide
        f.client()
            .decide(&id, &f.arbitrator, &DisputeOutcome::Split, &5_000);
        let dispute = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute.status, DisputeStatus::Decided);

        // Step 4: Settle
        f.client().settle(&id);
        let dispute = f.client().get_dispute(&id).unwrap();
        assert_eq!(dispute.status, DisputeStatus::Settled);
        assert!(dispute.settled_at > 0);
    }
}
