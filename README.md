# PayGuard AI 🛡️
> **Verify Once. Pay with Confidence. The Proof-of-Life Layer for the Intelligent Economy.**

[![Squad Hackathon](https://img.shields.io/badge/Squad_Hackathon-3.0-orange?style=for-the-badge)](https://squadco.com/hackathon)
[![Challenge](https://img.shields.io/badge/Challenge-Proof_of_Life-emerald?style=for-the-badge)](https://squadco.com/hackathon)
[![Status](https://img.shields.io/badge/Status-Production_Ready-blue?style=for-the-badge)]()

---

## 🇳🇬 The Nigerian Context: A ₦20 Billion Monthly Leak
In Nigeria, "Ghost Workers" are not just a myth—they are a national economic emergency. Despite the implementation of IPPIS, the Nigerian government still loses an estimated **₦15 billion to ₦20 billion monthly** to non-existent employees.

**The Fatal Flaw:** Existing systems verify identity at the point of *enrollment*, but never at the point of *disbursement*. Between enrollment and the next payday, a worker can resign, pass away, or be duplicated—yet the salary keeps flowing.

**PayGuard AI** is the zero-trust bridge. We ensure that for every ₦1 that leaves a Squad wallet, there is a living, breathing, AI-verified human on the other side.

---

## ✨ Key Features

- **🛡️ Biometric Gating**: No salary is released unless the worker passes a real-time AI liveness test.
- **🔗 Squad-Powered Escrow**: Salaries are held in isolated Squad sub-accounts and only "unlocked" by biometric success.
- **📱 Zero-App Friction**: Workers verify via a lightweight web link on any smartphone—no app downloads or high-end hardware required.
- **🤖 Multi-Layer AI**:
  - **Liveness**: 468-point 3D Face Mesh tracking to prevent photo/video spoofing.
  - **Identity**: Neural face matching against government-standard reference photos.
  - **Trust Score**: A weighted algorithm that calculates the "Human Probability" of every session.
- **📊 HR Command Center**: Real-time visibility into "Ghost Alerts" and payroll health.

---

## 🛠️ How it Works (The "Zero Trust" Flow)

1. **Upload**: HR uploads the monthly payroll CSV.
2. **Alert**: System automatically identifies staff with missing biometric references and alerts HR.
3. **Verify**: Workers receive a secure, one-time verification link via SMS/Email.
4. **Scan**: Worker completes a 10-second "Proof of Life" challenge (blink, smile, turn head) in their browser.
5. **Disburse**: Upon a **Trust Score ≥ 90%**, the **Squad Payout API** is triggered automatically to the worker's verified account.

---

## 🔌 Squad API Integration
PayGuard AI isn't just integrated with Squad; it is **governed** by it.

| Feature | Squad API Endpoint | Purpose |
| :--- | :--- | :--- |
| **Ministry Wallets** | `Sub-account API` | Creates isolated, secure funding pools for each government department. |
| **Worker Accounts** | `Virtual Account API` | Auto-generates unique receiving accounts for verified personnel. |
| **Identity Locking** | `Account Lookup API` | Ensures the bank account name matches the payroll name before any Naira moves. |
| **Smart Payouts** | `Payout/Transfer API` | The "Final Switch"—only triggered by the AI Trust Engine. |

---

## 🧠 AI & Security Architecture

### The Trust Stack
1. **Liveness Detection (MediaPipe)**: Tracks 3D landmarks to ensure the user is a physical human being, not a screen or a mask.
2. **Face Comparison (Face-API.js)**: Generates a 128-d descriptor to match the live user against the HR reference photo with 99.4% accuracy.
3. **Anti-Spoofing Challenges**: Randomly generated requests (e.g., "Blink twice", "Turn left") to defeat deepfakes.

### Privacy & Compliance
- **NDPR Compliant**: We do **not** store raw biometric images. We only store anonymized mathematical embeddings.
- **Immutable Auditing**: Every "Ghost Alert" and "Successful Payment" is logged in an encrypted audit trail.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x or higher
- A Supabase Project
- Squad Sandbox Secret Keys ([Get them here](https://sandbox.squadco.com))

### Quick Install
```bash
# Clone the repository
git clone https://github.com/Abbey256/payguard-ai.git

# Install all dependencies
npm run install-all

# Setup Environment Variables
# Copy .env.example to .env in both /frontend and /backend
# and fill in your Supabase and Squad credentials

# Start the Intelligent Economy
npm run dev
```

---

## 👥 The Team: Reacha
- **Abiodun Olabisi**: Frontend Engineering & AI Architecture. (Built the Liveness Scanner & UI)
- **Najib Adebisi**: Backend Infrastructure & Payment Orchestration. (Built the Squad & Supabase Integration)

---

## 🏆 Hackathon Submission
- **Project Name**: PayGuard AI
- **Track**: Smart Systems: The Intelligent Economy
- **Challenge**: Challenge 01 — Proof of Life
- **Region**: Nigeria 🇳🇬

> **"In an intelligent economy, trust is automated. PayGuard AI ensures that the sweat of the worker reaches the right hands, every single time."**