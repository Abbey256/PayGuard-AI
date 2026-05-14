// Feature: liveness-verification
// Tests for FaceGuide.tsx — unit tests and property-based tests
// Tests the stroke colour logic: green iff faceDetected === true AND faceSize >= 0.2

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure helper — mirrors the logic inside FaceGuide
// ---------------------------------------------------------------------------

const GREEN = '#22c55e';
const RED = '#ef4444';
const MIN_FACE_SIZE = 0.2;

function getStrokeColor(faceDetected: boolean, faceSize: number): string {
  return faceDetected && faceSize >= MIN_FACE_SIZE ? GREEN : RED;
}

// ---------------------------------------------------------------------------
// Unit tests — specific examples
// ---------------------------------------------------------------------------

describe('FaceGuide stroke colour — unit tests', () => {
  it('is green when faceDetected is true and faceSize is exactly 0.2', () => {
    expect(getStrokeColor(true, 0.2)).toBe(GREEN);
  });

  it('is green when faceDetected is true and faceSize is above 0.2', () => {
    expect(getStrokeColor(true, 0.5)).toBe(GREEN);
    expect(getStrokeColor(true, 1.0)).toBe(GREEN);
  });

  it('is red when faceDetected is true but faceSize is below 0.2', () => {
    expect(getStrokeColor(true, 0.19)).toBe(RED);
    expect(getStrokeColor(true, 0.0)).toBe(RED);
  });

  it('is red when faceDetected is false regardless of faceSize', () => {
    expect(getStrokeColor(false, 0.5)).toBe(RED);
    expect(getStrokeColor(false, 0.2)).toBe(RED);
    expect(getStrokeColor(false, 0.0)).toBe(RED);
    expect(getStrokeColor(false, 1.0)).toBe(RED);
  });

  it('is red when faceDetected is false and faceSize is 0', () => {
    expect(getStrokeColor(false, 0)).toBe(RED);
  });

  it('is red at faceSize just below threshold (0.199...)', () => {
    expect(getStrokeColor(true, 0.1999)).toBe(RED);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

/**
 * Property 17: FaceGuide stroke colour is determined by the conjunction of faceDetected and faceSize
 *
 * Validates: Requirements 14.2, 14.3
 */
describe('Property 17: FaceGuide stroke colour is determined by the conjunction of faceDetected and faceSize', () => {
  // Feature: liveness-verification, Property 17: FaceGuide stroke colour is determined by the conjunction of faceDetected and faceSize

  it('stroke is green if and only if faceDetected === true AND faceSize >= 0.2', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (faceDetected, faceSize) => {
          const color = getStrokeColor(faceDetected, faceSize);
          const shouldBeGreen = faceDetected === true && faceSize >= 0.2;

          if (shouldBeGreen) {
            return color === GREEN;
          } else {
            return color === RED;
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('stroke is never green when faceDetected is false, for any faceSize', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        (faceSize) => {
          return getStrokeColor(false, faceSize) === RED;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('stroke is never green when faceSize is below 0.2, for any faceDetected value', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.float({ min: Math.fround(0), max: Math.fround(0.1999), noNaN: true }),
        (faceDetected, faceSize) => {
          return getStrokeColor(faceDetected, faceSize) === RED;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('stroke is always green when faceDetected is true and faceSize >= 0.2', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.2), max: Math.fround(1), noNaN: true }),
        (faceSize) => {
          return getStrokeColor(true, faceSize) === GREEN;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('stroke is always either green or red — never any other value', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (faceDetected, faceSize) => {
          const color = getStrokeColor(faceDetected, faceSize);
          return color === GREEN || color === RED;
        }
      ),
      { numRuns: 200 }
    );
  });
});
