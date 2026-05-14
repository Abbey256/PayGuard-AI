// utils/trustScore.js

/**
 * Calculate Trust Score
 */
const calculateTrustScore = (data) => {
    const {
        attendance_days = 0,
        faceMatchScore = 70,
        attempts = 0,
        status = 'pending'
    } = data;

    let score = 0;

    // Attendance Score (40%)
    const attendanceScore = Math.min((attendance_days / 30) * 100, 100) * 0.4;

    // Face Match Score (35%)
    const faceScore = faceMatchScore * 0.35;

    // Attempt Penalty (15%)
    let attemptScore = 100;
    if (attempts === 2) attemptScore = 70;
    if (attempts >= 3) attemptScore = 40;
    attemptScore *= 0.15;

    // Status Score (10%)
    let statusScore = status === 'verified' ? 100 : (status === 'manual_review' ? 50 : 20);
    statusScore *= 0.10;

    score = attendanceScore + faceScore + attemptScore + statusScore;

    return Math.round(Math.max(0, Math.min(100, score)));
};

module.exports = { calculateTrustScore };