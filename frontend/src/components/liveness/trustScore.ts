/**
 * Trust Score Calculator for Liveness Verification (Simplified)
 */

export interface SessionResult {
  challengesPassed: number;
  staticFaceDetected: boolean;
}

export interface TrustScoreOutput {
  trustScore: number;
  verdict: 'verified' | 'flagged';
}

/**
 * Computes the trust score and verdict for a completed liveness session.
 * 
 * Simplified Additive formula:
 * - Each challenge passed: +30 (max 90 for all three)
 * - staticFaceDetected === false: +10
 * - Score is capped at 100
 * - Verdict: "verified" if score >= 90, else "flagged"
 */
export function computeTrustScore(result: SessionResult): TrustScoreOutput {
  const challengesPassed = Math.max(0, Math.min(3, result.challengesPassed));
  
  let trustScore = 0;

  // +30 per challenge passed, maximum 90
  trustScore += challengesPassed * 30;

  // +10 if no static face was detected
  if (result.staticFaceDetected === false) {
    trustScore += 10;
  }

  // Cap at 100
  trustScore = Math.min(100, trustScore);

  const verdict: 'verified' | 'flagged' = trustScore >= 90 ? 'verified' : 'flagged';

  return { trustScore, verdict };
}
