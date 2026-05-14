# PayGuard AI

> **Verify once. Pay with confidence.**

The proof-of-life payroll verification layer built to eliminate 
ghost workers from Nigerian government payroll.

Built for **Squad Hackathon 3.0 — Challenge 01: Proof of Life**  
by **Team Reacha**

---

## The Problem

Nigeria loses an estimated ₦200 billion annually to ghost workers.
IPPIS and existing payroll systems verify workers once at enrollment 
— never again at the moment of payment.

That gap is where billions disappear.

PayGuard AI closes it.

---

## What We Built

A zero-trust biometric verification system that requires live 
AI-confirmed proof of life before every salary disbursement.

No verification. No payment. No exceptions.

---

## How It Works

1. HR uploads monthly payroll CSV + staff reference photos
2. System generates unique verification link per worker
3. Worker opens link on any phone — no app download needed
4. MediaPipe AI runs liveness challenges (blink, head turn, smile)
5. Trust score calculated from biometric signals
6. Squad API releases salary only to verified workers
7. Full audit trail generated automatically with biometric evidence

---

## Squad API Integration

Squad is the payment gate our AI controls — not decoration.

| API | Purpose |
|-----|---------|
| Sub-account Creation | Each ministry gets isolated Squad wallet |
| Virtual Account Creation | Auto-created per verified worker |
| Account Name Verification | Name must match payroll before transfer |
| Payout Transfer | Triggered by AI trust score — not human approval |

---

## AI Architecture

**Layer 1 — Liveness (MediaPipe Face Mesh)**
- 468 3D facial landmarks tracked in real time
- Randomized challenge sequence per session
- Static face detection, multiple face detection, 
  virtual camera detection

**Layer 2 — Identity (face-api.js)**
- Mathematical face comparison against reference photo
- Runs entirely in browser — no biometric data leaves device
- Only numerical confidence scores transmitted to backend

**Layer 3 — Trust Score Engine**
- Liveness result: 35%
- Face match confidence: 35%
- Challenge completion: 20%
- Session behavior: 10%
- Score ≥ 90 → verified | Score < 90 → flagged

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Lucide React |
| Biometrics | MediaPipe Face Mesh, face-api.js |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Payments | Squad API (Sandbox) |
| Hosting | Vercel (frontend), Railway (backend) |

---

## Repository Structure
payguard-ai/
├── frontend/
│   ├── src/components/
│   │   ├── liveness/       # LivenessScanner, FaceGuide
│   │   ├── dashboard/      # HR admin components
│   │   └── ui/             # Shared UI components
│   ├── src/pages/
│   │   ├── Dashboard.tsx
│   │   ├── StaffManagement.tsx
│   │   ├── VerificationCenter.tsx
│   │   ├── PaymentBatches.tsx
│   │   ├── Reports.tsx
│   │   └── verify/[token].tsx  # Worker-facing verification
│   └── src/services/       # Supabase + API clients
├── backend/
│   ├── src/controllers/    # Auth, staff, verify, payments
│   ├── src/routes/         # REST endpoints
│   ├── src/services/
│   │   ├── squadService.js # All Squad API calls
│   │   └── trustScore.js   # Trust score algorithm
│   └── src/middleware/     # Auth, rate limiting, errors
├── ai/
│   ├── liveness/           # MediaPipe implementation
│   ├── facematch/          # face-api.js integration
│   └── trustScore/         # Scoring algorithm
└── docs/
├── PRD.md
└── architecture.md

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)
- Squad sandbox credentials from sandbox.squadco.com

### Environment Variables

**Frontend** (`frontend/.env`):
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3000

**Backend** (`backend/.env`):
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SQUAD_SECRET_KEY=your_squad_secret_key
SQUAD_BASE_URL=https://sandbox-api-d.squadco.com
FRONTEND_URL=http://localhost:5174

### Installation

```bash
git clone https://github.com/Abbey256/payguard-ai.git
cd payguard-ai

# Install frontend
cd frontend && npm install

# Install backend  
cd ../backend && npm install

# Run both
cd frontend && npm run dev
cd backend && npm run dev
```

---

## Security and Compliance

- Zero-trust: no hardcoded secrets in source control
- NDPR compliant: no raw biometric data stored — 
  only numerical confidence scores
- Dual authorization: no single officer can override 
  AI payment decision alone
- Immutable audit trail: every verification and payment 
  logged with timestamp and biometric reference
- Squad key isolation: secret key lives only in backend 
  environment — never exposed to browser

---

## Demo Flow

To run a complete end-to-end demo:

1. Sign up with any email (email confirmation disabled in sandbox)
2. Upload the sample CSV from `/docs/sample-payroll.csv`
3. Upload sample photos from `/docs/sample-photos.zip`
4. Send verification link to a test worker email
5. Open the link on a phone and complete liveness verification
6. Return to dashboard — worker should show as verified
7. Approve payment batch — Squad sandbox transfer executes

Sample credentials for judges:
HR Login: demo@ministry.gov.ng
Password: PayGuard2026!

---

## Team Reacha

**Abiodun Olabisi** — Frontend, AI architecture, UI design  
Self-taught engineer. Zoology background. 
Built the liveness verification system and HR dashboard.

**Najib Adebisi** — Backend, Squad API integration, 
database security and payment orchestration.

---

## Hackathon Submission

- **Event:** Squad Hackathon 3.0
- **Challenge:** Challenge 01 — Proof of Life
- **Theme:** Smart Systems: The Intelligent Economy
- **Submission Date:** May 2026

> Verify once. Pay with confidence.