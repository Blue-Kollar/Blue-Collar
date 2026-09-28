#![cfg(test)]
extern crate std;

use super::*;
use bluecollar_shared::test_fixtures::deploy_token_and_mint;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::Client as TokenClient,
    Address, BytesN, Env, String, Symbol, Vec,
};

/// Advance the ledger timestamp to `ts`.
///
/// Local copy of `bluecollar_types::test_utils::set_time`: enabling that
/// crate's `testutils` feature currently fails to compile (missing
/// `soroban_sdk::testutils::Ledger` import in `types/src/test_utils.rs`),
/// so the helper is inlined here instead — issue #1436.
fn set_time(env: &Env, ts: u64) {
    let mut info = env.ledger().get();
    info.timestamp = ts;
    env.ledger().set(info);
}

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

        let token = deploy_token_and_mint(&env, &admin, &member, 1_000_000);

        let contract = env.register(InsurancePoolContract, ());
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

    fn client(&self) -> InsurancePoolContractClient<'_> {
        InsurancePoolContractClient::new(&self.env, &self.contract)
    }

    fn contribute(&self) {
        let token_client = TokenClient::new(&self.env, &self.token);
        token_client.approve(&self.member, &self.contract, &100_000, &200_000);
        self.client()
            .contribute(&self.member, &self.token, &100_000);
    }

    fn file_claim(&self, claim_id: &str) {
        self.file_claim_amount(claim_id, 10_000);
    }

    fn file_claim_amount(&self, claim_id: &str, amount: i128) {
        self.client()
            .file_claim(&self.member, &Symbol::new(&self.env, claim_id), &amount);
    }

    fn approve_claim(&self, claim_id: &str) {
        self.client()
            .approve_claim(&self.claims_mgr, &Symbol::new(&self.env, claim_id));
    }

    fn claim(&self, claim_id: &str) -> Claim {
        self.client().get_claim(&Symbol::new(&self.env, claim_id))
    }

    fn pool_stats(&self) -> PoolStats {
        self.client().get_pool_stats(&self.token)
    }

    fn token_client(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.token)
    }
}

/// Assert the pool accounting invariant (issue #1436).
///
/// After every claim — successful *or* failed — the pool must satisfy
/// `total_balance == total_contributions - total_claims_paid`, that recorded
/// balance must match the real token holdings of the pool contract, and it
/// must never be negative.
fn assert_pool_balanced(f: &AuthFixture, token: &Address) {
    let stats = f.client().get_pool_stats(token);
    let held = TokenClient::new(&f.env, token).balance(&f.contract);

    assert!(
        stats.total_balance >= 0,
        "recorded pool balance must never be negative"
    );
    assert_eq!(
        stats.total_balance,
        stats.total_contributions - stats.total_claims_paid,
        "pool identity broken: total_balance != total_contributions - total_claims_paid"
    );
    assert_eq!(
        stats.total_balance, held,
        "recorded pool balance does not match the pool contract's real token holdings"
    );
}

/// Read the stored membership list for `role` directly from contract storage.
fn role_members(f: &AuthFixture, role: &str) -> Vec<Address> {
    let members: Option<Vec<Address>> = f.env.as_contract(&f.contract, || {
        f.env
            .storage()
            .persistent()
            .get(&DataKey::RoleMembers(Symbol::new(&f.env, role)))
    });
    members.unwrap_or_else(|| Vec::new(&f.env))
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
            InsurancePoolContractClient::new(&env, &env.register(InsurancePoolContract, ()))
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

// =============================================================================
// Claim payout paths — issue #1436 (fund safety of pooled payouts)
// =============================================================================

mod claim_payout {
    use super::*;

    #[test]
    fn pay_claim_moves_funds_status_and_pool_stats() {
        let f = AuthFixture::new();
        set_time(&f.env, 1_000);
        f.contribute(); // pool holds 100_000
        f.file_claim("pay_ok"); // 10_000
        set_time(&f.env, 2_000);
        f.approve_claim("pay_ok");

        let claimant_before = f.token_client().balance(&f.member);
        let pool_before = f.token_client().balance(&f.contract);
        assert_eq!(pool_before, 100_000);
        assert_pool_balanced(&f, &f.token);

        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "pay_ok"), &f.token);

        let claim = f.claim("pay_ok");
        assert_eq!(claim.status, String::from_str(&f.env, "paid"));
        assert_eq!(claim.claimant, f.member);
        assert_eq!(claim.amount, 10_000);
        assert_eq!(claim.filed_at, 1_000);
        assert_eq!(claim.resolved_at, 2_000);

        let stats = f.pool_stats();
        assert_eq!(stats.total_contributions, 100_000);
        assert_eq!(stats.total_claims_paid, 10_000);
        assert_eq!(stats.total_balance, 90_000);
        assert!(stats.total_claims_paid >= 10_000);

        assert_eq!(
            f.token_client().balance(&f.member),
            claimant_before + 10_000
        );
        assert_eq!(f.token_client().balance(&f.contract), 90_000);
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn pay_claim_draining_pool_exactly_keeps_accounting_balanced() {
        let f = AuthFixture::new();
        f.contribute(); // pool holds 100_000
        f.file_claim_amount("drain", 100_000);
        f.approve_claim("drain");

        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "drain"), &f.token);

        let stats = f.pool_stats();
        assert_eq!(stats.total_balance, 0);
        assert_eq!(stats.total_claims_paid, 100_000);
        assert_eq!(f.token_client().balance(&f.contract), 0);
        assert_eq!(f.claim("drain").status, String::from_str(&f.env, "paid"));
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn rejected_claim_is_not_payable_and_pool_is_untouched() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("rej_pay");
        f.client()
            .reject_claim(&f.claims_mgr, &Symbol::new(&f.env, "rej_pay"));

        assert_eq!(
            f.client()
                .try_pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "rej_pay"), &f.token),
            Err(Ok(ContractError::ClaimNotApproved))
        );
        assert_eq!(f.pool_stats().total_claims_paid, 0);
        assert_eq!(f.token_client().balance(&f.contract), 100_000);
        assert_pool_balanced(&f, &f.token);
    }
}

// =============================================================================
// Insufficient pool balance — no in-contract guard: the SAC transfer traps
// =============================================================================

mod insufficient_balance {
    use super::*;

    #[test]
    fn pay_claim_panics_when_pool_cannot_cover_claim_and_state_is_unchanged() {
        let f = AuthFixture::new();
        set_time(&f.env, 1_000);
        f.contribute(); // pool holds 100_000
        f.file_claim_amount("too_big", 500_000); // 5x the pool's funds
        set_time(&f.env, 2_000);
        f.approve_claim("too_big");

        let stats_before = f.pool_stats();
        let pool_before = f.token_client().balance(&f.contract);
        let claimant_before = f.token_client().balance(&f.member);

        // There is no balance guard in `pay_claim`; the token transfer itself
        // fails at the host level. Same pattern as
        // escrow/src/test.rs::test_release_state_unchanged_when_transfer_fails.
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.client()
                .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "too_big"), &f.token);
        }));
        assert!(
            result.is_err(),
            "pay_claim must panic when the pool cannot fund the transfer"
        );

        // The failed payout must not have advanced any state.
        let claim = f.claim("too_big");
        assert_eq!(claim.status, String::from_str(&f.env, "approved"));
        assert_eq!(claim.resolved_at, 2_000);
        assert_eq!(f.pool_stats(), stats_before);
        assert_eq!(f.token_client().balance(&f.contract), pool_before);
        assert_eq!(f.token_client().balance(&f.member), claimant_before);
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn pay_claim_on_empty_pool_panics_and_leaves_claim_approved() {
        let f = AuthFixture::new(); // no contribution: pool holds 0
        f.file_claim("no_funds");
        f.approve_claim("no_funds");

        let stats_before = f.pool_stats();
        assert_eq!(stats_before.total_balance, 0);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.client()
                .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "no_funds"), &f.token);
        }));
        assert!(result.is_err());

        assert_eq!(
            f.claim("no_funds").status,
            String::from_str(&f.env, "approved")
        );
        assert_eq!(f.pool_stats(), stats_before);
        assert_eq!(f.token_client().balance(&f.contract), 0);
        assert_eq!(f.token_client().balance(&f.member), 1_000_000);
        assert_pool_balanced(&f, &f.token);
    }
}

// =============================================================================
// Concurrent claims competing for the same pooled funds
// =============================================================================

mod concurrent_claims {
    use super::*;

    #[test]
    fn second_claim_exceeding_remaining_funds_fails_while_first_is_paid() {
        let f = AuthFixture::new();
        f.contribute(); // pool holds 100_000
        f.file_claim_amount("c_first", 60_000);
        f.file_claim_amount("c_second", 60_000); // 120_000 > 100_000
        f.approve_claim("c_first");
        f.approve_claim("c_second");

        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "c_first"), &f.token);
        assert_eq!(f.claim("c_first").status, String::from_str(&f.env, "paid"));
        assert_pool_balanced(&f, &f.token);

        // Only 40_000 remains for a 60_000 claim.
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.client()
                .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "c_second"), &f.token);
        }));
        assert!(
            result.is_err(),
            "the overdrawn claim's transfer must fail at the token level"
        );

        assert_eq!(
            f.claim("c_second").status,
            String::from_str(&f.env, "approved")
        );
        let stats = f.pool_stats();
        assert_eq!(stats.total_claims_paid, 60_000);
        assert_eq!(stats.total_balance, 40_000);
        assert_eq!(f.token_client().balance(&f.contract), 40_000);
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn claims_are_paid_in_sequence_until_pool_is_exhausted() {
        let f = AuthFixture::new();
        f.contribute(); // pool holds 100_000
        f.file_claim_amount("s1", 70_000);
        f.file_claim_amount("s2", 30_000);
        f.file_claim_amount("s3", 5_000); // 105_000 requested in total
        f.approve_claim("s1");
        f.approve_claim("s2");
        f.approve_claim("s3");

        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "s1"), &f.token);
        assert_eq!(f.pool_stats().total_balance, 30_000);
        assert_pool_balanced(&f, &f.token);

        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "s2"), &f.token);
        assert_eq!(f.pool_stats().total_balance, 0);
        assert_pool_balanced(&f, &f.token);

        // Pool is exhausted: the last approved claim cannot be funded.
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.client()
                .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "s3"), &f.token);
        }));
        assert!(result.is_err());

        assert_eq!(f.claim("s1").status, String::from_str(&f.env, "paid"));
        assert_eq!(f.claim("s2").status, String::from_str(&f.env, "paid"));
        assert_eq!(f.claim("s3").status, String::from_str(&f.env, "approved"));

        let stats = f.pool_stats();
        assert_eq!(stats.total_claims_paid, 100_000);
        assert_eq!(stats.total_balance, 0);
        assert_eq!(f.token_client().balance(&f.contract), 0);
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn claims_fully_covered_by_pool_all_pay_successfully() {
        let f = AuthFixture::new();
        f.contribute(); // pool holds 100_000
        f.file_claim_amount("k1", 40_000);
        f.file_claim_amount("k2", 60_000);
        f.approve_claim("k1");
        f.approve_claim("k2");

        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "k1"), &f.token);
        assert_pool_balanced(&f, &f.token);
        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "k2"), &f.token);
        assert_pool_balanced(&f, &f.token);

        let stats = f.pool_stats();
        assert_eq!(stats.total_claims_paid, 100_000);
        assert_eq!(stats.total_balance, 0);
        assert_eq!(f.claim("k1").status, String::from_str(&f.env, "paid"));
        assert_eq!(f.claim("k2").status, String::from_str(&f.env, "paid"));
    }
}

// =============================================================================
// Double-claim protection
// =============================================================================

mod double_claim {
    use super::*;

    #[test]
    fn paying_an_already_paid_claim_fails_without_double_spend() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("dc1");
        f.approve_claim("dc1");
        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "dc1"), &f.token);

        let claimant_after_first = f.token_client().balance(&f.member);
        let stats_after_first = f.pool_stats();
        assert_eq!(stats_after_first.total_claims_paid, 10_000);

        assert_eq!(
            f.client()
                .try_pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "dc1"), &f.token),
            Err(Ok(ContractError::ClaimNotApproved))
        );

        // Nothing moved a second time.
        assert_eq!(f.token_client().balance(&f.member), claimant_after_first);
        assert_eq!(f.pool_stats(), stats_after_first);
        assert_eq!(f.claim("dc1").status, String::from_str(&f.env, "paid"));
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn approving_an_already_approved_claim_returns_claim_not_pending() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("dc2");
        f.approve_claim("dc2");

        assert_eq!(
            f.client()
                .try_approve_claim(&f.claims_mgr, &Symbol::new(&f.env, "dc2")),
            Err(Ok(ContractError::ClaimNotPending))
        );
        assert_eq!(f.claim("dc2").status, String::from_str(&f.env, "approved"));
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn rejecting_an_approved_claim_returns_claim_not_pending() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("dc3");
        f.approve_claim("dc3");

        assert_eq!(
            f.client()
                .try_reject_claim(&f.claims_mgr, &Symbol::new(&f.env, "dc3")),
            Err(Ok(ContractError::ClaimNotPending))
        );
        assert_eq!(f.claim("dc3").status, String::from_str(&f.env, "approved"));
        assert_pool_balanced(&f, &f.token);
    }

    /// CHARACTERIZATION (no guard exists today): re-filing an already-paid
    /// claim id resets it to "pending" and appends the id to the claims index
    /// a second time. Not changed here — production behaviour only.
    #[test]
    fn re_filing_a_paid_claim_resets_it_to_pending_and_duplicates_the_index_entry() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("rc1");
        f.approve_claim("rc1");
        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "rc1"), &f.token);
        assert_eq!(f.claim("rc1").status, String::from_str(&f.env, "paid"));

        set_time(&f.env, 5_000);
        f.file_claim("rc1");

        let claim = f.claim("rc1");
        assert_eq!(claim.status, String::from_str(&f.env, "pending"));
        assert_eq!(claim.resolved_at, 0);
        assert_eq!(claim.amount, 10_000);
        assert_eq!(claim.filed_at, 5_000);

        let ids: Option<Vec<Symbol>> = f.env.as_contract(&f.contract, || {
            f.env.storage().persistent().get(&DataKey::Claims)
        });
        let ids = ids.expect("claims index must exist after filing");
        let occurrences = ids
            .iter()
            .filter(|id| *id == Symbol::new(&f.env, "rc1"))
            .count();
        assert_eq!(occurrences, 2, "claim id appended to the index twice");

        // The pool itself was not touched by the re-filing.
        assert_pool_balanced(&f, &f.token);
    }

    /// CHARACTERIZATION (documents a fund-safety gap, not desired behaviour):
    /// because `file_claim` has no duplicate-id guard, the same claim id can be
    /// re-approved and paid out twice. Accounting stays internally consistent,
    /// but the pool pays twice for one claim.
    #[test]
    fn re_filed_paid_claim_can_be_paid_a_second_time() {
        let f = AuthFixture::new();
        f.contribute(); // pool holds 100_000
        f.file_claim("rc2");
        f.approve_claim("rc2");
        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "rc2"), &f.token);
        let claimant_after_first = f.token_client().balance(&f.member);
        assert_eq!(f.pool_stats().total_claims_paid, 10_000);

        f.file_claim("rc2");
        f.approve_claim("rc2");
        f.client()
            .pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "rc2"), &f.token);

        assert_eq!(
            f.token_client().balance(&f.member),
            claimant_after_first + 10_000
        );
        let stats = f.pool_stats();
        assert_eq!(stats.total_claims_paid, 20_000);
        assert_eq!(stats.total_balance, 80_000);
        assert_pool_balanced(&f, &f.token);
    }
}

// =============================================================================
// Claim error paths and read-only accessors
// =============================================================================

mod claim_errors {
    use super::*;

    #[test]
    fn get_claim_unknown_id_returns_claim_not_found() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_get_claim(&Symbol::new(&f.env, "missing")),
            Err(Ok(ContractError::ClaimNotFound))
        );
    }

    #[test]
    fn get_claim_returns_the_filed_claim() {
        let f = AuthFixture::new();
        set_time(&f.env, 1_500);
        f.file_claim("gc1");

        let claim = f.claim("gc1");
        assert_eq!(claim.id, Symbol::new(&f.env, "gc1"));
        assert_eq!(claim.claimant, f.member);
        assert_eq!(claim.amount, 10_000);
        assert_eq!(claim.status, String::from_str(&f.env, "pending"));
        assert_eq!(claim.filed_at, 1_500);
        assert_eq!(claim.resolved_at, 0);
    }

    #[test]
    fn approve_claim_unknown_id_returns_claim_not_found() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client()
                .try_approve_claim(&f.claims_mgr, &Symbol::new(&f.env, "missing")),
            Err(Ok(ContractError::ClaimNotFound))
        );
    }

    #[test]
    fn reject_claim_unknown_id_returns_claim_not_found() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client()
                .try_reject_claim(&f.claims_mgr, &Symbol::new(&f.env, "missing")),
            Err(Ok(ContractError::ClaimNotFound))
        );
    }

    #[test]
    fn pay_claim_unknown_id_returns_claim_not_found() {
        let f = AuthFixture::new();
        f.contribute();
        assert_eq!(
            f.client()
                .try_pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "missing"), &f.token),
            Err(Ok(ContractError::ClaimNotFound))
        );
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn pay_claim_on_pending_claim_returns_claim_not_approved() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("pend1");

        assert_eq!(
            f.client()
                .try_pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "pend1"), &f.token),
            Err(Ok(ContractError::ClaimNotApproved))
        );
        assert_eq!(f.claim("pend1").status, String::from_str(&f.env, "pending"));
        assert_eq!(f.pool_stats().total_claims_paid, 0);
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn reject_claim_happy_path_marks_claim_rejected() {
        let f = AuthFixture::new();
        f.contribute();
        set_time(&f.env, 1_000);
        f.file_claim("rj1");
        set_time(&f.env, 3_000);
        f.client()
            .reject_claim(&f.claims_mgr, &Symbol::new(&f.env, "rj1"));

        let claim = f.claim("rj1");
        assert_eq!(claim.status, String::from_str(&f.env, "rejected"));
        assert_eq!(claim.resolved_at, 3_000);
        assert_eq!(f.pool_stats().total_claims_paid, 0);
        assert_eq!(f.token_client().balance(&f.contract), 100_000);
        assert_pool_balanced(&f, &f.token);
    }

    /// `pay_claim` transfers *before* it looks up `PoolStats`. A payout against
    /// a token with no stats entry therefore reaches the stats lookup only
    /// after the transfer has run; the resulting `PoolStatsNotFound` error traps
    /// the invocation, which rolls back the transfer and the `"paid"` write.
    #[test]
    fn pay_claim_without_pool_stats_returns_pool_stats_not_found() {
        let f = AuthFixture::new();
        f.contribute();
        f.file_claim("nostats");
        f.approve_claim("nostats");

        // Give the pool contract real funds in a token that has no PoolStats
        // record, so the transfer succeeds and the stats lookup is reached.
        let other = deploy_token_and_mint(&f.env, &f.admin, &f.contract, 50_000);

        assert_eq!(
            f.client()
                .try_pay_claim(&f.claims_mgr, &Symbol::new(&f.env, "nostats"), &other),
            Err(Ok(ContractError::PoolStatsNotFound))
        );

        // The trapped invocation left no partial state behind.
        assert_eq!(
            f.claim("nostats").status,
            String::from_str(&f.env, "approved")
        );
        assert_eq!(
            TokenClient::new(&f.env, &other).balance(&f.contract),
            50_000
        );
        assert_eq!(f.client().get_pool_stats(&other).total_balance, 0);

        // The pool's own registered token is untouched and still balanced.
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn get_pool_members_returns_contributors() {
        let f = AuthFixture::new();
        set_time(&f.env, 4_000);
        f.contribute();

        let members = f.client().get_pool_members();
        assert_eq!(members.len(), 1);
        let member = members.get(0).unwrap();
        assert_eq!(member.address, f.member);
        assert_eq!(member.contribution, 100_000);
        assert_eq!(member.last_contribution_at, 4_000);
    }

    #[test]
    fn get_pool_members_empty_before_any_contribution() {
        let f = AuthFixture::new();
        assert_eq!(f.client().get_pool_members().len(), 0);
    }

    #[test]
    fn version_returns_event_schema_version() {
        let f = AuthFixture::new();
        assert_eq!(f.client().version(), VERSION);
    }

    #[test]
    fn get_pool_stats_unknown_token_returns_zeroed_stats() {
        let f = AuthFixture::new();
        let unknown = Address::generate(&f.env);
        let stats = f.client().get_pool_stats(&unknown);
        assert_eq!(stats.token, unknown);
        assert_eq!(stats.total_balance, 0);
        assert_eq!(stats.total_contributions, 0);
        assert_eq!(stats.total_claims_paid, 0);
        assert_eq!(stats.premium_bps, 0);
    }

    #[test]
    fn rebalance_pool_without_pool_stats_returns_pool_stats_not_found() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client()
                .try_rebalance_pool(&f.admin, &Address::generate(&f.env), &500),
            Err(Ok(ContractError::PoolStatsNotFound))
        );
    }
}

// =============================================================================
// Role management
// =============================================================================

mod role_management {
    use super::*;

    #[test]
    fn grant_role_is_idempotent_and_does_not_duplicate_members() {
        let f = AuthFixture::new();
        let role = Symbol::new(&f.env, ROLE_CLAIMS_MGR);
        let user = Address::generate(&f.env);

        f.client().grant_role(&f.admin, &role, &user);
        f.client().grant_role(&f.admin, &role, &user); // no-op branch

        let members = role_members(&f, ROLE_CLAIMS_MGR);
        assert_eq!(members.len(), 2); // fixture claims_mgr + user, no duplicate
        assert_eq!(members.iter().filter(|m| *m == user).count(), 1);
    }

    #[test]
    fn grant_role_for_unseen_role_creates_membership_list() {
        let f = AuthFixture::new();
        let auditor = Symbol::new(&f.env, "auditor");
        let user = Address::generate(&f.env);

        assert_eq!(role_members(&f, "auditor").len(), 0);
        f.client().grant_role(&f.admin, &auditor, &user);
        assert_eq!(role_members(&f, "auditor").len(), 1);
        assert_eq!(role_members(&f, "auditor").get(0).unwrap(), user);
    }

    #[test]
    fn revoke_role_success_removes_account_and_blocks_further_use() {
        let f = AuthFixture::new();
        assert_eq!(role_members(&f, ROLE_CLAIMS_MGR).len(), 1);

        f.client().revoke_role(
            &f.admin,
            &Symbol::new(&f.env, ROLE_CLAIMS_MGR),
            &f.claims_mgr,
        );
        assert_eq!(role_members(&f, ROLE_CLAIMS_MGR).len(), 0);

        f.contribute();
        f.file_claim("rv1");
        assert_eq!(
            f.client()
                .try_approve_claim(&f.claims_mgr, &Symbol::new(&f.env, "rv1")),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn revoke_role_from_multi_member_list_preserves_other_members() {
        let f = AuthFixture::new();
        let role = Symbol::new(&f.env, ROLE_CLAIMS_MGR);
        let user = Address::generate(&f.env);
        f.client().grant_role(&f.admin, &role, &user);
        assert_eq!(role_members(&f, ROLE_CLAIMS_MGR).len(), 2);

        f.client().revoke_role(&f.admin, &role, &user);

        let remaining = role_members(&f, ROLE_CLAIMS_MGR);
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining.get(0).unwrap(), f.claims_mgr);
    }

    #[test]
    fn revoke_role_twice_returns_account_does_not_hold_role() {
        let f = AuthFixture::new();
        let role = Symbol::new(&f.env, ROLE_CLAIMS_MGR);
        f.client().revoke_role(&f.admin, &role, &f.claims_mgr);
        assert_eq!(
            f.client().try_revoke_role(&f.admin, &role, &f.claims_mgr),
            Err(Ok(ContractError::AccountDoesNotHoldRole))
        );
    }

    #[test]
    fn revoke_role_from_unseen_role_returns_account_does_not_hold_role() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_revoke_role(
                &f.admin,
                &Symbol::new(&f.env, "auditor"),
                &Address::generate(&f.env)
            ),
            Err(Ok(ContractError::AccountDoesNotHoldRole))
        );
    }
}

// =============================================================================
// Lifecycle / remaining untested branches
// =============================================================================

mod lifecycle {
    use super::*;

    #[test]
    fn initialize_twice_returns_already_initialized() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_initialize(&f.admin, &f.token, &500),
            Err(Ok(ContractError::AlreadyInitialized))
        );
    }

    #[test]
    fn unpause_restores_state_mutating_operations() {
        let f = AuthFixture::new();
        f.client().pause(&f.pauser);
        assert_eq!(
            f.client()
                .try_file_claim(&f.member, &Symbol::new(&f.env, "up1"), &10_000),
            Err(Ok(ContractError::ContractIsPaused))
        );

        f.client().unpause(&f.admin);
        f.file_claim("up1");
        assert_eq!(f.claim("up1").status, String::from_str(&f.env, "pending"));

        // Paused flag must now read false from instance storage.
        let paused: Option<bool> = f.env.as_contract(&f.contract, || {
            f.env.storage().instance().get(&DataKey::Paused)
        });
        assert_eq!(paused, Some(false));
    }

    #[test]
    fn upgrade_with_upgrader_role_reaches_wasm_update() {
        let f = AuthFixture::new();
        let hash = BytesN::from_array(&f.env, &[0u8; 32]);
        // Role check passes; the host rejects the placeholder WASM hash.
        let res = f.client().try_upgrade(&f.upgrader, &hash);
        assert_ne!(res, Err(Ok(ContractError::MissingRole)));
    }

    #[test]
    fn contribute_twice_updates_single_member_record() {
        let f = AuthFixture::new();
        f.contribute();
        f.contribute();

        let members = f.client().get_pool_members();
        assert_eq!(members.len(), 1);
        let member = members.get(0).unwrap();
        assert_eq!(member.address, f.member);
        assert_eq!(member.contribution, 200_000);

        let stats = f.pool_stats();
        assert_eq!(stats.total_contributions, 200_000);
        assert_eq!(stats.total_balance, 200_000);
        assert_eq!(f.token_client().balance(&f.contract), 200_000);
        assert_pool_balanced(&f, &f.token);
    }

    #[test]
    fn contribute_with_untracked_token_creates_default_pool_stats() {
        let f = AuthFixture::new();
        let other = deploy_token_and_mint(&f.env, &f.admin, &f.member, 500_000);
        TokenClient::new(&f.env, &other).approve(&f.member, &f.contract, &25_000, &50_000);

        f.client().contribute(&f.member, &other, &25_000);

        let stats = f.client().get_pool_stats(&other);
        assert_eq!(stats.total_balance, 25_000);
        assert_eq!(stats.total_contributions, 25_000);
        assert_eq!(stats.total_claims_paid, 0);
        assert_eq!(stats.premium_bps, 0); // default stats, premium not initialized
        assert_pool_balanced(&f, &other);

        // The original pool token is unaffected.
        assert_pool_balanced(&f, &f.token);
    }
}
