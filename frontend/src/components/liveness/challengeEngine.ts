/**
 * Challenge Engine — pure functions for liveness challenge detection.
 * No side effects, no DOM access. All functions are independently testable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Landmark {
  x: number; // normalised 0–1
  y: number; // normalised 0–1
  z: number;
}

export interface EyeIndices {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface BlinkState {
  eyeClosed: boolean;
  blinkCount: number;
}

export interface HeadTurnState {
  leftDetected: boolean;
  passed: boolean;
}

export interface SmileState {
  smileStartMs: number | null;
  passed: boolean;
}

export type ChallengeType = 'blink' | 'headTurn' | 'smile';

export interface ChallengeState {
  type: ChallengeType;
  status: 'pending' | 'passed' | 'failed';
  startedAt: number | null; // timestamp ms
}

// ---------------------------------------------------------------------------
// EAR (Eye Aspect Ratio)
// ---------------------------------------------------------------------------

/**
 * Compute the Eye Aspect Ratio (EAR) for a single eye.
 *
 * EAR = (vertical distance between top and bottom landmarks)
 *       / (horizontal distance between left and right landmarks)
 *
 * Returns a non-negative, finite number. If the horizontal distance is zero
 * (degenerate case), returns 0 to avoid division by zero.
 *
 * Requirements: 3.2, 3.3
 */
export function computeEAR(landmarks: Landmark[], eyeIndices: EyeIndices): number {
  const top = landmarks[eyeIndices.top];
  const bottom = landmarks[eyeIndices.bottom];
  const left = landmarks[eyeIndices.left];
  const right = landmarks[eyeIndices.right];

  const vertical = Math.abs(top.y - bottom.y);
  const horizontal = Math.abs(left.x - right.x);

  if (horizontal === 0) {
    return 0;
  }

  const ear = vertical / horizontal;
  return ear;
}

// ---------------------------------------------------------------------------
// Blink detection state machine
// ---------------------------------------------------------------------------

/**
 * Process a single EAR sample through the blink state machine.
 *
 * State transitions:
 *   - EAR < 0.2  → eye is closed  (eyeClosed = true)
 *   - EAR > 0.25 after being closed → blink counted, eye open again
 *   - blinkCount is monotonically non-decreasing
 *
 * Requirements: 3.4, 3.5, 3.7
 */
export function processBlink(state: BlinkState, ear: number): BlinkState {
  if (ear < 0.2) {
    // Eye is closing / closed
    return { ...state, eyeClosed: true };
  }

  if (ear > 0.25 && state.eyeClosed) {
    // Eye has re-opened after being closed — count one blink
    return { eyeClosed: false, blinkCount: state.blinkCount + 1 };
  }

  // EAR is in the hysteresis band (0.2–0.25) or eye was already open
  return { ...state, eyeClosed: false };
}

// ---------------------------------------------------------------------------
// Head turn ratio
// ---------------------------------------------------------------------------

/**
 * Compute the normalised horizontal head-turn ratio.
 *
 * Ratio = (nose_x - left_edge_x) / (right_edge_x - left_edge_x)
 *
 * Uses:
 *   - Landmark 1   : nose tip
 *   - Landmark 234 : left face edge
 *   - Landmark 454 : right face edge
 *
 * Result is clamped to [0, 1]. Returns 0.5 for degenerate (zero-width) cases.
 *
 * Requirements: 4.2
 */
export function computeHeadRatio(landmarks: Landmark[]): number {
  const noseTip = landmarks[1];
  const leftEdge = landmarks[234];
  const rightEdge = landmarks[454];

  const width = rightEdge.x - leftEdge.x;

  if (width === 0) {
    return 0.5;
  }

  const ratio = (noseTip.x - leftEdge.x) / width;
  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, ratio));
}

// ---------------------------------------------------------------------------
// Head turn state machine
// ---------------------------------------------------------------------------

/**
 * Process a single head-turn ratio through the head-turn state machine.
 *
 * State transitions:
 *   - ratio < 0.4  → left-turn event recorded
 *   - ratio > 0.6 AND leftDetected → challenge passed
 *   - A right-turn alone (without a prior left-turn) never passes the challenge
 *
 * Requirements: 4.3, 4.4
 */
export function processHeadTurn(state: HeadTurnState, ratio: number): HeadTurnState {
  if (state.passed) {
    // Already passed — no further state changes
    return state;
  }

  let leftDetected = state.leftDetected;

  if (ratio < 0.4) {
    leftDetected = true;
  }

  if (ratio > 0.6 && leftDetected) {
    return { leftDetected: true, passed: true };
  }

  return { ...state, leftDetected };
}

// ---------------------------------------------------------------------------
// Mouth ratio
// ---------------------------------------------------------------------------

/**
 * Compute the mouth width-to-height ratio.
 *
 * Width  = horizontal distance between landmarks 61 (left corner) and 291 (right corner)
 * Height = vertical distance between landmarks 13 (top lip) and 14 (bottom lip)
 *
 * Returns a non-negative, finite number. Returns 0 for degenerate (zero-height) cases.
 *
 * Requirements: 5.2
 */
export function computeMouthRatio(landmarks: Landmark[]): number {
  const leftCorner = landmarks[61];
  const rightCorner = landmarks[291];
  const topLip = landmarks[13];
  const bottomLip = landmarks[14];

  const width = Math.abs(rightCorner.x - leftCorner.x);
  const height = Math.abs(bottomLip.y - topLip.y);

  if (height === 0) {
    return 0;
  }

  return width / height;
}

// ---------------------------------------------------------------------------
// Smile state machine
// ---------------------------------------------------------------------------

/**
 * Process a single mouth-ratio sample and elapsed time through the smile state machine.
 *
 * State transitions:
 *   - ratio > 3.5 → smile detected; start (or continue) the smile timer
 *   - ratio ≤ 3.5 → smile not detected; reset the smile timer
 *   - smile held for ≥ 1000 ms → challenge passed
 *
 * @param state    Current smile state
 * @param ratio    Current mouth width-to-height ratio
 * @param deltaMs  Milliseconds elapsed since the last frame
 *
 * Requirements: 5.3, 5.4, 5.6
 */
export function processSmile(state: SmileState, ratio: number, deltaMs: number): SmileState {
  if (state.passed) {
    // Already passed — no further state changes
    return state;
  }

  const smileDetected = ratio > 3.5;

  if (!smileDetected) {
    // Smile broken — reset timer
    return { smileStartMs: null, passed: false };
  }

  // Smile is active
  const accumulated = (state.smileStartMs ?? 0) + deltaMs;

  if (accumulated >= 1000) {
    return { smileStartMs: accumulated, passed: true };
  }

  return { smileStartMs: accumulated, passed: false };
}

// ---------------------------------------------------------------------------
// Challenge shuffle (Fisher-Yates)
// ---------------------------------------------------------------------------

/**
 * Shuffle an array of ChallengeType values using the Fisher-Yates algorithm.
 *
 * The result is always a valid permutation of the input array:
 *   - Same length as input
 *   - Contains exactly the same elements (no additions, removals, or duplicates)
 *
 * Requirements: 6.1
 */
export function shuffleChallenges(challenges: ChallengeType[]): ChallengeType[] {
  const result = [...challenges];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Swap result[i] and result[j]
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}
