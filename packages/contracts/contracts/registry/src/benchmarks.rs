//! # Registry Contract â€” Benchmark Harness
//!
//! Measures CPU instruction cost and memory byte cost for the key
//! operations in the Registry contract using the Soroban test environment's
//! built-in budget.
//!
//! Run with:
//! ```
//! cd packages/contracts
//! cargo test -p bluecollar-registry benchmarks -- --nocapture
//! ```

#[cfg(test)]
mod benchmarks {
    extern crate std;

    use crate::{RegistryContract, ROLE_CURATOR_MGR, ROLE_PAUSER, ROLE_REP_MGR, ROLE_UPGRADER};
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::StellarAssetClient,
        Address, BytesN, Env, String, Symbol,
    };

    /// Shared test harness for all registry benchmarks.
    struct BenchEnv {
        env: Env,
        contract_id: Address,
        admin: Address,
        curator: Address,
        owner: Address,
    }

    impl BenchEnv {
        fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let curator = Address::generate(&env);
            let owner = Address::generate(&env);

            let contract_id = env.register_contract(None, RegistryContract);
            let client = crate::RegistryContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_CURATOR_MGR), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_UPGRADER), &admin);
            client.add_curator(&admin, &curator);

            BenchEnv { env, contract_id, admin, curator, owner }
        }

        fn client(&self) -> crate::RegistryContractClient {
            crate::RegistryContractClient::new(&self.env, &self.contract_id)
        }

        fn zero_hash(&self) -> BytesN<32> {
            BytesN::from_array(&self.env, &[0u8; 32])
        }

        fn register_one(&self, id_str: &str) {
            self.client().register(
                &Symbol::new(&self.env, id_str),
                &self.owner,
                &String::from_str(&self.env, "Worker"),
                &Symbol::new(&self.env, "plumber"),
                &self.zero_hash(),
                &self.zero_hash(),
                &self.curator,
            );
        }
    }

    // -------------------------------------------------------------------------
    // Benchmark: register (single worker â€” the "mint" equivalent)
    // -------------------------------------------------------------------------

    #[test]
    fn bench_register_single() {
        let b = BenchEnv::new();

        b.env.budget().reset_unlimited();

        b.register_one("w1");

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] registry::register(1 worker)  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: batch_register (10 workers)
    // -------------------------------------------------------------------------

    #[test]
    fn bench_batch_register_10() {
        let b = BenchEnv::new();

        let mut ids = soroban_sdk::Vec::new(&b.env);
        let mut owners = soroban_sdk::Vec::new(&b.env);
        let mut names = soroban_sdk::Vec::new(&b.env);
        let mut cats = soroban_sdk::Vec::new(&b.env);
        let mut hashes: soroban_sdk::Vec<BytesN<32>> = soroban_sdk::Vec::new(&b.env);

        for i in 0..10u32 {
            let id_str = std::format!("bw{i}");
            ids.push_back(Symbol::new(&b.env, &id_str));
            owners.push_back(b.owner.clone());
            names.push_back(String::from_str(&b.env, "Worker"));
            cats.push_back(Symbol::new(&b.env, "plumber"));
            hashes.push_back(b.zero_hash());
        }

        b.env.budget().reset_unlimited();

        b.client().batch_register(
            &b.curator,
            &ids,
            &owners,
            &names,
            &cats,
            &hashes,
            &hashes,
        );

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] registry::batch_register(10 workers)  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: toggle (transfer-equivalent state update)
    // -------------------------------------------------------------------------

    #[test]
    fn bench_toggle() {
        let b = BenchEnv::new();
        b.register_one("tw1");

        b.env.budget().reset_unlimited();

        b.client().toggle(&Symbol::new(&b.env, "tw1"), &b.owner);

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] registry::toggle  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: update_reputation
    // -------------------------------------------------------------------------

    #[test]
    fn bench_update_reputation() {
        let b = BenchEnv::new();
        b.register_one("rw1");

        b.env.budget().reset_unlimited();

        b.client().update_reputation(
            &b.admin,
            &Symbol::new(&b.env, "rw1"),
            &8500,
        );

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] registry::update_reputation  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: submit_review (updates reputation inputs + computes score)
    // -------------------------------------------------------------------------

    #[test]
    fn bench_submit_review() {
        let b = BenchEnv::new();
        b.register_one("rv1");
        let reviewer = Address::generate(&b.env);

        b.env.budget().reset_unlimited();

        b.client().submit_review(
            &reviewer,
            &Symbol::new(&b.env, "rv1"),
            &8000,
        );

        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] registry::submit_review  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: stake
    // -------------------------------------------------------------------------

    #[test]
    fn bench_stake() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let curator = Address::generate(&env);
        let owner = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&owner, &10_000_000);
        // Mint to contract for reward payouts
        let contract_id = env.register_contract(None, RegistryContract);
        StellarAssetClient::new(&env, &token_addr).mint(&contract_id, &10_000_000);

        let client = crate::RegistryContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.grant_role(&admin, &Symbol::new(&env, ROLE_CURATOR_MGR), &admin);
        client.add_curator(&admin, &curator);

        let worker_id = Symbol::new(&env, "sw1");
        client.register(
            &worker_id,
            &owner,
            &String::from_str(&env, "Worker"),
            &Symbol::new(&env, "plumber"),
            &BytesN::from_array(&env, &[0u8; 32]),
            &BytesN::from_array(&env, &[0u8; 32]),
            &curator,
        );

        {
            let mut info = env.ledger().get();
            info.timestamp = 1000;
            env.ledger().set(info);
        }

        env.budget().reset_unlimited();

        client.stake(&owner, &worker_id, &token_addr, &500_000);

        let cpu = env.budget().cpu_instruction_cost();
        let mem = env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] registry::stake  cpu={} instructions  mem={} bytes",
            cpu, mem
        );
    }
}
