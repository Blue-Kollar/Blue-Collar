//! BlueCollar Market Contract
//! Handles tip/payment escrow between users and workers on Stellar (Soroban).

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub struct Escrow {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub token: Address,
    /// Unix timestamp (seconds) after which the payer may cancel
    pub expiry: u64,
    pub released: bool,
    pub cancelled: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    pub fee_bps: u32,
    pub fee_recipient: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    pub fee_bps: u32,
    pub fee_recipient: Address,
}

#[contracttype]
pub enum DataKey {
    Escrow(Symbol),
    /// Instance storage — admin address, set once at initialize
    Admin,
    Tip(Symbol),
    Admin,
    FeeBps,
    FeeRecipient,
    Escrow(Symbol),
    Config,
}

// ---------------------------------------------------------------------------
// Escrow state
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum EscrowStatus {
    Active,
    Released,
    Cancelled,
}

// =============================================================================
// Contract
// =============================================================================
#[contracttype]
#[derive(Clone)]
pub struct Escrow {
    pub from: Address,
    pub to: Address,
    pub token: Address,
    pub amount: i128,
    pub expiry: u64,
    pub status: EscrowStatus,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/// Maximum fee: 5% = 500 bps
pub const MAX_FEE_BPS: u32 = 500;

#[contract]
pub struct MarketContract;

#[contractimpl]
impl MarketContract {
    // -------------------------------------------------------------------------
    // Tip
    // -------------------------------------------------------------------------

    /// Send a direct tip to a worker — transfers tokens immediately.
    /// Emits: TipSent
    /// Initialise the contract — sets admin, fee basis points, and fee recipient
    pub fn initialize(env: Env, admin: Address, fee_bps: u32, fee_recipient: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::Admin),
            "Already initialized"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::FeeRecipient, &fee_recipient);
    }

    /// Return the admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).expect("Not initialized")
    }

    /// Return the fee in basis points (e.g. 100 = 1%)
    pub fn get_fee_bps(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::FeeBps).expect("Not initialized")
    }

    /// Return the address that receives collected fees
    pub fn get_fee_recipient(env: Env) -> Address {
        env.storage().instance().get(&DataKey::FeeRecipient).expect("Not initialized")
    }

    /// Send a tip to a worker — transfers tokens directly
    // -----------------------------------------------------------------------
    // Initialise
    // -----------------------------------------------------------------------

    /// Initialise the contract with an admin, fee in basis points, and fee recipient.
    /// Must be called once before any other function.
    pub fn initialize(env: Env, admin: Address, fee_bps: u32, fee_recipient: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::Config),
            "Already initialized"
        );
        assert!(fee_bps <= MAX_FEE_BPS, "fee_bps exceeds maximum (500)");
        let config = Config {
            admin,
            fee_bps,
            fee_recipient,
        };
        env.storage().instance().set(&DataKey::Config, &config);
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Update the protocol fee (admin only, capped at 500 bps / 5%).
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

    // -----------------------------------------------------------------------
    // Tip
    // -----------------------------------------------------------------------

    /// Send a tip to a worker.
    /// Deducts a protocol fee (fee_bps) and transfers the remainder to `to`.
    pub fn tip(env: Env, from: Address, to: Address, token_addr: Address, amount: i128) {
        from.require_auth();
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
    }

    // -----------------------------------------------------------------------
    // Escrow
    // -----------------------------------------------------------------------

    /// Create an escrow — locks tokens until released, cancelled, or expired.
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

        assert!(amount > 0, "Amount must be positive");
        assert!(
            !env.storage().persistent().has(&DataKey::Escrow(id.clone())),
            "Escrow id already exists"
        );
        assert!(amount > 0, "Amount must be positive");

        let contract_addr = env.current_contract_address();
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&from, &contract_addr, &amount);

        let escrow = Escrow {
            from: from.clone(),
            to: to.clone(),
            amount,
            token: token_addr.clone(),
            expiry,
            released: false,
            cancelled: false,
        };
        env.storage().persistent().set(&DataKey::Escrow(id.clone()), &escrow);

        // topics: ("EscCrt", id, from)  data: (to, token_addr, amount, expiry)
        env.events().publish(
            (symbol_short!("EscCrt"), id, from),
            (to, token_addr, amount, expiry),
        );
    }

    /// Release escrowed funds to the worker.
    ///
    /// Callable by either `from` (payer approves) or `to` (worker claims).
    ///
    /// Emits: EscrowReleased

        let client = token::Client::new(&env, &token_addr);
        client.transfer(&from, &env.current_contract_address(), &amount);

        let escrow = Escrow {
            from,
            to,
            token: token_addr,
            amount,
            expiry,
            status: EscrowStatus::Active,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);
    }

    /// Release escrow funds to the worker (from only).
    pub fn release_escrow(env: Env, id: Symbol, caller: Address) {
        caller.require_auth();
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

        // topics: ("EscRel", id, escrow.to)  data: escrow.amount
        env.events().publish(
            (symbol_short!("EscRel"), id, escrow.to),
            escrow.amount,
        );
    }

    /// Cancel escrow and refund the payer.
    ///
    /// Only callable by `from` (the payer), and only after `expiry` has passed.
    ///
    /// Emits: EscrowCancelled
    pub fn cancel_escrow(env: Env, id: Symbol, caller: Address) {
        caller.require_auth();
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

        // topics: ("EscCnl", id, escrow.from)  data: escrow.amount
        env.events().publish(
            (symbol_short!("EscCnl"), id, escrow.from),
            escrow.amount,
        );
    }

    /// Fetch escrow details by id.
    pub fn get_escrow(env: Env, id: Symbol) -> Option<Escrow> {
        env.storage().persistent().get(&DataKey::Escrow(id))
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
        Address, Env, Symbol,
    };

    struct TestEnv {
        env: Env,
        contract_id: Address,
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

            TestEnv { env, contract_id, payer, worker, token_addr }
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

    // -------------------------------------------------------------------------
    // tip
    // -------------------------------------------------------------------------

    #[test]
    fn test_tip_transfers_tokens() {
        let t = TestEnv::new();
        t.client().tip(&t.payer, &t.worker, &t.token_addr, &500_000);
        assert_eq!(t.token_balance(&t.worker), 500_000);
        assert_eq!(t.token_balance(&t.payer), 500_000);
    }

    // -------------------------------------------------------------------------
    // create_escrow
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // release_escrow
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // cancel_escrow
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // get_escrow
    // -------------------------------------------------------------------------

    #[test]
    fn test_get_escrow_nonexistent_returns_none() {
        let t = TestEnv::new();
        let id = Symbol::new(&t.env, "nope");
        assert!(t.client().get_escrow(&id).is_none());
    }
}
#[cfg(test)]
mod test;
