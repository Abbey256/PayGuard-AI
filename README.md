# PayGuard AI

**Biometric payroll verification for Nigerian government agencies.**  
PayGuard AI prevents ghost worker fraud by requiring every staff member to complete a live biometric challenge before their salary is released. No liveness check, no payment.

Live demo: [payguard-ai-twhx.onrender.com](https://payguard-ai-twhx.onrender.com)

---

## The Problem

Ghost workers — deceased, retired, or fictitious employees — cost the Nigerian government an estimated ₦200 billion annually. Traditional payroll audits rely on paper documentation that is easily forged. PayGuard AI makes ghost worker fraud structurally impossible: salary payments only execute after a verified live human face is confirmed in real time.

---

## How It Works

```
HR Admin                    Worker (Mobile Browser)           Backend
──────────                  ───────────────────────           ───────
1. Upload staff + photo  →
2. Send verification link ─────────────────────────────────→
                            3. Open link on phone
                            4. Camera opens
                            5. Complete challenges:           Server issues signed
                               • Smile                        nonce with challenge
                               • Blink twice                  sequence — browser
                               • Turn head left/right         cannot predict or
                               (randomised order)             forge it
                            6. Face compared against
                               HR-uploaded photo
                            7. Submit result + nonce ────────→
                                                              8. Verify nonce HMAC
                                                              9. Recompute score
                                                              10. Write verdict to DB
                                                              11. Auto-add to batch
HR Admin
3. Payments page loads batch of verified staff
4. Review → Approve → Confirm payment
5. Squad API disburses salary per staff member
6. Name mismatch check blocks identity swaps
```

---

## Security Architecture

### Anti-Fraud Layers

| Layer | What it prevents |
|-------|-----------------|
| **HMAC-signed challenge nonce** | API bypass — cannot POST fake biometric data without a valid server-issued nonce |
| **Server-side score recomputation** | Score tampering — backend ignores client-supplied trust score, always recomputes |
| **Replay protection** | Nonce reuse — each nonce is single-use, expires in 10 minutes, bound to specific token |
| **Randomised challenge sequence** | Pre-recorded video attacks — `crypto.getRandomValues` picks order each session |
| **Adaptive EAR calibration** | False blink detection — baseline measured per person during positioning phase |
| **Hardware camera lock** | Virtual camera injection — label heuristic + device list cross-check |
| **Bank account name verification** | Identity swap — Squad API verifies account name matches staff name before transfer |
| **One-time verification token** | Link reuse — token marked completed after first successful verification |

### Trust Score Formula (Server-Side)

```
Liveness Score = 10 (base)
               + challengesPassed × 25   (max 75)
               + 15 (if no static face detected)
               = max 100

If faceMatchScore > 0:
  Final = (Liveness × 0.5) + (FaceMatch × 0.5)
Else:
  Final = Liveness  ← face match unavailable, liveness-only

Verdict:  ≥ 90 → verified  |  70–89 → review  |  < 70 → flagged
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TailwindCSS |
| Backend | Node.js, Express 5, ES Modules |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (JWT) |
| Biometrics | MediaPipe FaceMesh (468 landmarks, in-browser) |
| Face comparison | Cosine similarity on pose-normalised landmark embeddings |
| Email | Resend API |
| Payments | Squad API (virtual accounts + bank transfers) |
| Deployment | Render (single service — Express serves built React app) |

### Production Target Architecture
The diagram shows the planned AWS serverless architecture (Lambda + API Gateway, Multi-AZ) with Rekognition for server-side face verification. Current deployment runs on Render with browser-side face matching.

---

## Project Structure

```
PayGuard-AI/
├── frontend/                   # React + TypeScript SPA
│   └── src/
│       ├── pages/
│       │   ├── Dashboard/      # HR admin home with stats
│       │   ├── PayGuard/
│       │   │   ├── Staff.tsx   # Staff management + photo upload
│       │   │   ├── Payments.tsx # Batch payment flow
│       │   │   ├── Verification.tsx # Verification request management
│       │   │   └── Reports.tsx
│       │   └── Verification/
│       │       └── VerificationPage.tsx  # Worker-facing verification page
│       └── components/
│           └── liveness/
│               ├── LivenessScanner.tsx   # Main scanner component
│               ├── challengeEngine.ts    # Pure blink/headTurn/smile functions
│               ├── faceVerification.ts   # Cosine similarity face matching
│               ├── trustScore.ts         # Score computation
│               └── FaceGuide.tsx         # Oval face guide UI
├── backend/                    # Express API
│   └── src/
│       ├── controllers/
│       │   ├── verifyController.js    # Liveness token + HMAC nonce system
│       │   ├── paymentController.js   # Batch creation, approval, disbursement
│       │   ├── organizationController.js
│       │   └── employeeController.js
│       ├── services/
│       │   ├── squadService.js        # Squad API integration
│       │   └── supabaseClient.js
│       ├── middleware/
│       │   ├── authMiddleware.js
│       │   └── rateLimiter.js
│       └── models/schema.sql          # Full PostgreSQL schema + RLS policies
└── ai/                         # Standalone algorithm modules (documented)
    ├── liveness/livenessDetector.js
    ├── facematch/faceMatch.js
    └── trustScore/trustScore.js
```

---

## Verification Flow (Technical Detail)

### 1. HR sends verification link
```
POST /api/verification/send
→ Generates UUID token, stores in verification_requests
→ Emails worker a link: /verify/:token
```

### 2. Worker opens link — server issues signed challenge
```
GET /api/verify/:token
→ Validates token (not expired, not completed)
→ Issues HMAC-SHA256 signed nonce:
   payload = { seq: ["smile","blink","headTurn"], ts, rnd, tok }
   nonce   = base64url(payload) + "." + HMAC(payload, NONCE_SECRET)
→ Returns: { workerName, photoUrl, challengeNonce, challengeSequence }
```

### 3. Browser runs challenges in server-dictated order
- EAR baseline calibrated during 2s positioning phase
- Blink: adaptive threshold = 70% of baseline EAR (handles all eye shapes)
- Head turn: ratio < 0.35 = left, > 0.65 = right
- Smile: mouth width/height ratio > 3.3 held for 1000ms
- Face compared against HR photo using cosine similarity on 468 landmarks

### 4. Submit with nonce
```
POST /api/verify/submit
Body: { token, challengeNonce, faceMatchScore, livenessData }
→ Server verifies HMAC signature
→ Checks nonce not expired (10 min TTL)
→ Checks nonce not replayed (in-memory store)
→ Checks nonce bound to this token
→ Recomputes trust score server-side
→ Marks token completed
→ Updates staff status
→ Auto-adds to payment batch
```

---

## Payment Flow

```
Payment Batch (draft)
  ↓ created automatically when staff verified
Approve Batch (pending → approved)
  ↓ HR clicks Approve
Process Payment
  ↓ HR types "APPROVE" to confirm
  ↓ For each verified staff:
      1. Squad account name lookup
      2. Fuzzy name match (Jaro-Winkler)
      3. If match → Squad payout transfer
      4. If mismatch → blocked, audit logged
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=https://your-domain.onrender.com

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Squad Payment API
SQUAD_SECRET_KEY=sandbox_sk_...
SQUAD_PUBLIC_KEY=sandbox_pk_...

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=PayGuard AI <support@yourdomain.com>

# Anti-fraud nonce signing (generate with: node -e "require('crypto').randomBytes(32).toString('hex')")
NONCE_SECRET=your-32-byte-hex-secret
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=https://your-backend.onrender.com
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## Local Development

```bash
# Install all dependencies
npm run install-all

# Run both frontend and backend concurrently
npm run dev

# Backend only (port 5000)
npm run backend

# Frontend only (port 5173)
npm run frontend
```

## Deployment (Render — single service)

```
Build Command:  npm run build
Start Command:  npm run start
```

The build script installs backend + frontend deps and runs `vite build` which outputs to `backend/public`. Express serves the built React app as static files with React Router fallback.

---

## Database Schema

Key tables in Supabase PostgreSQL:

| Table | Purpose |
|-------|---------|
| `organizations` | Ministry/agency accounts |
| `staff` | Employee records with status + trust_score |
| `verification_requests` | One-time verification tokens |
| `payment_batches` | Grouped salary disbursements |
| `payment_batch_staff` | Staff ↔ batch junction |
| `payment_records` | Per-transfer audit trail |
| `audit_logs` | Security events (fraud attempts, approvals, payments) |

All tables have Row Level Security (RLS) — admins can only access their own organisation's data. The `anon` role can read verification_requests by token only (for the public /verify/:token page).

---

## Roadmap — Production Hardening

- [ ] **AWS Rekognition** — Server-side face verification (S3 bucket created, IAM configured)
- [ ] **NIN/BVN verification** — NIMC/NIBSS API integration for government ID matching
- [ ] **Redis** — Replace in-memory nonce store for multi-instance deployments
- [ ] **BVN/bank account encryption** — pgcrypto or Supabase Vault (NDPR compliance)
- [ ] **Squad live keys** — Switch from sandbox to production Squad environment
- [ ] **AWS Lambda** — Migrate to serverless architecture (architecture diagram included)

---

## Security Notes

- All biometric processing runs in the browser — no video or images are sent to the server
- Only numeric scores and challenge metadata are transmitted
- The HMAC nonce system ensures verification sessions cannot be fabricated via API
- Trust scores are always recomputed server-side — client values are ignored
- Fraud attempts (invalid nonces) are logged to audit_logs with IP address

---

Built for the **2025 Hackathon** — solving ghost worker fraud in Nigerian government payroll.
