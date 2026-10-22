//! Market contract events — re-exported from the shared `bluecollar_types` crate.
//!
//! All event struct definitions live in `bluecollar_types::events` so that
//! every contract and every indexer can rely on the same layout. Import from
//! here within the market crate for convenience.

pub use bluecollar_types::events::{
    ArbitrationRequested, ArbitrationResolved, ArbitratorAdded, ArbitratorRemoved,
    ContractPaused, ContractUnpaused, ContractUpgraded, EscrowCancelled, EscrowCreated,
    EscrowExpired, EscrowReleased, FeeTaken, MultiSigEscrowApproval, MultiSigEscrowCancelled,
    MultiSigEscrowCreated, MultiSigEscrowReleased, MultisigArbitrationRequested,
    MultisigArbitrationResolved, RoleGranted, RoleRevoked, TipSent, TreasurySet,
};
