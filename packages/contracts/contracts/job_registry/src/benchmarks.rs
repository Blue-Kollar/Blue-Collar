//! # Job-Registry — Benchmark Harness
//!
//! Measures CPU instruction cost and memory byte cost for the key entry
//! points of the job-registry contract using the Soroban test environment's
//! built-in budget (issue #1433 — storage/fee profiling).
//!
//! Run with:
//! ```text
//! cd packages/contracts
//! cargo test -p bluecollar-job-registry benchmarks -- --nocapture
//! ```

#[cfg(test)]
mod benchmarks {
    extern crate std;

    use crate::JobRegistryContract;
    use bluecollar_types::test_utils::zero_hash;
    use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

    /// Shared harness for job-registry benchmarks.
    struct BenchEnv {
        env: Env,
        contract_id: Address,
        poster: Address,
        worker: Address,
        token: Address,
    }

    impl BenchEnv {
        fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let poster = Address::generate(&env);
            let worker = Address::generate(&env);
            let token = Address::generate(&env);

            let contract_id = env.register_contract(None, JobRegistryContract);
            crate::JobRegistryContractClient::new(&env, &contract_id).initialize(&admin);

            BenchEnv {
                env,
                contract_id,
                poster,
                worker,
                token,
            }
        }

        fn client(&self) -> crate::JobRegistryContractClient {
            crate::JobRegistryContractClient::new(&self.env, &self.contract_id)
        }

        fn post(&self, n: u32) {
            self.client().post_job(
                &self.poster,
                &Symbol::new(&self.env, &std::format!("job{n}")),
                &Symbol::new(&self.env, "plumb"),
                &zero_hash(&self.env),
                &1_000,
                &self.token,
            );
        }
    }

    // -------------------------------------------------------------------------
    // Benchmark: post_job against an empty index
    // -------------------------------------------------------------------------

    #[test]
    fn bench_post_job_empty_index() {
        let b = BenchEnv::new();

        b.env.budget().reset_unlimited();
        b.post(0);
        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] job_registry::post_job (empty index)  cpu={} instructions  mem={} bytes",
            cpu,
            mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: post_job against a populated index (steady-state cost)
    // -------------------------------------------------------------------------

    #[test]
    fn bench_post_job_grown_index() {
        let b = BenchEnv::new();
        for n in 0..50 {
            b.post(n);
        }

        b.env.budget().reset_unlimited();
        b.post(50);
        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] job_registry::post_job (50 existing)  cpu={} instructions  mem={} bytes",
            cpu,
            mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: assign_worker
    // -------------------------------------------------------------------------

    #[test]
    fn bench_assign_worker() {
        let b = BenchEnv::new();
        b.post(0);
        let job_id = Symbol::new(&b.env, "job0");

        b.env.budget().reset_unlimited();
        b.client().assign_worker(&b.poster, &job_id, &b.worker);
        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] job_registry::assign_worker  cpu={} instructions  mem={} bytes",
            cpu,
            mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: complete_job
    // -------------------------------------------------------------------------

    #[test]
    fn bench_complete_job() {
        let b = BenchEnv::new();
        b.post(0);
        let job_id = Symbol::new(&b.env, "job0");
        b.client().assign_worker(&b.poster, &job_id, &b.worker);

        b.env.budget().reset_unlimited();
        b.client().complete_job(&b.worker, &job_id);
        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] job_registry::complete_job  cpu={} instructions  mem={} bytes",
            cpu,
            mem
        );
    }

    // -------------------------------------------------------------------------
    // Benchmark: cancel_job (second status-transition writer)
    // -------------------------------------------------------------------------

    #[test]
    fn bench_cancel_job() {
        let b = BenchEnv::new();
        b.post(0);
        let job_id = Symbol::new(&b.env, "job0");

        b.env.budget().reset_unlimited();
        b.client().cancel_job(&b.poster, &job_id);
        let cpu = b.env.budget().cpu_instruction_cost();
        let mem = b.env.budget().memory_bytes_cost();

        std::println!(
            "[BENCH] job_registry::cancel_job  cpu={} instructions  mem={} bytes",
            cpu,
            mem
        );
    }
}
