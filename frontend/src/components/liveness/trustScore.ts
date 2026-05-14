/**
 * Trust Score Calculator for Liveness Verification
 *
 * Computes a deterministic trust score from session results using an additive
 * formula, then derives a binary verdict based on the score threshold.
 */

export interface SessionResult {
  /** Number of challenges passed, 0–3 */
  challengesPassed: number;
  /** Whether the face size was adequate throughout the session */
  faceSizeAdequate: boolean;
  /** Whether a static (non-moving) face was detected during the session */
  staticFaceDetected: boolean;
  /** Total session duration in seconds */
  completionTimeSeconds: number;
}

export interface TrustScoreOutput {
  /** Final trust score, 0–100 (capped) */
  score: number;
  /** "verified" if score >= 90, otherwise "flagged" */
  verdict: 'verified' | 'flagged';
}

/**
 * Computes the trust score and verdict for a completed liveness session.
 *
 * Additive formula:
 * - Each challenge passed: +25 (max 75 for all three)
 * - Face size adequate throughout: +10
 * - staticFaceDetected === false: +10
 * - completionTimeSeconds >= 60: +5
 * - Score is capped at 100
 * - Verdict: "verified" if score >= 90, else "flagged"
 */
export function computeTrustScore(result: SessionResult): TrustScoreOutput {
  // Clamp challengesPassed to the valid range 0–3 before scoring
  const challengesPassed = Math.max(0, Math.min(3, result.challengesPassed));

  let score = 0;

  // +25 per challenge passed, maximum 75
  score += challengesPassed * 25;

  // +10 if face size was adequate throughout
  if (result.faceSizeAdequate) {
    score += 10;
  }

  // +10 if no static face was detected (i.e. real movement was present)
  if (result.staticFaceDetected === false) {
    score += 10;
  }

  // +5 if the session took 60 seconds or more (not rushed)
  if (result.completionTimeSeconds >= 60) {
    score += 5;
  }

  // Cap at 100
  score = Math.min(100, score);

  const verdict: 'verified' | 'flagged' = score >= 90 ? 'verified' : 'flagged';

  return { score, verdict };
}
