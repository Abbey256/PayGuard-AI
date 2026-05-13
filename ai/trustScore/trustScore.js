/**
 * Trust Score Service (Client-side)
 * Calculates trust score locally before sending to backend
 * Mirrors the backend trustScoreService for preview
 *
 * This module allows the frontend to:
 * - Show real-time trust score updates as verification progresses
 * - Provide feedback to the user during liveness/face match
 * - Validate data before sending to backend
 * - Calculate preliminary verdict before backend confirmation
 */

import { calculateTrustScore as backendCalc } from "../../backend/src/services/trustScoreService.js";

/**
 * Client-side mirror of backend trust score calculation
 * Used for preview only - backend performs final calculation
 * @param {Object} verificationData - All verification components
 * @returns {Object} Trust score, verdict, and confidence
 */
export function calculateClientTrustScore(verificationData) {
  const {
    livenessScore = 0,
    facematchScore = 0,
    challengesPassed = 0,
    challengesTotal = 1,
    accountNameMatch = false,
  } = verificationData;

  // Normalize all inputs to 0-100 range
  const normalizedLiveness = Math.max(0, Math.min(100, livenessScore || 0));
  const normalizedFacematch = Math.max(0, Math.min(100, facematchScore || 0));
  const challengeScore = (challengesPassed / Math.max(1, challengesTotal)) * 100;
  const normalizedChallenges = Math.max(0, Math.min(100, challengeScore));
  const accountScore = accountNameMatch ? 100 : 0;

  // Weighted calculation (must match backend)
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
 * Get color for UI display based on verdict
 * @param {string} verdict - Trust verdict
 * @returns {Object} Color codes for different frameworks
 */
export function getVerdictColors(verdict) {
  const colors = {
    verified: {
      tailwind: "bg-green-500 text-white",
      hex: "#10B981",
      rgb: "16, 185, 129",
      badge: "success",
    },
    review: {
      tailwind: "bg-yellow-500 text-white",
      hex: "#F59E0B",
      rgb: "245, 158, 11",
      badge: "warning",
    },
    flagged: {
      tailwind: "bg-red-500 text-white",
      hex: "#EF4444",
      rgb: "239, 68, 68",
      badge: "danger",
    },
  };

  return colors[verdict] || colors.flagged;
}

/**
 * Get verdict message for user display
 * @param {string} verdict - Trust verdict
 * @returns {Object} Title, message, and suggestion
 */
export function getVerdictMessage(verdict) {
  const messages = {
    verified: {
      title: "Verification Successful ✓",
      message: "Your identity has been confirmed. You can now proceed with payments.",
      suggestion: "Your account is approved for fund transfers.",
      icon: "CheckCircle",
    },
    review: {
      title: "Verification Pending ⚠",
      message: "Your verification requires manual review. We'll contact you within 24 hours.",
      suggestion: "You may proceed with limited transactions while review is ongoing.",
      icon: "AlertCircle",
    },
    flagged: {
      title: "Verification Failed ✗",
      message: "Your verification could not be completed. Please try again or contact support.",
      suggestion: "If you believe this is an error, contact support@payguard.ai",
      icon: "XCircle",
    },
  };

  return messages[verdict] || messages.flagged;
}

/**
 * Calculate progress percentage for verification
 * @param {Object} data - Verification data collected so far
 * @returns {number} Progress 0-100
 */
export function calculateVerificationProgress(data) {
  let progress = 0;

  if (data.livenessScore !== undefined && data.livenessScore > 0) progress += 25;
  if (data.facematchScore !== undefined && data.facematchScore > 0) progress += 25;
  if (data.challengesPassed !== undefined && data.challengesPassed > 0) progress += 25;
  if (data.accountNameMatch) progress += 25;

  return Math.min(progress, 100);
}

/**
 * Format trust score for UI display
 * @param {number} score - Score 0-100
 * @returns {string} Formatted score with percentage
 */
export function formatTrustScore(score) {
  return `${Math.round(score)}%`;
}

/**
 * Validate trust score data before submission
 * @param {Object} data - Verification data
 * @returns {Object} Validation result with errors
 */
export function validateTrustScoreData(data) {
  const errors = [];

  if (data.livenessScore < 0 || data.livenessScore > 100) {
    errors.push("Liveness score must be between 0-100");
  }

  if (data.facematchScore < 0 || data.facematchScore > 100) {
    errors.push("Face match score must be between 0-100");
  }

  if (data.challengesPassed < 0 || data.challengesTotal < 1) {
    errors.push("Challenge data is invalid");
  }

  if (data.challengesPassed > data.challengesTotal) {
    errors.push("Challenges passed cannot exceed total challenges");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default {
  calculateClientTrustScore,
  getVerdictColors,
  getVerdictMessage,
  calculateVerificationProgress,
  formatTrustScore,
  validateTrustScoreData,
};
