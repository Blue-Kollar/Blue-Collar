//! # BlueCollar Market Contract
//!
//! Deployed on Stellar (Soroban), this contract handles token transfers between
//! users and workers in the BlueCollar protocol. It supports two payment modes:
//!
//! - **Direct tips** via [`tip`]: Immediate token transfer with an optional protocol fee.
//! - **Escrow payments** via [`create_escrow`] / [`release_escrow`] / [`cancel_escrow`]:
//!   Funds are locked until the payer approves release or the escrow expires.
//!
//! ## Access Control
//! - **Admin**: Set once at [`initialize`]. Can update the protocol fee and upgrade the contract.
//! - **Payer (`from`)**: Creates and can release or cancel (after expiry) an escrow.
//! - **Worker (`to`)**: Can also release an escrow to claim funds.
//!
//! ## Fee Model
//! A protocol fee in basis points (`fee_bps`) is deducted from each tip.
//! The fee is capped at [`MAX_FEE_BPS`] (500 bps = 5%).
//! Fees are sent to the `fee_recipient` address configured at initialisation.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol, Vec};

/// Maximum allowed protocol fee: 500 bps = 5%.
pub const MAX_FEE_BPS: u32 = 500;

// =============================================================================
// Types
// =============================================================================

/// Protocol configuration stored in instance storage.
#[contracttype]
#[derive(Clone)]
pub struct Config {
    /// The admin address — can update fees and upgrade the contract.
    pub admin: Address,
    /// Protocol fee in basis points (e.g. 100 = 1%). Capped at [`MAX_FEE_BPS`].
    pub fee_bps: u32,
    /// Address that receives collected protocol fees.
    pub fee_recipient: Address,
}

/// Escrow state stored in persistent storage, keyed by a caller-supplied [`Symbol`] id.
#[contracttype]
#[derive(Clone)]
pub struct Escrow {
    /// Address that funded the escrow (the payer).
    pub from: Address,
    /// Address that will receive the funds on release (the worker).
    pub to: Address,
    /// Token contract address (e.g. XLM or a custom Stellar asset).
    pub token: Address,
    /// Locked amount in the token's smallest unit.
    pub amount: i128,
    /// Unix timestamp (seconds) after which the payer may cancel.
    pub expiry: u64,
    /// `true` once funds have been released to `to`.
    pub released: bool,
    /// `true` once funds have been refunded to `from`.
    pub cancelled: bool,
}

/// Storage keys used throughout the contract.
#[contracttype]
pub enum DataKey {
    /// Instance storage — [`Config`] struct, set once at [`MarketContract::initialize`].
    Config,
    /// Instance storage — paused flag; when `true` all state-mutating functions revert.
    Paused,
    /// Persistent storage — [`Escrow`] struct keyed by a caller-supplied id [`Symbol`].
    Escrow(Symbol),
    /// Persistent storage — [`MilestoneEscrow`] struct keyed by a caller-supplied id [`Symbol`].
    MilestoneEscrow(Symbol),
}

/// A single milestone within a [`MilestoneEscrow`].
#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    /// Amount to release to the worker when this milestone is completed.
    pub amount: i128,
    /// `true` once the payer has approved completion and funds have been released.
    pub completed: bool,
    /// `true` if this milestone is under dispute.
    pub disputed: bool,
}

/// Multi-milestone escrow stored in persistent storage.
///
/// The total locked amount equals the sum of all milestone amounts.
/// Each milestone is released independently via [`MarketContract::complete_milestone`].
#[contracttype]
#[derive(Clone)]
pub struct MilestoneEscrow {
    /// Address that funded the escrow (the payer).
    pub from: Address,
    /// Address that will receive funds as milestones are completed (the worker).
    pub to: Address,
    /// Token contract address.
    pub token: Address,
    /// Unix timestamp after which the payer may cancel any unreleased funds.
    pub expiry: u64,
    /// Ordered list of milestones.
    pub milestones: Vec<Milestone>,
    /// `true` once all milestones are completed or the escrow is cancelled.
    pub cancelled: bool,
}

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct MarketContract;

#[contractimpl]
impl MarketContract {
    // -------------------------------------------------------------------------
    // Initialise
    // -------------------------------------------------------------------------

    /// Initialise the contract with an admin, fee in basis points, and fee recipient.
    ///
    /// Must be called once before any other function.
    ///
    /// # Parameters
    /// - `admin`: Address that will have admin privileges.
    /// - `fee_bps`: Protocol fee in basis points (0–500). E.g. `100` = 1%.
    /// - `fee_recipient`: Address that receives collected fees.
    ///
    /// # Panics
    /// - `"Already initialized"` if called more than once.
    /// - `"fee_bps exceeds maximum (500)"` if `fee_bps > MAX_FEE_BPS`.
    pub fn initialize(env: Env, admin: Address, fee_bps: u32, fee_recipient: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::Config),
            "Already initialized"
        );
        assert!(fee_bps <= MAX_FEE_BPS, "fee_bps exceeds maximum (500)");
        let config = Config { admin, fee_bps, fee_recipient };
        env.storage().instance().set(&DataKey::Config, &config);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// Update the protocol fee (admin only, capped at [`MAX_FEE_BPS`]).
    ///
    /// # Parameters
    /// - `admin`: Must be the contract admin; `require_auth()` is enforced.
    /// - `new_fee_bps`: New fee in basis points (0–500).
    ///
    /// # Panics
    /// - `"fee_bps exceeds maximum (500)"` if `new_fee_bps > MAX_FEE_BPS`.
    /// - `"Unauthorized"` if `admin` does not match the stored admin.
    /// - `"Not initialized"` if [`initialize`] has not been called.
    pub fn update_fee(env: Env, admin: Address, new_fee_bps: u32) {
        admin.require_auth();
        assert!(new_fee_bps <= MAX_FEE_BPS, "fee_bps exceeds maximum (500)");
        let mut config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("Not initialized");
        assert!(config.admin == admin, "Unauthorized");
        config.fee_bps = new_fee_bps;
        env.storage().instance().set(&DataKey::Config, &config);
    }

    // -------------------------------------------------------------------------
    // Pause / Unpause (admin only)
    // -------------------------------------------------------------------------

    /// Assert that the contract is not paused.
    ///
    /// # Panics
    /// Panics with `"Contract is paused"` if the paused flag is set.
    fn require_not_paused(env: &Env) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        assert!(!paused, "Contract is paused");
    }

    /// Pause the contract, blocking all state-mutating operations.
    ///
    /// # Parameters
    /// - `admin`: Must be the contract admin; `require_auth()` is enforced.
    ///
    /// # Panics
    /// - `"Not initialized"` if [`initialize`] has not been called.
    /// - `"Unauthorized"` if `admin` does not match the stored admin.
    ///
    /// # Events
    /// Emits `("Paused", admin)`.
    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("Not initialized");
        assert!(config.admin == admin, "Unauthorized");
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("Paused"), admin), ());
    }

    /// Unpause the contract, re-enabling all state-mutating operations.
    ///
    /// # Parameters
    /// - `admin`: Must be the contract admin; `require_auth()` is enforced.
    ///
    /// # Panics
    /// - `"Not initialized"` if [`initialize`] has not been called.
    /// - `"Unauthorized"` if `admin` does not match the stored admin.
    ///
    /// # Events
    /// Emits `("Unpaused", admin)`.
    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("Not initialized");
        assert!(config.admin == admin, "Unauthorized");
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish((symbol_short!("Unpaused"), admin), ());
    }

    /// Returns `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    // -------------------------------------------------------------------------
    // Tip
    // -------------------------------------------------------------------------

    /// Send a direct tip to a worker.
    ///
    /// Deducts the protocol fee (`fee_bps`) from `amount` and transfers the remainder
    /// to `to`. If `fee_bps` is 0, the full amount goes to `to`.
    ///
    /// # Parameters
    /// - `from`: Payer address; `require_auth()` is enforced.
    /// - `to`: Worker address that receives the tip.
    /// - `token_addr`: The Stellar token contract address.
    /// - `amount`: Total amount to send (in the token's smallest unit).
    ///
    /// # Panics
    /// - `"Amount must be positive"` if `amount <= 0`.
    /// - `"Not initialized"` if [`initialize`] has not been called.
    ///
    /// # Events
    /// Emits `("TipSent", from, to)` with data `(token_addr, amount)`.
    pub fn tip(env: Env, from: Address, to: Address, token_addr: Address, amount: i128) {
        from.require_auth();
        Self::require_not_paused(&env);
        assert!(amount > 0, "Amount must be positive");

        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("Not initialized");

        let client = token::Client::new(&env, &token_addr);

        let fee: i128 = (amount * config.fee_bps as i128) / 10_000;
        let worker_amount = amount - fee;

        client.transfer(&from, &to, &worker_amount);
        if fee > 0 {
            client.transfer(&from, &config.fee_recipient, &fee);
        }

        env.events().publish(
            (symbol_short!("TipSent"), from, to),
            (token_addr, amount),
        );
    }

    // -------------------------------------------------------------------------
    // Escrow
    // -------------------------------------------------------------------------

    /// Create an escrow — locks tokens in the contract until released, cancelled, or expired.
    ///
    /// Transfers `amount` tokens from `from` to the contract address immediately.
    ///
    /// # Parameters
    /// - `id`: Caller-supplied unique identifier for this escrow.
    /// - `from`: Payer address; `require_auth()` is enforced.
    /// - `to`: Worker address that will receive funds on release.
    /// - `token_addr`: The Stellar token contract address.
    /// - `amount`: Amount to lock (must be > 0).
    /// - `expiry`: Unix timestamp after which `from` may cancel and reclaim funds.
    ///
    /// # Panics
    /// - `"Amount must be positive"` if `amount <= 0`.
    /// - `"Escrow id already exists"` if an escrow with the same `id` already exists.
    ///
    /// # Events
    /// Emits `("EscCrt", id, from)` with data `(to, token_addr, amount, expiry)`.
    pub fn create_escrow(
        env: Env,
        id: Symbol,
        from: Address,
        to: Address,
        token_addr: Address,
        amount: i128,
        expiry: u64,
    ) {
        from.require_auth();
        Self::require_not_paused(&env);
        assert!(amount > 0, "Amount must be positive");
        assert!(
            !env.storage().persistent().has(&DataKey::Escrow(id.clone())),
            "Escrow id already exists"
        );

        let contract_addr = env.current_contract_address();
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&from, &contract_addr, &amount);

        let escrow = Escrow {
            from: from.clone(),
            to: to.clone(),
            token: token_addr.clone(),
            amount,
            expiry,
            released: false,
            cancelled: false,
        };
        env.storage().persistent().set(&DataKey::Escrow(id.clone()), &escrow);

        env.events().publish(
            (symbol_short!("EscCrt"), id, from),
            (to, token_addr, amount, expiry),
        );
    }

    /// Release escrowed funds to the worker.
    ///
    /// Callable by either `from` (payer approves) or `to` (worker claims).
    ///
    /// # Parameters
    /// - `id`: The escrow identifier.
    /// - `caller`: Must be either `from` or `to`; `require_auth()` is enforced.
    ///
    /// # Panics
    /// - `"Escrow not found"` if no escrow exists with the given `id`.
    /// - `"Not authorized"` if `caller` is neither `from` nor `to`.
    /// - `"Already released"` if the escrow has already been released.
    /// - `"Escrow cancelled"` if the escrow was previously cancelled.
    ///
    /// # Events
    /// Emits `("EscRel", id, escrow.to)` with data `escrow.amount`.
    pub fn release_escrow(env: Env, id: Symbol, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(&env);
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id.clone()))
            .expect("Escrow not found");

        assert!(
            escrow.from == caller || escrow.to == caller,
            "Not authorized"
        );
        assert!(!escrow.released, "Already released");
        assert!(!escrow.cancelled, "Escrow cancelled");

        let contract_addr = env.current_contract_address();
        let client = token::Client::new(&env, &escrow.token);
        client.transfer(&contract_addr, &escrow.to, &escrow.amount);

        escrow.released = true;
        env.storage().persistent().set(&DataKey::Escrow(id.clone()), &escrow);

        env.events().publish(
            (symbol_short!("EscRel"), id, escrow.to),
            escrow.amount,
        );
    }

    /// Cancel escrow and refund the payer.
    ///
    /// Only callable by `from` (the payer), and only after `expiry` has passed.
    ///
    /// # Parameters
    /// - `id`: The escrow identifier.
    /// - `caller`: Must be `from`; `require_auth()` is enforced.
    ///
    /// # Panics
    /// - `"Escrow not found"` if no escrow exists with the given `id`.
    /// - `"Not authorized"` if `caller` is not `from`.
    /// - `"Already released"` if the escrow has already been released.
    /// - `"Already cancelled"` if the escrow was already cancelled.
    /// - `"Escrow not yet expired"` if the current ledger timestamp is before `expiry`.
    ///
    /// # Events
    /// Emits `("EscCnl", id, escrow.from)` with data `escrow.amount`.
    pub fn cancel_escrow(env: Env, id: Symbol, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(&env);
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id.clone()))
            .expect("Escrow not found");

        assert!(escrow.from == caller, "Not authorized");
        assert!(!escrow.released, "Already released");
        assert!(!escrow.cancelled, "Already cancelled");

        let now = env.ledger().timestamp();
        assert!(now >= escrow.expiry, "Escrow not yet expired");

        let contract_addr = env.current_contract_address();
        let client = token::Client::new(&env, &escrow.token);
        client.transfer(&contract_addr, &escrow.from, &escrow.amount);

        escrow.cancelled = true;
        env.storage().persistent().set(&DataKey::Escrow(id.clone()), &escrow);

        env.events().publish(
            (symbol_short!("EscCnl"), id, escrow.from),
            escrow.amount,
        );
    }

    /// Fetch escrow details by id.
    ///
    /// # Parameters
    /// - `id`: The escrow identifier.
    ///
    /// # Returns
    /// `Some(Escrow)` if found, `None` otherwise.
    pub fn get_escrow(env: Env, id: Symbol) -> Option<Escrow> {
        env.storage().persistent().get(&DataKey::Escrow(id))
    }

    // -------------------------------------------------------------------------
    // Milestone Escrow
    // -------------------------------------------------------------------------

    /// Create a multi-milestone escrow, locking the total of all milestone amounts.
    ///
    /// # Parameters
    /// - `id`: Caller-supplied unique identifier.
    /// - `from`: Payer; `require_auth()` is enforced.
    /// - `to`: Worker that receives funds per milestone.
    /// - `token_addr`: Stellar token contract address.
    /// - `milestones`: Ordered vec of milestone amounts (each must be > 0).
    /// - `expiry`: Unix timestamp after which `from` may cancel remaining funds.
    ///
    /// # Panics
    /// - `"No milestones provided"` if `milestones` is empty.
    /// - `"Milestone amount must be positive"` if any amount <= 0.
    /// - `"Milestone escrow id already exists"` on duplicate id.
    /// - `"Contract is paused"` if paused.
    ///
    /// # Events
    /// Emits `("MilCrt", id, from)` with data `(to, token_addr, total_amount, expiry)`.
    pub fn create_milestone_escrow(
        env: Env,
        id: Symbol,
        from: Address,
        to: Address,
        token_addr: Address,
        milestone_amounts: Vec<i128>,
        expiry: u64,
    ) {
        from.require_auth();
        Self::require_not_paused(&env);

        assert!(!milestone_amounts.is_empty(), "No milestones provided");
        assert!(
            !env.storage().persistent().has(&DataKey::MilestoneEscrow(id.clone())),
            "Milestone escrow id already exists"
        );

        let mut total: i128 = 0;
        let mut milestones: Vec<Milestone> = Vec::new(&env);
        for amt in milestone_amounts.iter() {
            assert!(amt > 0, "Milestone amount must be positive");
            total += amt;
            milestones.push_back(Milestone { amount: amt, completed: false, disputed: false });
        }

        let contract_addr = env.current_contract_address();
        token::Client::new(&env, &token_addr).transfer(&from, &contract_addr, &total);

        let escrow = MilestoneEscrow {
            from: from.clone(),
            to: to.clone(),
            token: token_addr.clone(),
            expiry,
            milestones,
            cancelled: false,
        };
        env.storage().persistent().set(&DataKey::MilestoneEscrow(id.clone()), &escrow);

        env.events().publish(
            (symbol_short!("MilCrt"), id, from),
            (to, token_addr, total, expiry),
        );
    }

    /// Mark a milestone as complete and release its funds to the worker.
    ///
    /// Only the payer (`from`) may approve completion.
    ///
    /// # Parameters
    /// - `id`: The milestone escrow identifier.
    /// - `caller`: Must be `from`; `require_auth()` is enforced.
    /// - `milestone_index`: Zero-based index of the milestone to complete.
    ///
    /// # Panics
    /// - `"Milestone escrow not found"` if `id` does not exist.
    /// - `"Not authorized"` if `caller` is not `from`.
    /// - `"Escrow cancelled"` if the escrow was cancelled.
    /// - `"Invalid milestone index"` if index is out of bounds.
    /// - `"Milestone already completed"` if already released.
    /// - `"Milestone is disputed"` if under active dispute.
    /// - `"Contract is paused"` if paused.
    ///
    /// # Events
    /// Emits `("MilCmp", id, milestone_index)` with data `amount`.
    pub fn complete_milestone(env: Env, id: Symbol, caller: Address, milestone_index: u32) {
        caller.require_auth();
        Self::require_not_paused(&env);

        let mut escrow: MilestoneEscrow = env
            .storage()
            .persistent()
            .get(&DataKey::MilestoneEscrow(id.clone()))
            .expect("Milestone escrow not found");

        assert!(escrow.from == caller, "Not authorized");
        assert!(!escrow.cancelled, "Escrow cancelled");
        assert!(milestone_index < escrow.milestones.len(), "Invalid milestone index");

        let mut milestone = escrow.milestones.get(milestone_index).unwrap();
        assert!(!milestone.completed, "Milestone already completed");
        assert!(!milestone.disputed, "Milestone is disputed");

        let amount = milestone.amount;
        milestone.completed = true;
        escrow.milestones.set(milestone_index, milestone);
        env.storage().persistent().set(&DataKey::MilestoneEscrow(id.clone()), &escrow);

        let contract_addr = env.current_contract_address();
        token::Client::new(&env, &escrow.token).transfer(&contract_addr, &escrow.to, &amount);

        env.events().publish(
            (symbol_short!("MilCmp"), id, milestone_index),
            amount,
        );
    }

    /// Raise a dispute on a specific milestone.
    ///
    /// Either `from` (payer) or `to` (worker) may open a dispute.
    ///
    /// # Parameters
    /// - `id`: The milestone escrow identifier.
    /// - `caller`: Must be `from` or `to`; `require_auth()` is enforced.
    /// - `milestone_index`: Zero-based index of the milestone to dispute.
    ///
    /// # Panics
    /// - `"Milestone escrow not found"` if `id` does not exist.
    /// - `"Not authorized"` if `caller` is neither `from` nor `to`.
    /// - `"Escrow cancelled"` if the escrow was cancelled.
    /// - `"Invalid milestone index"` if index is out of bounds.
    /// - `"Milestone already completed"` if already released.
    /// - `"Already disputed"` if already under dispute.
    /// - `"Contract is paused"` if paused.
    ///
    /// # Events
    /// Emits `("MilDsp", id, milestone_index)` with data `caller`.
    pub fn dispute_milestone(env: Env, id: Symbol, caller: Address, milestone_index: u32) {
        caller.require_auth();
        Self::require_not_paused(&env);

        let mut escrow: MilestoneEscrow = env
            .storage()
            .persistent()
            .get(&DataKey::MilestoneEscrow(id.clone()))
            .expect("Milestone escrow not found");

        assert!(
            escrow.from == caller || escrow.to == caller,
            "Not authorized"
        );
        assert!(!escrow.cancelled, "Escrow cancelled");
        assert!(milestone_index < escrow.milestones.len(), "Invalid milestone index");

        let mut milestone = escrow.milestones.get(milestone_index).unwrap();
        assert!(!milestone.completed, "Milestone already completed");
        assert!(!milestone.disputed, "Already disputed");

        milestone.disputed = true;
        escrow.milestones.set(milestone_index, milestone);
        env.storage().persistent().set(&DataKey::MilestoneEscrow(id.clone()), &escrow);

        env.events().publish(
            (symbol_short!("MilDsp"), id, milestone_index),
            caller,
        );
    }

    /// Resolve a disputed milestone (admin only).
    ///
    /// Admin decides whether to release funds to the worker or refund the payer.
    ///
    /// # Parameters
    /// - `id`: The milestone escrow identifier.
    /// - `admin`: Must be the contract admin; `require_auth()` is enforced.
    /// - `milestone_index`: Zero-based index of the disputed milestone.
    /// - `release_to_worker`: `true` → pay worker; `false` → refund payer.
    ///
    /// # Panics
    /// - `"Milestone escrow not found"` if `id` does not exist.
    /// - `"Unauthorized"` if `admin` is not the stored admin.
    /// - `"Milestone not disputed"` if the milestone is not under dispute.
    /// - `"Contract is paused"` if paused.
    ///
    /// # Events
    /// Emits `("MilRes", id, milestone_index)` with data `release_to_worker`.
    pub fn resolve_milestone_dispute(
        env: Env,
        id: Symbol,
        admin: Address,
        milestone_index: u32,
        release_to_worker: bool,
    ) {
        admin.require_auth();
        Self::require_not_paused(&env);

        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("Not initialized");
        assert!(config.admin == admin, "Unauthorized");

        let mut escrow: MilestoneEscrow = env
            .storage()
            .persistent()
            .get(&DataKey::MilestoneEscrow(id.clone()))
            .expect("Milestone escrow not found");

        assert!(milestone_index < escrow.milestones.len(), "Invalid milestone index");

        let mut milestone = escrow.milestones.get(milestone_index).unwrap();
        assert!(milestone.disputed, "Milestone not disputed");

        let amount = milestone.amount;
        milestone.disputed = false;
        milestone.completed = true;
        escrow.milestones.set(milestone_index, milestone);
        env.storage().persistent().set(&DataKey::MilestoneEscrow(id.clone()), &escrow);

        let contract_addr = env.current_contract_address();
        let recipient = if release_to_worker { escrow.to.clone() } else { escrow.from.clone() };
        token::Client::new(&env, &escrow.token).transfer(&contract_addr, &recipient, &amount);

        env.events().publish(
            (symbol_short!("MilRes"), id, milestone_index),
            release_to_worker,
        );
    }

    /// Cancel a milestone escrow and refund all unreleased funds to the payer.
    ///
    /// Only callable by `from` after `expiry` has passed.
    ///
    /// # Parameters
    /// - `id`: The milestone escrow identifier.
    /// - `caller`: Must be `from`; `require_auth()` is enforced.
    ///
    /// # Panics
    /// - `"Milestone escrow not found"` if `id` does not exist.
    /// - `"Not authorized"` if `caller` is not `from`.
    /// - `"Already cancelled"` if already cancelled.
    /// - `"Escrow not yet expired"` if before `expiry`.
    /// - `"Contract is paused"` if paused.
    ///
    /// # Events
    /// Emits `("MilCnl", id, caller)` with data `refund_amount`.
    pub fn cancel_milestone_escrow(env: Env, id: Symbol, caller: Address) {
        caller.require_auth();
        Self::require_not_paused(&env);

        let mut escrow: MilestoneEscrow = env
            .storage()
            .persistent()
            .get(&DataKey::MilestoneEscrow(id.clone()))
            .expect("Milestone escrow not found");

        assert!(escrow.from == caller, "Not authorized");
        assert!(!escrow.cancelled, "Already cancelled");

        let now = env.ledger().timestamp();
        assert!(now >= escrow.expiry, "Escrow not yet expired");

        // Sum all unreleased (not completed) milestone amounts for refund.
        let mut refund: i128 = 0;
        for m in escrow.milestones.iter() {
            if !m.completed {
                refund += m.amount;
            }
        }

        escrow.cancelled = true;
        env.storage().persistent().set(&DataKey::MilestoneEscrow(id.clone()), &escrow);

        if refund > 0 {
            let contract_addr = env.current_contract_address();
            token::Client::new(&env, &escrow.token).transfer(&contract_addr, &escrow.from, &refund);
        }

        env.events().publish(
            (symbol_short!("MilCnl"), id, caller),
            refund,
        );
    }

    /// Fetch a milestone escrow by id.
    ///
    /// # Returns
    /// `Some(MilestoneEscrow)` if found, `None` otherwise.
    pub fn get_milestone_escrow(env: Env, id: Symbol) -> Option<MilestoneEscrow> {
        env.storage().persistent().get(&DataKey::MilestoneEscrow(id))
    }

    // -------------------------------------------------------------------------
    // Upgrade
    // -------------------------------------------------------------------------

    /// Upgrade the contract WASM in-place, preserving the contract ID and all storage.
    ///
    /// # Parameters
    /// - `admin`: Must be the contract admin; `require_auth()` is enforced.
    /// - `new_wasm_hash`: The hash returned by `stellar contract install` for the new WASM.
    ///
    /// # Panics
    /// - `"Not initialized"` if [`initialize`] has not been called.
    /// - `"Unauthorized"` if `admin` does not match the stored admin.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: soroban_sdk::BytesN<32>) {
        admin.require_auth();
        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("Not initialized");
        assert!(config.admin == admin, "Unauthorized");
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env, Symbol, Vec,
    };

    struct TestEnv {
        env: Env,
        contract_id: Address,
        admin: Address,
        payer: Address,
        worker: Address,
        token_addr: Address,
    }

    impl TestEnv {
        fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let payer = Address::generate(&env);
            let worker = Address::generate(&env);

            let token_id = env.register_stellar_asset_contract_v2(admin.clone());
            let token_addr = token_id.address();
            StellarAssetClient::new(&env, &token_addr).mint(&payer, &1_000_000);

            let contract_id = env.register_contract(None, MarketContract);
            MarketContractClient::new(&env, &contract_id).initialize(&admin, &0, &admin);

            TestEnv { env, contract_id, admin, payer, worker, token_addr }
        }

        fn client(&self) -> MarketContractClient {
            MarketContractClient::new(&self.env, &self.contract_id)
        }

        fn token_balance(&self, addr: &Address) -> i128 {
            TokenClient::new(&self.env, &self.token_addr).balance(addr)
        }

        fn id(&self) -> Symbol {
            Symbol::new(&self.env, "escrow1")
        }

        fn set_time(&self, ts: u64) {
            self.env.ledger().set(LedgerInfo {
                timestamp: ts,
                protocol_version: 22,
                sequence_number: 1,
                network_id: Default::default(),
                base_reserve: 10,
                min_temp_entry_ttl: 1,
                min_persistent_entry_ttl: 1,
                max_entry_ttl: 100_000,
            });
        }
    }

    #[test]
    fn test_tip_transfers_tokens() {
        let t = TestEnv::new();
        t.client().tip(&t.payer, &t.worker, &t.token_addr, &500_000);
        assert_eq!(t.token_balance(&t.worker), 500_000);
        assert_eq!(t.token_balance(&t.payer), 500_000);
    }

    #[test]
    fn test_create_escrow_locks_funds() {
        let t = TestEnv::new();
        let id = t.id();
        t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &9999);

        assert_eq!(t.token_balance(&t.payer), 700_000);
        assert_eq!(t.token_balance(&t.contract_id), 300_000);

        let escrow = t.client().get_escrow(&id).unwrap();
        assert_eq!(escrow.amount, 300_000);
        assert_eq!(escrow.expiry, 9999);
        assert!(!escrow.released);
        assert!(!escrow.cancelled);
    }

    #[test]
    #[should_panic(expected = "Escrow id already exists")]
    fn test_create_escrow_duplicate_id_panics() {
        let t = TestEnv::new();
        let id = t.id();
        t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &100_000, &9999);
        t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &100_000, &9999);
    }

    #[test]
    #[should_panic(expected = "Amount must be positive")]
    fn test_create_escrow_zero_amount_panics() {
        let t = TestEnv::new();
        let id = t.id();
        t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &0, &9999);
    }

    #[test]
    fn test_release_by_payer() {
        let t = TestEnv::new();
        let id = t.id();
        let client = t.client();
        client.create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &9999);
        client.release_escrow(&id, &t.payer);

        assert_eq!(t.token_balance(&t.worker), 300_000);
        assert_eq!(t.token_balance(&t.contract_id), 0);
        assert!(client.get_escrow(&id).unwrap().released);
    }

    #[test]
    fn test_release_by_worker() {
        let t = TestEnv::new();
        let id = t.id();
        let client = t.client();
        client.create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &9999);
        client.release_escrow(&id, &t.worker);

        assert_eq!(t.token_balance(&t.worker), 300_000);
        assert!(client.get_escrow(&id).unwrap().released);
    }

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn test_release_by_stranger_panics() {
        let t = TestEnv::new();
        let id = t.id();
        let stranger = Address::generate(&t.env);
        t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &9999);
        t.client().release_escrow(&id, &stranger);
    }

    #[test]
    #[should_panic(expected = "Already released")]
    fn test_release_twice_panics() {
        let t = TestEnv::new();
        let id = t.id();
        let client = t.client();
        client.create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &9999);
        client.release_escrow(&id, &t.payer);
        client.release_escrow(&id, &t.payer);
    }

    #[test]
    fn test_cancel_after_expiry_refunds_payer() {
        let t = TestEnv::new();
        let id = t.id();
        let client = t.client();

        t.set_time(1000);
        client.create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &2000);
        t.set_time(3000);
        client.cancel_escrow(&id, &t.payer);

        assert_eq!(t.token_balance(&t.payer), 1_000_000);
        assert_eq!(t.token_balance(&t.contract_id), 0);
        assert!(client.get_escrow(&id).unwrap().cancelled);
    }

    #[test]
    fn test_cancel_at_exact_expiry_succeeds() {
        let t = TestEnv::new();
        let id = t.id();
        let client = t.client();

        t.set_time(1000);
        client.create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &2000);
        t.set_time(2000);
        client.cancel_escrow(&id, &t.payer);

        assert!(client.get_escrow(&id).unwrap().cancelled);
    }

    #[test]
    #[should_panic(expected = "Escrow not yet expired")]
    fn test_cancel_before_expiry_panics() {
        let t = TestEnv::new();
        let id = t.id();

        t.set_time(500);
        t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &2000);
        t.client().cancel_escrow(&id, &t.payer);
    }

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn test_cancel_by_worker_panics() {
        let t = TestEnv::new();
        let id = t.id();

        t.set_time(5000);
        t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &2000);
        t.client().cancel_escrow(&id, &t.worker);
    }

    #[test]
    #[should_panic(expected = "Already cancelled")]
    fn test_cancel_twice_panics() {
        let t = TestEnv::new();
        let id = t.id();
        let client = t.client();

        t.set_time(5000);
        client.create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &2000);
        client.cancel_escrow(&id, &t.payer);
        client.cancel_escrow(&id, &t.payer);
    }

    #[test]
    #[should_panic(expected = "Escrow cancelled")]
    fn test_release_after_cancel_panics() {
        let t = TestEnv::new();
        let id = t.id();
        let client = t.client();

        t.set_time(5000);
        client.create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &2000);
        client.cancel_escrow(&id, &t.payer);
        client.release_escrow(&id, &t.payer);
    }

    #[test]
    fn test_get_escrow_nonexistent_returns_none() {
        let t = TestEnv::new();
        let id = Symbol::new(&t.env, "nope");
        assert!(t.client().get_escrow(&id).is_none());
    }

    // -------------------------------------------------------------------------
    // Milestone escrow tests
    // -------------------------------------------------------------------------

    fn milestone_id(t: &TestEnv) -> Symbol {
        Symbol::new(&t.env, "mil1")
    }

    fn two_milestones(t: &TestEnv) -> Vec<i128> {
        let mut v = Vec::new(&t.env);
        v.push_back(100_000_i128);
        v.push_back(200_000_i128);
        v
    }

    #[test]
    fn test_create_milestone_escrow_locks_total() {
        let t = TestEnv::new();
        let id = milestone_id(&t);
        t.client().create_milestone_escrow(&id, &t.payer, &t.worker, &t.token_addr, &two_milestones(&t), &9999);

        assert_eq!(t.token_balance(&t.payer), 700_000);
        assert_eq!(t.token_balance(&t.contract_id), 300_000);

        let esc = t.client().get_milestone_escrow(&id).unwrap();
        assert_eq!(esc.milestones.len(), 2);
        assert!(!esc.cancelled);
    }

    #[test]
    fn test_complete_milestone_releases_partial_funds() {
        let t = TestEnv::new();
        let id = milestone_id(&t);
        let client = t.client();
        client.create_milestone_escrow(&id, &t.payer, &t.worker, &t.token_addr, &two_milestones(&t), &9999);

        client.complete_milestone(&id, &t.payer, &0);
        assert_eq!(t.token_balance(&t.worker), 100_000);
        assert_eq!(t.token_balance(&t.contract_id), 200_000);

        let esc = client.get_milestone_escrow(&id).unwrap();
        assert!(esc.milestones.get(0).unwrap().completed);
        assert!(!esc.milestones.get(1).unwrap().completed);
    }

    #[test]
    fn test_complete_all_milestones() {
        let t = TestEnv::new();
        let id = milestone_id(&t);
        let client = t.client();
        client.create_milestone_escrow(&id, &t.payer, &t.worker, &t.token_addr, &two_milestones(&t), &9999);

        client.complete_milestone(&id, &t.payer, &0);
        client.complete_milestone(&id, &t.payer, &1);

        assert_eq!(t.token_balance(&t.worker), 300_000);
        assert_eq!(t.token_balance(&t.contract_id), 0);
    }

    #[test]
    #[should_panic(expected = "Milestone already completed")]
    fn test_complete_milestone_twice_panics() {
        let t = TestEnv::new();
        let id = milestone_id(&t);
        let client = t.client();
        client.create_milestone_escrow(&id, &t.payer, &t.worker, &t.token_addr, &two_milestones(&t), &9999);
        client.complete_milestone(&id, &t.payer, &0);
        client.complete_milestone(&id, &t.payer, &0);
    }

    #[test]
    fn test_dispute_milestone_blocks_completion() {
        let t = TestEnv::new();
        let id = milestone_id(&t);
        let client = t.client();
        client.create_milestone_escrow(&id, &t.payer, &t.worker, &t.token_addr, &two_milestones(&t), &9999);
        client.dispute_milestone(&id, &t.worker, &0);

        let esc = client.get_milestone_escrow(&id).unwrap();
        assert!(esc.milestones.get(0).unwrap().disputed);
    }

    #[test]
    #[should_panic(expected = "Milestone is disputed")]
    fn test_complete_disputed_milestone_panics() {
        let t = TestEnv::new();
        let id = milestone_id(&t);
        let client = t.client();
        client.create_milestone_escrow(&id, &t.payer, &t.worker, &t.token_addr, &two_milestones(&t), &9999);
        client.dispute_milestone(&id, &t.worker, &0);
        client.complete_milestone(&id, &t.payer, &0);
    }

    #[test]
    fn test_resolve_dispute_releases_to_worker() {
        let t = TestEnv::new();
        let id = milestone_id(&t);
        let client = t.client();
        client.create_milestone_escrow(&id, &t.payer, &t.worker, &t.token_addr, &two_milestones(&t), &9999);
        client.dispute_milestone(&id, &t.payer, &0);
        client.resolve_milestone_dispute(&id, &t.admin, &0, &true);

        assert_eq!(t.token_balance(&t.worker), 100_000);
        assert_eq!(t.token_balance(&t.contract_id), 200_000); // second milestone still locked
    }

    #[test]
    fn test_cancel_milestone_escrow_refunds_remaining() {
        let t = TestEnv::new();
        let id = milestone_id(&t);
        let client = t.client();

        t.set_time(1000);
        client.create_milestone_escrow(&id, &t.payer, &t.worker, &t.token_addr, &two_milestones(&t), &2000);
        // Complete first milestone
        client.complete_milestone(&id, &t.payer, &0);
        // Cancel after expiry — only second milestone (200_000) should be refunded
        t.set_time(3000);
        client.cancel_milestone_escrow(&id, &t.payer);

        assert_eq!(t.token_balance(&t.payer), 900_000); // 1_000_000 - 100_000 (worker kept)
        assert_eq!(t.token_balance(&t.contract_id), 0);
    }

    #[test]
    #[should_panic(expected = "Escrow not yet expired")]
    fn test_cancel_milestone_before_expiry_panics() {
        let t = TestEnv::new();
        let id = milestone_id(&t);
        t.set_time(500);
        t.client().create_milestone_escrow(&id, &t.payer, &t.worker, &t.token_addr, &two_milestones(&t), &2000);
        t.client().cancel_milestone_escrow(&id, &t.payer);
    }
}
