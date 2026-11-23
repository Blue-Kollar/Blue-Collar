# BlueCollar Curator Guide

Curators are trusted community members who create and manage worker listings on BlueCollar. This guide walks you through everything you need to get started.

---

## Table of Contents

- [What is a Curator?](#what-is-a-curator)
- [Getting the Curator Role](#getting-the-curator-role)
- [Connecting Your Stellar Wallet](#connecting-your-stellar-wallet)
- [Creating a Worker Listing](#creating-a-worker-listing)
- [Updating a Listing](#updating-a-listing)
- [Uploading a Profile Photo](#uploading-a-profile-photo)
- [Toggling Availability](#toggling-availability)
- [Managing Availability Slots](#managing-availability-slots)
- [Registering a Worker On-Chain](#registering-a-worker-on-chain)
- [Reviewing Contact Requests](#reviewing-contact-requests)
- [Viewing Verifications](#viewing-verifications)
- [Analytics Dashboard](#analytics-dashboard)
- [Extending On-Chain TTL](#extending-on-chain-ttl)
- [Troubleshooting FAQ](#troubleshooting-faq)

---

## What is a Curator?

A curator is a verified community member responsible for:

- Creating and maintaining worker profiles
- Anchoring listings on the Stellar blockchain via the Registry smart contract
- Managing availability and contact requests
- Ensuring listing quality and accuracy

Curators do not need to be the workers themselves. They can represent a community, co-op, or trade association.

---

## Getting the Curator Role

1. Register for a BlueCollar account at the app URL.
2. Verify your email address by clicking the link in your inbox.
3. Contact a platform admin (via GitHub Discussions or Telegram) to request the `curator` role.
4. Once approved, your account will be upgraded and the **Dashboard** section will become visible.

> **Note:** Role upgrades are done by an admin via the internal API. You cannot self-assign the curator role.

---

## Connecting Your Stellar Wallet

A Stellar wallet is required to register workers on-chain.

1. Install [Freighter](https://freighter.app) browser extension.
2. Create or import a Stellar account.
3. Click **Connect Wallet** in the top-right corner of the app.
4. Approve the connection in Freighter.

For testnet development, click **Fund Wallet (Testnet)** to receive XLM from Friendbot.

---

## Creating a Worker Listing

**From the app:**

1. Go to **Dashboard → Register Worker**.
2. Fill in the required fields:
   - **Name** — worker's full name or trade name
   - **Category** — select from the available categories (e.g., Plumber, Electrician)
   - **Phone** — contact number
   - **Email** — contact email (optional)
   - **Bio** — short description of skills and experience
   - **Wallet Address** — worker's Stellar public key (required for on-chain tips)
3. Click **Create Listing**.

**Via API:**

```bash
curl -X POST https://api.bluecollar.app/api/v1/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "categoryId": "cat_plumber_01",
    "phone": "+55 11 99999-0000",
    "email": "joao@example.com",
    "bio": "10 years experience in residential plumbing.",
    "walletAddress": "GABC...XYZ"
  }'
```

**Success response:**

```json
{
  "status": "success",
  "message": "Worker created",
  "code": 201,
  "data": {
    "id": "wkr_abc123",
    "name": "João Silva",
    "isActive": true,
    "categoryId": "cat_plumber_01",
    "curatorId": "usr_your_id",
    "createdAt": "2026-06-25T04:00:00.000Z"
  }
}
```

---

## Updating a Listing

**From the app:**

1. Go to **Dashboard → My Listings**.
2. Find the listing and click **Edit**.
3. Update the fields you want to change.
4. Click **Save Changes**.

**Via API (JSON, no file upload):**

```bash
curl -X PUT https://api.bluecollar.app/api/v1/workers/wkr_abc123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio": "Updated bio with new skills."}'
```

> For file uploads (avatar), use the [method-override pattern](#uploading-a-profile-photo) below.

---

## Uploading a Profile Photo

HTML forms and multipart requests only support `POST`. To update a worker with a photo, send a `POST` with the header `X-HTTP-Method: PUT`:

```bash
curl -X POST https://api.bluecollar.app/api/v1/workers/wkr_abc123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-HTTP-Method: PUT" \
  -F "name=João Silva" \
  -F "avatar=@/path/to/photo.jpg"
```

**JavaScript (Fetch API):**

```javascript
const formData = new FormData();
formData.append('bio', 'Updated bio.');
formData.append('avatar', fileInput.files[0]);

await fetch('/api/v1/workers/wkr_abc123', {
  method: 'POST',
  headers: {
    'X-HTTP-Method': 'PUT',
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

Supported formats: JPEG, PNG, WebP. Max size: 5 MB. Images are resized and optimised automatically by Sharp.

---

## Toggling Availability

Mark a worker as available or unavailable without deleting the listing:

**From the app:** Click the toggle switch on the listing card in **My Listings**.

**Via API:**

```bash
curl -X PATCH https://api.bluecollar.app/api/v1/workers/wkr_abc123/toggle \
  -H "Authorization: Bearer $TOKEN"
```

Response returns the updated worker object with the new `isActive` value.

---

## Managing Availability Slots

Set specific time windows when the worker is available for bookings:

```bash
# Replace entire availability schedule
curl -X PUT https://api.bluecollar.app/api/v1/workers/wkr_abc123/availability \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slots": [
      {"day": "monday", "startTime": "08:00", "endTime": "17:00"},
      {"day": "tuesday", "startTime": "08:00", "endTime": "17:00"}
    ]
  }'

# Add a single slot
curl -X POST https://api.bluecollar.app/api/v1/workers/wkr_abc123/availability \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"day": "saturday", "startTime": "09:00", "endTime": "13:00"}'

# Delete a slot
curl -X DELETE https://api.bluecollar.app/api/v1/workers/wkr_abc123/availability/slot_id \
  -H "Authorization: Bearer $TOKEN"
```

---

## Registering a Worker On-Chain

Anchoring a worker to the Stellar Registry contract creates an immutable, publicly verifiable record.

**Prerequisites:**

- Worker must have a `walletAddress` set
- Your Freighter wallet must be connected

**From the app:**

1. Open the worker listing.
2. Click **Register On-Chain**.
3. Approve the transaction in Freighter.

**Via API:**

```bash
curl -X POST https://api.bluecollar.app/api/v1/workers/wkr_abc123/register-on-chain \
  -H "Authorization: Bearer $TOKEN"
```

**Success response:**

```json
{
  "status": "success",
  "data": { "txHash": "abc123def456..." }
}
```

> On-chain entries expire after ~1 year (535,000 ledgers). See [Extending On-Chain TTL](#extending-on-chain-ttl).

---

## Reviewing Contact Requests

When a user sends a contact request to one of your workers, you'll see it in the dashboard:

```bash
# List requests
curl -X GET https://api.bluecollar.app/api/v1/workers/wkr_abc123/contacts \
  -H "Authorization: Bearer $TOKEN"

# Mark as read
curl -X PATCH https://api.bluecollar.app/api/v1/workers/wkr_abc123/contacts/req_id \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "read"}'
```

---

## Viewing Verifications

```bash
curl -X GET https://api.bluecollar.app/api/v1/workers/wkr_abc123/verifications \
  -H "Authorization: Bearer $TOKEN"
```

Verifications are identity or credential checks attached to a worker by the platform.

---

## Analytics Dashboard

Track views and engagement for your listings:

```bash
# Overview
curl -X GET https://api.bluecollar.app/api/v1/workers/wkr_abc123/analytics \
  -H "Authorization: Bearer $TOKEN"

# View trend over time
curl -X GET https://api.bluecollar.app/api/v1/workers/wkr_abc123/analytics/trends \
  -H "Authorization: Bearer $TOKEN"
```

---

## Extending On-Chain TTL

On-chain entries expire after ~1 year. Renew before expiry to keep the listing discoverable on Stellar:

```bash
# Using Stellar CLI
stellar contract invoke \
  --id <registry-contract-id> \
  --source <any-account-secret> \
  --network testnet \
  -- extend_worker_ttl \
  --id wkr_abc123
```

The app will also display a **Renew Listing** button when the TTL is within 6 months of expiry.

---

## Troubleshooting FAQ

**Q: I get 403 Forbidden when creating a worker.**
A: Your account does not have the `curator` role. Contact an admin to have your role upgraded.

**Q: The photo upload returns a 400 error.**
A: Make sure you are sending `POST` with `X-HTTP-Method: PUT` — not a regular `PUT` request. Also check the file size is under 5 MB and the format is JPEG, PNG, or WebP.

**Q: "Register On-Chain" button is greyed out.**
A: The worker needs a `walletAddress` set first. Edit the listing and add a valid Stellar public key.

**Q: The on-chain registration transaction fails.**
A: Your Freighter wallet may not have enough XLM for the transaction fee. On testnet, click **Fund Wallet** to add testnet XLM.

**Q: My listing shows "Expired" on-chain.**
A: The Soroban storage TTL has lapsed. Click **Renew Listing** or use the Stellar CLI `extend_worker_ttl` command.

**Q: I can't see the Dashboard menu.**
A: You may need to log out and log back in after your role is upgraded, so your JWT is refreshed.

**Q: The idempotency check is rejecting my duplicate request.**
A: If you send the same `Idempotency-Key` header twice, the second request returns the cached result. Use a new key for genuinely new requests.
