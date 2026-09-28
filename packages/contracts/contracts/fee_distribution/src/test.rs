#![cfg(test)]
extern crate std;

use super::*;
use bluecollar_shared::test_fixtures::deploy_token_and_mint;
use soroban_sdk::{
    testutils::Address as _, token::Client as TokenClient, Address, BytesN, Env, Symbol, Vec,
};

struct AuthFixture {
    env: Env,
    contract: Address,
    admin: Address,
    pauser: Address,
    fee_mgr: Address,
    upgrader: Address,
    stranger: Address,
    token: Address,
    recipient_a: Address,
    recipient_b: Address,
}

impl AuthFixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let pauser = Address::generate(&env);
        let fee_mgr = Address::generate(&env);
        let upgrader = Address::generate(&env);
        let stranger = Address::generate(&env);
        let recipient_a = Address::generate(&env);
        let recipient_b = Address::generate(&env);

        let token = deploy_token_and_mint(&env, &admin, &admin, 1_000_000);

        let contract = env.register_contract(None, FeeDistributionContract);
        let client = FeeDistributionContractClient::new(&env, &contract);
        client.initialize(&admin);

        // Grant operational roles
        client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &pauser);
        client.grant_role(&admin, &Symbol::new(&env, ROLE_FEE_MANAGER), &fee_mgr);
        client.grant_role(&admin, &Symbol::new(&env, ROLE_UPGRADER), &upgrader);

        // Set fee recipient for distribution tests
        let recipients = Vec::from_array(
            &env,
            [
                FeeRecipient {
                    address: recipient_a.clone(),
                    percentage_bps: 6_000,
                },
                FeeRecipient {
                    address: recipient_b.clone(),
                    percentage_bps: 4_000,
                },
            ],
        );
        client.set_fee_recipients(&fee_mgr, &recipients);

        AuthFixture {
            env,
            contract,
            admin,
            pauser,
            fee_mgr,
            upgrader,
            stranger,
            token,
            recipient_a,
            recipient_b,
        }
    }

    fn client(&self) -> FeeDistributionContractClient {
        FeeDistributionContractClient::new(&self.env, &self.contract)
    }

    fn collect_some_fees(&self) {
        let token_client = TokenClient::new(&self.env, &self.token);
        let admin_signer = self.admin.clone();
        token_client.approve(&admin_signer, &self.contract, &100_000, &200_000);
        self.client()
            .collect_fees(&self.admin, &self.token, &100_000);
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
    fn set_fee_recipients_requires_fee_mgr() {
        let f = AuthFixture::new();
        let recipients = Vec::new(&f.env);
        assert_eq!(
            f.client().try_set_fee_recipients(&f.stranger, &recipients),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn distribute_fees_requires_fee_mgr() {
        let f = AuthFixture::new();
        f.collect_some_fees();
        assert_eq!(
            f.client().try_distribute_fees(&f.stranger, &f.token),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn withdraw_fees_requires_admin() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_withdraw_fees(&f.stranger, &f.token, &100),
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
    fn grant_role_while_paused() {
        let f = AuthFixture::new();
        f.client().pause(&f.pauser);
        let role = Symbol::new(&f.env, ROLE_PAUSER);
        assert_eq!(
            f.client()
                .try_grant_role(&f.admin, &role, &Address::generate(&f.env)),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn revoke_role_while_paused() {
        let f = AuthFixture::new();
        f.client().pause(&f.pauser);
        let role = Symbol::new(&f.env, ROLE_PAUSER);
        assert_eq!(
            f.client().try_revoke_role(&f.admin, &role, &f.pauser),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn set_fee_recipients_while_paused() {
        let f = AuthFixture::new();
        f.client().pause(&f.pauser);
        let recipients = Vec::new(&f.env);
        assert_eq!(
            f.client().try_set_fee_recipients(&f.fee_mgr, &recipients),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn distribute_fees_while_paused() {
        let f = AuthFixture::new();
        f.collect_some_fees();
        f.client().pause(&f.pauser);
        assert_eq!(
            f.client().try_distribute_fees(&f.fee_mgr, &f.token),
            Err(Ok(ContractError::ContractIsPaused))
        );
    }

    #[test]
    fn collect_fees_while_paused() {
        let f = AuthFixture::new();
        f.client().pause(&f.pauser);
        assert_eq!(
            f.client().try_collect_fees(&f.admin, &f.token, &100),
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
    fn collect_fees_zero_amount() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_collect_fees(&f.admin, &f.token, &0),
            Err(Ok(ContractError::AmountMustBePositive))
        );
    }

    #[test]
    fn withdraw_fees_zero_amount() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_withdraw_fees(&f.admin, &f.token, &0),
            Err(Ok(ContractError::AmountMustBePositive))
        );
    }

    #[test]
    fn set_recipients_total_under_100() {
        let f = AuthFixture::new();
        let recipients = Vec::from_array(
            &f.env,
            [
                FeeRecipient {
                    address: f.recipient_a.clone(),
                    percentage_bps: 3_000,
                },
                FeeRecipient {
                    address: f.recipient_b.clone(),
                    percentage_bps: 3_000,
                },
            ],
        );
        assert_eq!(
            f.client().try_set_fee_recipients(&f.fee_mgr, &recipients),
            Err(Ok(ContractError::InvalidFeeSplit))
        );
    }

    #[test]
    fn set_recipients_total_over_100() {
        let f = AuthFixture::new();
        let recipients = Vec::from_array(
            &f.env,
            [
                FeeRecipient {
                    address: f.recipient_a.clone(),
                    percentage_bps: 6_000,
                },
                FeeRecipient {
                    address: f.recipient_b.clone(),
                    percentage_bps: 5_000,
                },
            ],
        );
        assert_eq!(
            f.client().try_set_fee_recipients(&f.fee_mgr, &recipients),
            Err(Ok(ContractError::InvalidFeeSplit))
        );
    }

    #[test]
    fn distribute_without_recipients() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let fee_mgr = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();

        let contract = env.register_contract(None, FeeDistributionContract);
        let client = FeeDistributionContractClient::new(&env, &contract);
        client.initialize(&admin);
        client.grant_role(&admin, &Symbol::new(&env, ROLE_FEE_MANAGER), &fee_mgr);

        // No recipients set, try to distribute
        assert_eq!(
            client.try_distribute_fees(&fee_mgr, &token),
            Err(Ok(ContractError::NoFeeRecipientsConfigured))
        );
    }

    #[test]
    fn distribute_without_collected_fees() {
        let f = AuthFixture::new();
        assert_eq!(
            f.client().try_distribute_fees(&f.fee_mgr, &f.token),
            Err(Ok(ContractError::NoFeesToDistribute))
        );
    }

    #[test]
    fn set_recipients_single_recipient_100_percent() {
        let f = AuthFixture::new();
        let recipients = Vec::from_array(
            &f.env,
            [FeeRecipient {
                address: f.recipient_a.clone(),
                percentage_bps: 10_000,
            }],
        );
        f.client().set_fee_recipients(&f.fee_mgr, &recipients);
        let stored = f.client().get_fee_recipients();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored.get(0).unwrap().percentage_bps, 10_000);
    }

    #[test]
    fn revoke_nonexistent_role() {
        let f = AuthFixture::new();
        let role = Symbol::new(&f.env, ROLE_PAUSER);
        assert_eq!(
            f.client().try_revoke_role(&f.admin, &role, &f.stranger),
            Err(Ok(ContractError::AccountDoesNotHoldRole))
        );
    }
}

// =============================================================================
// Distribution tests (happy path + dust/remainder accounting)
// =============================================================================

mod distribution {
    use super::*;

    fn token(f: &AuthFixture) -> TokenClient<'_> {
        TokenClient::new(&f.env, &f.token)
    }

    fn collect_amount(f: &AuthFixture, amount: i128) {
        token(f).approve(&f.admin, &f.contract, &amount, &500_000);
        f.client().collect_fees(&f.admin, &f.token, &amount);
    }

    fn set_recipients(f: &AuthFixture, bps: &[u32]) -> std::vec::Vec<Address> {
        let mut recipients: Vec<FeeRecipient> = Vec::new(&f.env);
        let mut used: std::vec::Vec<Address> = std::vec::Vec::new();
        for b in bps {
            let address = Address::generate(&f.env);
            used.push(address.clone());
            recipients.push_back(FeeRecipient {
                address,
                percentage_bps: *b,
            });
        }
        f.client().set_fee_recipients(&f.fee_mgr, &recipients);
        used
    }

    #[test]
    fn distribute_pays_floor_shares_and_closes_collection() {
        let f = AuthFixture::new();
        collect_amount(&f, 100_000);

        f.client().distribute_fees(&f.fee_mgr, &f.token);

        // Fixture recipients are 6000 / 4000 bps.
        assert_eq!(token(&f).balance(&f.recipient_a), 60_000);
        assert_eq!(token(&f).balance(&f.recipient_b), 40_000);
        assert_eq!(token(&f).balance(&f.contract), 0);

        let collection = f.client().get_fee_collection(&f.token);
        assert_eq!(collection.total_amount, 100_000);
        assert_eq!(collection.distributed_amount, 100_000);
    }

    #[test]
    fn truncate_dust_is_credited_to_first_recipient_and_nothing_is_stranded() {
        let f = AuthFixture::new();
        // 3333 + 3333 + 3334 = 10000 bps. With 10_001 available the floor
        // shares are 3333 + 3333 + 3334 = 10_000, leaving 1 stroop of dust.
        let users = set_recipients(&f, &[3_333, 3_333, 3_334]);
        collect_amount(&f, 10_001);

        f.client().distribute_fees(&f.fee_mgr, &f.token);

        let paid: i128 = users.iter().map(|u| token(&f).balance(u)).sum::<i128>();
        assert_eq!(paid, 10_001);
        assert_eq!(token(&f).balance(&f.contract), 0);
        // The remainder lands with the first recipient: 3333 + 1.
        assert_eq!(token(&f).balance(&users[0]), 3_334);

        let collection = f.client().get_fee_collection(&f.token);
        assert_eq!(collection.distributed_amount, collection.total_amount);
        assert_eq!(collection.distributed_amount, 10_001);
    }

    #[test]
    fn distribute_twice_without_new_fees_returns_no_fees() {
        let f = AuthFixture::new();
        collect_amount(&f, 100_000);
        f.client().distribute_fees(&f.fee_mgr, &f.token);

        assert_eq!(
            f.client().try_distribute_fees(&f.fee_mgr, &f.token),
            Err(Ok(ContractError::NoFeesToDistribute))
        );
        // No duplicate payout happened.
        assert_eq!(token(&f).balance(&f.recipient_a), 60_000);
        assert_eq!(token(&f).balance(&f.recipient_b), 40_000);
    }

    #[test]
    fn collect_after_distribution_accumulates_correctly() {
        let f = AuthFixture::new();
        collect_amount(&f, 100_000);
        f.client().distribute_fees(&f.fee_mgr, &f.token);

        collect_amount(&f, 10_000);
        let collection = f.client().get_fee_collection(&f.token);
        assert_eq!(collection.total_amount, 110_000);
        assert_eq!(collection.distributed_amount, 100_000);

        f.client().distribute_fees(&f.fee_mgr, &f.token);
        assert_eq!(token(&f).balance(&f.recipient_a), 66_000);
        assert_eq!(token(&f).balance(&f.recipient_b), 44_000);
        assert_eq!(token(&f).balance(&f.contract), 0);

        let collection = f.client().get_fee_collection(&f.token);
        assert_eq!(collection.distributed_amount, 110_000);
    }

    #[test]
    fn single_recipient_receives_the_entire_amount() {
        let f = AuthFixture::new();
        set_recipients(&f, &[10_000]);
        collect_amount(&f, 12_345);

        f.client().distribute_fees(&f.fee_mgr, &f.token);

        let stored = f.client().get_fee_recipients();
        let sole = stored.get(0).unwrap().address;
        assert_eq!(token(&f).balance(&sole), 12_345);
        assert_eq!(token(&f).balance(&f.contract), 0);
    }

    #[test]
    fn zero_share_recipients_receive_nothing_but_still_account() {
        let f = AuthFixture::new();
        // Only the first recipient carries weight; the others are 0 bps.
        set_recipients(&f, &[10_000, 0, 0]);
        collect_amount(&f, 777);

        f.client().distribute_fees(&f.fee_mgr, &f.token);

        let stored = f.client().get_fee_recipients();
        assert_eq!(token(&f).balance(&stored.get(0).unwrap().address), 777);
        assert_eq!(token(&f).balance(&stored.get(1).unwrap().address), 0);
        assert_eq!(token(&f).balance(&stored.get(2).unwrap().address), 0);
        assert_eq!(token(&f).balance(&f.contract), 0);
    }

    // ------------------------------------------------------------------
    // Direct unit tests for the extracted planning helpers
    // ------------------------------------------------------------------

    #[test]
    fn plan_distribution_empty_recipients_is_invalid_split() {
        let env = Env::default();
        let recipients: Vec<FeeRecipient> = Vec::new(&env);
        assert_eq!(
            plan_distribution(&env, 1_000, &recipients),
            Err(ContractError::InvalidFeeSplit)
        );
    }

    #[test]
    fn plan_distribution_rejects_split_not_totaling_10000_bps() {
        let env = Env::default();
        let address = Address::generate(&env);
        let mut recipients: Vec<FeeRecipient> = Vec::new(&env);
        recipients.push_back(FeeRecipient {
            address: address.clone(),
            percentage_bps: 5_000,
        });
        recipients.push_back(FeeRecipient {
            address,
            percentage_bps: 4_000,
        });
        assert_eq!(
            plan_distribution(&env, 1_000, &recipients),
            Err(ContractError::InvalidFeeSplit)
        );
    }

    #[test]
    fn plan_distribution_rejects_negative_available() {
        let env = Env::default();
        let address = Address::generate(&env);
        let mut recipients: Vec<FeeRecipient> = Vec::new(&env);
        recipients.push_back(FeeRecipient {
            address,
            percentage_bps: 10_000,
        });
        assert_eq!(
            plan_distribution(&env, -1, &recipients),
            Err(ContractError::ArithmeticOverflow)
        );
    }

    #[test]
    fn plan_distribution_zero_available_pays_nothing() {
        let env = Env::default();
        let address = Address::generate(&env);
        let mut recipients: Vec<FeeRecipient> = Vec::new(&env);
        recipients.push_back(FeeRecipient {
            address,
            percentage_bps: 10_000,
        });
        let shares = plan_distribution(&env, 0, &recipients).unwrap();
        assert_eq!(shares.len(), 1);
        assert_eq!(shares.get(0).unwrap(), 0);
    }

    #[test]
    fn total_percentage_bps_sums_and_checks() {
        let env = Env::default();
        let address = Address::generate(&env);
        let mut recipients: Vec<FeeRecipient> = Vec::new(&env);
        recipients.push_back(FeeRecipient {
            address: address.clone(),
            percentage_bps: 6_000,
        });
        recipients.push_back(FeeRecipient {
            address,
            percentage_bps: 4_000,
        });
        assert_eq!(total_percentage_bps(&recipients).unwrap(), 10_000);

        let empty: Vec<FeeRecipient> = Vec::new(&env);
        assert_eq!(total_percentage_bps(&empty).unwrap(), 0);
    }
}

// =============================================================================
// Property-based tests (issue #1434): splits always sum to the input amount
// =============================================================================

mod properties {
    use super::*;
    use proptest::prelude::*;

    /// Random basis-point vectors that total exactly [`MAX_FEE_BPS`].
    ///
    /// Built by cutting `[0, MAX_FEE_BPS]` at `n` sorted points, so the
    /// resulting weights always sum to 10000 (individual weights may be 0).
    fn arb_valid_split() -> impl Strategy<Value = std::vec::Vec<u32>> {
        (1_usize..=6).prop_flat_map(|n| {
            proptest::collection::vec(0_u32..=MAX_FEE_BPS, n - 1).prop_map(move |mut cuts| {
                cuts.sort_unstable();
                let mut bps = std::vec::Vec::with_capacity(n);
                let mut prev = 0_u32;
                for cut in cuts {
                    bps.push(cut - prev);
                    prev = cut;
                }
                bps.push(MAX_FEE_BPS - prev);
                bps
            })
        })
    }

    fn recipients_for(env: &Env, bps: &[u32]) -> Vec<FeeRecipient> {
        let address = Address::generate(env);
        let mut recipients: Vec<FeeRecipient> = Vec::new(env);
        for b in bps {
            recipients.push_back(FeeRecipient {
                address: address.clone(),
                percentage_bps: *b,
            });
        }
        recipients
    }

    proptest! {
        /// The core invariant: whatever the weight vector (0, 1 or many
        /// recipients) and whatever the amount, the planned shares never lose
        /// or duplicate a single stroop.
        #[test]
        fn splits_sum_exactly_to_the_input_amount(
            available in 0_i128..=10_000_000_000_i128,
            bps in arb_valid_split(),
        ) {
            let env = Env::default();
            let recipients = recipients_for(&env, &bps);
            let shares = plan_distribution(&env, available, &recipients)
                .expect("a split totalling 10000 bps must plan successfully");

            prop_assert_eq!(shares.len(), bps.len() as u32);

            let mut total: i128 = 0;
            for share in shares.iter() {
                prop_assert!(share >= 0, "no negative share");
                total = total.checked_add(share).expect("no overflow");
            }
            prop_assert_eq!(total, available, "shares must sum to the input");
        }

        /// A sole recipient is owed the whole amount, dust included.
        #[test]
        fn sole_recipient_is_paid_the_full_amount(
            available in 0_i128..=i128::from(u64::MAX),
        ) {
            let env = Env::default();
            let recipients = recipients_for(&env, &[MAX_FEE_BPS]);
            let shares = plan_distribution(&env, available, &recipients).unwrap();
            prop_assert_eq!(shares.get(0).unwrap(), available);
        }

        /// Any basis-point vector that does not total exactly 10000 is
        /// rejected rather than silently mis-priced.
        #[test]
        fn splits_not_totaling_10000_bps_are_rejected(
            available in 1_i128..=1_000_000_i128,
            bps in proptest::collection::vec(0_u32..=MAX_FEE_BPS, 1..=6),
        ) {
            prop_assume!(bps.iter().copied().sum::<u32>() != MAX_FEE_BPS);
            let env = Env::default();
            let recipients = recipients_for(&env, &bps);
            prop_assert!(matches!(
                plan_distribution(&env, available, &recipients),
                Err(ContractError::InvalidFeeSplit)
            ));
        }

        /// No recipient is ever paid more than the available balance, so the
        /// sum invariant cannot be met by over-paying one party.
        #[test]
        fn no_share_exceeds_the_available_balance(
            available in 0_i128..=10_000_000_000_i128,
            bps in arb_valid_split(),
        ) {
            let env = Env::default();
            let recipients = recipients_for(&env, &bps);
            let shares = plan_distribution(&env, available, &recipients).unwrap();
            for share in shares.iter() {
                prop_assert!(share <= available);
            }
        }
    }
}
