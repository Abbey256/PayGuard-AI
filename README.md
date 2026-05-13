# PayGuard AI

**The proof-of-life payroll verification layer for national workforce integrity.**

Built for **Squad Hackathon 3.0** by **Team Reacha**.

## Overview

PayGuard AI is a zero-trust payroll verification system designed to reduce ghost-worker fraud by requiring live biometric proof before salary disbursement. It bridges legacy payroll records with Squad-powered payment orchestration so funds are only released after a worker is verified as present and real.

## Problem

Payroll systems can confirm that a person is scheduled to be paid, but they often cannot confirm that the person is physically present, authenticated, and eligible at the moment of payment. That gap creates fraud risk, weak audit trails, and unnecessary leakage of public funds.

## Solution

PayGuard AI combines AI-assisted liveness detection with Squad API-based escrow and transfer workflows. Salaries can be held in virtual accounts, verified through biometric checks, and released only when the payroll identity and account details match the approval rules.

## Core Capabilities

### Biometric Liveness Verification
- Uses client-side MediaPipe Face Mesh for real-time liveness checks.
- Supports challenge-response flows such as blink, head movement, and smile prompts.
- Reduces the risk of photo replay and prerecorded video spoofing.

### Secure Payment Orchestration
- Integrates with Squad API flows for virtual account creation and transfers.
- Supports account-name verification before funds are released.
- Keeps the payment process auditable and controlled.

### Trust Scoring and Audit Flags
- Applies a trust score to each verification event.
- Flags suspicious sessions for review based on biometric confidence and identity mismatch signals.
- Generates an audit-friendly trail for compliance and fraud response.

## Technology Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Lucide React
- **Biometrics:** MediaPipe Face Mesh
- **Backend:** Node.js, Express, Prisma, PostgreSQL
- **Payments:** Squad API
- **State Management:** Zustand-ready structure
- **Animation Layer:** Framer Motion-ready UI patterns

## Repository Structure

```text
payguard-ai/
├── frontend/                # React (Vite) application
│   ├── src/components       # UI, navigation, liveness scanner
│   ├── src/hooks           # Client-side state and liveness logic
│   ├── src/pages           # Dashboard and workflow screens
│   └── src/services        # API calling layer
├── backend/                 # Node.js + Express API
│   ├── src/controllers      # Payroll, verification, payout handlers
│   ├── src/middleware       # Auth, security, error handling
│   ├── src/routes           # REST endpoints
│   ├── src/services         # Squad integration and trust logic
│   └── src/models           # Prisma schema and persistence layer
├── shared/                  # Shared types and constants
├── docs/                    # PRD, architecture, and API docs
└── docker-compose.yml       # Local infrastructure support
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- PostgreSQL, locally or via Docker
- Squad sandbox credentials

### Setup

```bash
git clone https://github.com/Abbey256/payguard-ai.git
cd payguard-ai
npm install
```

Create the required environment files from the template and configure your local secrets before running the app.

```bash
npm run dev
```

## Security and Compliance

- **Zero-trust by design:** no hardcoded secrets in source control.
- **NDPR-aware data handling:** raw biometric images should not be stored; only derived verification artifacts should be retained where necessary.
- **Device-aware verification:** sessions can be tied to hardware and browser context to reduce proxy scanning risk.
- **Auditability:** failed or blocked transactions should be logged for review and governance workflows.

## Team Reacha

- **Abiodun Olabisi** — Frontend, AI architecture, and UI design
- **Najib Adebisi** — Backend, Squad API integration, and database security

## Status

This repository is being shaped for the Squad Hackathon 3.0 submission and will continue to evolve toward a production-ready government fintech workflow.

> Verify once. Pay with confidence.
"# pay-ai" 
