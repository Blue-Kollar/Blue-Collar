#![no_std]
use soroban_sdk::{contract, contracttype, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenTransfer {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub asset: String,
    pub memo: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferResult {
    pub success: bool,
    pub amount: i128,
    pub tx_hash: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransferError {
    InsufficientBalance = 1,
    ZeroAmount = 2,
    Unauthorized = 3,
    Overflow = 4,
    InvalidAddress = 5,
    AssetNotFound = 6,
    TransferFailed = 7,
}

#[contract]
pub struct TokenTransferContract;

#[contractimpl]
impl TokenTransferContract {
    /// Transfer tokens from one address to another
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        asset: String,
        memo: String,
    ) -> Result<TransferResult, TransferError> {
        // Check authorization
        from.require_auth();

        // Validate addresses
        if Self::is_invalid_address(&from) || Self::is_invalid_address(&to) {
            return Err(TransferError::InvalidAddress);
        }

        // Check zero amount
        if amount <= 0 {
            return Err(TransferError::ZeroAmount);
        }

        // Check balance
        let balance = Self::get_balance(&env, &from, &asset);
        if balance < amount {
            return Err(TransferError::InsufficientBalance);
        }

        // Check overflow
        let recipient_balance = Self::get_balance(&env, &to, &asset);
        if let Err(_) = recipient_balance.checked_add(amount) {
            return Err(TransferError::Overflow);
        }

        // Store transfer record
        let transfer = TokenTransfer {
            from: from.clone(),
            to: to.clone(),
            amount,
            asset: asset.clone(),
            memo: memo.clone(),
        };

        // Update balances
        Self::update_balance(&env, &from, &asset, balance - amount);
        Self::update_balance(&env, &to, &asset, recipient_balance + amount);

        // Store transfer history
        let transfer_id = Self::store_transfer(&env, transfer);

        // Emit event
        env.events().publish(
            ("transfer", "v1"),
            (from, to, amount, asset, memo),
        );

        Ok(TransferResult {
            success: true,
            amount,
            tx_hash: String::from_str(&env, &format!("txn_{}", transfer_id)),
        })
    }

    /// Get balance for an address
    pub fn get_balance(env: Env, address: Address, asset: String) -> i128 {
        Self::get_balance(&env, &address, &asset)
    }

    /// Get transfer history
    pub fn get_transfers(env: Env, address: Address) -> Vec<TokenTransfer> {
        Self::get_transfers(&env, &address)
    }

    // ================================================================
    // Internal helper functions
    // ================================================================

    fn is_invalid_address(address: &Address) -> bool {
        // Check for zero address or invalid format
        address.to_string().len() < 10
    }

    fn get_balance(env: &Env, address: &Address, asset: &String) -> i128 {
        let key = format!("balance_{}_{}", address.to_string(), asset.to_string());
        env.storage().get(&String::from_str(env, &key)).unwrap_or(0)
    }

    fn update_balance(env: &Env, address: &Address, asset: &String, new_balance: i128) {
        let key = format!("balance_{}_{}", address.to_string(), asset.to_string());
        env.storage().set(&String::from_str(env, &key), &new_balance);
    }

    fn store_transfer(env: &Env, transfer: TokenTransfer) -> u64 {
        let id: u64 = env.storage().get(&String::from_str(env, "transfer_count")).unwrap_or(0) + 1;
        let key = format!("transfer_{}", id);
        env.storage().set(&String::from_str(env, &key), &transfer);
        env.storage().set(&String::from_str(env, "transfer_count"), &id);
        id
    }

    fn get_transfers(env: &Env, address: &Address) -> Vec<TokenTransfer> {
        let count: u64 = env.storage().get(&String::from_str(env, "transfer_count")).unwrap_or(0);
        let mut transfers = Vec::new(env);
        for i in 1..=count {
            let key = format!("transfer_{}", i);
            if let Some(transfer) = env.storage().get::<TokenTransfer>(&String::from_str(env, &key)) {
                if transfer.from == *address || transfer.to == *address {
                    transfers.push_back(transfer);
                }
            }
        }
        transfers
    }
}

#[cfg(test)]
mod tests;
