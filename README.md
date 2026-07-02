# PayGuard AI 🛡️

> **Verify Once. Pay with Confidence. The Proof-of-Life Layer for Government Payroll.**

[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)]()
[![Node](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square)](https://www.typescriptlang.org)

---

## The Problem

Nigeria loses an estimated **₦15–20 billion monthly** to ghost workers — employees who have resigned, passed away, or never existed, yet continue drawing salaries from government payrolls.

Existing verification systems authenticate identity at **enrolment**. Nobody checks again at **disbursement**.

PayGuard AI closes this gap. Before any salary leaves a ministry wallet, the worker must pass a real-time AI-powered biometric challenge — in their browser, on any smartphone, with no app download required.

---

## How It Works

```
HR Admin                     Worker (any phone/browser)
────────                     ──────────────────────────
1. Upload staff CSV          
2. Assign reference photos   
3. Trigger verification round
                             4. Receive secure one-time email link
                             5. Open link → biometric challenge starts
                                 ├── Blink twice
                                 ├── Turn head left → right
                                 └── Smile and hold
                             6. AI scores liveness + face match
                             7. Result submitted to backend
4. Dashboard shows results:
   ├── Verified  → added to payment batch
   ├── Review    → manual HR check
   └── Flagged   → ghost alert, payment blocked
5. Admin approves batch
6. Payment API disburses salaries to verified accounts only
```

---

## AI Engine

All AI processing runs **in the worker's browser**. No biometric video or images are transmitted to the server.

### Liveness Detection (`ai/liveness/livenessDetector.js`)

Uses **MediaPipe FaceMesh** (468 3D facial landmarks) to confirm the person is physically present.

| Challenge | How it's detected |
|-----------|-------------------|
| Blink | Eye Aspect Ratio (EAR) threshold crossing — requires full open→close→open cycle |
| Head turn | Nose-tip lateral ratio shift across cheek anchor points |
| Smile | Mouth Aspect Ratio (MAR) sustained above threshold for ≥ 500 ms |

Anti-spoofing:
- Rejects static photos and screen replays (require genuine facial motion)
- Hardware camera lock — detects and rejects OBS, DroidCam, and other virtual camera drivers using a three-layer check: `getCapabilities()` API, label heuristics, and device-list cross-reference

### Face Matching (`ai/facematch/faceMatch.js`)

Compares the live worker against their HR-uploaded reference photo.

1. Extract a 468×3 pose-normalised, scale-invariant embedding from FaceMesh landmarks
2. Compute cosine similarity between live and reference embeddings

| Similarity | Verdict |
|------------|---------|
| ≥ 0.85 | Confirmed — proceed |
| 0.80–0.85 | Uncertain — manual review |
| < 0.80 | Mismatch — payment blocked, zero trust score |

### Trust Score Calculator (`ai/trustScore/trustScore.js`)

Combines liveness and face-match into a single score:

```
Trust Score = (Liveness Score × 0.50) + (Face Match Score × 0.50)
```

| Score | Verdict | Action |
|-------|---------|--------|
| ≥ 90 | Verified | Salary disbursed automatically |
| 70–89 | Review | Payment held, HR notified |
| < 70 | Flagged | Payment blocked, ghost alert |

If face-match verdict is `mismatch`, trust score is **zeroed** regardless of liveness result.

---

## Architecture

### Current (Hackathon)

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)             │
│  Admin Dashboard │ Staff Management │ Payments       │
│  VerificationPage (public, token-gated)              │
└────────────────────────┬────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────┐
│               Backend (Node.js / Express)            │
│  /api/verification  - send email links               │
│  /api/verify        - token validation + submit      │
│  /api/payments      - batch CRUD + process           │
│  /api/organizations - setup + wallet                 │
│  /api/employees     - CSV upload + payroll           │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                   Supabase                          │
│  PostgreSQL DB │ Auth │ Storage (staff photos)       │
└─────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              Payment Provider (Sandbox)              │
│  Account lookup │ Fund transfer │ Virtual accounts   │
└─────────────────────────────────────────────────────┘
```

### Production (AWS Target Architecture)

```
                        ┌──────────────────────┐
                        │   Route 53 (DNS)     │
                        └──────────┬───────────┘
                                   │
                ┌──────────────────▼──────────────────┐
                │        CloudFront CDN                │
                │   (Static React frontend from S3)   │
                └──────────────────┬──────────────────┘
                                   │ HTTPS API calls
                ┌──────────────────▼──────────────────┐
                │          API Gateway                 │
                │   (REST endpoints → Lambda)          │
                └──────────────────┬──────────────────┘
                                   │
          ┌────────────────────────┼───────────────────┐
          │                        │                   │
┌─────────▼────────┐  ┌────────────▼─────┐  ┌─────────▼────────┐
│  Lambda: Verify  │  │ Lambda: Payments │  │ Lambda: Staff    │
│  (token + AI     │  │ (batch CRUD +    │  │ (CSV upload +    │
│   result submit) │  │  disbursement)   │  │  photo mgmt)     │
└─────────┬────────┘  └────────────┬─────┘  └─────────┬────────┘
          │                        │                   │
          └────────────────────────▼───────────────────┘
                                   │
                ┌──────────────────▼──────────────────┐
                │         Amazon RDS                   │
                │    PostgreSQL (db.t3.small)          │
                │    Same schema as current Supabase   │
                └─────────────────────────────────────┘
          
          Supporting services:
          ├── S3              — Staff reference photos (private bucket, presigned URLs)
          ├── SES             — Verification email delivery
          ├── Cognito         — HR admin authentication
          ├── Rekognition     — Optional: server-side face validation layer
          ├── CloudWatch      — Logs and alerts
          └── CloudTrail      — Immutable audit trail (compliance requirement)
```

**Estimated production cost:** $80–150/month at 5,000–20,000 staff.  
**Migration timeline for cloud engineer:** 3–4 weeks full-time.

---

## Project Structure

```
payguard-ai/
├── ai/                          # AI modules (browser-side)
│   ├── liveness/
│   │   └── livenessDetector.js  # MediaPipe challenge engine
│   ├── facematch/
│   │   └── faceMatch.js         # Cosine similarity face matching
│   └── trustScore/
│       └── trustScore.js        # Score combinator + verdict engine
│
├── backend/                     # Node.js / Express API
│   ├── server.js                # Entry point
│   └── src/
│       ├── controllers/
│       │   ├── verifyController.js       # Token validation + liveness submit
│       │   ├── paymentController.js      # Batch CRUD + disbursement
│       │   └── organizationController.js # Setup + wallet
│       ├── routes/
│       ├── services/
│       │   └── supabaseClient.js
│       ├── middleware/
│       │   ├── authMiddleware.js         # Supabase JWT verification
│       │   ├── rateLimiter.js
│       │   └── errorHandler.js
│       └── utils/
│           └── emailService.js
│
└── frontend/                    # React 19 / Vite / TypeScript
    └── src/
        ├── components/
        │   └── liveness/
        │       ├── LivenessScanner.tsx   # Full verification flow UI
        │       ├── faceVerification.ts   # Live embedding + cosine similarity
        │       ├── challengeEngine.ts    # EAR / head ratio / MAR
        │       └── trustScore.ts        # Client-side score calculator
        ├── pages/
        │   ├── Dashboard/Home.tsx        # Stats + ghost alerts
        │   ├── PayGuard/Staff.tsx        # Staff management + CSV upload
        │   ├── PayGuard/Payments.tsx     # Batch approval + disbursement
        │   └── Verification/VerificationPage.tsx  # Public worker-facing page
        └── lib/
            └── supabaseClient.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with the schema from `backend/src/models/schema.sql`
- Payment API sandbox credentials

### Install

```bash
git clone https://github.com/Abbey256/PayGuard-AI.git
cd PayGuard-AI

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Configure environment variables

**`backend/.env`**
```env
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PAYMENT_API_SECRET_KEY=your_payment_sandbox_key
RESEND_API_KEY=your_email_api_key
FRONTEND_URL=http://localhost:5173
```

**`frontend/.env`**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:5000
```

### Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
Backend health check: http://localhost:5000/health

---

## Rubric Alignment (JAF BuildVerse 2026)

| Criterion | Implementation |
|-----------|---------------|
| **Code Structure** | Monorepo: `ai/` (engine), `backend/` (API), `frontend/` (UI). Controllers, routes, services, middleware all separated |
| **Functionality** | End-to-end flow: CSV upload → email → biometric scan → trust score → payment batch → disbursement |
| **AI Depth** | MediaPipe FaceMesh (468 landmarks, 3D), challenge engine (blink/head/smile), cosine similarity face matching, hardware camera lock — all core to the product value |
| **AI Output Quality** | Trust score is deterministic and explainable with a per-component breakdown. Hard mismatch zeros the score. Uncertain cases route to manual review |
| **UX** | Mobile-first verification page, voice-guided challenges (Web Speech API), dark mode admin dashboard |
| **Problem Definition** | Nigeria ghost worker crisis — ₦15–20B monthly leak, specific to disbursement-time verification gap |
| **Focus Area** | Civic Engagement + Social Impact & Inclusion |
| **Target User** | Government HR admins + public sector employees on any smartphone |
| **Feasibility** | Browser-based AI (no GPU server), email delivery, works on low-end Android — designed for Nigerian infrastructure constraints |
| **Scalability** | Architecture maps directly to AWS serverless (Lambda + API Gateway) — no re-architecture needed for production |

---

## Key Design Decisions

**Why client-side AI?**  
Running inference in the worker's browser means no GPU cloud costs, works offline after initial load, and biometric data never leaves the device until a numeric score is transmitted.

**Why geometric embeddings instead of a neural face model?**  
Neural models (face-api.js) require 30–90 MB downloads and WebGL. On a ₦10,000 Android phone with 2G data, that fails. MediaPipe FaceMesh is already loaded for liveness — we derive identity comparison from the same landmark data at zero added cost.

**Why Supabase for the hackathon?**  
Speed of development. The schema, auth, and storage are production-grade. The migration path to AWS RDS + Cognito + S3 is a configuration change, not a rewrite.

---

## Known Limitations & Security Transparency

This section is intentionally honest. Hackathon judges and future engineers should understand what is production-ready and what is not.

### What is production-ready in this build

- **Server-side trust score recomputation** — The backend ignores the client-supplied `trustScore` and `verdict`. It recomputes both from the raw `livenessData` challenge booleans. A tampered POST to `/api/verify/submit` with `{trustScore: 100, verdict: "verified"}` does not bypass the gate — the server derives its own verdict and writes that to the database.
- **Token single-use enforcement** — Verification tokens are marked `completed` before any DB updates, so replay attacks are blocked.
- **Tenant isolation in RLS** — Database policies scope every query to the authenticated admin's own organisation. An HR admin from Ministry A cannot read Ministry B's staff or salary data, even via direct Supabase API calls.
- **Hardware camera lock** — Virtual camera software (OBS, DroidCam, etc.) is detected and rejected before the biometric session starts.
- **Rate limiting** — Verification endpoint is limited to 10 requests per 15 minutes per IP.

### What requires production hardening before government deployment

**BVN and bank account numbers stored as plaintext**
BVN and `bank_account` are stored as `TEXT` columns in PostgreSQL. In production these must be encrypted at the column level using `pgcrypto` AES-256 or Supabase Vault (KMS envelope encryption) before any real government data is stored. This is a known gap, documented here for the next engineer.

**Client-side face matching**
The face comparison (cosine similarity on MediaPipe landmarks) runs in the worker's browser. The match score is submitted by the client and used as one input to the server's trust score formula — but the server cannot independently verify the face match without a server-side vision API. In production, a frame snapshot should be sent to Amazon Rekognition `CompareFaces` for independent server-side validation.

**No 2FA for HR admin actions**
Approving a payment batch and triggering disbursement currently requires only a Supabase JWT + typing "APPROVE". Production should require a second factor (OTP or hardware key) before any money moves.

**Payment API is sandbox**
All disbursements use the sandbox environment. Transfers are simulated — no real Naira moves. Switching to production requires a verified merchant account and compliance review.

---

## Team

- **Abiodun Olabisi** — Frontend Engineering & AI Architecture
- **Najib Adebisi** — Backend Infrastructure & Payment Integration

---

*PayGuard AI — Because every Naira should reach a living, breathing human.*
