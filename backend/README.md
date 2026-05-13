# PayGuard Backend

Government payroll verification system backend powered by Express.js, Supabase, and Squad API.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

**Required Environment Variables:**

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key (from Settings > API > Service Role)
- `SQUAD_SECRET_KEY` - Squad API secret key (from https://dashboard.sandbox-api-d.squadco.com)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:5173)

### 3. Squad API Sandbox Setup

1. Go to https://dashboard.sandbox-api-d.squadco.com
2. Create a sandbox account
3. Get your API keys from the dashboard
4. Add `SQUAD_SECRET_KEY` to `.env`

### 4. Start Development Server

```bash
npm run dev
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh-token` - Refresh JWT token
- `GET /api/auth/me` - Get current user info (protected)

### Staff Management
- `POST /api/staff/upload` - Upload staff CSV (protected)
- `GET /api/staff` - Get all staff (protected)
- `PUT /api/staff/:id` - Update staff (protected)

### Verification
- `POST /api/verification/initiate` - Start verification (protected, rate limited)
- `POST /api/verification/submit` - Submit verification data (protected, rate limited)
- `GET /api/verification/status/:id` - Check verification status (protected)

### Payments
- `POST /api/payments/batches` - Create payment batch (protected)
- `POST /api/payments/batches/:id/approve` - Approve batch (protected)
- `POST /api/payments/process` - Process payment (protected)
- `GET /api/payments/status/:id` - Check payment status (protected)

### Reports
- `GET /api/reports/audit-log` - Get audit log (protected)
- `POST /api/reports/generate` - Generate report (protected)
- `GET /api/reports/history` - Get report history (protected)

### Health
- `GET /health` - Health check (public)

## Trust Score System

The trust score is calculated as a weighted average of four factors:

```
Trust Score = (Liveness × 0.35) + (Face Match × 0.35) + (Challenges × 0.20) + (Account Match × 0.10)
```

### Verdict Rules

- **Verified** (✓): Score ≥ 90%
  - Staff member is confirmed as genuine
  - Account name matches government records
  - High confidence in biometric verification

- **Review** (⚠): Score 70-89%
  - Staff member requires manual verification
  - Some biometric data needs confirmation
  - Account information partially matches

- **Flagged** (✗): Score < 70%
  - Staff member is suspicious
  - Potential fraud indicators detected
  - Account name mismatch or failed biometric checks

## Services

### Squad Service (`src/services/squadService.js`)

Handles virtual account creation and transfers:

- `createVirtualAccount(name, email, ref)` - Creates a unique account
- `verifyAccountName(accountNum, bankCode)` - Verifies account details
- `initiateTransfer(amount, bankCode, account, name, ref)` - Processes payment

### Trust Score Service (`src/services/trustScoreService.js`)

Calculates verification verdicts:

- `calculateTrustScore(data)` - Returns score and verdict
- `getVerdictColor(verdict)` - Returns color for UI
- `formatTrustScore(score)` - Formats score for display

## Database Schema

Run the schema setup in Supabase SQL Editor:

```sql
-- Copy contents of src/models/schema.sql into Supabase SQL Editor
-- This creates all required tables and indexes
```

### Key Tables

- `users` - User profiles (linked to Supabase auth)
- `organizations` - Government organizations
- `staff` - Staff members with verification status
- `verification_requests` - Verification submission records
- `payment_batches` - Grouped payments
- `payment_records` - Individual payment transactions
- `notifications` - Real-time system notifications
- `audit_logs` - All system actions for compliance

## Security Features

- **JWT Authentication** - All protected routes require valid token
- **Rate Limiting** - 100 req/15min general, 10 req/15min for verification
- **CORS** - Restricted to frontend URL
- **Helmet** - Security headers
- **Input Validation** - Data validation on all endpoints
- **Error Handling** - Centralized error middleware
- **Audit Logging** - All actions logged for compliance

## Development

### File Structure

```
backend/
├── src/
│   ├── index.js                 # Express app entry point
│   ├── controllers/             # Route handlers
│   ├── routes/                  # API route definitions
│   ├── middleware/              # Auth, error handling, rate limits
│   ├── services/                # Business logic
│   │   ├── supabaseClient.js
│   │   ├── squadService.js
│   │   ├── trustScoreService.js
│   │   └── notificationService.js
│   └── models/
│       └── schema.sql           # Database schema
├── .env.example                 # Environment template
├── package.json
└── README.md
```

### Next Steps

1. Implement authentication endpoints with Supabase JWT
2. Add CSV parsing for staff uploads
3. Integrate liveness detection via MediaPipe (from AI folder)
4. Implement payment processing with Squad API
5. Add comprehensive error logging and monitoring

## Troubleshooting

### "SQUAD_SECRET_KEY not set" warning

Set the Squad secret key in your `.env` file. Get it from the Squad sandbox dashboard.

### "SUPABASE_URL and SUPABASE_SERVICE_KEY are required"

Fill in your Supabase credentials in `.env`. Get them from Supabase Dashboard > Settings > API.

### Rate limit errors

Adjust rate limits in `src/middleware/rateLimiter.js` for development.

## License

Proprietary - PayGuard Inc.
