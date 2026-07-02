# PayGuard AI — Backend API

Node.js / Express REST API that handles verification token lifecycle, payment batch management, and salary disbursement.

## Entry Point

```
server.js
```

`package.json` `main` field points to `server.js`. This is the only server entry point.

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/api/organizations/setup` | — | Activate org + create wallet |
| GET | `/api/organizations/me` | ✓ | Get current org details |
| POST | `/api/verification/send` | ✓ | Generate + email verification link |
| GET | `/api/verify/:token` | — | Validate one-time token |
| POST | `/api/verify/submit` | — | Submit liveness result |
| POST | `/api/payments/batches` | ✓ | Create payment batch from verified staff |
| POST | `/api/payments/batches/:id/approve` | ✓ | Approve batch for processing |
| POST | `/api/payments/process` | ✓ | Disburse salaries via payment API |
| GET | `/api/payments/status/:id` | ✓ | Get batch status + per-staff records |
| GET | `/api/payments/transactions` | ✓ | Wallet transaction history |
| POST | `/api/payments/simulate-funding` | ✓ | Sandbox: fund the org wallet |
| POST | `/api/employees/upload-payroll` | ✓ | CSV payroll upload |

Auth (✓) = Supabase JWT required in `Authorization: Bearer <token>` header.

## Environment Variables

```env
PORT=5000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PAYMENT_API_SECRET_KEY=
RESEND_API_KEY=
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

## Running

```bash
npm install
npm run dev    # development (node --watch)
npm start      # production
```

## Key Modules

- `src/controllers/verifyController.js` — Token validation and liveness result submission. Automatically creates payment batch entries for verified staff.
- `src/controllers/paymentController.js` — Full batch lifecycle: create, approve, process, status.
- `src/controllers/organizationController.js` — Organisation setup and wallet management.
- `src/services/supabaseClient.js` — Supabase admin client (service role).
- `src/middleware/authMiddleware.js` — Validates Supabase JWTs on protected routes.
- `src/middleware/rateLimiter.js` — General (100 req/15 min) and verification (10 req/15 min) limiters.
- `src/utils/emailService.js` — Verification email delivery via Resend.
