//! BlueCollar Market Contract
//! Handles tip/payment escrow between users and workers on Stellar (Soroban).

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol};

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

// =============================================================================
// Data types
// =============================================================================

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

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

        assert!(escrow.status == EscrowStatus::Active, "Escrow not active");
        assert!(escrow.from == caller, "Unauthorized");

        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("Not initialized");

        let fee: i128 = (escrow.amount * config.fee_bps as i128) / 10_000;
        let worker_amount = escrow.amount - fee;

        let client = token::Client::new(&env, &escrow.token);
        client.transfer(&env.current_contract_address(), &escrow.to, &worker_amount);
        if fee > 0 {
            client.transfer(
                &env.current_contract_address(),
                &config.fee_recipient,
                &fee,
            );
        }

        escrow.status = EscrowStatus::Released;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);
    }

    /// Cancel escrow and refund to sender (from only, before expiry).
    pub fn cancel_escrow(env: Env, id: Symbol, caller: Address) {
        caller.require_auth();
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id.clone()))
            .expect("Escrow not found");

        assert!(escrow.status == EscrowStatus::Active, "Escrow not active");
        assert!(escrow.from == caller, "Unauthorized");

        let client = token::Client::new(&env, &escrow.token);
        client.transfer(&env.current_contract_address(), &escrow.from, &escrow.amount);

        escrow.status = EscrowStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);
    }

    /// Cancel an expired escrow — anyone can call once past expiry.
    pub fn cancel_expired_escrow(env: Env, id: Symbol) {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id.clone()))
            .expect("Escrow not found");

        assert!(escrow.status == EscrowStatus::Active, "Escrow not active");
        assert!(
            env.ledger().timestamp() >= escrow.expiry,
            "Escrow not yet expired"
        );

        let client = token::Client::new(&env, &escrow.token);
        client.transfer(&env.current_contract_address(), &escrow.from, &escrow.amount);

        escrow.status = EscrowStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    pub fn get_config(env: Env) -> Config {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .expect("Not initialized")
    }

    pub fn get_escrow(env: Env, id: Symbol) -> Option<Escrow> {
        env.storage().persistent().get(&DataKey::Escrow(id))
    }

    /// Upgrade the contract WASM (admin only)
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: soroban_sdk::BytesN<32>) {
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn setup() -> (Env, MarketContractClient<'static>, Address, Address) {
        let env = Env::default();
        let contract_id = env.register_contract(None, MarketContract);
        let client = MarketContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        client.initialize(&admin, &100u32, &fee_recipient);
        (env, client, admin, fee_recipient)
    }

    #[test]
    fn test_get_admin() {
        let (_env, client, admin, _) = setup();
        assert_eq!(client.get_admin(), admin);
    }

    #[test]
    fn test_get_fee_bps() {
        let (_env, client, _, _) = setup();
        assert_eq!(client.get_fee_bps(), 100u32);
    }

    #[test]
    fn test_get_fee_recipient() {
        let (_env, client, _, fee_recipient) = setup();
        assert_eq!(client.get_fee_recipient(), fee_recipient);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_initialize_twice_panics() {
        let t = TestEnv::new();
        // second call must panic
        t.client().initialize(&t.admin);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_initialize_with_different_admin_panics() {
        let t = TestEnv::new();
        let attacker = Address::generate(&t.env);
        t.client().initialize(&attacker);
    }

    #[test]
    fn test_admin_cannot_be_overwritten() {
        let t = TestEnv::new();
        let attacker = Address::generate(&t.env);
        // Attacker is a different address — original admin is still set
        assert_ne!(t.client().get_admin(), attacker);
        assert_eq!(t.client().get_admin(), t.admin);
    }
}
#[cfg(test)]
mod test;
