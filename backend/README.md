# PayGuard AI — Backend API

Node.js / Express REST API. Handles verification token lifecycle, HMAC nonce anti-fraud system, payment batch management, and salary disbursement via Squad API.

Serves the built React frontend as static files — single Render deployment.

## Entry Point

```
server.js
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| GET | `/api/verify/:token` | — | Validate token + issue signed challenge nonce |
| POST | `/api/verify/submit` | — | Submit liveness result (requires valid nonce) |
| POST | `/api/organizations/setup` | — | Activate org + create Squad wallet |
| GET | `/api/organizations/me` | ✓ | Get current org + wallet balance |
| POST | `/api/verification/send` | ✓ | Generate + email verification link |
| POST | `/api/payments/batches` | ✓ | Sync payment batch from verified staff |
| POST | `/api/payments/batches/:id/approve` | ✓ | Approve batch for processing |
| POST | `/api/payments/process` | ✓ | Disburse salaries via Squad API |
| GET | `/api/payments/status/:id` | ✓ | Batch status + per-staff records |
| GET | `/api/payments/transactions` | ✓ | Wallet transaction history |
| POST | `/api/payments/simulate-funding` | ✓ | Sandbox: fund org wallet |
| POST | `/api/employees/upload-payroll` | ✓ | CSV payroll upload |

Auth (✓) = Supabase JWT in `Authorization: Bearer <token>`.

## Anti-Fraud: HMAC Challenge Nonce System

`GET /api/verify/:token` now returns a signed nonce alongside worker info:

```json
{
  "workerName": "Abiodun Olabisi",
  "photoUrl": "https://...",
  "challengeNonce": "eyJ...base64url.hmac-sha256-sig",
  "challengeSequence": ["smile", "blink", "headTurn"]
}
```

The nonce is HMAC-SHA256 signed with `NONCE_SECRET`. `POST /api/verify/submit` rejects any submission without a valid nonce — closes the API bypass attack where a fraudster POSTs fabricated biometric data.

## Environment Variables

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=https://your-domain.onrender.com

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

SQUAD_SECRET_KEY=sandbox_sk_...
SQUAD_PUBLIC_KEY=sandbox_pk_...

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=PayGuard AI <support@yourdomain.com>

# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NONCE_SECRET=your-32-byte-hex-secret
```

## Running

```bash
npm install
npm run dev    # development (node --watch)
npm start      # production
```

## Key Modules

| File | Purpose |
|------|---------|
| `src/controllers/verifyController.js` | Token validation, HMAC nonce issue/verify, score recomputation, batch auto-population |
| `src/controllers/paymentController.js` | Batch create/sync (idempotent), approve, Squad transfer with name check |
| `src/controllers/organizationController.js` | Org setup, Squad sub-account, wallet management |
| `src/services/squadService.js` | Squad API: virtual accounts, transfers, account name lookup |
| `src/services/supabaseClient.js` | Supabase admin client (service role, bypasses RLS) |
| `src/middleware/authMiddleware.js` | Validates Supabase JWTs on protected routes |
| `src/middleware/rateLimiter.js` | General (100/15min) + verification (10/15min) rate limits |
| `src/utils/emailService.js` | Verification email via Resend |
| `src/models/schema.sql` | Full PostgreSQL schema + RLS policies |
| `src/services/faceMatchService.js` | Placeholder for AWS Rekognition (not yet wired) |
