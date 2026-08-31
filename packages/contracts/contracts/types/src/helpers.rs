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

// =============================================================================
// Unit tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

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
        members.push_back(other.clone());
        members.push_back(caller.clone());

        assert!(require_role(&caller, &members).is_ok());
    }

    #[test]
    fn require_role_unauthorized_empty_members() {
        let env = Env::default();
        env.mock_all_auths();

        let caller = Address::generate(&env);
        let members: Vec<Address> = Vec::new(&env);

        assert_eq!(
            require_role(&caller, &members).unwrap_err(),
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
        members.push_back(other.clone());

        assert_eq!(
            require_role(&caller, &members).unwrap_err(),
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

        assert!(require_role(&caller, &members).is_ok());
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
        assert!(require_admin(&admin, &admin).is_ok());
    }

    #[test]
    fn require_admin_caller_is_not_admin() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let other = Address::generate(&env);

        assert_eq!(
            require_admin(&other, &admin).unwrap_err(),
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
}
