# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in BlueCollar, please **do not** open a public GitHub issue.

Instead, report it responsibly by emailing:

**security@bluecollar.dev**

Please include:
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

### PGP Key

For sensitive disclosures, you may encrypt your report. Contact us at the email above to obtain our PGP key.

## What to Expect

- **Acknowledgement**: Within 48 hours of your report
- **Status update**: Within 7 days with an initial assessment
- **Resolution**: Critical issues within 14 days, others within 30 days
- **Credit**: In the release notes (if desired) once the issue is resolved

## Scope

### In Scope

- BlueCollar API (`packages/api/`)
- Smart contracts (`packages/contracts/`)
- Frontend application (`packages/web/`)
- Authentication and authorization flows
- Database access and data handling
- Docker deployment configurations

### Out of Scope

- Third-party dependencies (report to their maintainers)
- Social engineering attacks
- Denial of service attacks
- Issues in deprecated or archived code

## Security Controls

### Input Sanitization

All incoming API `req.body` and `req.query` values are recursively sanitized with the `xss` package before reaching route handlers. This strips unsafe HTML tags and dangerous attributes such as `<script>` and inline event handlers from string values at any nesting depth. Raw HTML should not be stored or reflected without passing through this middleware.

### Rate Limiting

API endpoints are protected by `express-rate-limit`:
- **Auth endpoints**: Stricter limits to prevent brute-force attacks
- **Admin endpoints**: Separate rate limiting configuration
- **General API**: Standard rate limits for normal usage

### CORS

Cross-Origin Resource Sharing is configured via `cors` middleware:
- Allowed origins are configured per environment
- Credentials are supported for authenticated requests
- Preflight requests are handled automatically

### Authentication

- JWT-based authentication for API access
- Token expiration and refresh mechanisms
- Secure password hashing with bcrypt

### Data Protection

- Sensitive user data is sanitized before API responses (`sanitizeUser`)
- Database credentials stored in environment variables (never committed)
- `.env.example` provided as a template without real values

## Known Limitations and Accepted Risks

1. **Rate limiting is IP-based**: Users behind shared NAT may be affected
2. **CORS is permissive in development**: Production uses strict origin validation
3. **Session storage**: Currently in-memory; production should use Redis

## Bug Bounty Scope

### In Scope

- Authentication bypass
- SQL injection
- Cross-site scripting (XSS)
- Remote code execution
- Data leakage of user information
- Privilege escalation

### Out of Scope

- Missing best practices without demonstrated exploit
- Theoretical vulnerabilities without proof of concept
- Issues requiring physical access to the server

## Dependencies

We regularly audit dependencies for known vulnerabilities:

```bash
pnpm audit
```

Critical vulnerabilities are patched within 48 hours of discovery.

## Security Updates

Security patches are released as soon as possible. Subscribe to our [GitHub Security Advisories](https://github.com/Blue-Kollar/Blue-Collar/security/advisories) to stay informed.

## Contact

For security-related inquiries: **security@bluecollar.dev**
