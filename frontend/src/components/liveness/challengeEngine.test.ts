// Feature: liveness-verification
// Tests for challengeEngine.ts — unit tests and property-based tests

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeEAR,
  processBlink,
  computeHeadRatio,
  processHeadTurn,
  computeMouthRatio,
  processSmile,
  shuffleChallenges,
  Landmark,
  EyeIndices,
  BlinkState,
  HeadTurnState,
  SmileState,
  ChallengeType,
} from './challengeEngine';

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
// Unit tests — computeEAR
// ---------------------------------------------------------------------------

describe('computeEAR — unit tests', () => {
  const indices: EyeIndices = { top: 0, bottom: 1, left: 2, right: 3 };

  it('returns correct EAR for a non-degenerate eye', () => {
    const lm = makeLandmarks({
      0: { y: 0.0 },  // top
      1: { y: 0.1 },  // bottom  → vertical = 0.1
      2: { x: 0.0 },  // left
      3: { x: 0.5 },  // right   → horizontal = 0.5
    });
    // EAR = 0.1 / 0.5 = 0.2
    expect(computeEAR(lm, indices)).toBeCloseTo(0.2);
  });

  it('returns 0 when horizontal distance is zero (degenerate)', () => {
    const lm = makeLandmarks({
      0: { y: 0.1 },
      1: { y: 0.2 },
      2: { x: 0.5 },
      3: { x: 0.5 }, // same x → horizontal = 0
    });
    expect(computeEAR(lm, indices)).toBe(0);
  });

  it('returns a non-negative value', () => {
    const lm = makeLandmarks({
      0: { y: 0.3 },
      1: { y: 0.1 },
      2: { x: 0.0 },
      3: { x: 0.4 },
    });
    expect(computeEAR(lm, indices)).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — processBlink
// ---------------------------------------------------------------------------

describe('processBlink — unit tests', () => {
  it('marks eye as closed when EAR < 0.2', () => {
    const state: BlinkState = { eyeClosed: false, blinkCount: 0 };
    const next = processBlink(state, 0.15);
    expect(next.eyeClosed).toBe(true);
    expect(next.blinkCount).toBe(0);
  });

  it('increments blinkCount when EAR > 0.25 after being closed', () => {
    const state: BlinkState = { eyeClosed: true, blinkCount: 0 };
    const next = processBlink(state, 0.3);
    expect(next.eyeClosed).toBe(false);
    expect(next.blinkCount).toBe(1);
  });

  it('does not increment blinkCount when EAR > 0.25 but eye was already open', () => {
    const state: BlinkState = { eyeClosed: false, blinkCount: 2 };
    const next = processBlink(state, 0.3);
    expect(next.blinkCount).toBe(2);
  });

  it('stays in hysteresis band without changing blinkCount', () => {
    const state: BlinkState = { eyeClosed: true, blinkCount: 1 };
    const next = processBlink(state, 0.22); // between 0.2 and 0.25
    expect(next.blinkCount).toBe(1);
    expect(next.eyeClosed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — computeHeadRatio
// ---------------------------------------------------------------------------

describe('computeHeadRatio — unit tests', () => {
  it('returns 0.5 when nose is exactly in the middle', () => {
    const lm = makeLandmarks({
      1:   { x: 0.5 }, // nose tip
      234: { x: 0.0 }, // left edge
      454: { x: 1.0 }, // right edge
    });
    expect(computeHeadRatio(lm)).toBeCloseTo(0.5);
  });

  it('returns close to 0 when nose is near the left edge', () => {
    const lm = makeLandmarks({
      1:   { x: 0.05 },
      234: { x: 0.0 },
      454: { x: 1.0 },
    });
    expect(computeHeadRatio(lm)).toBeCloseTo(0.05);
  });

  it('returns close to 1 when nose is near the right edge', () => {
    const lm = makeLandmarks({
      1:   { x: 0.95 },
      234: { x: 0.0 },
      454: { x: 1.0 },
    });
    expect(computeHeadRatio(lm)).toBeCloseTo(0.95);
  });

  it('returns 0.5 for degenerate (zero-width) case', () => {
    const lm = makeLandmarks({
      1:   { x: 0.5 },
      234: { x: 0.5 },
      454: { x: 0.5 }, // same x → width = 0
    });
    expect(computeHeadRatio(lm)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — processHeadTurn
// ---------------------------------------------------------------------------

describe('processHeadTurn — unit tests', () => {
  it('records left-turn event when ratio < 0.4', () => {
    const state: HeadTurnState = { leftDetected: false, passed: false };
    const next = processHeadTurn(state, 0.3);
    expect(next.leftDetected).toBe(true);
    expect(next.passed).toBe(false);
  });

  it('passes challenge when ratio > 0.6 after left-turn', () => {
    const state: HeadTurnState = { leftDetected: true, passed: false };
    const next = processHeadTurn(state, 0.7);
    expect(next.passed).toBe(true);
  });

  it('does NOT pass challenge on right-turn alone (no prior left-turn)', () => {
    const state: HeadTurnState = { leftDetected: false, passed: false };
    const next = processHeadTurn(state, 0.8);
    expect(next.passed).toBe(false);
  });

  it('stays passed once already passed', () => {
    const state: HeadTurnState = { leftDetected: true, passed: true };
    const next = processHeadTurn(state, 0.1);
    expect(next.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — computeMouthRatio
// ---------------------------------------------------------------------------

describe('computeMouthRatio — unit tests', () => {
  it('returns correct ratio for a normal mouth', () => {
    const lm = makeLandmarks({
      61:  { x: 0.0 },  // left corner
      291: { x: 0.6 },  // right corner → width = 0.6
      13:  { y: 0.0 },  // top lip
      14:  { y: 0.2 },  // bottom lip  → height = 0.2
    });
    // ratio = 0.6 / 0.2 = 3.0
    expect(computeMouthRatio(lm)).toBeCloseTo(3.0);
  });

  it('returns 0 when height is zero (degenerate)', () => {
    const lm = makeLandmarks({
      61:  { x: 0.0 },
      291: { x: 0.5 },
      13:  { y: 0.5 },
      14:  { y: 0.5 }, // same y → height = 0
    });
    expect(computeMouthRatio(lm)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — processSmile
// ---------------------------------------------------------------------------

describe('processSmile — unit tests', () => {
  it('does not pass when ratio <= 3.5', () => {
    const state: SmileState = { smileStartMs: null, passed: false };
    const next = processSmile(state, 3.0, 500);
    expect(next.passed).toBe(false);
    expect(next.smileStartMs).toBeNull();
  });

  it('accumulates time when ratio > 3.5', () => {
    const state: SmileState = { smileStartMs: null, passed: false };
    const next = processSmile(state, 4.0, 500);
    expect(next.passed).toBe(false);
    expect(next.smileStartMs).toBe(500);
  });

  it('passes when accumulated time reaches 1000ms', () => {
    const state: SmileState = { smileStartMs: 600, passed: false };
    const next = processSmile(state, 4.0, 500); // 600 + 500 = 1100 >= 1000
    expect(next.passed).toBe(true);
  });

  it('resets timer when smile is broken', () => {
    const state: SmileState = { smileStartMs: 800, passed: false };
    const next = processSmile(state, 2.0, 100); // ratio <= 3.5
    expect(next.smileStartMs).toBeNull();
    expect(next.passed).toBe(false);
  });

  it('stays passed once already passed', () => {
    const state: SmileState = { smileStartMs: 1000, passed: true };
    const next = processSmile(state, 1.0, 500);
    expect(next.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — shuffleChallenges
// ---------------------------------------------------------------------------

describe('shuffleChallenges — unit tests', () => {
  const ALL: ChallengeType[] = ['blink', 'headTurn', 'smile'];

  it('returns an array of length 3', () => {
    expect(shuffleChallenges(ALL)).toHaveLength(3);
  });

  it('contains exactly one of each challenge type', () => {
    const result = shuffleChallenges(ALL);
    expect(result).toContain('blink');
    expect(result).toContain('headTurn');
    expect(result).toContain('smile');
  });

  it('does not mutate the input array', () => {
    const input: ChallengeType[] = ['blink', 'headTurn', 'smile'];
    shuffleChallenges(input);
    expect(input).toEqual(['blink', 'headTurn', 'smile']);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

/**
 * Property 1: EAR computation is a ratio of vertical to horizontal distances
 *
 * Validates: Requirements 3.2, 3.3
 */
describe('Property 1: EAR computation is a ratio of vertical to horizontal distances', () => {
  // Feature: liveness-verification, Property 1: EAR computation is a ratio of vertical to horizontal distances
  it('EAR equals vertical/horizontal distance and is non-negative and finite', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),  // top.y
        fc.float({ min: 0, max: 1, noNaN: true }),  // bottom.y
        fc.float({ min: 0, max: 1, noNaN: true }),  // left.x
        fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }), // right.x (non-zero width)
        (topY, bottomY, leftX, rightX) => {
          const lm = makeLandmarks({
            0: { y: topY },
            1: { y: bottomY },
            2: { x: leftX },
            3: { x: rightX + leftX }, // ensure right > left
          });
          const indices: EyeIndices = { top: 0, bottom: 1, left: 2, right: 3 };
          const ear = computeEAR(lm, indices);

          const vertical = Math.abs(topY - bottomY);
          const horizontal = Math.abs(rightX); // rightX is the delta
          const expected = vertical / horizontal;

          return ear >= 0 && isFinite(ear) && Math.abs(ear - expected) < 1e-9;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns 0 for degenerate (zero horizontal distance) case', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (topY, bottomY, x) => {
          const lm = makeLandmarks({
            0: { y: topY },
            1: { y: bottomY },
            2: { x },
            3: { x }, // same x → horizontal = 0
          });
          const indices: EyeIndices = { top: 0, bottom: 1, left: 2, right: 3 };
          return computeEAR(lm, indices) === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: EAR threshold correctly classifies eye state
 *
 * Validates: Requirements 3.4, 3.5
 */
describe('Property 2: EAR threshold correctly classifies eye state', () => {
  // Feature: liveness-verification, Property 2: EAR threshold correctly classifies eye state
  it('EAR < 0.2 always sets eyeClosed to true', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.199), noNaN: true }),
        fc.integer({ min: 0, max: 10 }),
        (ear, blinkCount) => {
          const state: BlinkState = { eyeClosed: false, blinkCount };
          const next = processBlink(state, ear);
          return next.eyeClosed === true;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('EAR > 0.25 after being closed increments blinkCount by exactly 1', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.251), max: 1.0, noNaN: true }),
        fc.integer({ min: 0, max: 10 }),
        (ear, blinkCount) => {
          const state: BlinkState = { eyeClosed: true, blinkCount };
          const next = processBlink(state, ear);
          return next.blinkCount === blinkCount + 1 && next.eyeClosed === false;
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 3: Blink count is monotonically non-decreasing
 *
 * Validates: Requirements 3.5, 3.7
 */
describe('Property 3: Blink count is monotonically non-decreasing', () => {
  // Feature: liveness-verification, Property 3: Blink count is monotonically non-decreasing
  it('blinkCount never decreases across any sequence of EAR values', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 50 }),
        (earValues) => {
          let state: BlinkState = { eyeClosed: false, blinkCount: 0 };
          let prevCount = 0;
          for (const ear of earValues) {
            state = processBlink(state, ear);
            if (state.blinkCount < prevCount) return false;
            prevCount = state.blinkCount;
          }
          return true;
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 4: Head turn ratio is correctly computed from landmarks
 *
 * Validates: Requirements 4.2
 */
describe('Property 4: Head turn ratio is correctly computed from landmarks', () => {
  // Feature: liveness-verification, Property 4: Head turn ratio is correctly computed from landmarks
  it('ratio equals normalised nose position between face edges, clamped to [0,1]', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),  // leftEdge.x
        fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }), // width (positive)
        fc.float({ min: 0, max: 1, noNaN: true }),  // nose offset within [0, width]
        (leftX, width, noseOffset) => {
          const rightX = leftX + width;
          const noseX = leftX + noseOffset * width; // nose is within [leftX, rightX]
          const lm = makeLandmarks({
            1:   { x: noseX },
            234: { x: leftX },
            454: { x: rightX },
          });
          const ratio = computeHeadRatio(lm);
          const expected = Math.min(1, Math.max(0, noseOffset));
          return ratio >= 0 && ratio <= 1 && Math.abs(ratio - expected) < 1e-6;
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 5: Head turn state machine requires left-then-right sequence
 *
 * Validates: Requirements 4.3, 4.4
 */
describe('Property 5: Head turn state machine requires left-then-right sequence', () => {
  // Feature: liveness-verification, Property 5: Head turn state machine requires left-then-right sequence
  it('right-turn alone never passes the challenge', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: Math.fround(0.61), max: 1.0, noNaN: true }), { minLength: 1, maxLength: 30 }),
        (ratios) => {
          let state: HeadTurnState = { leftDetected: false, passed: false };
          for (const r of ratios) {
            state = processHeadTurn(state, r);
          }
          return state.passed === false;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('left-then-right sequence always passes the challenge', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.39), noNaN: true }),  // left ratio
        fc.float({ min: Math.fround(0.61), max: 1.0, noNaN: true }), // right ratio
        (leftRatio, rightRatio) => {
          let state: HeadTurnState = { leftDetected: false, passed: false };
          state = processHeadTurn(state, leftRatio);
          state = processHeadTurn(state, rightRatio);
          return state.passed === true;
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 6: Mouth ratio is correctly computed from landmarks
 *
 * Validates: Requirements 5.2
 */
describe('Property 6: Mouth ratio is correctly computed from landmarks', () => {
  // Feature: liveness-verification, Property 6: Mouth ratio is correctly computed from landmarks
  it('mouth ratio equals width/height and is non-negative and finite for non-degenerate inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),   // leftCorner.x
        fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }), // width (positive)
        fc.float({ min: 0, max: 1, noNaN: true }),   // topLip.y
        fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }), // height (positive)
        (leftX, width, topY, height) => {
          const lm = makeLandmarks({
            61:  { x: leftX },
            291: { x: leftX + width },
            13:  { y: topY },
            14:  { y: topY + height },
          });
          const ratio = computeMouthRatio(lm);
          const expected = width / height;
          return ratio >= 0 && isFinite(ratio) && Math.abs(ratio - expected) < 1e-6;
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 7: Smile challenge cannot pass without a detected smile
 *
 * Validates: Requirements 5.3, 5.6
 */
describe('Property 7: Smile challenge cannot pass without a detected smile', () => {
  // Feature: liveness-verification, Property 7: Smile challenge cannot pass without a detected smile
  it('smile never passes when ratio never exceeds 3.5', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ratio: fc.float({ min: 0, max: 3.5, noNaN: true }),
            deltaMs: fc.float({ min: 0, max: 500, noNaN: true }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (frames) => {
          let state: SmileState = { smileStartMs: null, passed: false };
          for (const { ratio, deltaMs } of frames) {
            state = processSmile(state, ratio, deltaMs);
          }
          return state.passed === false;
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 8: Challenge shuffle always produces a valid permutation
 *
 * Validates: Requirements 6.1
 */
describe('Property 8: Challenge shuffle always produces a valid permutation', () => {
  // Feature: liveness-verification, Property 8: Challenge shuffle always produces a valid permutation
  it('shuffled result has length 3 and contains exactly one of each challenge type', () => {
    const ALL: ChallengeType[] = ['blink', 'headTurn', 'smile'];
    fc.assert(
      fc.property(
        fc.constant(ALL),
        (challenges) => {
          const result = shuffleChallenges([...challenges]);
          if (result.length !== 3) return false;
          const sorted = [...result].sort();
          const expected = ['blink', 'headTurn', 'smile'].sort();
          return sorted.every((v, i) => v === expected[i]);
        }
      ),
      { numRuns: 200 }
    );
  });
});
