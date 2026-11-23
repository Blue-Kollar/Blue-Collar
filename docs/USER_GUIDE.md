# BlueCollar User Guide

BlueCollar connects you with verified, community-curated skilled workers near you. This guide covers everything from finding a worker to sending a tip on the Stellar blockchain.

---

## Table of Contents

- [Creating an Account](#creating-an-account)
- [Verifying Your Email](#verifying-your-email)
- [Logging In](#logging-in)
- [Google Sign-In](#google-sign-in)
- [Setting Up Two-Factor Authentication](#setting-up-two-factor-authentication)
- [Discovering Workers](#discovering-workers)
- [Advanced Search](#advanced-search)
- [Bookmarking Workers](#bookmarking-workers)
- [Contacting a Worker](#contacting-a-worker)
- [Writing a Review](#writing-a-review)
- [Posting a Job](#posting-a-job)
- [Connecting Freighter](#connecting-freighter)
- [Sending a Tip](#sending-a-tip)
- [Managing Your Profile](#managing-your-profile)
- [Changing Your Password](#changing-your-password)
- [Deleting Your Account](#deleting-your-account)
- [Troubleshooting FAQ](#troubleshooting-faq)

---

## Creating an Account

1. Go to the BlueCollar app and click **Sign Up**.
2. Enter your first name, last name, email address, and a password (minimum 8 characters).
3. Click **Create Account** — you will receive a verification email within a few minutes.

**Via API:**

```bash
curl -X POST https://api.bluecollar.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Ana",
    "lastName": "Costa",
    "email": "ana@example.com",
    "password": "supersecure123"
  }'
```

**Success response (201):**

```json
{
  "status": "success",
  "message": "Account created. Check your email to verify.",
  "code": 201,
  "data": {
    "id": "usr_abc123",
    "email": "ana@example.com",
    "firstName": "Ana",
    "lastName": "Costa",
    "role": "user",
    "verified": false
  }
}
```

---

## Verifying Your Email

After registering, check your inbox for an email from BlueCollar. Click the **Verify Email** link. This marks your account as verified and unlocks full access.

If you didn't receive the email:

- Check your spam folder.
- Request a new one:

```bash
curl -X POST https://api.bluecollar.app/api/v1/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "ana@example.com"}'
```

---

## Logging In

```bash
curl -X POST https://api.bluecollar.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ana@example.com", "password": "supersecure123"}'
```

**Success response (202):**

```json
{
  "status": "success",
  "code": 202,
  "token": "<jwt>",
  "data": {
    "id": "usr_abc123",
    "email": "ana@example.com",
    "role": "user",
    "verified": true
  }
}
```

Save the `token` and include it in subsequent requests as `Authorization: Bearer <token>`. Tokens expire after 7 days.

---

## Google Sign-In

1. Click **Continue with Google** on the login page.
2. Select your Google account and approve the permissions.
3. You will be redirected back to the app, already logged in.

The first time you sign in with Google, an account is automatically created.

---

## Setting Up Two-Factor Authentication

2FA adds an extra layer of security using an authenticator app (Google Authenticator, Authy, etc.).

1. Log in and go to **Settings → Security → Enable 2FA**.
2. Scan the QR code with your authenticator app.
3. Enter the 6-digit code to confirm setup.

After enabling 2FA, each login will require your TOTP code as a second step.

**Save your backup codes.** You are given 8 one-time codes during setup. Store them in a safe place — they let you log in if you lose access to your authenticator app.

**Via API:**

```bash
# Step 1 — get QR code
curl -X POST https://api.bluecollar.app/api/v1/auth/2fa/setup \
  -H "Authorization: Bearer $TOKEN"

# Step 2 — enable after scanning (enter the TOTP code)
curl -X POST https://api.bluecollar.app/api/v1/auth/2fa/enable \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

---

## Discovering Workers

**From the app:**

1. Go to the **Workers** page.
2. Use the **Category** dropdown to filter by trade (Plumber, Electrician, Carpenter, etc.).
3. Use the search bar to filter by name or keyword.
4. Click any listing card to view the full profile.

**Via API:**

```bash
# List all active workers
curl https://api.bluecollar.app/api/v1/workers

# Filter by category
curl "https://api.bluecollar.app/api/v1/workers?category=cat_plumber_01&page=1&limit=20"
```

---

## Advanced Search

```bash
curl "https://api.bluecollar.app/api/v1/workers/search/advanced?q=electrician&location=São+Paulo&minRating=4&available=true"
```

| Parameter   | Description                        |
| ----------- | ---------------------------------- |
| `q`         | Keyword search (name, bio)         |
| `category`  | Category ID                        |
| `location`  | Location name or area              |
| `minRating` | Minimum average rating (1–5)       |
| `available` | `true` to show only active workers |
| `page`      | Page number (default: 1)           |
| `limit`     | Results per page (default: 20)     |

---

## Bookmarking Workers

Save workers you want to revisit:

```bash
# Toggle bookmark (adds if not bookmarked, removes if already bookmarked)
curl -X POST https://api.bluecollar.app/api/v1/workers/wkr_abc123/bookmark \
  -H "Authorization: Bearer $TOKEN"

# View your bookmarks
curl https://api.bluecollar.app/api/v1/users/me/bookmarks \
  -H "Authorization: Bearer $TOKEN"
```

---

## Contacting a Worker

Send a message directly to a worker through the platform:

```bash
curl -X POST https://api.bluecollar.app/api/v1/workers/wkr_abc123/contact \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hi, I need a plumber to fix a leak. Are you available this Friday?"}'
```

The message is delivered to the curator managing the listing. Rate limiting applies to prevent spam.

---

## Writing a Review

After using a worker's services, leave a review to help the community:

```bash
curl -X POST https://api.bluecollar.app/api/v1/workers/wkr_abc123/reviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "body": "João arrived on time and fixed the leak quickly. Highly recommend!"
  }'
```

- `rating`: integer 1–5
- `body`: your written review (required)

You can only submit one review per worker. To delete your own review:

```bash
curl -X DELETE https://api.bluecollar.app/api/v1/workers/reviews/rev_id \
  -H "Authorization: Bearer $TOKEN"
```

---

## Posting a Job

If you need a specific task done, post a job that workers can apply to:

```bash
curl -X POST https://api.bluecollar.app/api/v1/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix bathroom pipe leak",
    "description": "Need a plumber to fix a leaking pipe under the sink. Urgently.",
    "budget": 150,
    "categoryId": "cat_plumber_01",
    "expiresAt": "2026-07-10T00:00:00.000Z"
  }'
```

Once posted, workers can apply. You'll receive applications at:

```bash
curl https://api.bluecollar.app/api/v1/jobs/job_id/applications \
  -H "Authorization: Bearer $TOKEN"
```

Accept or reject applications:

```bash
curl -X PATCH "https://api.bluecollar.app/api/v1/jobs/job_id/applications/app_id" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "accepted"}'
```

---

## Connecting Freighter

The Freighter browser extension is needed for on-chain tipping.

1. Install [Freighter](https://freighter.app) from the browser extension store.
2. Create or import your Stellar account.
3. In the BlueCollar app, click **Connect Wallet** in the top-right corner.
4. Approve the connection request in Freighter.

Your Stellar public key will appear in the navbar when connected.

> **Testnet:** Click **Fund Wallet (Testnet)** to receive free testnet XLM from Friendbot.

---

## Sending a Tip

Tip a worker directly using XLM or supported Stellar tokens via the Market smart contract:

1. Open the worker's profile.
2. Click **Send Tip**.
3. Enter the amount.
4. Click **Confirm** — Freighter will open for you to sign the transaction.
5. Approve in Freighter.

**Via API:**

```bash
curl -X POST https://api.bluecollar.app/api/v1/payments/tip \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "GYOUR...WALLET",
    "to": "GWORKER...WALLET",
    "amount": 10
  }'
```

The transfer happens directly on the Stellar network — BlueCollar never holds your funds.

---

## Managing Your Profile

Update your name, bio, phone, and avatar:

```bash
# JSON update
curl -X PATCH https://api.bluecollar.app/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio": "Looking for reliable tradespeople in São Paulo."}'

# With avatar upload (method-override)
curl -X POST https://api.bluecollar.app/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-HTTP-Method: PUT" \
  -F "firstName=Ana" \
  -F "avatar=@/path/to/photo.jpg"
```

---

## Changing Your Password

```bash
curl -X PUT https://api.bluecollar.app/api/v1/users/me/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "old_password", "newPassword": "new_secure_password123"}'
```

**Forgot your password?**

```bash
# Request reset email
curl -X POST https://api.bluecollar.app/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "ana@example.com"}'

# Reset using token from the email
curl -X PUT https://api.bluecollar.app/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "<token-from-email>", "password": "new_secure_password123"}'
```

---

## Deleting Your Account

```bash
curl -X DELETE https://api.bluecollar.app/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN"
```

This permanently deletes your account and associated data. This action cannot be undone.

---

## Troubleshooting FAQ

**Q: I didn't receive the verification email.**
A: Check your spam folder first. Then use the resend endpoint or the **Resend Verification** button on the login page.

**Q: My login returns 403 "Email not verified".**
A: Verify your email first. If you lost the email, request a new verification link.

**Q: Login returns 401 "Invalid credentials".**
A: Double-check your email and password. If you signed up with Google, use the Google sign-in button instead.

**Q: My JWT expired — I'm getting 401 on all requests.**
A: Tokens last 7 days. Use `POST /api/v1/auth/refresh` with your refresh token, or log in again.

**Q: I can't send a tip — Freighter shows an error.**
A: Make sure your wallet has enough XLM to cover the transaction amount plus the network fee (~0.001 XLM). On testnet, click **Fund Wallet**.

**Q: The worker I want doesn't have a Stellar wallet address.**
A: On-chain tipping requires the worker to have a wallet address. Contact the curator to update the listing.

**Q: I already reviewed a worker and want to change my rating.**
A: Delete your existing review and submit a new one. Only one review per worker is permitted.

**Q: How do I report an inappropriate review?**
A: Click the flag icon on the review, or use `PATCH /api/v1/workers/reviews/{id}/flag`. Flagged reviews are placed in a moderation queue reviewed by admins.

**Q: Can I log in with 2FA using a backup code?**
A: Yes. On the 2FA verification screen, click **Use Backup Code** and enter one of your saved codes.
