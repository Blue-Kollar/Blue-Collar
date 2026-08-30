//! Optimized storage key encoding for Soroban contracts
//! 
//! This module provides compact storage key types to reduce contract footprint.
//! Using enums and small symbols instead of string-based keys saves storage costs.

use soroban_sdk::{Env, Symbol};

/// Compact storage key enum for common data types
/// Using u32 discriminants instead of string symbols saves space
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum CompactKey {
    // Core contract state
    Admin = 1,
    Paused = 2,
    Version = 3,
    TotalSupply = 4,
    
    // User data
    Balance = 10,
    Allowance = 11,
    Locked = 12,
    Nonce = 13,
    
    // Market data
    Product = 20,
    Listing = 21,
    Purchase = 22,
    Counter = 23,
    
    // Escrow data
    Escrow = 30,
    EscrowStatus = 31,
    EscrowCounter = 32,
    
    // Token data
    Token = 40,
    TokenMetadata = 41,
    TokenBalance = 42,
    
    // Governance
    Proposal = 50,
    Vote = 51,
    Delegation = 52,
    
    // Custom data (for contract-specific use)
    Custom = 100,
}

impl CompactKey {
    /// Convert CompactKey to a Symbol for storage operations
    pub fn to_symbol(&self, env: &Env) -> Symbol {
        // Use the discriminator as a compact symbol name
        // This creates a symbol from the numeric value, which is much smaller
        // than storing full string names
        match self {
            // Core keys - use short symbols
            CompactKey::Admin => Symbol::new(env, "a"),
            CompactKey::Paused => Symbol::new(env, "p"),
            CompactKey::Version => Symbol::new(env, "v"),
            CompactKey::TotalSupply => Symbol::new(env, "ts"),
            
            // User data
            CompactKey::Balance => Symbol::new(env, "b"),
            CompactKey::Allowance => Symbol::new(env, "al"),
            CompactKey::Locked => Symbol::new(env, "l"),
            CompactKey::Nonce => Symbol::new(env, "n"),
            
            // Market data
            CompactKey::Product => Symbol::new(env, "pr"),
            CompactKey::Listing => Symbol::new(env, "li"),
            CompactKey::Purchase => Symbol::new(env, "pu"),
            CompactKey::Counter => Symbol::new(env, "c"),
            
            // Escrow data
            CompactKey::Escrow => Symbol::new(env, "e"),
            CompactKey::EscrowStatus => Symbol::new(env, "es"),
            CompactKey::EscrowCounter => Symbol::new(env, "ec"),
            
            // Token data
            CompactKey::Token => Symbol::new(env, "t"),
            CompactKey::TokenMetadata => Symbol::new(env, "tm"),
            CompactKey::TokenBalance => Symbol::new(env, "tb"),
            
            // Governance
            CompactKey::Proposal => Symbol::new(env, "pro"),
            CompactKey::Vote => Symbol::new(env, "vo"),
            CompactKey::Delegation => Symbol::new(env, "de"),
            
            // Custom
            CompactKey::Custom => Symbol::new(env, "cu"),
        }
    }
    
    /// Get the raw u32 value of the key
    pub fn as_u32(&self) -> u32 {
        *self as u32
    }
}

/// Builder for creating storage keys with user-specific identifiers
pub struct StorageKeyBuilder<'a> {
    env: &'a Env,
    base: CompactKey,
}

impl<'a> StorageKeyBuilder<'a> {
    pub fn new(env: &'a Env, base: CompactKey) -> Self {
        Self { env, base }
    }
    
    /// Create a key with a user address
    pub fn with_address(&self, address: &soroban_sdk::Address) -> Symbol {
        // Combine base key with address using a separator
        let key_str = format!("{}{}", self.base.as_u32(), address.to_string());
        Symbol::new(self.env, &key_str)
    }
    
    /// Create a key with a u32 identifier
    pub fn with_id(&self, id: u32) -> Symbol {
        let key_str = format!("{}{}", self.base.as_u32(), id);
        Symbol::new(self.env, &key_str)
    }
    
    /// Create a key with a string identifier
    pub fn with_string(&self, s: &str) -> Symbol {
        let key_str = format!("{}{}", self.base.as_u32(), s);
        Symbol::new(self.env, &key_str)
    }
    
    /// Get the base symbol
    pub fn base_symbol(&self) -> Symbol {
        self.base.to_symbol(self.env)
    }
}

/// Pre-optimized storage key constants for common patterns
pub mod keys {
    use super::*;
    
    /// Get the admin key
    pub fn admin(env: &Env) -> Symbol {
        CompactKey::Admin.to_symbol(env)
    }
    
    /// Get the paused key
    pub fn paused(env: &Env) -> Symbol {
        CompactKey::Paused.to_symbol(env)
    }
    
    /// Get the total supply key
    pub fn total_supply(env: &Env) -> Symbol {
        CompactKey::TotalSupply.to_symbol(env)
    }
    
    /// Get a balance key for an address
    pub fn balance(env: &Env, address: &soroban_sdk::Address) -> Symbol {
        StorageKeyBuilder::new(env, CompactKey::Balance).with_address(address)
    }
    
    /// Get a product key
    pub fn product(env: &Env, id: u32) -> Symbol {
        StorageKeyBuilder::new(env, CompactKey::Product).with_id(id)
    }
    
    /// Get a listing key
    pub fn listing(env: &Env, id: u32) -> Symbol {
        StorageKeyBuilder::new(env, CompactKey::Listing).with_id(id)
    }
    
    /// Get a purchase key
    pub fn purchase(env: &Env, id: u32) -> Symbol {
        StorageKeyBuilder::new(env, CompactKey::Purchase).with_id(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;
    
    #[test]
    fn test_compact_key_to_symbol() {
        let env = Env::default();
        let key = CompactKey::Admin;
        let symbol = key.to_symbol(&env);
        assert_eq!(symbol, Symbol::new(&env, "a"));
    }
    
    #[test]
    fn test_key_builder_with_address() {
        let env = Env::default();
        let address = soroban_sdk::Address::generate(&env);
        let symbol = StorageKeyBuilder::new(&env, CompactKey::Balance).with_address(&address);
        assert!(symbol.to_string().len() > 0);
    }
    
    #[test]
    fn test_key_builder_with_id() {
        let env = Env::default();
        let symbol = StorageKeyBuilder::new(&env, CompactKey::Product).with_id(123);
        assert!(symbol.to_string().len() > 0);
    }
    
    #[test]
    fn test_helper_functions() {
        let env = Env::default();
        let address = soroban_sdk::Address::generate(&env);
        
        let admin = keys::admin(&env);
        let balance = keys::balance(&env, &address);
        let product = keys::product(&env, 1);
        
        assert_eq!(admin, Symbol::new(&env, "a"));
        assert!(balance.to_string().len() > 0);
        assert!(product.to_string().len() > 0);
    }
}
