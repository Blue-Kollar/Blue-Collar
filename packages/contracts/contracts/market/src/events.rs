//! Market contract events using modern `#[contractevent]` macro approach.
//!
//! These events replace the deprecated `env.events().publish()` calls with
//! statically typed event structs for better performance and smaller WASM size.

use soroban_sdk::{contractevent, Address, Symbol};

#[contractevent]
pub struct RoleGranted {
    pub role: Symbol,
    pub admin: Address,
}

#[contractevent]
pub struct RoleRevoked {
    pub role: Symbol,
    pub account: Address,
}

#[contractevent]
pub struct TreasurySet {
    pub caller: Address,
    pub new_treasury: Address,
}

#[contractevent]
pub struct ContractPaused {
    pub admin: Address,
}

#[contractevent]
pub struct ContractUnpaused {
    pub admin: Address,
}

#[contractevent]
pub struct FeeTaken {
    pub recipient: Address,
    pub amount: i128,
}

#[contractevent]
pub struct TipSent {
    pub from: Address,
    pub to: Address,
    pub token: Address,
    pub amount: i128,
}

#[contractevent]
pub struct EscrowCreated {
    pub id: Symbol,
    pub from: Address,
    pub to: Address,
    pub token: Address,
    pub amount: i128,
    pub expiry_ledger: u32,
}

#[contractevent]
pub struct EscrowReleased {
    pub id: Symbol,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct EscrowCancelled {
    pub id: Symbol,
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
pub struct EscrowExpired {
    pub id: Symbol,
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
pub struct MultiSigEscrowCreated {
    pub id: Symbol,
    pub from: Address,
    pub to: Address,
    pub token: Address,
    pub amount: i128,
    pub expiry_ledger: u32,
    pub threshold: u32,
}

#[contractevent]
pub struct MultiSigEscrowApproval {
    pub id: Symbol,
    pub caller: Address,
    pub approval_count: u32,
}

#[contractevent]
pub struct MultiSigEscrowReleased {
    pub id: Symbol,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct MultiSigEscrowCancelled {
    pub id: Symbol,
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
pub struct ArbitrationRequested {
    pub escrow_id: Symbol,
    pub requester: Address,
    pub arbitrator: Address,
    pub fee: i128,
}

#[contractevent]
pub struct MultisigArbitrationRequested {
    pub escrow_id: Symbol,
    pub requester: Address,
    pub arbitrator: Address,
    pub fee: i128,
}

#[contractevent]
pub struct ArbitratorAdded {
    pub admin: Address,
    pub arbitrator: Address,
}

#[contractevent]
pub struct ArbitratorRemoved {
    pub admin: Address,
    pub arbitrator: Address,
}

#[contractevent]
pub struct ArbitrationResolved {
    pub id: Symbol,
    pub arbitrator: Address,
    pub winner: Address,
    pub amount: i128,
}

#[contractevent]
pub struct MultisigArbitrationResolved {
    pub id: Symbol,
    pub arbitrator: Address,
    pub winner: Address,
    pub amount: i128,
}

#[contractevent]
pub struct ContractUpgraded {
    pub admin: Address,
    pub new_wasm_hash: soroban_sdk::BytesN<32>,
    pub version: u32,
}