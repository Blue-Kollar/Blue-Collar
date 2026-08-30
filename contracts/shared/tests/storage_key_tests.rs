#![cfg(test)]

use soroban_sdk::{Env, Address};
use shared::storage_keys::{CompactKey, StorageKeyBuilder, keys};

#[test]
fn test_compact_key_conversion() {
    let env = Env::default();
    
    let key = CompactKey::Admin;
    let symbol = key.to_symbol(&env);
    
    assert_eq!(symbol, soroban_sdk::Symbol::new(&env, "a"));
}

#[test]
fn test_key_builder_address() {
    let env = Env::default();
    let address = Address::generate(&env);
    
    let key = StorageKeyBuilder::new(&env, CompactKey::Balance).with_address(&address);
    assert!(key.to_string().len() > 0);
}

#[test]
fn test_key_builder_id() {
    let env = Env::default();
    
    let key = StorageKeyBuilder::new(&env, CompactKey::Product).with_id(123);
    assert!(key.to_string().len() > 0);
}

#[test]
fn test_helper_functions() {
    let env = Env::default();
    let address = Address::generate(&env);
    
    let admin = keys::admin(&env);
    let balance = keys::balance(&env, &address);
    
    assert_eq!(admin, soroban_sdk::Symbol::new(&env, "a"));
    assert!(balance.to_string().len() > 0);
}

#[test]
fn test_storage_roundtrip() {
    let env = Env::default();
    let address = Address::generate(&env);
    
    let key = StorageKeyBuilder::new(&env, CompactKey::Balance).with_address(&address);
    let value: i128 = 1000;
    env.storage().set(&key, &value);
    
    let stored: i128 = env.storage().get(&key).unwrap();
    assert_eq!(stored, value);
}

#[test]
fn test_key_uniqueness() {
    let env = Env::default();
    let addr1 = Address::generate(&env);
    let addr2 = Address::generate(&env);
    
    let key1 = StorageKeyBuilder::new(&env, CompactKey::Balance).with_address(&addr1);
    let key2 = StorageKeyBuilder::new(&env, CompactKey::Balance).with_address(&addr2);
    
    assert_ne!(key1.to_string(), key2.to_string());
}
