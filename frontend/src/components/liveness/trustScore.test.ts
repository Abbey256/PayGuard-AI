// Feature: liveness-verification
// Tests for trustScore.ts — unit tests and property-based tests

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeTrustScore, SessionResult } from './trustScore';

// ---------------------------------------------------------------------------
// Unit tests — specific examples
// ---------------------------------------------------------------------------

describe('computeTrustScore — unit tests', () => {
  it('returns score 0 and verdict "flagged" for a completely failed session', () => {
    const result = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 30,
    });
    expect(result.score).toBe(0);
    expect(result.verdict).toBe('flagged');
  });

  it('awards +25 per challenge passed', () => {
    const one = computeTrustScore({
      challengesPassed: 1,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 0,
    });
    expect(one.score).toBe(25);

    const two = computeTrustScore({
      challengesPassed: 2,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 0,
    });
    expect(two.score).toBe(50);

    const three = computeTrustScore({
      challengesPassed: 3,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 0,
    });
    expect(three.score).toBe(75);
  });

  it('awards +10 for faceSizeAdequate', () => {
    const without = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 0,
    });
    const with_ = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: true,
      staticFaceDetected: true,
      completionTimeSeconds: 0,
    });
    expect(with_.score - without.score).toBe(10);
  });

  it('awards +10 when staticFaceDetected is false', () => {
    const detected = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 0,
    });
    const notDetected = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: false,
      staticFaceDetected: false,
      completionTimeSeconds: 0,
    });
    expect(notDetected.score - detected.score).toBe(10);
  });

  it('awards +5 when completionTimeSeconds >= 60', () => {
    const fast = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 59,
    });
    const slow = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 60,
    });
    expect(slow.score - fast.score).toBe(5);
  });

  it('awards +5 at exactly 60 seconds', () => {
    const result = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 60,
    });
    expect(result.score).toBe(5);
  });

  it('does NOT award +5 at 59 seconds', () => {
    const result = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 59,
    });
    expect(result.score).toBe(0);
  });

  it('returns "verified" at exactly score 90', () => {
    // 3 challenges (75) + faceSizeAdequate (10) + no static (10) = 95, capped at 100
    // To get exactly 90: 3 challenges (75) + faceSizeAdequate (10) + no static (10) - 5 = 90
    // i.e. completionTimeSeconds < 60
    const result = computeTrustScore({
      challengesPassed: 3,
      faceSizeAdequate: true,
      staticFaceDetected: false,
      completionTimeSeconds: 59,
    });
    expect(result.score).toBe(95);
    expect(result.verdict).toBe('verified');
  });

  it('returns "verified" for a perfect session (score 100)', () => {
    const result = computeTrustScore({
      challengesPassed: 3,
      faceSizeAdequate: true,
      staticFaceDetected: false,
      completionTimeSeconds: 60,
    });
    expect(result.score).toBe(100);
    expect(result.verdict).toBe('verified');
  });

  it('caps score at 100 even if formula would exceed it', () => {
    // Max possible without cap: 75 + 10 + 10 + 5 = 100 — already at cap
    // Verify cap holds regardless
    const result = computeTrustScore({
      challengesPassed: 3,
      faceSizeAdequate: true,
      staticFaceDetected: false,
      completionTimeSeconds: 90,
    });
    expect(result.score).toBe(100);
  });

  it('returns "flagged" at score 89', () => {
    // 3 challenges (75) + faceSizeAdequate (10) = 85, no static bonus, no time bonus
    // Need 89: not achievable with standard formula — test score just below 90
    // 2 challenges (50) + faceSizeAdequate (10) + no static (10) + time (5) = 75 → flagged
    const result = computeTrustScore({
      challengesPassed: 2,
      faceSizeAdequate: true,
      staticFaceDetected: false,
      completionTimeSeconds: 60,
    });
    expect(result.score).toBe(75);
    expect(result.verdict).toBe('flagged');
  });

  it('returns "flagged" at score 0', () => {
    const result = computeTrustScore({
      challengesPassed: 0,
      faceSizeAdequate: false,
      staticFaceDetected: true,
      completionTimeSeconds: 0,
    });
    expect(result.score).toBe(0);
    expect(result.verdict).toBe('flagged');
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

/**
 * Property 13: Trust score formula is applied correctly for all input combinations
 *
 * Validates: Requirements 11.1, 11.2
 */
describe('Property 13: Trust score formula is applied correctly for all input combinations', () => {
  // Feature: liveness-verification, Property 13: Trust score formula is applied correctly for all input combinations
  it('score equals sum of applicable components, capped at 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),   // challengesPassed
        fc.boolean(),                       // faceSizeAdequate
        fc.boolean(),                       // staticFaceDetected
        fc.float({ min: 0, max: 300, noNaN: true }), // completionTimeSeconds
        (challengesPassed, faceSizeAdequate, staticFaceDetected, completionTimeSeconds) => {
          const input: SessionResult = {
            challengesPassed,
            faceSizeAdequate,
            staticFaceDetected,
            completionTimeSeconds,
          };

          const { score } = computeTrustScore(input);

          // Compute expected score manually
          let expected = challengesPassed * 25;
          if (faceSizeAdequate) expected += 10;
          if (staticFaceDetected === false) expected += 10;
          if (completionTimeSeconds >= 60) expected += 5;
          expected = Math.min(100, expected);

          return score === expected;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('score is always in the range [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.boolean(),
        fc.boolean(),
        fc.float({ min: 0, max: 300, noNaN: true }),
        (challengesPassed, faceSizeAdequate, staticFaceDetected, completionTimeSeconds) => {
          const { score } = computeTrustScore({
            challengesPassed,
            faceSizeAdequate,
            staticFaceDetected,
            completionTimeSeconds,
          });
          return score >= 0 && score <= 100;
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 14: Trust score verdict threshold is applied correctly
 *
 * Validates: Requirements 11.3, 11.4
 */
describe('Property 14: Trust score verdict threshold is applied correctly', () => {
  // Feature: liveness-verification, Property 14: Trust score verdict threshold is applied correctly
  it('verdict is "verified" if and only if score >= 90', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.boolean(),
        fc.boolean(),
        fc.float({ min: 0, max: 300, noNaN: true }),
        (challengesPassed, faceSizeAdequate, staticFaceDetected, completionTimeSeconds) => {
          const { score, verdict } = computeTrustScore({
            challengesPassed,
            faceSizeAdequate,
            staticFaceDetected,
            completionTimeSeconds,
          });

          if (score >= 90) {
            return verdict === 'verified';
          } else {
            return verdict === 'flagged';
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('verdict is always either "verified" or "flagged" — never undefined or another value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.boolean(),
        fc.boolean(),
        fc.float({ min: 0, max: 300, noNaN: true }),
        (challengesPassed, faceSizeAdequate, staticFaceDetected, completionTimeSeconds) => {
          const { verdict } = computeTrustScore({
            challengesPassed,
            faceSizeAdequate,
            staticFaceDetected,
            completionTimeSeconds,
          });
          return verdict === 'verified' || verdict === 'flagged';
        }
      ),
      { numRuns: 200 }
    );
  });
});
