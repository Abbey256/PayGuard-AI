// Feature: liveness-verification
// Tests for antiSpoofing.ts — unit tests and property-based tests

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  updateNoseTipHistory,
  computeVariance,
  isStaticFace,
  computeFaceBoundingWidth,
  isFaceSizeAdequate,
  Point2D,
  Landmark,
} from './antiSpoofing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal 468-landmark array with all zeros, then override specific indices. */
function makeLandmarks(overrides: Record<number, Partial<Landmark>> = {}): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 468 }, () => ({ x: 0, y: 0, z: 0 }));
  for (const [idx, vals] of Object.entries(overrides)) {
    lm[Number(idx)] = { ...lm[Number(idx)], ...vals };
  }
  return lm;
}

// ---------------------------------------------------------------------------
// Unit tests — updateNoseTipHistory
// ---------------------------------------------------------------------------

describe('updateNoseTipHistory — unit tests', () => {
  it('appends a point to an empty history', () => {
    const result = updateNoseTipHistory([], { x: 0.5, y: 0.5 }, 30);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ x: 0.5, y: 0.5 });
  });

  it('does not exceed maxFrames', () => {
    let history: Point2D[] = [];
    for (let i = 0; i < 35; i++) {
      history = updateNoseTipHistory(history, { x: i / 100, y: i / 100 }, 30);
    }
    expect(history).toHaveLength(30);
  });

  it('retains the most recent points when buffer is full', () => {
    let history: Point2D[] = [];
    for (let i = 0; i < 32; i++) {
      history = updateNoseTipHistory(history, { x: i / 100, y: i / 100 }, 30);
    }
    // The oldest 2 should have been dropped; most recent should be index 31
    expect(history[history.length - 1]).toEqual({ x: 31 / 100, y: 31 / 100 });
    expect(history[0]).toEqual({ x: 2 / 100, y: 2 / 100 });
  });

  it('does not mutate the input history array', () => {
    const original: Point2D[] = [{ x: 0.1, y: 0.1 }];
    updateNoseTipHistory(original, { x: 0.2, y: 0.2 }, 30);
    expect(original).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — computeVariance
// ---------------------------------------------------------------------------

describe('computeVariance — unit tests', () => {
  it('returns 0 for an empty array', () => {
    expect(computeVariance([])).toBe(0);
  });

  it('returns 0 for a single-element array', () => {
    expect(computeVariance([5])).toBe(0);
  });

  it('returns 0 for a constant array', () => {
    expect(computeVariance([3, 3, 3, 3])).toBe(0);
  });

  it('returns correct variance for a known array', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → mean = 5, variance = 4
    expect(computeVariance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(4);
  });

  it('returns a non-negative value', () => {
    expect(computeVariance([1, 2, 3])).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — isStaticFace
// ---------------------------------------------------------------------------

describe('isStaticFace — unit tests', () => {
  it('returns true when all points are identical (zero variance)', () => {
    const history: Point2D[] = Array.from({ length: 30 }, () => ({ x: 0.5, y: 0.5 }));
    expect(isStaticFace(history)).toBe(true);
  });

  it('returns false when x-variance is above threshold', () => {
    const history: Point2D[] = Array.from({ length: 30 }, (_, i) => ({
      x: i * 0.01, // variance will be well above 0.001
      y: 0.5,
    }));
    expect(isStaticFace(history)).toBe(false);
  });

  it('returns false when y-variance is above threshold', () => {
    const history: Point2D[] = Array.from({ length: 30 }, (_, i) => ({
      x: 0.5,
      y: i * 0.01,
    }));
    expect(isStaticFace(history)).toBe(false);
  });

  it('returns true for very small movement (variance < 0.001)', () => {
    // tiny jitter: x and y vary by 0.0001 each frame
    const history: Point2D[] = Array.from({ length: 30 }, (_, i) => ({
      x: 0.5 + (i % 2 === 0 ? 0.0001 : -0.0001),
      y: 0.5 + (i % 2 === 0 ? 0.0001 : -0.0001),
    }));
    expect(isStaticFace(history)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — computeFaceBoundingWidth
// ---------------------------------------------------------------------------

describe('computeFaceBoundingWidth — unit tests', () => {
  it('returns correct pixel width for known landmarks', () => {
    const lm = makeLandmarks({
      234: { x: 0.2 },
      454: { x: 0.8 },
    });
    // |0.8 - 0.2| * 640 = 0.6 * 640 = 384
    expect(computeFaceBoundingWidth(lm, 640)).toBeCloseTo(384);
  });

  it('returns a non-negative value', () => {
    const lm = makeLandmarks({
      234: { x: 0.8 },
      454: { x: 0.2 }, // reversed order
    });
    expect(computeFaceBoundingWidth(lm, 640)).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 when both landmarks have the same x', () => {
    const lm = makeLandmarks({
      234: { x: 0.5 },
      454: { x: 0.5 },
    });
    expect(computeFaceBoundingWidth(lm, 640)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — isFaceSizeAdequate
// ---------------------------------------------------------------------------

describe('isFaceSizeAdequate — unit tests', () => {
  it('returns true when bounding width is exactly 20% of frame width', () => {
    expect(isFaceSizeAdequate(128, 640)).toBe(true); // 128/640 = 0.2
  });

  it('returns true when bounding width exceeds 20%', () => {
    expect(isFaceSizeAdequate(200, 640)).toBe(true);
  });

  it('returns false when bounding width is below 20%', () => {
    expect(isFaceSizeAdequate(100, 640)).toBe(false); // 100/640 ≈ 0.156
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

/**
 * Property 9: Nose-tip history buffer is bounded at 30 frames
 *
 * Validates: Requirements 7.1
 */
describe('Property 9: Nose-tip history buffer is bounded at 30 frames', () => {
  // Feature: liveness-verification, Property 9: Nose-tip history buffer is bounded at 30 frames
  it('buffer length never exceeds maxFrames for any sequence of points', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.float({ min: 0, max: 1, noNaN: true }),
            y: fc.float({ min: 0, max: 1, noNaN: true }),
          }),
          { minLength: 31, maxLength: 100 }
        ),
        (points) => {
          let history: Point2D[] = [];
          for (const p of points) {
            history = updateNoseTipHistory(history, p, 30);
          }
          return history.length === 30;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('buffer contains the most recent 30 points after overflow', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 31, max: 100 }),
        (n) => {
          let history: Point2D[] = [];
          const points: Point2D[] = Array.from({ length: n }, (_, i) => ({
            x: i / n,
            y: i / n,
          }));
          for (const p of points) {
            history = updateNoseTipHistory(history, p, 30);
          }
          // Last point in history should be the last point added
          const lastAdded = points[n - 1];
          const lastInHistory = history[history.length - 1];
          return (
            Math.abs(lastInHistory.x - lastAdded.x) < 1e-9 &&
            Math.abs(lastInHistory.y - lastAdded.y) < 1e-9
          );
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 10: Static face detection correctly applies the variance threshold
 *
 * Validates: Requirements 7.2, 7.3
 */
describe('Property 10: Static face detection correctly applies the variance threshold', () => {
  // Feature: liveness-verification, Property 10: Static face detection correctly applies the variance threshold
  it('isStaticFace returns true when both x and y variance are below 0.001', () => {
    fc.assert(
      fc.property(
        // Generate 30 points with very small spread (variance < 0.001)
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }), // base x
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }), // base y
        (baseX, baseY) => {
          // All points identical → variance = 0 < 0.001
          const history: Point2D[] = Array.from({ length: 30 }, () => ({
            x: baseX,
            y: baseY,
          }));
          return isStaticFace(history) === true;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('isStaticFace returns false when x-variance is at or above 0.001', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }), // base y (static)
        (baseY) => {
          // Spread x values enough to ensure variance >= 0.001
          // Use alternating 0.0 and 1.0 → variance = 0.25 >> 0.001
          const history: Point2D[] = Array.from({ length: 30 }, (_, i) => ({
            x: i % 2 === 0 ? 0.0 : 1.0,
            y: baseY,
          }));
          return isStaticFace(history) === false;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('isStaticFace returns false when y-variance is at or above 0.001', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }), // base x (static)
        (baseX) => {
          const history: Point2D[] = Array.from({ length: 30 }, (_, i) => ({
            x: baseX,
            y: i % 2 === 0 ? 0.0 : 1.0,
          }));
          return isStaticFace(history) === false;
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 11: Face bounding-box width is the horizontal distance between landmarks 234 and 454
 *
 * Validates: Requirements 9.1
 */
describe('Property 11: Face bounding-box width is the horizontal distance between landmarks 234 and 454', () => {
  // Feature: liveness-verification, Property 11: Face bounding-box width is the horizontal distance between landmarks 234 and 454
  it('returns |landmark454.x - landmark234.x| * frameWidth and is non-negative', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),   // landmark 234 x
        fc.float({ min: 0, max: 1, noNaN: true }),   // landmark 454 x
        fc.float({ min: 1, max: 1920, noNaN: true }), // frameWidth
        (x234, x454, frameWidth) => {
          const lm = makeLandmarks({
            234: { x: x234 },
            454: { x: x454 },
          });
          const result = computeFaceBoundingWidth(lm, frameWidth);
          const expected = Math.abs(x454 - x234) * frameWidth;
          return result >= 0 && Math.abs(result - expected) < 1e-6;
        }
      ),
      { numRuns: 200 }
    );
  });
});
