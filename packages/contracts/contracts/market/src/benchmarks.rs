//! # Market Contract â€” Benchmark Harness
//!
//! Measures CPU instruction cost and memory byte cost for the key
//! operations in the Market contract using the Soroban test environment's
//! built-in budget.
//!
//! Run with:
//! ```
//! cd packages/contracts
//! cargo test -p bluecollar-market benchmarks -- --nocapture
//! ```

#[cfg(test)]
mod benchmarks {
    extern crate std;

    use crate::MarketContract;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::StellarAssetClient,
        Address, Env, Symbol,
    };

    /// Shared test harness for all market benchmarks.
    struct BenchEnv {
        env: Env,
        contract_id: Address,
        admin: Address,
        payer: Address,
        worker: Address,
        token_addr: Address,
    }

    impl BenchEnv {
        fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let payer = Address::generate(&env);
            let worker = Address::generate(&env);

            let token_id = env.register_stellar_asset_contract_v2(admin.clone());
            let token_addr = token_id.address();

            // Mint generous balance to payer and contract (for reward payouts).
            StellarAssetClient::new(&env, &token_addr).mint(&payer, &100_000_000);

            let contract_id = env.register_contract(None, MarketContract);
            crate::MarketContractClient::new(&env, &contract_id)
                .initialize(&admin, &100, &admin);

            // Mint some tokens to the contract so it can pay out escrow releases.
            StellarAssetClient::new(&env, &token_addr)
                .mint(&contract_id, &100_000_000);

            BenchEnv { env, contract_id, admin, payer, worker, token_addr }
        }

        fn client(&self) -> crate::MarketContractClient {
            crate::MarketContractClient::new(&self.env, &self.contract_id)
        }

        fn set_time(&self, ts: u64) {
            let mut info = self.env.ledger().get();
            info.timestamp = ts;
            self.env.ledger().set(info);
        }
    }

    // -------------------------------------------------------------------------
    // Benchmark: tip
    // -------------------------------------------------------------------------

    #[test]
    fn bench_tip() {
        let b = BenchEnv::new();

        // Reset budget so only the tip call is measured.
        b.env.budget().reset_unlimited();

        b.client().tip(&b.payer, &b.worker, &b.token_addr, &1_000_000);

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] market::tip  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: create_escrow
    // -------------------------------------------------------------------------

    #[test]
    fn bench_create_escrow() {
        let b = BenchEnv::new();
        let id = Symbol::new(&b.env, "esc1");

        b.env.budget().reset_unlimited();

        b.client().create_escrow(
            &id,
            &b.payer,
            &b.worker,
            &b.token_addr,
            &1_000_000,
            &9_999_999,
        );

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] market::create_escrow  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: release_escrow
    // -------------------------------------------------------------------------

    #[test]
    fn bench_release_escrow() {
        let b = BenchEnv::new();
        let id = Symbol::new(&b.env, "esc2");

        // Setup: create the escrow first (not measured).
        b.client().create_escrow(
            &id,
            &b.payer,
            &b.worker,
            &b.token_addr,
            &1_000_000,
            &9_999_999,
        );

        // Now measure release only.
        b.env.budget().reset_unlimited();

        b.client().release_escrow(&id, &b.payer);

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] market::release_escrow  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: cancel_escrow (after expiry)
    // -------------------------------------------------------------------------

    #[test]
    fn bench_cancel_escrow() {
        let b = BenchEnv::new();
        let id = Symbol::new(&b.env, "esc3");

        b.set_time(1000);
        b.client().create_escrow(
            &id,
            &b.payer,
            &b.worker,
            &b.token_addr,
            &1_000_000,
            &2000,
        );

        b.set_time(3000);
        b.env.budget().reset_unlimited();

        b.client().cancel_escrow(&id, &b.payer);

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] market::cancel_escrow  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: create_multisig_escrow (2-of-2)
    // -------------------------------------------------------------------------

    #[test]
    fn bench_create_multisig_escrow() {
        let b = BenchEnv::new();
        let id = Symbol::new(&b.env, "ms1");
        let s1 = Address::generate(&b.env);
        let s2 = Address::generate(&b.env);
        let signers = soroban_sdk::vec![&b.env, s1, s2];

        b.env.budget().reset_unlimited();

        b.client().create_multisig_escrow(
            &id,
            &b.payer,
            &b.worker,
            &b.token_addr,
            &1_000_000,
            &9_999_999,
            &signers,
            &2,
        );

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] market::create_multisig_escrow(2-of-2)  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: approve_multisig_release (final approval that triggers transfer)
    // -------------------------------------------------------------------------

    #[test]
    fn bench_approve_multisig_release_final() {
        let b = BenchEnv::new();
        let id = Symbol::new(&b.env, "ms2");
        let s1 = Address::generate(&b.env);
        let signers = soroban_sdk::vec![&b.env, s1.clone()];

        b.client().create_multisig_escrow(
            &id,
            &b.payer,
            &b.worker,
            &b.token_addr,
            &1_000_000,
            &9_999_999,
            &signers,
            &1,
        );

        // Single approval = threshold met = fund transfer happens.
        b.env.budget().reset_unlimited();

        b.client().approve_multisig_release(&id, &s1);

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] market::approve_multisig_release(1-of-1, transfers)  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }
}
