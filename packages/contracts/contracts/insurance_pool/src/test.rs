#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, String, Symbol, Vec,
};

struct AuthFixture {
    env: Env,
    contract: Address,
    admin: Address,
    pauser: Address,
    claims_mgr: Address,
    upgrader: Address,
    stranger: Address,
    token: Address,
    member: Address,
}

impl AuthFixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let pauser = Address::generate(&env);
        let claims_mgr = Address::generate(&env);
        let upgrader = Address::generate(&env);
        let stranger = Address::generate(&env);
        let member = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        StellarAssetClient::new(&env, &token).mint(&member, &1_000_000);

        let contract = env.register_contract(None, InsurancePoolContract);
        let client = InsurancePoolContractClient::new(&env, &contract);
        client.initialize(&admin, &token, &500);

        // Grant operational roles
        client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &pauser);
        client.grant_role(&admin, &Symbol::new(&env, ROLE_CLAIMS_MGR), &claims_mgr);
        client.grant_role(&admin, &Symbol::new(&env, ROLE_UPGRADER), &upgrader);

        AuthFixture {
            env,
            contract,
            admin,
            pauser,
            claims_mgr,
            upgrader,
            stranger,
            token,
            member,
        }
    }

    fn client(&self) -> InsurancePoolContractClient {
        InsurancePoolContractClient::new(&self.env, &self.contract)
    }

    fn contribute(&self) {
        let token_client = TokenClient::new(&self.env, &self.token);
        token_client.approve(&self.member, &self.contract, &100_000, &200_000);
        self.client()
            .contribute(&self.member, &self.token, &100_000);
    }

    fn file_claim(&self, claim_id: &str) {
        self.client()
            .file_claim(&self.member, &Symbol::new(&self.env, claim_id), &10_000);
    }

    fn approve_claim(&self, claim_id: &str) {
        self.client()
            .approve_claim(&self.claims_mgr, &Symbol::new(&self.env, claim_id));
    }
}

// =============================================================================
// Auth-failure tests (role-gated functions)
// =============================================================================

mod auth_failures {
    use super::*;

    #[test]
    fn grant_role_requires_admin() {
        let f = AuthFixture::new();
        let role = Symbol::new(&f.env, ROLE_PAUSER);
        assert_eq!(
            f.client()
                .try_grant_role(&f.stranger, &role, &Address::generate(&f.env)),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn revoke_role_requires_admin() {
        let f = AuthFixture::new();
        let role = Symbol::new(&f.env, ROLE_PAUSER);
        assert_eq!(
            f.client().try_revoke_role(&f.stranger, &role, &f.pauser),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn pause_requires_pauser() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_pause(&f.stranger),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn unpause_requires_admin() {
        let f = AuthFixture::new();
        f.client().pause(&f.pauser);
        assert_eq!(
            f.client().try_unpause(&f.stranger),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn approve_claim_requires_claims_mgr() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("c1");
        assert_eq!(
            f.client()
                .try_approve_claim(&f.stranger, &Symbol::new(&f.env, "c1")),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn reject_claim_requires_claims_mgr() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("c2");
        assert_eq!(
            f.client()
                .try_reject_claim(&f.stranger, &Symbol::new(&f.env, "c2")),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn pay_claim_requires_claims_mgr() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("c3");
        f.approve_claim("c3");
        assert_eq!(
            f.client()
                .try_pay_claim(&f.stranger, &Symbol::new(&f.env, "c3"), &f.token),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn rebalance_pool_requires_admin() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_rebalance_pool(&f.stranger, &f.token, &600),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn upgrade_requires_upgrader() {
        let f = AuthFixture::new();
        let hash = BytesN::from_array(&f.env, &[1u8; 32]);
        assert_eq!(
            f.client().try_upgrade(&f.stranger, &hash),
            Err(Ok(ContractError::MissingRole))
        );
    }
}

// =============================================================================
// Paused-state tests
// =============================================================================

mod paused_state {
    use super::*;

    #[test]
    fn contribute_while_paused() {
        let f = AuthFixture::new();
        f.client().pause(&f.pauser);
        assert_eq!(
            f.client().try_contribute(&f.member, &f.token, &100),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn file_claim_while_paused() {
        let f = AuthFixture::new();
        f.client().pause(&f.pauser);
        assert_eq!(
            f.client()
                .try_file_claim(&f.member, &Symbol::new(&f.env, "p1"), &100),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn approve_claim_while_paused() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("p2");
        f.client().pause(&f.pauser);
        assert_eq!(
            f.client()
                .try_approve_claim(&f.claims_mgr, &Symbol::new(&f.env, "p2")),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn reject_claim_while_paused() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("p3");
        f.client().pause(&f.pauser);
        assert_eq!(
            f.client()
                .try_reject_claim(&f.claims_mgr, &Symbol::new(&f.env, "p3")),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn pay_claim_while_paused() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("p4");
        f.approve_claim("p4");
        f.client().pause(&f.pauser);
        assert_eq!(
            f.client()
                .try_pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "p4"), &f.token),
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
    fn contribute_zero_amount() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_contribute(&f.member, &f.token, &0),
            Err(Ok(ContractError::AmountMustBePositive))
        );
    }

    #[test]
    fn file_claim_zero_amount() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client()
                .try_file_claim(&f.member, &Symbol::new(&f.env, "z1"), &0),
            Err(Ok(ContractError::AmountMustBePositive))
        );
    }

    #[test]
    fn initialize_premium_too_high() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        assert_eq!(
            InsurancePoolContractClient::new(
                &env,
                &env.register_contract(None, InsurancePoolContract)
            )
            .try_initialize(&admin, &token, &10_001),
            Err(Ok(ContractError::PremiumExceedsMaximum))
        );
    }

    #[test]
    fn rebalance_pool_premium_too_high() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_rebalance_pool(&f.admin, &f.token, &10_001),
            Err(Ok(ContractError::PremiumExceedsMaximum))
        );
    }

    #[test]
    fn rebalance_pool_premium_at_max() {
        let f = AuthFixture::new();
        f.client().rebalance_pool(&f.admin, &f.token, &10_000);
        let stats = f.client().get_pool_stats(&f.token);
        assert_eq!(stats.premium_bps, 10_000);
    }

    #[test]
    fn rebalance_pool_premium_at_min() {
        let f = AuthFixture::new();
        f.client().rebalance_pool(&f.admin, &f.token, &0);
        let stats = f.client().get_pool_stats(&f.token);
        assert_eq!(stats.premium_bps, 0);
    }
}
