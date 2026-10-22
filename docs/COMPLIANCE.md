# Compliance & PII Management

## 1. PII Inventory

The following personally identifiable information is collected, stored, and processed:

### User Model (`User`)
| Field | Type | Sensitivity | Encryption | Retention |
|-------|------|-------------|------------|-----------|
| `email` | String | **High** | AES-256-GCM at column level | Lifetime of account + 90 days after deletion |
| `password` | String? | **Critical** | Argon2id hash (never stored in plaintext) | Never deleted; account lifecycle |
| `phone` | String? | **High** | AES-256-GCM at column level | Lifetime of account + 90 days after deletion |
| `googleId` | String? | Medium | AES-256-GCM at column level | Lifetime of account |
| `avatar` | String? | Low | Encrypted at rest (RDS) | Lifetime of account |
| `firstName` | String | Medium | Encrypted at rest (RDS) | Lifetime of account + 90 days |
| `lastName` | String | Medium | Encrypted at rest (RDS) | Lifetime of account + 90 days |
| `verificationToken` | String? | **Critical** | Argon2id hash | 24 hours then purged |
| `resetToken` | String? | **Critical** | Argon2id hash | 1 hour then purged |
| `twoFactorSecret` | String? | **Critical** | AES-256-GCM at column level | Lifetime of account |
| `twoFactorBackupCodes` | String[] | **Critical** | AES-256-GCM at column level | Lifetime of account |

### Worker Model (`Worker`)
| Field | Type | Sensitivity | Encryption | Retention |
|-------|------|-------------|------------|-----------|
| `email` | String? | **High** | AES-256-GCM at column level | Lifetime of listing + 90 days |
| `phone` | String? | **High** | AES-256-GCM at column level | Lifetime of listing + 90 days |
| `walletAddress` | String? | Medium | Encrypted at rest (RDS) | Lifetime of listing |

### Device Model (`Device`)
| Field | Type | Sensitivity | Encryption | Retention |
|-------|------|-------------|------------|-----------|
| `ipAddress` | String | **High** | AES-256-GCM at column level | 90 days then anonymized |
| `userAgent` | String? | Low | Encrypted at rest (RDS) | 90 days |

### Other PII-bearing Models
| Model | PII Fields | Sensitivity | Retention |
|-------|-----------|-------------|-----------|
| `ProfileView` | `ip` | Medium | 30 days (aggregated) |
| `SearchAnalytics` | `ipAddress` | Medium | 30 days (aggregated) |
| `Message` | `body` | Medium | Lifetime of conversation |
| `JobMessage` | `body` | Medium | Lifetime of job |
| `ContactRequest` | `message` | Medium | Lifetime of account |

## 2. Encryption-at-Rest Policy

- **Database level**: RDS encryption at rest (AES-256) is enabled for all data.
- **Column level**: Highly sensitive fields (`email`, `phone`, `password`, `googleId`, `twoFactorSecret`, `twoFactorBackupCodes`, `verificationToken`, `resetToken`, `ipAddress`) use application-level encryption with AES-256-GCM.
- **Key management**: Encryption keys are managed via AWS KMS or HashiCorp Vault (see `deploy/vault/`). Keys are rotated every 90 days.
- **Backups**: RDS automated backups are encrypted with the same KMS key. Backups are retained for 30 days.

## 3. PII in Logs — Minimisation

- **Request logs**: `requestLogger.ts` strips all PII. Only `method`, `url`, `statusCode` are logged. `userId` is logged only when authenticated (not PII).
- **Error logs**: `errorHandler.ts` and `handleError.ts` never include request body, query params, or user data. Stack traces are included in development only.
- **Audit logs**: The `audit.ts` middleware logs only `userId`, `action`, `resource`, `resourceId`, and sanitized `meta` (IP, method, path). No request bodies or PII are stored.
- **Pino logger**: Configured with custom serializers that exclude `req.headers`, `req.body`, and `res.body`.

## 4. Data Retention and Minimisation

- User accounts: Data retained for the lifetime of the account plus 90 days after soft-delete (`deletedAt`).
- Session tokens: Refresh tokens expire after 30 days. Revoked tokens purged after 90 days.
- Verification tokens: Expire after 24 hours and are then purged.
- Password reset tokens: Expire after 1 hour.
- IP addresses in `ProfileView` and `SearchAnalytics`: Retained for 30 days, then anonymized by truncating the last octet.
- Device IP addresses: Retained for 90 days, then anonymized.
- Two-factor backup codes: Retained only while 2FA is enabled. Purged on 2FA disable.

## 5. Data Subject Rights

- **Access**: Users can export their data via `GET /api/users/me/export`.
- **Rectification**: Users can update their profile via `PUT /api/users/me`.
- **Deletion**: Account deletion via `DELETE /api/users/me` triggers a soft-delete. Hard deletion occurs after 90 days.
- **Portability**: Data export includes all user-generated content in JSON format.

## 6. Breach Notification

In the event of a data breach involving PII:
1. Engineering team is alerted via PagerDuty within 15 minutes.
2. Security team investigates and contains within 1 hour.
3. Affected users are notified within 72 hours via email.
4. Relevant authorities notified within 72 hours (GDPR Art. 33).

## 7. Third-Party Data Processors

| Processor | Data Shared | Purpose |
|-----------|------------|---------|
| Stellar Horizon (testnet/mainnet) | Wallet address | Transaction processing |
| Sentry (if enabled) | Error stack traces | Error monitoring |
| Vercel (hosting) | IP addresses | CDN and request routing |
| AWS RDS | All data (encrypted) | Database hosting |
