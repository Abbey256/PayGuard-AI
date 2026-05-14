/**
 * Anti-Spoofing Engine
 *
 * Pure functions for detecting static faces and verifying minimum face size.
 * No side effects, no DOM access — independently testable.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Landmark {
  x: number; // normalised 0–1
  y: number; // normalised 0–1
  z: number;
}

/**
 * Appends a new nose-tip position to the sliding-window history buffer.
 *
 * The buffer is bounded to `maxFrames` entries. When the buffer is full,
 * the oldest entry is dropped so the result always contains the most recent
 * positions. The returned array is a new array (immutable update).
 *
 * Result length: min(history.length + 1, maxFrames)
 *
 * @param history  Current history buffer (not mutated)
 * @param point    New nose-tip position to append
 * @param maxFrames Maximum number of frames to retain (e.g. 30)
 * @returns        Updated history buffer
 */
export function updateNoseTipHistory(
  history: Point2D[],
  point: Point2D,
  maxFrames: number
): Point2D[] {
  const updated = [...history, point];
  if (updated.length > maxFrames) {
    // Drop the oldest entry (front of the array)
    return updated.slice(updated.length - maxFrames);
  }
  return updated;
}

/**
 * Computes the population variance of a numeric array.
 *
 * Population variance = mean of squared deviations from the mean.
 * Returns 0 for arrays with fewer than 2 elements.
 *
 * @param values  Array of numbers
 * @returns       Population variance (≥ 0)
 */
export function computeVariance(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDeviations = values.map((v) => (v - mean) ** 2);
  return squaredDeviations.reduce((sum, d) => sum + d, 0) / values.length;
}

/**
 * Determines whether the face is static (i.e. a printed photo or screen replay).
 *
 * A face is considered static when both the x-variance and y-variance of the
 * nose-tip history are below 0.001, indicating near-zero movement across the
 * recorded frames.
 *
 * @param history  Nose-tip position history (typically last 30 frames)
 * @returns        `true` if both variances are below 0.001, `false` otherwise
 */
export function isStaticFace(history: Point2D[]): boolean {
  const xValues = history.map((p) => p.x);
  const yValues = history.map((p) => p.y);

  const xVariance = computeVariance(xValues);
  const yVariance = computeVariance(yValues);

  return xVariance < 0.001 && yVariance < 0.001;
}

/**
 * Computes the absolute horizontal pixel distance between face-edge landmarks
 * 234 (left) and 454 (right), scaled to the actual frame width.
 *
 * Landmarks are normalised to [0, 1], so the pixel distance is obtained by
 * multiplying the normalised horizontal distance by `frameWidth`.
 *
 * The result is always non-negative (absolute value is taken).
 *
 * @param landmarks  Array of 468 normalised facial landmarks
 * @param frameWidth Actual video frame width in pixels
 * @returns          Absolute horizontal pixel distance between landmarks 234 and 454
 */
export function computeFaceBoundingWidth(
  landmarks: Landmark[],
  frameWidth: number
): number {
  const left = landmarks[234];
  const right = landmarks[454];
  return Math.abs(right.x - left.x) * frameWidth;
}

/**
 * Determines whether the face occupies a sufficient portion of the frame.
 *
 * The face is considered adequately sized when the bounding-box width is at
 * least 20% of the frame width (i.e. `boundingWidth / frameWidth >= 0.2`).
 *
 * @param boundingWidth  Face bounding-box width in pixels (from `computeFaceBoundingWidth`)
 * @param frameWidth     Actual video frame width in pixels
 * @returns              `true` if the face meets the minimum size requirement
 */
export function isFaceSizeAdequate(
  boundingWidth: number,
  frameWidth: number
): boolean {
  return boundingWidth / frameWidth >= 0.2;
}
