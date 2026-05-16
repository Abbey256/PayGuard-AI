/**
 * Trust Score Calculator for Liveness Verification
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
 * Scoring formula:
 * - Base for attempting: +10
 * - Each challenge passed: +25 (max 75 for all three)
 * - staticFaceDetected === false: +15
 * - Score is capped at 100
 * - Verdict: "verified" if score >= 60, else "flagged"
 *   (2 challenges = 60 pts = verified; 1 challenge = 35 pts = flagged)
 */
export function computeTrustScore(result: SessionResult): TrustScoreOutput {
  const challengesPassed = Math.max(0, Math.min(3, result.challengesPassed));

  // Base score for attempting verification
  let trustScore = 10;

  // +25 per challenge passed, maximum 75
  trustScore += challengesPassed * 25;

  // +15 if no static face was detected (genuine liveness)
  if (result.staticFaceDetected === false) {
    trustScore += 15;
  }

  // Cap at 100
  trustScore = Math.min(100, trustScore);

  // 2 challenges (60pts) = verified; 1 challenge (35pts) = flagged
  const verdict: 'verified' | 'flagged' = trustScore >= 60 ? 'verified' : 'flagged';

  return { trustScore, verdict };
}
