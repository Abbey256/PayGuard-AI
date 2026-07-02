/**
 * Trust Score Calculator
 * Combines liveness and face-match results into a single scored verdict.
 *
 * This module is the decision engine for PayGuard AI.
 * It determines whether a staff member's salary payment proceeds, is held
 * for manual review, or is blocked entirely.
 *
 * Scoring formula:
 * ────────────────
 *   Liveness score  × 0.50   (challenges: blink, head-turn, smile)
 *   Face match score × 0.50  (cosine similarity vs. reference photo)
 *
 * Both inputs are normalised to [0, 100] before weighting.
 * The combined score is also capped at 100.
 *
 * Verdicts:
 *   ≥ 90  → verified  — payment proceeds automatically
 *   70–89 → review    — payment held, manual HR review within 24 h
 *   < 70  → flagged   — payment blocked, ghost worker alert raised
 *
 * Face-match hard block:
 *   If the face-match verdict is 'mismatch' (cosine < 0.80), the final
 *   verdict is ALWAYS 'flagged' and the trust score is zeroed,
 *   regardless of the liveness score.
 */

// ─── Verdict thresholds ───────────────────────────────────────────────────────

export const VERDICT_THRESHOLDS = {
  VERIFIED: 90,
  REVIEW:   70,
};

// ─── Main calculator ──────────────────────────────────────────────────────────

/**
 * Calculates the combined trust score and final verdict.
 *
 * @param {{
 *   livenessScore:    number,                           // 0–100 from evaluateLiveness()
 *   faceMatchScore:   number,                           // 0–100 from compareFaces()
 *   faceMatchVerdict: 'confirmed'|'uncertain'|'mismatch'
 * }} inputs
 *
 * @returns {{
 *   trustScore:     number,                             // 0–100
 *   verdict:        'verified'|'review'|'flagged',
 *   isVerified:     boolean,
 *   requiresReview: boolean,
 *   isFlagged:      boolean,
 *   breakdown: {
 *     livenessContribution: number,
 *     faceMatchContribution: number,
 *   }
 * }}
 */
export function calculateTrustScore({ livenessScore, faceMatchScore, faceMatchVerdict }) {
  // Normalise inputs to [0, 100]
  const liveness   = Math.max(0, Math.min(100, livenessScore  ?? 0));
  const faceMatch  = Math.max(0, Math.min(100, faceMatchScore ?? 0));

  // Hard block: face mismatch overrides everything
  if (faceMatchVerdict === 'mismatch') {
    return {
      trustScore:     0,
      verdict:        'flagged',
      isVerified:     false,
      requiresReview: false,
      isFlagged:      true,
      breakdown: {
        livenessContribution:   0,
        faceMatchContribution:  0,
      },
    };
  }

  const livenessContrib   = liveness  * 0.5;
  const faceMatchContrib  = faceMatch * 0.5;
  const rawScore          = livenessContrib + faceMatchContrib;
  const trustScore        = Math.min(100, Math.round(rawScore * 100) / 100);

  let verdict;
  if (trustScore >= VERDICT_THRESHOLDS.VERIFIED) {
    verdict = 'verified';
  } else if (trustScore >= VERDICT_THRESHOLDS.REVIEW) {
    verdict = 'review';
  } else {
    verdict = 'flagged';
  }

  return {
    trustScore,
    verdict,
    isVerified:     verdict === 'verified',
    requiresReview: verdict === 'review',
    isFlagged:      verdict === 'flagged',
    breakdown: {
      livenessContribution:  Math.round(livenessContrib  * 100) / 100,
      faceMatchContribution: Math.round(faceMatchContrib * 100) / 100,
    },
  };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

/**
 * Returns Tailwind colour classes for a given verdict.
 *
 * @param {'verified'|'review'|'flagged'} verdict
 * @returns {{ bg: string, text: string, hex: string }}
 */
export function getVerdictStyle(verdict) {
  const styles = {
    verified: { bg: 'bg-emerald-500', text: 'text-white', hex: '#10B981' },
    review:   { bg: 'bg-yellow-500',  text: 'text-white', hex: '#F59E0B' },
    flagged:  { bg: 'bg-red-500',     text: 'text-white', hex: '#EF4444' },
  };
  return styles[verdict] ?? styles.flagged;
}

/**
 * Returns a human-readable message for the worker's result screen.
 *
 * @param {'verified'|'review'|'flagged'} verdict
 * @returns {{ title: string, message: string }}
 */
export function getVerdictMessage(verdict) {
  const messages = {
    verified: {
      title:   'Verification Successful ✓',
      message: 'Your identity has been confirmed. Your salary will be processed.',
    },
    review: {
      title:   'Verification Pending ⚠',
      message: 'Your verification requires manual review. HR will contact you within 24 hours.',
    },
    flagged: {
      title:   'Verification Failed ✗',
      message: 'Verification could not be completed. Please contact your HR department.',
    },
  };
  return messages[verdict] ?? messages.flagged;
}

/**
 * Returns the verification progress percentage (0–100) based on
 * how many steps of the session have been completed.
 *
 * @param {{ livenessScore?: number, faceMatchScore?: number }} data
 * @returns {number}
 */
export function calculateVerificationProgress(data) {
  let progress = 0;
  if ((data.livenessScore ?? 0) > 0)  progress += 50;
  if ((data.faceMatchScore ?? 0) > 0) progress += 50;
  return Math.min(progress, 100);
}

export default {
  calculateTrustScore,
  getVerdictStyle,
  getVerdictMessage,
  calculateVerificationProgress,
  VERDICT_THRESHOLDS,
};
