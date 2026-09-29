#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, JobRegistryClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, JobRegistry);
    let client = JobRegistryClient::new(&env, &contract_id);
    let client_admin = Address::generate(&env);
    let freelancer = Address::generate(&env);
    client.initialize(&client_admin);
    (env, client, client_admin, freelancer)
}

fn create_job(env: &Env, client: &JobRegistryClient, client_admin: &Address) -> u64 {
    client.create_job(
        client_admin,
        &String::from_str(env, "Fuzz job"),
        &String::from_str(env, "desc"),
        &100_i128,
    )
}

#[test]
fn test_create_job_starts_open() {
    let (env, client, client_admin, _) = setup();
    let job_id = create_job(&env, &client, &client_admin);
    let job = client.get_job(&job_id);
    assert_eq!(job.status, JobStatus::Open);
}

#[test]
fn test_legal_transition_open_to_assigned() {
    let (env, client, client_admin, freelancer) = setup();
    let job_id = create_job(&env, &client, &client_admin);
    client.assign_freelancer(&client_admin, &job_id, &freelancer);
    assert_eq!(client.get_job(&job_id).status, JobStatus::Assigned);
}

#[test]
fn test_legal_transition_assigned_to_completed() {
    let (env, client, client_admin, freelancer) = setup();
    let job_id = create_job(&env, &client, &client_admin);
    client.assign_freelancer(&client_admin, &job_id, &freelancer);
    client.complete_job(&client_admin, &job_id);
    assert_eq!(client.get_job(&job_id).status, JobStatus::Completed);
}

#[test]
fn test_legal_transition_completed_to_closed() {
    let (env, client, client_admin, freelancer) = setup();
    let job_id = create_job(&env, &client, &client_admin);
    client.assign_freelancer(&client_admin, &job_id, &freelancer);
    client.complete_job(&client_admin, &job_id);
    client.close_job(&client_admin, &job_id);
    assert_eq!(client.get_job(&job_id).status, JobStatus::Closed);
}

#[test]
fn test_illegal_transition_open_to_completed_rejected() {
    let (env, client, client_admin, _) = setup();
    let job_id = create_job(&env, &client, &client_admin);
    let result = client.try_complete_job(&client_admin, &job_id);
    assert!(result.is_err());
    assert_eq!(client.get_job(&job_id).status, JobStatus::Open);
}

#[test]
fn test_illegal_transition_open_to_closed_rejected() {
    let (env, client, client_admin, _) = setup();
    let job_id = create_job(&env, &client, &client_admin);
    let result = client.try_close_job(&client_admin, &job_id);
    assert!(result.is_err());
    assert_eq!(client.get_job(&job_id).status, JobStatus::Open);
}

#[test]
fn test_illegal_transition_assigned_to_closed_rejected() {
    let (env, client, client_admin, freelancer) = setup();
    let job_id = create_job(&env, &client, &client_admin);
    client.assign_freelancer(&client_admin, &job_id, &freelancer);
    let result = client.try_close_job(&client_admin, &job_id);
    assert!(result.is_err());
    assert_eq!(client.get_job(&job_id).status, JobStatus::Assigned);
}

#[test]
fn test_illegal_transition_closed_is_terminal() {
    let (env, client, client_admin, freelancer) = setup();
    let job_id = create_job(&env, &client, &client_admin);
    client.assign_freelancer(&client_admin, &job_id, &freelancer);
    client.complete_job(&client_admin, &job_id);
    client.close_job(&client_admin, &job_id);
    assert!(client.try_complete_job(&client_admin, &job_id).is_err());
    assert!(client.try_close_job(&client_admin, &job_id).is_err());
    assert_eq!(client.get_job(&job_id).status, JobStatus::Closed);
}

/// Deterministic pseudo-random sequence generator used to drive the
/// contract-level fuzz test below. Keeps the fuzz run reproducible so any
/// discovered invalid-transition bug can be replayed as a regression test.
struct FuzzRng(u64);

impl FuzzRng {
    fn new(seed: u64) -> Self {
        Self(seed | 1)
    }

    fn next(&mut self) -> u64 {
        // xorshift64
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }

    fn below(&mut self, bound: u64) -> u64 {
        self.next() % bound
    }
}

/// Fuzz the `job_registry` state machine with randomized call sequences and
/// assert that only legal transitions succeed. Any illegal transition must be
/// rejected and must leave the job in its previous state.
#[test]
fn fuzz_job_registry_state_transitions() {
    let (env, client, client_admin, freelancer) = setup();
    let mut rng = FuzzRng::new(0x5eed_1234_abcd_ef01);

    for _ in 0..64 {
        let job_id = create_job(&env, &client, &client_admin);
        let mut expected = JobStatus::Open;

        for _ in 0..32 {
            let action = rng.below(4);
            let before = expected;

            match action {
                0 => {
                    // assign_freelancer: legal only from Open
                    let res = client.try_assign_freelancer(&client_admin, &job_id, &freelancer);
                    if before == JobStatus::Open {
                        assert!(res.is_ok(), "assign from Open must succeed");
                        expected = JobStatus::Assigned;
                    } else {
                        assert!(res.is_err(), "assign from {:?} must fail", before);
                    }
                }
                1 => {
                    // complete_job: legal only from Assigned
                    let res = client.try_complete_job(&client_admin, &job_id);
                    if before == JobStatus::Assigned {
                        assert!(res.is_ok(), "complete from Assigned must succeed");
                        expected = JobStatus::Completed;
                    } else {
                        assert!(res.is_err(), "complete from {:?} must fail", before);
                    }
                }
                2 => {
                    // close_job: legal only from Completed
                    let res = client.try_close_job(&client_admin, &job_id);
                    if before == JobStatus::Completed {
                        assert!(res.is_ok(), "close from Completed must succeed");
                        expected = JobStatus::Closed;
                    } else {
                        assert!(res.is_err(), "close from {:?} must fail", before);
                    }
                }
                _ => {
                    // read-only observation must never mutate state
                    let job = client.get_job(&job_id);
                    assert_eq!(job.status, before);
                }
            }

            // Invariant: the on-chain status always matches the modelled state.
            assert_eq!(client.get_job(&job_id).status, expected);
        }
    }
}
