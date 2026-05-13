/**
 * Trust Score Service
 * Calculates a weighted trust score based on:
 * - Liveness detection (35%): Ensures the person is real and present
 * - Face matching (35%): Compares face to government ID or reference
 * - Challenge responses (20%): Correct answers to verification questions
 * - Account name matching (10%): Verifies bank account name
 */

/**
 * Calculate overall trust score
 * @param {Object} scoreData - Score components
 * @param {number} scoreData.livenessScore - 0-100, liveness confidence
 * @param {number} scoreData.facematchScore - 0-100, face match confidence
 * @param {number} scoreData.challengesPassed - Number of challenges answered correctly
 * @param {number} scoreData.challengesTotal - Total challenges presented
 * @param {boolean} scoreData.accountNameMatch - Whether account name matches government record
 * @returns {Object} Trust verdict and score
 */
export function calculateTrustScore({
  livenessScore = 0,
  facematchScore = 0,
  challengesPassed = 0,
  challengesTotal = 1,
  accountNameMatch = false,
}) {
  // Validate inputs
  const normalizedLiveness = Math.max(0, Math.min(100, livenessScore || 0));
  const normalizedFacematch = Math.max(0, Math.min(100, facematchScore || 0));
  const challengeScore = (challengesPassed / Math.max(1, challengesTotal)) * 100;
  const normalizedChallenges = Math.max(0, Math.min(100, challengeScore));
  const accountScore = accountNameMatch ? 100 : 0;

  // Weighted calculation
  const weightedScore =
    normalizedLiveness * 0.35 +
    normalizedFacematch * 0.35 +
    normalizedChallenges * 0.2 +
    accountScore * 0.1;

  // Determine verdict
  let verdict = "flagged";
  if (weightedScore >= 90) {
    verdict = "verified";
  } else if (weightedScore >= 70) {
    verdict = "review";
  }

  return {
    score: Math.round(weightedScore * 100) / 100,
    verdict,
    breakdown: {
      liveness: Math.round(normalizedLiveness),
      facematch: Math.round(normalizedFacematch),
      challenges: Math.round(normalizedChallenges),
      accountName: accountScore,
    },
    isVerified: verdict === "verified",
    requiresReview: verdict === "review",
    isFlagged: verdict === "flagged",
  };
}

/**
 * Get verdict color for UI display
 * @param {string} verdict - Trust verdict (verified, review, flagged)
 * @returns {string} Color code or class name
 */
export function getVerdictColor(verdict) {
  switch (verdict) {
    case "verified":
      return "green";
    case "review":
      return "yellow";
    case "flagged":
      return "red";
    default:
      return "gray";
  }
}

/**
 * Format trust score for display
 * @param {number} score - Score to format
 * @returns {string} Formatted score with percentage
 */
export function formatTrustScore(score) {
  return `${Math.round(score)}%`;
}

export default {
  calculateTrustScore,
  getVerdictColor,
  formatTrustScore,
};
