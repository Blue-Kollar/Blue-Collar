# End-to-End Worker Onboarding Flow

> Issue #720 · Priority: High · Complexity: Medium

Design specification for the full flow a worker (or curator on their behalf) follows from account creation through document verification to a live, discoverable profile. All screens are **mobile-first** (375 px base). All patterns use design tokens (`--primary: 221 83% 53%`, `--destructive: 0 84% 60%`) and Tailwind utility classes consistent with the rest of the design system.

---

## Table of Contents

- [Flow Overview](#flow-overview)
- [Role Selection](#role-selection)
- [Account Creation](#account-creation)
  - [Email Registration](#email-registration)
  - [Email Verification Gate](#email-verification-gate)
  - [Google OAuth Path](#google-oauth-path)
- [Profile Setup — Progressive Disclosure](#profile-setup--progressive-disclosure)
  - [Step 1 — Basic Info](#step-1--basic-info)
  - [Step 2 — Trade & Location](#step-2--trade--location)
  - [Step 3 — Contact & Wallet](#step-3--contact--wallet)
  - [Step 4 — Avatar & Bio](#step-4--avatar--bio)
- [Curator Path — Listing on Behalf of a Worker](#curator-path--listing-on-behalf-of-a-worker)
- [Verification Flow](#verification-flow)
  - [Submit Documents](#submit-documents)
  - [Pending State](#pending-state)
  - [Approved — Celebration Screen](#approved--celebration-screen)
  - [Rejected State](#rejected-state)
- [On-Chain Registration](#on-chain-registration)
- [Live Profile — Onboarding Complete](#live-profile--onboarding-complete)
- [Abandonment & Resume States](#abandonment--resume-states)
- [Accessibility Annotations](#accessibility-annotations)

---

## Flow Overview

```
                        ┌─────────────────────┐
                        │   Landing / Sign-up  │
                        └──────────┬──────────┘
                                   │
                         ┌─────────▼─────────┐
                         │   Role Selection   │
                         └──┬────────────┬───┘
                            │            │
               ┌────────────▼──┐    ┌────▼──────────────┐
               │  Worker path  │    │  Curator path      │
               │  (self-serve) │    │  (on behalf)       │
               └──────┬────────┘    └─────────┬──────────┘
                      │                        │
          ┌───────────▼───────────┐            │
          │  Account Creation     │            │
          │  (email or Google)    │            │
          └───────────┬───────────┘            │
                      │                        │
          ┌───────────▼───────────┐            │
          │  Email Verification   │            │
          └───────────┬───────────┘            │
                      │                        │
          ┌───────────▼──────────────────────┐
          │  Profile Setup (4 steps)         │◄─┘
          │  Step 1: Basic Info              │
          │  Step 2: Trade & Location        │
          │  Step 3: Contact & Wallet        │
          │  Step 4: Avatar & Bio            │
          └───────────┬──────────────────────┘
                      │
          ┌───────────▼───────────┐
          │  Submit Verification  │
          │  Documents            │
          └───────────┬───────────┘
                      │
           ┌──────────▼──────────┐
           │  Pending Review     │
           └──────┬─────────┬────┘
                  │         │
          ┌───────▼──┐  ┌───▼──────┐
          │ Approved │  │ Rejected │
          └───────┬──┘  └───┬──────┘
                  │         │ (resubmit)
                  │         └──────────────► Submit Verification
          ┌───────▼───────────┐
          │ On-Chain Register │
          └───────┬───────────┘
                  │
          ┌───────▼───────────┐
          │  Live Profile ✓   │
          └───────────────────┘
```

---

## Role Selection

First screen after landing. Determines which path the user follows.

```
┌─────────────────────────────────────┐
│                                     │
│         Welcome to BlueCollar       │
│    Connecting skilled workers with  │
│    people who need them.            │
│                                     │
│  I want to…                         │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🔨  List myself as a       │    │
│  │      skilled worker         │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  👥  List a worker on       │    │
│  │      their behalf (curator) │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🔍  Find a skilled worker  │    │
│  └─────────────────────────────┘    │
│                                     │
│  Already have an account?  Sign in  │
└─────────────────────────────────────┘
```

- "List myself" → Worker self-serve path (role: `user`, later `curator` if approved)
- "List a worker on their behalf" → Curator path (requires existing `curator` role)
- "Find a skilled worker" → Discovery / user path, skips onboarding
- Selection stored in `localStorage` as `bc_onboarding_role` for resume

---

## Account Creation

### Email Registration

```
┌─────────────────────────────────────┐
│  ←  Create your account             │
│  ──────────────────────────────── │
│                                     │
│  First name                         │
│  ┌─────────────────────────────┐    │
│  │  Jane                       │    │
│  └─────────────────────────────┘    │
│                                     │
│  Last name                          │
│  ┌─────────────────────────────┐    │
│  │  Doe                        │    │
│  └─────────────────────────────┘    │
│                                     │
│  Email address                      │
│  ┌─────────────────────────────┐    │
│  │  jane@example.com           │    │
│  └─────────────────────────────┘    │
│                                     │
│  Password                           │
│  ┌───────────────────────┐  [👁]    │
│  │  ••••••••••           │          │
│  └───────────────────────┘          │
│  Minimum 8 characters               │
│                                     │
│       [ Create account ]            │
│                                     │
│    ── or ──                         │
│    [ Continue with Google ]         │
│                                     │
│  By continuing you agree to the     │
│  Terms of Service and Privacy Policy│
└─────────────────────────────────────┘
```

Maps to `POST /auth/register` with `{ email, password, firstName, lastName }`.

**Validation** (inline, on blur):

- First/last name: required
- Email: valid format, shown as taken if 409 returned
- Password: ≥ 8 characters, strength indicator bar (weak/fair/strong)

---

### Email Verification Gate

Shown immediately after registration. Blocks progress until verified.

```
┌─────────────────────────────────────┐
│                                     │
│         ✉  (icon, 48px)             │
│                                     │
│      Check your email               │
│   We sent a link to                 │
│   jane@example.com                  │
│                                     │
│   Click the link to verify your     │
│   account and continue setup.       │
│                                     │
│   [ Resend email ]                  │
│                                     │
│   Wrong email?  [ Start over ]      │
│                                     │
│   ─ polling every 5 s ─             │
│   (auto-advances when verified)     │
└─────────────────────────────────────┘
```

- Page polls `GET /auth/me` every 5 s; when `verified: true` it auto-advances to Profile Setup.
- "Resend email" → `POST /auth/resend-verification` (rate-limited, button disabled 60 s after click).
- Deep link from email: `PUT /auth/verify-account?token=<token>` → redirects to `/onboarding/profile`.

---

### Google OAuth Path

Clicking "Continue with Google" → `GET /auth/google` → Google consent → `GET /auth/google/callback` → redirect to `/auth-callback?token=<jwt>`.  
Google accounts are pre-verified (no email gate). Auto-advances to Profile Setup.

---

## Profile Setup — Progressive Disclosure

A 4-step wizard with a progress indicator. Steps are saved after each "Continue" so the user can resume at any point.

```
Progress indicator (top of each step):
┌──────────────────────────────────────┐
│  ●──────●──────○──────○              │
│  Info   Trade  Contact  Photo        │
│  Step 1 of 4                         │
└──────────────────────────────────────┘
```

Each completed step saves partial state to `localStorage` under `bc_onboarding_progress`.

---

### Step 1 — Basic Info

```
┌─────────────────────────────────────┐
│  ←  Step 1 of 4 · Basic info        │
│  ●──────○──────○──────○             │
│  ──────────────────────────────── │
│                                     │
│  Worker's full name  *              │
│  ┌─────────────────────────────┐    │
│  │  John Doe                   │    │
│  └─────────────────────────────┘    │
│                                     │
│  Short bio  (optional)              │
│  ┌─────────────────────────────┐    │
│  │  Expert plumber with 10     │    │
│  │  years of experience…       │    │
│  └─────────────────────────────┘    │
│  0 / 300 characters                 │
│                                     │
│            [ Continue → ]           │
│            [ Save & exit ]          │
└─────────────────────────────────────┘
```

Maps to `name` and `bio` fields on `CreateWorkerBody`.

---

### Step 2 — Trade & Location

```
┌─────────────────────────────────────┐
│  ←  Step 2 of 4 · Trade & location  │
│  ●──────●──────○──────○             │
│  ──────────────────────────────── │
│                                     │
│  Trade / category  *                │
│  ┌─────────────────────────────┐    │
│  │  Plumber                ▼  │    │
│  └─────────────────────────────┘    │
│  (populated from GET /categories)   │
│                                     │
│  City  *                            │
│  ┌─────────────────────────────┐    │
│  │  Manchester                 │    │
│  └─────────────────────────────┘    │
│                                     │
│  Country  *                         │
│  ┌─────────────────────────────┐    │
│  │  United Kingdom         ▼  │    │
│  └─────────────────────────────┘    │
│                                     │
│  State / Province  (optional)       │
│  ┌─────────────────────────────┐    │
│  │  England                    │    │
│  └─────────────────────────────┘    │
│                                     │
│            [ Continue → ]           │
│            [ Save & exit ]          │
└─────────────────────────────────────┘
```

Maps to `categoryId` and `locationId` (creates/links a `Location` record).

---

### Step 3 — Contact & Wallet

```
┌─────────────────────────────────────┐
│  ←  Step 3 of 4 · Contact & wallet  │
│  ●──────●──────●──────○             │
│  ──────────────────────────────── │
│                                     │
│  Phone  (optional)                  │
│  ┌─────────────────────────────┐    │
│  │  +44 7700 900000            │    │
│  └─────────────────────────────┘    │
│                                     │
│  Public email  (optional)           │
│  ┌─────────────────────────────┐    │
│  │  john@example.com           │    │
│  └─────────────────────────────┘    │
│                                     │
│  Stellar wallet address  (optional) │
│  ┌─────────────────────────────┐    │
│  │  G1abc…                     │    │
│  └─────────────────────────────┘    │
│  Used to receive tips & payments    │
│  [ Connect Freighter wallet ]       │
│                                     │
│            [ Continue → ]           │
│            [ Skip for now ]         │
└─────────────────────────────────────┘
```

Maps to `phone`, `email`, `walletAddress` on `CreateWorkerBody`.  
"Connect Freighter wallet" calls `requestAccess()` + `getAddress()` and pre-fills the field.  
"Skip for now" advances without wallet; can be added later from the profile.

---

### Step 4 — Avatar & Bio

```
┌─────────────────────────────────────┐
│  ←  Step 4 of 4 · Photo             │
│  ●──────●──────●──────●             │
│  ──────────────────────────────── │
│                                     │
│  Profile photo  (optional)          │
│                                     │
│        ┌──────────────┐             │
│        │              │             │
│        │  [ + Upload ]│             │
│        │  (tap to add)│             │
│        └──────────────┘             │
│        JPG / PNG / WebP, max 5 MB   │
│                                     │
│  After upload: thumbnail preview    │
│  + [ Remove ] link.                 │
│                                     │
│       [ Create listing → ]          │
│       [ Skip for now ]              │
└─────────────────────────────────────┘
```

On "Create listing" → `POST /workers` with all collected fields (multipart if avatar present).  
On success → transition to **Verification Flow**.

---

## Curator Path — Listing on Behalf of a Worker

Curators bypass account creation (they already have a `curator` role account) and go directly to the 4-step profile setup wizard pre-labelled "Create worker listing".

```
┌─────────────────────────────────────┐
│  New worker listing                 │
│  You are creating this on behalf    │
│  of a worker as a curator.          │
│  ──────────────────────────────── │
│  (same 4-step wizard as above)      │
└─────────────────────────────────────┘
```

After listing creation, the curator is prompted to submit verification documents on the worker's behalf (same verification flow below).

---

## Verification Flow

### Submit Documents

Shown immediately after a worker listing is created (`worker.isVerified = false`).

```
┌─────────────────────────────────────┐
│  Get verified                       │
│  ──────────────────────────────── │
│                                     │
│  Verification helps workers build   │
│  trust and appear higher in search. │
│                                     │
│  Document URL  *                    │
│  ┌─────────────────────────────┐    │
│  │  https://…                  │    │
│  └─────────────────────────────┘    │
│  Link to a hosted document          │
│  (ID, trade cert, licence)          │
│                                     │
│  Notes  (optional)                  │
│  ┌─────────────────────────────┐    │
│  │  e.g. "Gas Safe cert #…"    │    │
│  └─────────────────────────────┘    │
│                                     │
│       [ Submit for review ]         │
│       [ Skip — do this later ]      │
└─────────────────────────────────────┘
```

Maps to `POST /verifications` with `{ workerId, documentUrl, notes }`.

---

### Pending State

Shown after submission and on any return visit while status is pending.

```
┌─────────────────────────────────────┐
│                                     │
│       ⏳  (icon, 48px)              │
│                                     │
│    Verification in progress         │
│  Your documents are being reviewed. │
│  We'll notify you by email when     │
│  a decision has been made.          │
│                                     │
│  Submitted  25 Jun 2026             │
│                                     │
│  In the meantime your profile is    │
│  visible but shown as unverified.   │
│                                     │
│       [ View profile ]              │
└─────────────────────────────────────┘
```

- Status badge on profile card: `Verification pending` (`bg-yellow-100 text-yellow-700`).
- Page polls `GET /workers/:id/verifications` every 30 s; auto-advances on status change.

---

### Approved — Celebration Screen

Triggered when `verificationRequest.status = 'approved'` (detected via poll or email deep-link).

```
┌─────────────────────────────────────┐
│                                     │
│     🎉  (confetti animation)        │
│                                     │
│     You're verified!                │
│  Your profile is now verified and   │
│  will appear higher in search.      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ✓ Profile created          │    │
│  │  ✓ Documents verified       │    │
│  │  ○ Register on-chain        │    │
│  └─────────────────────────────┘    │
│                                     │
│  [ Register on Stellar (optional) ] │
│  [ Go to my profile ]               │
└─────────────────────────────────────┘
```

- `isVerified` badge on profile card changes to `✓ Verified` (`text-primary`).
- Confetti animation: CSS keyframes, respects `prefers-reduced-motion` (disabled if set).

---

### Rejected State

```
┌─────────────────────────────────────┐
│                                     │
│       ✕  (red, 48px)               │
│                                     │
│    Verification not approved        │
│                                     │
│  Reason from reviewer:              │
│  ┌─────────────────────────────┐    │
│  │  "Document URL was          │    │
│  │   inaccessible."            │    │
│  └─────────────────────────────┘    │
│                                     │
│  Please fix the issue and           │
│  resubmit your documents.           │
│                                     │
│       [ Resubmit documents ]        │
│       [ Contact support ]           │
└─────────────────────────────────────┘
```

"Resubmit documents" returns to [Submit Documents](#submit-documents) with fields pre-filled.  
`reviewNote` from `PATCH /verifications/:id/review` is shown as the reason.

---

## On-Chain Registration

Optional step after verification. Anchors the worker profile to the Stellar Registry contract.

```
┌─────────────────────────────────────┐
│  Register on Stellar                │
│  ──────────────────────────────── │
│                                     │
│  Anchoring your profile on-chain    │
│  makes it permanent and trustless.  │
│                                     │
│  Contract ID  *                     │
│  ┌─────────────────────────────┐    │
│  │  C…                         │    │
│  └─────────────────────────────┘    │
│  The deployed Registry contract ID  │
│                                     │
│  ┌──── Wallet signing ──────────┐   │
│  │  Approve in your wallet      │   │
│  │  (same signing state as      │   │
│  │   payment flows)             │   │
│  └──────────────────────────────┘   │
│                                     │
│       [ Register ]                  │
│       [ Skip — do this later ]      │
└─────────────────────────────────────┘
```

Maps to `POST /workers/:id/register-on-chain` with `{ contractId }`.  
On success → `stellarContractId` stored; checklist item "Register on-chain" becomes `✓`.

---

## Live Profile — Onboarding Complete

Final screen. `User.onboardingCompleted` is set to `true` server-side.

```
┌─────────────────────────────────────┐
│                                     │
│       ✓  (green, 48px)              │
│                                     │
│   Your profile is live!             │
│   Workers can now find you on       │
│   BlueCollar.                       │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ✓ Profile created          │    │
│  │  ✓ Documents verified       │    │
│  │  ✓ Registered on-chain      │    │
│  └─────────────────────────────┘    │
│                                     │
│       [ View my profile ]           │
│       [ Share my profile ]          │
└─────────────────────────────────────┘
```

"Share my profile" opens the native share sheet (Web Share API) with the profile URL.

---

## Abandonment & Resume States

### Abandonment Detection

"Save & exit" on any step saves progress to `localStorage` (`bc_onboarding_progress`) and `PATCH /users/me` with `{ onboardingCompleted: false }`. The user is taken to their dashboard.

### Resume Banner

Shown on the dashboard when `onboardingCompleted = false` and partial progress exists:

```
┌─────────────────────────────────────┐
│  📋  Finish setting up your profile │
│  You're on step 2 of 4.             │
│                [ Continue → ]       │
└─────────────────────────────────────┘
```

Clicking "Continue" restores the wizard at the last completed step.

### Resume Entry Points

| Scenario                                     | Resume point                      |
| -------------------------------------------- | --------------------------------- |
| Left after registration, before email verify | Email verification gate           |
| Verified email, left before profile steps    | Step 1 — Basic Info               |
| Completed steps 1–2, left on step 3          | Step 3 — Contact & Wallet         |
| Profile created, left before verification    | Submit Documents                  |
| Verification pending                         | Pending State                     |
| Verification approved, skipped on-chain      | Approved screen with on-chain CTA |

### Expired / Invalid Resume

If `bc_onboarding_progress` is stale (> 7 days) or the worker record no longer exists, the resume banner is hidden and `localStorage` is cleared.

---

## Accessibility Annotations

| Element                             | Requirement                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Step wizard progress bar            | `role="progressbar"`, `aria-valuenow=<step>`, `aria-valuemin="1"`, `aria-valuemax="4"`, `aria-label="Step 2 of 4"` |
| Step headings                       | Each step has an `<h1>` that matches the step title; focus moves to `<h1>` on step transition                      |
| Form fields                         | All inputs have associated `<label>` elements; required fields have `aria-required="true"`                         |
| Inline errors                       | `aria-describedby` links input to error message; `role="alert"` on error container                                 |
| Password visibility toggle          | `aria-label="Show password"` / `aria-label="Hide password"` toggled on click                                       |
| Password strength indicator         | `aria-live="polite"` region announces strength label (Weak / Fair / Strong)                                        |
| Email verification polling          | `aria-live="polite"` status region announces "Verified! Continuing…"                                               |
| Celebration confetti                | `aria-hidden="true"`; heading "You're verified!" is the primary announcement                                       |
| Wallet connect button               | `aria-busy="true"` while awaiting Freighter; `aria-label="Connect Freighter wallet"`                               |
| Role selection cards                | `role="radio"` + `aria-checked`; group wrapped in `role="radiogroup"`                                              |
| "Save & exit" / "Skip"              | Clearly labelled; keyboard accessible; does not submit the form                                                    |
| Mobile step navigation (back arrow) | `aria-label="Go back to previous step"`                                                                            |
