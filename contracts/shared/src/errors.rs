//! Shared error types for all contracts (issue #1835)
//!
//! Re-exports `ContractError` from the `bluecollar-types` crate as the single
//! canonical error enum for the entire workspace. All contracts under
//! `contracts/` and `packages/contracts/contracts/` should use
//! `bluecollar_shared::ContractError` (or `bluecollar_types::ContractError`
//! directly) rather than defining their own error enums.
//!
//! The previous `CommonError` enum defined in this module has been removed.
//! Contracts that referenced `CommonError` should migrate to `ContractError`:
//!
//! | Old (`CommonError`)      | New (`ContractError`)          |
//! |--------------------------|-------------------------------|
//! | `Unauthorized`           | `NotAuthorized`               |
//! | `InvalidAmount`          | `AmountMustBePositive`        |
//! | `InsufficientBalance`    | `InsufficientBalance`         |
//! | `Overflow`               | `ArithmeticOverflow`          |
//! | `InvalidAddress`         | `InvalidAddress`              |

pub use bluecollar_types::ContractError;
