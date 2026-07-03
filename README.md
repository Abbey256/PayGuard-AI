<div align="center">

# 🛡️ PayGuard AI

### *Ghost workers don't blink. Real ones do.*

**Biometric payroll verification for Nigerian government agencies**  
Stop ghost worker fraud before a single naira leaves the wallet.

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-payguard--ai--twhx.onrender.com-22c55e?style=for-the-badge)](https://payguard-ai-twhx.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Squad](https://img.shields.io/badge/Squad-Payment_API-FF6B35?style=for-the-badge)](https://squadco.com)

</div>

---

## 💀 The Problem

Ghost workers — deceased, retired, or entirely fictitious employees — drain an estimated **₦200 billion** from the Nigerian government every year. Traditional payroll audits rely on paper documentation that can be forged in an afternoon. HR sign-offs get rubber-stamped. The money disappears.

PayGuard AI makes this structurally impossible:

> **No face. No blink. No salary.**

---

## ✨ What It Does

```
📋 HR uploads staff + photo
📧 Sends one-time verification link to worker's phone
📱 Worker opens link → camera starts
👁️ Worker completes 3 randomised biometric challenges
🔐 Server verifies the session cryptographically
✅ Worker marked verified → auto-added to salary batch
💰 HR approves → Squad API disburses salaries
🚫 Name mismatch? Payment blocked. Fraud logged.
```

Every step is locked. Every decision is audited.

---

## 🎯 Features

<table>
<tr>
<td width="50%">

### 🔒 Anti-Fraud
- HMAC-SHA256 signed challenge nonces
- Server-side score recomputation (client score ignored)
- Cryptographically randomised challenge order
- Replay attack prevention (single-use nonces)
- Hardware camera lock (blocks OBS, DroidCam, etc.)
- Bank account name verification before every transfer

</td>
<td width="50%">

### 🧠 Biometrics
- MediaPipe FaceMesh — 468 3D facial landmarks
- Adaptive EAR calibration per person per session
- Blink detection with hysteresis
- Head turn ratio (left → right sequence)
- Smile hold detection (1000ms sustained)
- Cosine similarity face matching (pose-normalised)

</td>
</tr>
<tr>
<td>

### 💳 Payments
- Squad API virtual accounts per ministry
- Batch salary disbursement with HR approval gate
- Jaro-Winkler fuzzy name matching
- Identity swap prevention before every transfer
- Full audit trail per transaction

</td>
<td>

### 📊 Dashboard
- Real-time staff verification status
- Payment batch management
- Ghost worker flagging
- Wallet balance + transaction history
- CSV payroll bulk upload

</td>
</tr>
</table>

---

## 🏗️ Architecture

### Current Deployment

```
                    ┌─────────────────────────────┐
                    │      Render (Single Service)  │
                    │                               │
   Browser ────────▶│  Express.js (Node 24)         │
                    │    ├── Serves React SPA        │
                    │    ├── REST API (/api/*)        │
                    │    └── Static files (dist/)    │
                    └──────────────┬────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
       ┌──────▼──────┐    ┌────────▼──────┐   ┌────────▼──────┐
       │  Supabase   │    │   Squad API   │   │  Resend API   │
       │ PostgreSQL  │    │  Payments +   │   │   (Email)     │
       │   + Auth    │    │  Virtual Accs │   └───────────────┘
       │   + RLS     │    └───────────────┘
       └─────────────┘
```

### Planned AWS Production Architecture

> Serverless Lambda + API Gateway, Multi-AZ, with AWS Rekognition for server-side face verification

```
Route53 → CloudFront → WAF → API Gateway → Lambda Functions
                                               ├── VerifyLambda  → RDS + ElastiCache
                                               ├── PaymentLambda → Squad API
                                               └── AuditLambda   → SQS → CloudWatch

S3 (staff photos) → Rekognition (face compare)
Secrets Manager (keys) | KMS (BVN/account encryption) | CloudTrail (audit)
```

---

## 🔐 The Nonce System (Anti-Bypass)

This is the core security innovation. Without it, a fraudster could just POST:
```json
{ "blinkDetected": true, "headTurnDetected": true, "smileDetected": true, "faceMatchScore": 100 }
```
...and get verified without ever showing their face.

Here's how we close that door:

```
1. GET /api/verify/:token
   Server generates:
   payload = { seq: ["smile","blink","headTurn"], ts: Date.now(), rnd: <16 random bytes>, tok: token }
   nonce   = base64url(payload) + "." + HMAC-SHA256(payload, NONCE_SECRET)
   ↓
   Returned to browser (browser CANNOT forge this — they don't have NONCE_SECRET)

2. Browser runs challenges in the SERVER-DICTATED order

3. POST /api/verify/submit  { ..., challengeNonce: "<the nonce>" }
   Server checks:
   ✓ HMAC signature valid (timing-safe comparison)
   ✓ Payload not expired (10 min TTL)
   ✓ Token binding matches
   ✓ Nonce not already used (replay prevention)
   ✗ Any check fails → 403 + fraud logged
```

---

## 🧪 Verification Flow (End to End)

```
HR Admin (Dashboard)                    Worker (Mobile)              Backend
────────────────────                    ───────────────              ───────

Upload staff photo ──────────────────────────────────────────────▶ Stored in Supabase Storage
Send verification link ──────────────────────────────────────────▶ Token created, email sent
                              ◀── Opens /verify/:token ──────────── Token validated
                                                                     Signed nonce issued
                                                                     Challenge order set

                              Camera starts ───────────────────────
                              Positioning (2s EAR calibration) ───
                              Challenge 1: e.g. Smile 😊 ─────────
                              Challenge 2: e.g. Blink 👁️ ─────────
                              Challenge 3: e.g. Head turn ↔️ ──────
                              Face match vs HR photo ─────────────
                              Submit + nonce ─────────────────────▶ Nonce verified
                                                                     Score recomputed
                                                                     Staff → verified
                                                                     Added to batch ──▶ payment_batches

Review batch ◀──────────────────────────────────────────────────── Real-time update
Approve batch ───────────────────────────────────────────────────▶ status: approved
Confirm payment (type APPROVE) ──────────────────────────────────▶ Squad name lookup
                                                                     Jaro-Winkler match
                                                                     Squad transfer ────▶ Worker's bank
```

---

## 📊 AI Performance Metrics

These metrics are based on real testing during development — not synthetic benchmarks.

### Liveness Detection

| Metric | Value | Notes |
|--------|-------|-------|
| Challenge completion rate | ~95% | Tested on Android Chrome, iOS Safari |
| EAR blink calibration range | 0.15 – 0.32 | Varies by eye shape, lighting, distance |
| Adaptive threshold (close) | baseline × 0.70 | Calibrated per person per session |
| Adaptive threshold (open) | baseline × 0.85 | Hysteresis prevents double-counting |
| Head turn ratio threshold | < 0.35 left, > 0.65 right | Forgiving for low-light conditions |
| Smile hold requirement | 1000ms sustained | Prevents accidental triggers |
| Processing framerate | 24 fps | Throttled for mobile battery |
| MediaPipe init time | 1–3s | CDN load, one-time per session |

### Face Matching (Cosine Similarity)

| Metric | Value | Notes |
|--------|-------|-------|
| Embedding dimensions | 1,404 | 468 landmarks × 3 (x, y, z) |
| Confirmed threshold | ≥ 0.78 | Pose-normalised, scale-invariant |
| Uncertain band | 0.72 – 0.78 | Manual HR review triggered |
| Hard mismatch | < 0.72 | Payment blocked, trust score → 0 |
| False positive mitigation | Adaptive per-session baseline | Different from fixed global threshold |
| Reference extraction time | ~500ms | One-shot FaceMesh on HR photo |

### Trust Score Distribution (Test Sessions)

| Outcome | Score | Conditions |
|---------|-------|-----------|
| Perfect liveness + face match | 95–100 | All 3 challenges + cosine ≥ 0.85 |
| Liveness only (face match unavailable) | 100 | All 3 challenges, no face comparison |
| Partial challenges (2/3) | 60–75 | Minimum for verified verdict |
| Face mismatch detected | 0 | Hard block regardless of liveness |
| No challenges completed | 0 | Hard block if static face also detected |

### Known Constraints

- Face matching runs client-side — browser conditions (lighting, angle, camera quality) affect cosine similarity scores
- EAR values vary significantly across individuals and devices — adaptive calibration addresses this but doesn't eliminate variance
- Production deployment will replace browser cosine similarity with **AWS Rekognition** (server-side, ~99% accuracy on well-lit photos)



```
┌─────────────────────────────────────────────────────┐
│                   SERVER-SIDE ONLY                   │
│                                                      │
│  Liveness Score                                      │
│    = 10 (base)                                       │
│    + challengesPassed × 25   (max 75 for 3/3)       │
│    + 15 (no static face detected)                    │
│    = max 100                                         │
│                                                      │
│  If faceMatchScore > 0:                              │
│    Final = (Liveness × 0.5) + (FaceMatch × 0.5)     │
│  Else (face match unavailable):                      │
│    Final = Liveness                                  │
│                                                      │
│  ≥ 90 → ✅ verified   (salary released)              │
│  70–89 → ⏸️  review    (HR notified)                 │
│  < 70  → 🚫 flagged   (payment blocked)              │
└─────────────────────────────────────────────────────┘

Client-supplied trustScore and verdict are ALWAYS ignored.
```

---

## 🎨 UI/UX Highlights

### Worker Verification Flow (Mobile-First)
- Full-screen camera with animated oval face guide
- Real-time feedback during each challenge (`Blinks: 1/2`, `← Turn head left`, `Hold your smile…`)
- EAR value displayed during blink challenge for calibration visibility
- Voice instructions via Web Speech API (female voice, en-GB, 0.9x rate)
- Progressive challenge stages with smooth transitions
- Immediate success/failure screen with trust score badge

### HR Admin Dashboard
- Dark mode first, clean card-based layout
- Real-time staff status updates via Supabase Realtime subscription
- Staff table with photo thumbnails, verification status badges, salary
- Payment batch review modal showing verified staff before approval
- Confirmation gate (type "APPROVE") prevents accidental payment triggers
- Post-payment summary: paid count, blocked count, disbursed amount, wallet balance

### Accessibility
- Semantic HTML throughout
- ARIA labels on interactive elements
- Keyboard navigable modals
- Sufficient colour contrast on status badges (emerald/amber/red)
- Voice-guided verification for low-literacy workers



```
PayGuard-AI/
│
├── 📱 frontend/                    React 19 + TypeScript + Vite + TailwindCSS
│   └── src/
│       ├── pages/
│       │   ├── Dashboard/Home.tsx        # Stats, verified count, savings estimate
│       │   ├── PayGuard/
│       │   │   ├── Staff.tsx             # Staff CRUD + photo upload + verification send
│       │   │   ├── Payments.tsx          # Batch review → approve → process
│       │   │   ├── Verification.tsx      # Verification request tracking
│       │   │   └── Reports.tsx           # Analytics + flagged staff
│       │   └── Verification/
│       │       └── VerificationPage.tsx  # Public worker-facing verification page
│       └── components/liveness/
│           ├── LivenessScanner.tsx       # Orchestrates the full biometric flow
│           ├── challengeEngine.ts        # Pure functions: EAR, head ratio, MAR
│           ├── faceVerification.ts       # Cosine similarity + hardware camera lock
│           ├── trustScore.ts             # Score formula + verdict
│           └── FaceGuide.tsx             # Animated oval face guide
│
├── ⚙️  backend/                     Node.js + Express 5 + ES Modules
│   └── src/
│       ├── controllers/
│       │   ├── verifyController.js       # HMAC nonce system + score recomputation
│       │   ├── paymentController.js      # Idempotent batch create + Squad disburse
│       │   ├── organizationController.js # Org setup + Squad sub-account
│       │   └── employeeController.js     # Staff + CSV upload
│       ├── services/
│       │   ├── squadService.js           # Squad: virtual accounts, transfers, lookup
│       │   ├── supabaseClient.js         # Service role client (bypasses RLS)
│       │   └── faceMatchService.js       # Placeholder → AWS Rekognition (roadmap)
│       ├── middleware/
│       │   ├── authMiddleware.js         # Supabase JWT validation
│       │   └── rateLimiter.js            # 100 req/15min general, 10/15min verify
│       └── models/schema.sql             # PostgreSQL schema + RLS policies
│
└── 🤖 ai/                           Standalone algorithm modules
    ├── liveness/livenessDetector.js  # EAR, head ratio, MAR implementations
    ├── facematch/faceMatch.js        # Cosine similarity face matching
    └── trustScore/trustScore.js      # Score combinator + verdict engine
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Supabase project
- Squad account (sandbox keys for dev)
- Resend account (email)

### Local Development

```bash
# Clone
git clone https://github.com/Abbey256/PayGuard-AI.git
cd PayGuard-AI

# Install everything
npm run install-all

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Fill in your keys

# Run both frontend (port 5173) + backend (port 5000)
npm run dev
```

### Environment Variables

**`backend/.env`**
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

SQUAD_SECRET_KEY=sandbox_sk_...
SQUAD_PUBLIC_KEY=sandbox_pk_...

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=PayGuard AI <support@yourdomain.com>

# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NONCE_SECRET=your-32-byte-hex-secret
```

**`frontend/.env`**
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Deploy to Render

| Setting | Value |
|---------|-------|
| Build Command | `npm run build` |
| Start Command | `npm run start` |
| Root Directory | *(repo root)* |

Add all backend env vars to Render's environment settings. The build installs both frontend and backend deps, runs Vite, and outputs the React app to `backend/public` where Express serves it.

---

## 🗃️ Database Schema

```sql
organizations          -- Ministry/agency accounts + Squad wallet balance
staff                  -- Employee records (status: pending/verified/flagged)
verification_requests  -- One-time tokens (status: pending/completed)
payment_batches        -- Grouped salary disbursements (status: draft/approved/processed)
payment_batch_staff    -- Staff ↔ batch junction table
payment_records        -- Per-transfer audit trail (success/failed)
audit_logs             -- Security events: fraud attempts, approvals, payouts
```

All tables have **Row Level Security (RLS)** — admins only access their own organisation's data. The `anon` role can read a single `verification_request` by token only (for the public `/verify/:token` page).

---

## 📋 Implementation Roadmap

### Phase 1 — Hackathon MVP *(Current)*
> **Target:** Tech-forward government offices (HQ/Abuja-based)

- ✅ Browser-based biometric verification (MediaPipe FaceMesh)
- ✅ HMAC-signed nonce system — API bypass prevention
- ✅ Squad API payment routing with identity guard
- ✅ Real-time HR dashboard with audit trails
- ✅ Single Render deployment — fully live and testable

### Phase 2 — Last-Mile Access *(3–6 months)*
> **Target:** Ministries with mixed connectivity and varied device access

- 🔧 **AWS Rekognition** — server-side face verification (S3 bucket ready)
- 📱 **SMS-based worker notification** — lower data requirement than email links
- 🤝 **Hybrid Agent Model** — government office staff assist low-digital-literacy workers
- 💡 **Agent dashboard** — simplified UI for verification agents at LGA offices
- 🔐 **NIN/BVN verification** — NIMC/NIBSS API for government ID matching
- 🔒 **BVN/account encryption** — pgcrypto / Supabase Vault (NDPR compliance)

### Phase 3 — Pilot & Scale *(6–12 months)*
> **Target:** Local government council pilot (2–3 councils to start)

- 📟 **USSD option** — feature phone support for unbanked/non-smartphone workers
- 🏛️ **State payroll system integration** — IPPIS and state-level equivalents
- 📊 **Analytics dashboard** — ghost worker detection patterns, savings reports
- 🔄 **Redis nonce store** — multi-instance support for scale
- ☁️ **Full AWS migration** — Lambda + API Gateway + RDS (architecture already designed)

### Known Challenges & Honest Solutions

| Challenge | V1 Reality | V2 Plan |
|-----------|-----------|---------|
| Poor connectivity | Requires stable internet + camera | SMS code + agent-assisted verification |
| Device access | Worker needs a smartphone | Verification agent has the device |
| Digital literacy | Fully self-service | Agent-guided + voice instructions |
| Trust in AI | Tech-only decision | Human + AI oversight with HR override |
| BVN/account security | Stored as plaintext (flagged, known gap) | pgcrypto envelope encryption |
| Face match accuracy | Browser cosine similarity (lighting-dependent) | AWS Rekognition (99%+ server-side) |

---

> *"We can't solve all problems now... there will always be challenges and we will refine till we get it right."*
>
> V1 works. V2 is planned. The ghost workers are already on notice.



| Feature | Status |
|---------|--------|
## 🔏 Privacy

- No video frames leave the device — ever
- No raw biometric images stored on any server
- Only numeric scores and challenge metadata transmitted
- Biometric processing is entirely ephemeral — session memory only
- Audit logs contain metadata only, not biometric data

---

## 🧰 Tech Stack

| | |
|--|--|
| **Frontend** | React 19, TypeScript, Vite 6, TailwindCSS 4 |
| **Backend** | Node.js 24, Express 5, ES Modules |
| **Database** | Supabase (PostgreSQL 15 + RLS + Realtime) |
| **Auth** | Supabase Auth (JWT) |
| **Biometrics** | MediaPipe FaceMesh (WASM, in-browser, 468 landmarks) |
| **Face Match** | Cosine similarity on pose-normalised landmark embeddings |
| **Payments** | Squad API (Nigeria) — virtual accounts + bank transfers |
| **Email** | Resend API |
| **Deployment** | Render — single web service |
| **Target Infra** | AWS (Lambda, RDS, Rekognition, S3, KMS, CloudTrail) |

---

<div align="center">

**Built with 🔥 for the 2026 Hackathon**

*Solving ghost worker fraud in Nigerian government payroll — one blink at a time.*

[![GitHub](https://img.shields.io/badge/GitHub-Abbey256%2FPayGuard--AI-181717?style=flat-square&logo=github)](https://github.com/Abbey256/PayGuard-AI)

</div>
