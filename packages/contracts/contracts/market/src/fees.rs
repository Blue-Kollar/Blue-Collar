//! Fee calculation helpers for the BlueCollar Market contract.
//!
//! The canonical implementation lives in [`bluecollar_types::helpers::split_fee`].
//! This module re-exports it for backward compatibility so that existing call-sites
//! inside the market crate (`use fees::split_fee`) do not need to change.

pub use bluecollar_types::helpers::split_fee;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_fee_zero_bps() {
        let (fee, net) = split_fee(100_000, 0);
        assert_eq!(fee, 0);
        assert_eq!(net, 100_000);
    }

    #[test]
    fn test_split_fee_100_bps() {
        let (fee, net) = split_fee(100_000, 100);
        assert_eq!(fee, 1_000);
        assert_eq!(net, 99_000);
    }

    #[test]
    fn test_split_fee_500_bps() {
        // max fee = 5%
        let (fee, net) = split_fee(100_000, 500);
        assert_eq!(fee, 5_000);
        assert_eq!(net, 95_000);
    }

    #[test]
    fn test_split_fee_rounds_down() {
        // 1 token with 100 bps → fee = 0 (rounds toward zero)
        let (fee, net) = split_fee(1, 100);
        assert_eq!(fee, 0);
        assert_eq!(net, 1);
    }

    #[test]
    fn test_split_fee_amounts_sum_to_original() {
        for bps in [0u32, 50, 100, 250, 500] {
            let amount = 999_999i128;
            let (fee, net) = split_fee(amount, bps);
            assert_eq!(fee + net, amount);
        }
    }
}
