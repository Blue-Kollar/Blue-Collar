//! Property-based tests for the shared contract math helpers
//! [`bluecollar_types::helpers::split_fee`] and
//! [`bluecollar_types::helpers::bps_share`] (issue #1848).
//!
//! These exercise the fee-split invariants over randomized inputs to catch
//! edge cases (rounding dust, zero, bounds) that the fixed-value unit tests
//! in `src/helpers.rs` can miss.

use bluecollar_types::helpers::{bps_share, split_fee};
use bluecollar_types::ContractError;
use proptest::prelude::*;

/// Largest amount used by the property tests. Large enough to exercise
/// rounding dust, yet small enough that `amount * 10_000` never overflows
/// `i128`: `split_fee` therefore cannot panic on its `checked_mul` path and
/// `bps_share` stays in its `Ok` branch.
const MAX_AMOUNT: i128 = 10_000_000_000_000; // 1e13; *10_000 = 1e17 << i128::MAX

proptest! {
    /// `split_fee` partitions the amount exactly: `fee + net == amount`.
    #[test]
    fn split_fee_parts_sum_to_amount(
        amount in 0_i128..=MAX_AMOUNT,
        fee_bps in 0_u32..=10_000,
    ) {
        let (fee, net) = split_fee(amount, fee_bps);
        prop_assert_eq!(fee + net, amount, "fee + net must equal amount");
    }

    /// Both parts are non-negative and neither exceeds the amount
    /// (`fee_bps <= 10_000` implies `fee <= amount`).
    #[test]
    fn split_fee_parts_are_bounded_by_amount(
        amount in 0_i128..=MAX_AMOUNT,
        fee_bps in 0_u32..=10_000,
    ) {
        let (fee, net) = split_fee(amount, fee_bps);
        prop_assert!(fee >= 0, "fee must be non-negative");
        prop_assert!(net >= 0, "net must be non-negative");
        prop_assert!(fee <= amount, "fee must not exceed amount");
        prop_assert!(net <= amount, "net must not exceed amount");
    }

    /// `split_fee` floors toward zero: `fee == amount * fee_bps / 10_000`.
    #[test]
    fn split_fee_floors_toward_zero(
        amount in 0_i128..=MAX_AMOUNT,
        fee_bps in 0_u32..=10_000,
    ) {
        let (fee, _net) = split_fee(amount, fee_bps);
        let scaled = amount * i128::from(fee_bps);
        prop_assert!(fee * 10_000 <= scaled, "fee over the floor");
        prop_assert!((fee + 1) * 10_000 > scaled, "fee under the floor");
    }

    /// `bps_share` is the floor of `amount * bps / 10_000`.
    #[test]
    fn bps_share_floors_toward_zero(
        amount in 0_i128..=MAX_AMOUNT,
        bps in 0_u32..=10_000,
    ) {
        let share = bps_share(amount, bps).expect("bounded inputs must not overflow");
        let scaled = amount * i128::from(bps);
        prop_assert!(share * 10_000 <= scaled, "share over the floor");
        prop_assert!((share + 1) * 10_000 > scaled, "share under the floor");
    }

    /// A bps weight of at most 10_000 never pays out more than the amount.
    #[test]
    fn bps_share_never_exceeds_amount(
        amount in 0_i128..=MAX_AMOUNT,
        bps in 0_u32..=10_000,
    ) {
        let share = bps_share(amount, bps).unwrap();
        prop_assert!(share >= 0, "share must be non-negative");
        prop_assert!(share <= amount, "share must not exceed amount");
    }
}

/// Negative amounts are rejected with `ArithmeticOverflow` rather than
/// mis-priced — a deterministic guard kept outside the randomized cases.
#[test]
fn bps_share_rejects_negative_amount() {
    for amount in [-1_i128, -100, i128::MIN] {
        assert_eq!(bps_share(amount, 100), Err(ContractError::ArithmeticOverflow));
    }
}
