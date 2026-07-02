/**
 * Liveness Detection Module
 * Detects whether the person in the video stream is a live human being.
 *
 * Technology: MediaPipe FaceMesh (468 facial landmarks, 3D x/y/z coordinates)
 *
 * Anti-spoofing approach:
 *   - Requires genuine blink events (EAR threshold crossing)
 *   - Requires lateral head movement (nose-tip ratio shift)
 *   - Requires smile detection (mouth aspect ratio sustained)
 *   - Hardware camera lock (rejects OBS / virtual cam drivers)
 *
 * All processing runs entirely in the user's browser.
 * No video frames are transmitted to the server.
 */

// ─── Landmark index constants (MediaPipe 468-point topology) ──────────────────

// Eye landmarks used for EAR (Eye Aspect Ratio)
const LEFT_EYE  = { top: 159, bottom: 145, left: 33,  right: 133 };
const RIGHT_EYE = { top: 386, bottom: 374, left: 362, right: 263 };

// Nose tip used for head-turn ratio
const NOSE_TIP   = 4;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;

// Mouth landmarks for smile detection
const MOUTH_LEFT  = 61;
const MOUTH_RIGHT = 291;
const MOUTH_TOP   = 13;
const MOUTH_BOTTOM = 14;

// ─── Thresholds ───────────────────────────────────────────────────────────────

const EAR_BLINK_THRESHOLD   = 0.22;  // EAR below this → eye closed
const BLINKS_REQUIRED       = 2;     // Number of full blink cycles needed
const HEAD_TURN_THRESHOLD   = 0.38;  // Nose ratio below this → looking left
const MOUTH_SMILE_THRESHOLD = 0.06;  // MAR above this for >500 ms → smile
const SMILE_HOLD_MS         = 500;   // Milliseconds smile must be held

// ─── Eye Aspect Ratio (EAR) ───────────────────────────────────────────────────

/**
 * Computes the Eye Aspect Ratio for a single eye from FaceMesh landmarks.
 * EAR ≈ vertical_opening / horizontal_width.
 * A value below EAR_BLINK_THRESHOLD indicates a closed eye.
 *
 * @param {Array}  landmarks - Full 468-point landmark array from MediaPipe
 * @param {Object} eye       - { top, bottom, left, right } landmark indices
 * @returns {number} EAR value (0 = fully closed, ~0.3 = normal open)
 */
export function computeEAR(landmarks, eye) {
  const vertical   = Math.abs(landmarks[eye.top].y   - landmarks[eye.bottom].y);
  const horizontal = Math.abs(landmarks[eye.left].x  - landmarks[eye.right].x);
  return horizontal > 0 ? vertical / horizontal : 0;
}

/**
 * Processes a single frame's blink state.
 * Counts a blink when the eye transitions from closed → open.
 *
 * @param {{ eyeClosed: boolean, blinkCount: number }} state - Previous state
 * @param {number} ear - Current EAR value
 * @returns {{ eyeClosed: boolean, blinkCount: number }} Updated state
 */
export function processBlink(state, ear) {
  const isClosed = ear < EAR_BLINK_THRESHOLD;

  if (isClosed && !state.eyeClosed) {
    // Eye just closed — mark it
    return { ...state, eyeClosed: true };
  }

  if (!isClosed && state.eyeClosed) {
    // Eye just opened after being closed — count a blink
    return { eyeClosed: false, blinkCount: state.blinkCount + 1 };
  }

  return state;
}

// ─── Head Turn Detection ──────────────────────────────────────────────────────

/**
 * Computes a nose-position ratio to detect lateral head turns.
 * Ratio < HEAD_TURN_THRESHOLD → looking left.
 * Ratio > (1 - HEAD_TURN_THRESHOLD) → looking right.
 *
 * @param {Array} landmarks - Full 468-point landmark array
 * @returns {number} Normalised nose position in [0, 1]
 */
export function computeHeadRatio(landmarks) {
  const noseX  = landmarks[NOSE_TIP].x;
  const leftX  = landmarks[LEFT_CHEEK].x;
  const rightX = landmarks[RIGHT_CHEEK].x;
  const width  = Math.abs(rightX - leftX);
  return width > 0 ? (noseX - leftX) / width : 0.5;
}

/**
 * Processes head-turn state: detects left-then-right sequence.
 *
 * @param {{ leftDetected: boolean, passed: boolean }} state
 * @param {number} ratio - Current head ratio
 * @returns {{ leftDetected: boolean, passed: boolean }}
 */
export function processHeadTurn(state, ratio) {
  if (state.passed) return state;

  if (!state.leftDetected && ratio < HEAD_TURN_THRESHOLD) {
    return { leftDetected: true, passed: false };
  }

  if (state.leftDetected && ratio > (1 - HEAD_TURN_THRESHOLD)) {
    return { leftDetected: true, passed: true };
  }

  return state;
}

// ─── Smile Detection ──────────────────────────────────────────────────────────

/**
 * Computes the Mouth Aspect Ratio (MAR) for smile detection.
 * A higher MAR indicates a wider open / smiling mouth.
 *
 * @param {Array} landmarks - Full 468-point landmark array
 * @returns {number} MAR value
 */
export function computeMouthRatio(landmarks) {
  const width    = Math.abs(landmarks[MOUTH_RIGHT].x - landmarks[MOUTH_LEFT].x);
  const vertical = Math.abs(landmarks[MOUTH_BOTTOM].y - landmarks[MOUTH_TOP].y);
  return width > 0 ? vertical / width : 0;
}

/**
 * Processes smile state: requires sustained smile above MAR threshold.
 *
 * @param {{ smileStartMs: number|null, passed: boolean }} state
 * @param {number} mar     - Current MAR value
 * @param {number} deltaMs - Milliseconds since last frame
 * @returns {{ smileStartMs: number|null, passed: boolean }}
 */
export function processSmile(state, mar, deltaMs) {
  if (state.passed) return state;

  if (mar > MOUTH_SMILE_THRESHOLD) {
    const elapsed = (state.smileStartMs ?? 0) + deltaMs;
    if (elapsed >= SMILE_HOLD_MS) {
      return { smileStartMs: elapsed, passed: true };
    }
    return { smileStartMs: elapsed, passed: false };
  }

  // Smile dropped — reset timer
  return { smileStartMs: null, passed: false };
}

// ─── Full Session Liveness Evaluation ────────────────────────────────────────

/**
 * Evaluates the liveness result after all challenges are complete.
 *
 * Scoring:
 *   Base:             +10 pts (for attempting)
 *   Per challenge:    +25 pts (max 75 for 3/3)
 *   No static face:   +15 pts
 *   Total cap:        100 pts
 *   Threshold:        ≥ 60 → verified (2/3 challenges minimum)
 *
 * @param {{ challengesPassed: number, staticFaceDetected: boolean }} result
 * @returns {{ livenessScore: number, verdict: 'verified'|'flagged', breakdown: Object }}
 */
export function evaluateLiveness(result) {
  const { challengesPassed = 0, staticFaceDetected = false } = result;
  const capped = Math.max(0, Math.min(3, challengesPassed));

  let score = 10;                        // base
  score += capped * 25;                  // challenge credit
  if (!staticFaceDetected) score += 15;  // liveness bonus
  score = Math.min(100, score);

  return {
    livenessScore: score,
    verdict: score >= 60 ? 'verified' : 'flagged',
    breakdown: {
      baseScore: 10,
      challengeScore: capped * 25,
      livenessBonus: staticFaceDetected ? 0 : 15,
      challengesPassed: capped,
      challengesTotal: 3,
    },
  };
}

// ─── Virtual Camera Detection ─────────────────────────────────────────────────

const VIRTUAL_CAM_LABELS = [
  'obs', 'virtual', 'snap camera', 'manycam',
  'xsplit', 'droidcam', 'iriun', 'mmhmm', 'camo',
];

/**
 * Verifies the MediaStream originates from a physical hardware camera.
 * Uses a three-layer check:
 *   1. getCapabilities() — physical cameras report facingMode
 *   2. Label heuristic   — known virtual-cam software names
 *   3. Device list check — active deviceId must appear in enumerated devices
 *
 * @param {MediaStream} stream - Active camera stream
 * @returns {Promise<{ isHardware: boolean, reason: string }>}
 */
export async function verifyHardwareCamera(stream) {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    return { isHardware: false, reason: 'No video track in stream.' };
  }

  const label = videoTrack.label.toLowerCase();
  const settings = videoTrack.getSettings?.() ?? {};

  // Layer 1: capabilities API
  if (typeof videoTrack.getCapabilities === 'function') {
    const caps = videoTrack.getCapabilities();
    if (!caps.facingMode || caps.facingMode.length === 0) {
      return {
        isHardware: false,
        reason: 'Camera reports no facingMode capability — virtual camera suspected.',
      };
    }
  }

  // Layer 2: label heuristic
  for (const keyword of VIRTUAL_CAM_LABELS) {
    if (label.includes(keyword)) {
      return {
        isHardware: false,
        reason: `Virtual camera label detected: "${videoTrack.label}".`,
      };
    }
  }

  // Layer 3: device list cross-check
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    if (settings.deviceId) {
      const match = videoDevices.find(d => d.deviceId === settings.deviceId);
      if (!match) {
        return {
          isHardware: false,
          reason: 'Active device not found in system device list.',
        };
      }
      for (const keyword of VIRTUAL_CAM_LABELS) {
        if (match.label.toLowerCase().includes(keyword)) {
          return {
            isHardware: false,
            reason: `Virtual camera in device list: "${match.label}".`,
          };
        }
      }
    }
  } catch {
    // enumerateDevices requires HTTPS — treat failure as pass-through
  }

  return { isHardware: true, reason: 'Physical hardware camera verified.' };
}

export default {
  computeEAR,
  processBlink,
  computeHeadRatio,
  processHeadTurn,
  computeMouthRatio,
  processSmile,
  evaluateLiveness,
  verifyHardwareCamera,
  THRESHOLDS: {
    EAR_BLINK_THRESHOLD,
    BLINKS_REQUIRED,
    HEAD_TURN_THRESHOLD,
    MOUTH_SMILE_THRESHOLD,
    SMILE_HOLD_MS,
  },
};
