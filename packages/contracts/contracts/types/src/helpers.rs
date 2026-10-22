//! Shared access-control and math helpers for BlueCollar contracts.
//!
//! These helpers centralise the validation and calculation logic that would
//! otherwise be duplicated across every contract.  Each helper receives the
//! *already-loaded* state it needs (the caller address, the pre-fetched member
//! list, the paused flag, …) so that the storage-key layout (which differs per
//! contract) can stay local to each contract's own storage module.
//!
//! ## Design rationale
//!
//! Soroban contracts run in a `no_std` environment.  Passing callbacks or
//! trait objects for the storage lookup would add unnecessary complexity.
//! Instead the helpers operate on plain values:
//!
//! ```text
//! // Caller-site (per-contract):
//! let members = storage::load_role_members(env, role_to_id(env, &role));
//! bluecollar_types::helpers::require_role(caller, &members)?;
//! ```
//!
//! This keeps each contract's storage layout private while sharing the
//! access-control logic that is prone to subtle bugs.
//!
//! ## Fee math
//!
//! [`split_fee`] is the single canonical implementation of the basis-points fee
//! split used by both the Market and Payment contracts.  Any future contract
//! that needs a protocol-fee deduction should import this function rather than
//! writing its own.

use soroban_sdk::{Address, Vec};

use crate::errors::ContractError;

/// Assert that `caller` holds a role whose member list is `members`.
///
/// Calls `caller.require_auth()` before checking membership, so the Soroban
/// host will reject the invocation if the transaction is not properly
/// authorised.
///
/// # Errors
///
/// Returns [`ContractError::MissingRole`] when `caller` is not present in
/// `members`.
pub fn require_role(caller: &Address, members: &Vec<Address>) -> Result<(), ContractError> {
    caller.require_auth();
    if members.iter().any(|m| m == *caller) {
        Ok(())
    } else {
        Err(ContractError::MissingRole)
    }
}

/// Assert that the contract is not paused.
///
/// # Errors
///
/// Returns [`ContractError::ContractIsPaused`] when `paused` is `true`.
pub fn require_not_paused(paused: bool) -> Result<(), ContractError> {
    if paused {
        Err(ContractError::ContractIsPaused)
    } else {
        Ok(())
    }
}

/// Assert that `caller` is the contract admin.
///
/// Calls `caller.require_auth()` before checking equality, so the Soroban
/// host will reject the invocation if the transaction is not properly
/// authorised.
///
/// # Errors
///
/// Returns [`ContractError::NotAuthorized`] when `caller != admin`.
pub fn require_admin(caller: &Address, admin: &Address) -> Result<(), ContractError> {
    caller.require_auth();
    if *caller == *admin {
        Ok(())
    } else {
        Err(ContractError::NotAuthorized)
    }
}

/// Assert that `caller` is one of the two named parties (e.g. depositor or
/// beneficiary on an escrow, buyer or seller on a job).
///
/// Calls `caller.require_auth()` before checking equality, so the Soroban
/// host will reject the invocation if the transaction is not properly
/// authorised. This centralises the "is caller a party to this record"
/// pattern previously reimplemented independently in escrow, job_registry,
/// and dispute.
///
/// # Errors
///
/// Returns [`ContractError::NotAParty`] when `caller` matches neither
/// `party_a` nor `party_b`.
pub fn require_party(
    caller: &Address,
    party_a: &Address,
    party_b: &Address,
) -> Result<(), ContractError> {
    caller.require_auth();
    if *caller == *party_a || *caller == *party_b {
        Ok(())
    } else {
        Err(ContractError::NotAParty)
    }
}

/// Assert that `caller` is either `primary` (e.g. the record owner/depositor)
/// or a member of `admins` (e.g. the admin role list).
///
/// This centralises the "owner-or-admin" authorization pattern used for
/// operations like releasing/cancelling an escrow, closing a job, etc.
///
/// # Errors
///
/// Returns [`ContractError::NotAuthorized`] when `caller` is neither
/// `primary` nor present in `admins`.
pub fn require_owner_or_role(
    caller: &Address,
    primary: &Address,
    admins: &Vec<Address>,
) -> Result<(), ContractError> {
    caller.require_auth();
    if *caller == *primary || admins.iter().any(|m| m == *caller) {
        Ok(())
    } else {
        Err(ContractError::NotAuthorized)
    }
}

// =============================================================================
// Fee calculation
// =============================================================================

/// Compute the protocol fee and net amount from a gross `amount`.
///
/// This is the **single canonical fee-split implementation** for all BlueCollar
/// contracts.  Both the Market and Payment contracts import this function rather
/// than maintaining their own duplicates.
///
/// # Parameters
/// - `amount`:  Gross amount before fee deduction (must be positive).
/// - `fee_bps`: Protocol fee in basis points (0–500; 500 bps = 5 %).
///
/// # Returns
/// `(fee, net)` where `fee + net == amount`.
///
/// # Panics
/// - Panics with `"Fee overflow"` if the intermediate `amount * fee_bps`
///   product overflows `i128`.
/// - Panics with `"Fee underflow"` if `amount - fee < 0` (should never happen
///   for a non-negative `amount` and `fee_bps ≤ 10_000`).
pub fn split_fee(amount: i128, fee_bps: u32) -> (i128, i128) {
    if fee_bps == 0 {
        return (0, amount);
    }
    let fee = amount
        .checked_mul(fee_bps as i128)
        .and_then(|v| v.checked_div(10_000))
        .expect("Fee overflow");
    let net = amount.checked_sub(fee).expect("Fee underflow");
    (fee, net)
}

/// Floor of `amount * bps / 10_000`: the single basis-point weighting
/// implementation shared by fee calculation and per-recipient fee distribution,
/// so rounding is identical across contracts (issue #1590).
///
/// The product is computed in `u128`, so it cannot overflow for any `u32`
/// basis-point weight and any non-negative `i128` amount that fits the result.
///
/// # Errors
/// - [`ContractError::ArithmeticOverflow`] if `amount` is negative or the
///   result does not fit in `i128`.
pub fn bps_share(amount: i128, bps: u32) -> Result<i128, ContractError> {
    let amount = u128::try_from(amount).map_err(|_| ContractError::ArithmeticOverflow)?;
    let numerator = amount
        .checked_mul(u128::from(bps))
        .ok_or(ContractError::ArithmeticOverflow)?;
    let floored = numerator / 10_000;
    i128::try_from(floored).map_err(|_| ContractError::ArithmeticOverflow)
}

// =============================================================================
// Unit tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env, Vec};

    #[contract]
    struct AuthFrame;

    #[contractimpl]
    impl AuthFrame {
        pub fn noop(_env: Env) {}
    }

    /// Run `f` inside a contract frame. The access-control helpers call
    /// `caller.require_auth()`, which the host only accepts while a contract
    /// is executing ("no contract running" otherwise).
    fn in_contract<F, R>(env: &Env, f: F) -> R
    where
        F: FnOnce() -> R,
    {
        let contract = env.register(AuthFrame, ());
        env.as_contract(&contract, f)
    }

    // -------------------------------------------------------------------------
    // require_role
    // -------------------------------------------------------------------------

    #[test]
    fn require_role_authorized() {
        let env = Env::default();
        env.mock_all_auths();

        let caller = Address::generate(&env);
        let other = Address::generate(&env);

        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(other);
        members.push_back(caller.clone());

        assert!(in_contract(&env, || require_role(&caller, &members)).is_ok());
    }

    #[test]
    fn require_role_unauthorized_empty_members() {
        let env = Env::default();
        env.mock_all_auths();

        let caller = Address::generate(&env);
        let members: Vec<Address> = Vec::new(&env);

        assert_eq!(
            in_contract(&env, || require_role(&caller, &members)).unwrap_err(),
            ContractError::MissingRole
        );
    }

    #[test]
    fn require_role_unauthorized_not_in_members() {
        let env = Env::default();
        env.mock_all_auths();

        let caller = Address::generate(&env);
        let other = Address::generate(&env);

        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(other);

        assert_eq!(
            in_contract(&env, || require_role(&caller, &members)).unwrap_err(),
            ContractError::MissingRole
        );
    }

    #[test]
    fn require_role_single_member_matches() {
        let env = Env::default();
        env.mock_all_auths();

        let caller = Address::generate(&env);
        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(caller.clone());

        assert!(in_contract(&env, || require_role(&caller, &members)).is_ok());
    }

    // -------------------------------------------------------------------------
    // require_not_paused
    // -------------------------------------------------------------------------

    #[test]
    fn require_not_paused_when_not_paused() {
        assert!(require_not_paused(false).is_ok());
    }

    #[test]
    fn require_not_paused_when_paused() {
        assert_eq!(
            require_not_paused(true).unwrap_err(),
            ContractError::ContractIsPaused
        );
    }

    // -------------------------------------------------------------------------
    // require_admin
    // -------------------------------------------------------------------------

    #[test]
    fn require_admin_caller_is_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        assert!(in_contract(&env, || require_admin(&admin, &admin)).is_ok());
    }

    #[test]
    fn require_admin_caller_is_not_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let other = Address::generate(&env);

        assert_eq!(
            in_contract(&env, || require_admin(&other, &admin)).unwrap_err(),
            ContractError::NotAuthorized
        );
    }

    // -------------------------------------------------------------------------
    // require_party
    // -------------------------------------------------------------------------

    #[test]
    fn require_party_matches_party_a() {
        let env = Env::default();
        env.mock_all_auths();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        assert!(in_contract(&env, || require_party(&a, &a, &b)).is_ok());
    }

    #[test]
    fn require_party_matches_party_b() {
        let env = Env::default();
        env.mock_all_auths();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        assert!(in_contract(&env, || require_party(&b, &a, &b)).is_ok());
    }

    #[test]
    fn require_party_rejects_stranger() {
        let env = Env::default();
        env.mock_all_auths();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let stranger = Address::generate(&env);
        assert_eq!(
            in_contract(&env, || require_party(&stranger, &a, &b)).unwrap_err(),
            ContractError::NotAParty
        );
    }

    // -------------------------------------------------------------------------
    // require_owner_or_role
    // -------------------------------------------------------------------------

    #[test]
    fn require_owner_or_role_owner_ok() {
        let env = Env::default();
        env.mock_all_auths();
        let owner = Address::generate(&env);
        let admins: Vec<Address> = Vec::new(&env);
        assert!(in_contract(&env, || require_owner_or_role(&owner, &owner, &admins)).is_ok());
    }

    #[test]
    fn require_owner_or_role_admin_ok() {
        let env = Env::default();
        env.mock_all_auths();
        let owner = Address::generate(&env);
        let admin = Address::generate(&env);
        let mut admins: Vec<Address> = Vec::new(&env);
        admins.push_back(admin.clone());
        assert!(in_contract(&env, || require_owner_or_role(&admin, &owner, &admins)).is_ok());
    }

    #[test]
    fn require_owner_or_role_rejects_stranger() {
        let env = Env::default();
        env.mock_all_auths();
        let owner = Address::generate(&env);
        let stranger = Address::generate(&env);
        let admins: Vec<Address> = Vec::new(&env);
        assert_eq!(
            in_contract(&env, || require_owner_or_role(&stranger, &owner, &admins)).unwrap_err(),
            ContractError::NotAuthorized
        );
    }

    // -------------------------------------------------------------------------
    // split_fee
    // -------------------------------------------------------------------------

    #[test]
    fn split_fee_zero_bps_returns_full_amount() {
        let (fee, net) = split_fee(100_000, 0);
        assert_eq!(fee, 0);
        assert_eq!(net, 100_000);
    }

    #[test]
    fn split_fee_100_bps_is_one_percent() {
        let (fee, net) = split_fee(100_000, 100);
        assert_eq!(fee, 1_000);
        assert_eq!(net, 99_000);
    }

    #[test]
    fn split_fee_500_bps_is_five_percent() {
        let (fee, net) = split_fee(100_000, 500);
        assert_eq!(fee, 5_000);
        assert_eq!(net, 95_000);
    }

    #[test]
    fn split_fee_rounds_down_for_tiny_amount() {
        // 1 token at 100 bps → fee rounds toward zero to 0
        let (fee, net) = split_fee(1, 100);
        assert_eq!(fee, 0);
        assert_eq!(net, 1);
    }

    #[test]
    fn split_fee_parts_always_sum_to_original() {
        for &bps in &[0u32, 50, 100, 250, 500] {
            let amount: i128 = 999_999;
            let (fee, net) = split_fee(amount, bps);
            assert_eq!(fee + net, amount, "fee + net != amount at {} bps", bps);
        }
    }

    // -------------------------------------------------------------------------
    // bps_share (issue #1590)
    // -------------------------------------------------------------------------

    #[test]
    fn bps_share_known_values() {
        assert_eq!(bps_share(10_000, 5_000), Ok(5_000));
        assert_eq!(bps_share(100_000, 100), Ok(1_000));
        assert_eq!(bps_share(1, 5_000), Ok(0));
        assert_eq!(bps_share(0, 10_000), Ok(0));
    }

    #[test]
    fn bps_share_rejects_negative_amount() {
        assert_eq!(bps_share(-1, 100), Err(ContractError::ArithmeticOverflow));
    }

    #[test]
    fn bps_share_rejects_result_overflow() {
        assert_eq!(bps_share(i128::MAX, 10_000), Err(ContractError::ArithmeticOverflow));
    }

    #[test]
    fn bps_share_is_floor_within_one_unit() {
        // For every amount/weight pair, share = floor(amount * bps / 10_000):
        // share * 10_000 <= amount * bps < (share + 1) * 10_000.
        for &amount in &[0i128, 1, 7, 999, 10_001, 123_456_789, 1_000_000_000_000] {
            for bps in (0u32..=10_000).step_by(37) {
                let share = bps_share(amount, bps).unwrap();
                let scaled = amount * i128::from(bps);
                assert!(share * 10_000 <= scaled, "floor too high: {amount} @ {bps}");
                assert!((share + 1) * 10_000 > scaled, "floor too low: {amount} @ {bps}");
            }
        }
    }

    #[test]
    fn bps_share_never_exceeds_amount() {
        for &amount in &[1i128, 3, 99, 10_001, 987_654_321] {
            for bps in 0u32..=10_000 {
                assert!(bps_share(amount, bps).unwrap() <= amount);
            }
        }
    }

    #[test]
    fn bps_share_partition_dust_is_bounded_by_recipient_count() {
        // Splitting 10_000 bps across k recipients leaves at most k - 1 units
        // of truncation dust, so the floor shares never drop more than k below
        // the amount they were drawn from.
        let splits: [&[u32]; 4] = [
            &[10_000],
            &[5_000, 5_000],
            &[3_333, 3_333, 3_334],
            &[1_000, 2_000, 3_000, 4_000],
        ];
        for &amount in &[1i128, 10, 999, 1_000_003, 555_555_555] {
            for weights in splits {
                let total: i128 = weights
                    .iter()
                    .map(|&w| bps_share(amount, w).unwrap())
                    .sum();
                let dust = amount - total;
                assert!(dust >= 0, "shares exceed amount");
                assert!(dust < weights.len() as i128, "dust {dust} >= {}", weights.len());
            }
        }
    }
}
