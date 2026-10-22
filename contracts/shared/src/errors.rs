//! Shared error types for all contracts
//!
//! This module defines common error variants used across multiple contracts.
//! Contract-specific errors should be defined in their own modules.

use soroban_sdk::contracterror;

/// Common errors that can occur across multiple contracts
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommonError {
    // ============================================
    // Authorization Errors (1-10)
    // ============================================
    
    /// The caller is not authorized to perform this action
    Unauthorized = 1,
    /// Admin privileges required
    AdminRequired = 2,
    /// Owner privileges required
    OwnerRequired = 3,
    /// Invalid signer
    InvalidSigner = 4,
    /// Insufficient permissions
    InsufficientPermissions = 5,
    
    // ============================================
    // Input Validation Errors (11-20)
    // ============================================
    
    /// Invalid input provided
    InvalidInput = 11,
    /// Invalid amount
    InvalidAmount = 12,
    /// Invalid address
    InvalidAddress = 13,
    /// Invalid parameter
    InvalidParameter = 14,
    /// Invalid state transition
    InvalidStateTransition = 15,
    
    // ============================================
    // Balance/Token Errors (21-30)
    // ============================================
    
    /// Insufficient balance
    InsufficientBalance = 21,
    /// Insufficient allowance
    InsufficientAllowance = 22,
    /// Token not found
    TokenNotFound = 23,
    /// Transfer failed
    TransferFailed = 24,
    /// Mint failed
    MintFailed = 25,
    /// Burn failed
    BurnFailed = 26,
    
    // ============================================
    // Contract State Errors (31-40)
    // ============================================
    
    /// Contract already initialized
    AlreadyInitialized = 31,
    /// Contract not initialized
    NotInitialized = 32,
    /// Invalid state
    InvalidState = 33,
    /// State transition not allowed
    StateTransitionNotAllowed = 34,
    
    // ============================================
    // Math/Calculation Errors (41-50)
    // ============================================
    
    /// Overflow error
    Overflow = 41,
    /// Underflow error
    Underflow = 42,
    /// Division by zero
    DivisionByZero = 43,
    /// Invalid math operation
    InvalidMathOperation = 44,
    
    // ============================================
    // External Call Errors (51-60)
    // ============================================
    
    /// External call failed
    ExternalCallFailed = 51,
    /// Invalid external call result
    InvalidExternalCallResult = 52,
    /// External call timed out
    ExternalCallTimedOut = 53,
    
    // ============================================
    // Payment Errors (61-70)
    // ============================================
    
    /// Payment failed
    PaymentFailed = 61,
    /// Invalid payment amount
    InvalidPaymentAmount = 62,
    /// Payment method not supported
    PaymentMethodNotSupported = 63,
    
    // ============================================
    // Governance Errors (71-80)
    // ============================================
    
    /// Proposal not found
    ProposalNotFound = 71,
    /// Proposal already executed
    ProposalAlreadyExecuted = 72,
    /// Proposal expired
    ProposalExpired = 73,
    /// Insufficient votes
    InsufficientVotes = 74,
    /// Voting period not over
    VotingPeriodNotOver = 75,
    
    // ============================================
    // Storage Errors (81-90)
    // ============================================
    
    /// Storage read error
    StorageReadError = 81,
    /// Storage write error
    StorageWriteError = 82,
    /// Storage key not found
    StorageKeyNotFound = 83,
    /// Storage already exists
    StorageAlreadyExists = 84,
}
