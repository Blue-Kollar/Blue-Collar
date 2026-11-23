# BlueCollar Worker Guide

This guide is for skilled tradespeople who want to get listed on BlueCollar, build their reputation, and start receiving work through the platform.

---

## Table of Contents

- [How BlueCollar Works for Workers](#how-bluecollar-works-for-workers)
- [Getting Listed](#getting-listed)
- [Setting Up a Stellar Wallet](#setting-up-a-stellar-wallet)
- [Your On-Chain Listing](#your-on-chain-listing)
- [Profile Completeness Tips](#profile-completeness-tips)
- [Your Availability](#your-availability)
- [Receiving Tips and Payments](#receiving-tips-and-payments)
- [Building Your Reputation](#building-your-reputation)
- [Understanding Your Reputation Score](#understanding-your-reputation-score)
- [Verification Badges](#verification-badges)
- [Portfolio (Coming Soon)](#portfolio-coming-soon)
- [Responding to Contact Requests](#responding-to-contact-requests)
- [Applying to Jobs](#applying-to-jobs)
- [Troubleshooting FAQ](#troubleshooting-faq)

---

## How BlueCollar Works for Workers

BlueCollar is a **curator-managed, decentralised marketplace**. Here's how the flow works:

1. A **curator** (trusted community member) creates your listing on the platform.
2. Your listing is anchored on the **Stellar blockchain** — no single company can take it down.
3. Users discover you by browsing categories or searching.
4. Users can send you **tips and payments directly** via the Stellar Market contract — funds go straight to your wallet.
5. Users leave **reviews** that build your on-chain reputation over time.

> You do not need a BlueCollar account to appear in listings. However, having a **Stellar wallet** is essential to receive payments.

---

## Getting Listed

You cannot directly create your own listing — a **curator** must create it on your behalf. Curators are verified community members (local trade unions, co-ops, community groups, or individual advocates).

**Steps:**

1. Find a curator in your community, or reach out via [GitHub Discussions](https://github.com/Fidelis900/Blue-Collar/discussions) or [Telegram](https://t.me/bluecollar).
2. Provide the curator with:
   - Your full name / trade name
   - Your trade category (e.g., Plumber, Electrician, Welder)
   - Contact number and email
   - A short bio describing your skills and experience
   - Your Stellar wallet address (required for on-chain registration and tips)
   - A profile photo (optional but strongly recommended)
3. The curator creates your listing and registers it on the Stellar Registry contract.

Once listed, your profile appears on the public workers page immediately and is discoverable via search.

---

## Setting Up a Stellar Wallet

A Stellar wallet lets you receive tips and payments directly from users — without any intermediary holding your funds.

**Recommended: Freighter (browser extension)**

1. Go to [freighter.app](https://freighter.app) and install the extension.
2. Click **Create Wallet** and follow the setup steps.
3. **Write down your recovery phrase** and store it somewhere safe. This is the only way to recover your wallet if you lose access to your device.
4. Your **public key** (starts with `G`) is your wallet address. Share this with your curator so it can be added to your listing.

**Important:**

- Your public key is safe to share publicly — it is like a bank account number.
- Your **secret key** (starts with `S`) must never be shared with anyone, including BlueCollar.

**Testnet accounts:** For testing, any Stellar testnet account will work. Testnet XLM has no real value.

---

## Your On-Chain Listing

When your curator registers your listing on the Stellar Registry contract, a permanent, verifiable record is created on the blockchain. This means:

- Your listing cannot be arbitrarily deleted by any single party
- Anyone can independently verify your listing on the Stellar network
- Your listing ID is tied to your wallet address

**TTL (Time to Live):** On-chain listings expire after approximately 1 year (535,000 ledgers). Your curator should renew it using the **Renew Listing** button or the Stellar CLI before it expires.

You can view your listing on any Stellar explorer using your wallet address.

---

## Profile Completeness Tips

A complete profile gets significantly more views and contact requests. Make sure your curator has added:

| Field              | Why it matters                                              |
| ------------------ | ----------------------------------------------------------- |
| **Photo**          | Builds trust — listings with photos get 3× more clicks      |
| **Bio**            | Describe your experience, specialisations, and service area |
| **Phone**          | Primary contact method for most users                       |
| **Email**          | Secondary contact for less urgent enquiries                 |
| **Category**       | Determines which search results your listing appears in     |
| **Wallet Address** | Required for receiving on-chain tips and payments           |

---

## Your Availability

Your curator can set your availability schedule — the days and times you are open for work. This helps users know when to expect a response.

**To update your availability**, contact your curator and provide your preferred schedule. Curators manage this via the Dashboard or API.

If you are temporarily unavailable (holiday, illness), ask your curator to use the **Toggle Availability** feature to mark you as inactive. Your listing stays intact but won't appear in active worker searches.

---

## Receiving Tips and Payments

Once your wallet address is in your listing, users can send you XLM (or supported Stellar tokens) directly via the BlueCollar Market smart contract.

**How it works:**

1. User clicks **Send Tip** on your profile.
2. Freighter opens on their side — they enter the amount and approve.
3. Stellar processes the transaction — typically settles in 3–5 seconds.
4. Funds appear in your Stellar wallet immediately.

You can check your balance in Freighter or any Stellar explorer (e.g., [stellar.expert](https://stellar.expert)).

**Platform fee:** A small basis-point fee is applied to payments. Check current fee at:

```bash
curl https://api.bluecollar.app/api/v1/payments/fee
```

**Escrow payments:** For larger jobs, users can create an escrow. Funds are locked on-chain and released when both parties agree the work is done.

---

## Building Your Reputation

Your reputation is the single most important factor for getting more work through BlueCollar. Here's how to build it:

1. **Complete jobs reliably** — show up on time, do quality work.
2. **Ask satisfied clients to leave a review** — a kind reminder after a job helps.
3. **Keep your availability up to date** — responding quickly to contact requests is tracked.
4. **Get verification badges** — having your credentials verified by the platform boosts your score.

---

## Understanding Your Reputation Score

Your reputation score is calculated from multiple signals:

| Signal                | Weight |
| --------------------- | ------ |
| Average review rating | High   |
| Number of reviews     | Medium |
| Review recency        | Medium |
| Response time         | Medium |
| Verification status   | High   |
| On-chain registration | Medium |

Check your current score via the API:

```bash
curl https://api.bluecollar.app/api/v1/workers/wkr_your_id/reputation
```

Response:

```json
{
  "status": "success",
  "data": {
    "score": 87,
    "breakdown": {
      "avgRating": 4.8,
      "reviewCount": 23,
      "verified": true,
      "onChain": true,
      "responseTime": "fast"
    }
  }
}
```

---

## Verification Badges

Verification badges signal to users that your credentials have been checked. Types of verifications may include:

- Identity verification
- Trade licence / certification
- Insurance
- Community endorsement

Your curator or a platform admin can add verifications to your profile. Contact them if you have credentials you would like added.

---

## Portfolio (Coming Soon)

A portfolio section is planned where you can showcase photos of completed work. Ask your curator to add portfolio images in the meantime via the portfolio endpoints.

---

## Responding to Contact Requests

When a user sends you a contact request through the platform, it is routed to your curator's dashboard. The curator will see your contact details and pass the message on to you.

Make sure your phone number and email in the listing are current and correct. This is the only way users can reach you through the platform.

---

## Applying to Jobs

If you have a BlueCollar account (not required for basic listings), you can browse and apply to job postings directly:

```bash
# Browse open jobs in your category
curl "https://api.bluecollar.app/api/v1/jobs?category=cat_electrician_01&status=open"

# Apply
curl -X POST https://api.bluecollar.app/api/v1/jobs/job_id/apply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "coverLetter": "I have 8 years of experience in residential electrical work and I am available this week.",
    "proposedBudget": 200
  }'
```

---

## Troubleshooting FAQ

**Q: How do I get a curator to create my listing?**
A: Join the [Telegram group](https://t.me/bluecollar) or post in [GitHub Discussions](https://github.com/Fidelis900/Blue-Collar/discussions). Community curators will be happy to help you get listed.

**Q: I haven't received any tips in my wallet.**
A: Make sure your wallet address in the listing is correct — it must be your Stellar public key (starts with `G`). Ask your curator to double-check it.

**Q: My listing appears as "Inactive".**
A: Your curator has toggled your availability off, or your on-chain listing may have expired. Contact your curator to re-activate or renew the listing.

**Q: I want to update my bio or contact details.**
A: Contact your curator. They can edit the listing from their Dashboard or via the API.

**Q: My on-chain listing has expired — what happens?**
A: Your off-platform listing (database) remains intact. Only the on-chain record has expired and needs to be renewed via the `extend_worker_ttl` function. Ask your curator to renew it.

**Q: A user left an unfair or abusive review.**
A: Users can flag reviews for moderation. Ask the user to flag it, or contact a platform admin to have it reviewed. Admins can remove reviews that violate the community guidelines.

**Q: I set up a Stellar wallet but the funds aren't showing.**
A: Check the correct network (testnet vs mainnet). If you're on testnet, funds only exist in the test environment. Mainnet tips use real XLM.

**Q: Can I have more than one listing?**
A: A curator can create multiple listings for different trades or locations. Each listing is independent on-chain.

**Q: How long does it take for a review to appear?**
A: Reviews appear immediately on your profile once submitted.
