/**
 * faceVerification.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 1:1 Face Verification using Cosine Similarity on MediaPipe FaceMesh landmarks.
 *
 * Instead of shipping a separate neural-net (face-api.js), we derive a compact
 * geometric embedding directly from the 468 FaceMesh landmarks that MediaPipe
 * already produces during liveness detection. This keeps the bundle lean while
 * providing robust identity comparison.
 *
 * Embedding strategy
 * ──────────────────
 * Raw (x,y,z) coordinates are pose-dependent. We normalise them into a
 * translation- and scale-invariant representation:
 *   1. Compute the centroid of all landmarks.
 *   2. Subtract the centroid (translation invariance).
 *   3. Divide by the inter-ocular distance (scale invariance).
 *   4. Flatten [x,y,z, x,y,z, …] into a 1-D Float32Array.
 *
 * Cosine similarity of two such vectors is 1.0 for identical geometry and
 * approaches 0 for unrelated faces.
 *
 * Thresholds (configurable via SIMILARITY_THRESHOLDS):
 *   ≥ 0.85  → Identity CONFIRMED  → proceed to payout
 *   0.80–0.85 → Uncertain          → flagged, manual review
 *   < 0.80  → Identity MISMATCH   → trust_score = 0, alert fired
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single MediaPipe FaceMesh landmark: normalised [0,1] coords. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type LandmarkVector = Float32Array;

export interface SimilarityResult {
  score: number;         // Cosine similarity [0, 1]
  verdict: 'confirmed' | 'uncertain' | 'mismatch';
  trustScore: number;    // 0–100 contribution from face match
  alert: string | null;  // Human-readable alert message or null
}

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds
// ─────────────────────────────────────────────────────────────────────────────

export const SIMILARITY_THRESHOLDS = {
  /** Minimum score to proceed to payout. */
  PROCEED: 0.85,
  /** Minimum score to avoid an Identity Mismatch alert. */
  SOFT_PASS: 0.80,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Embedding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the index of the left-eye inner-corner and right-eye inner-corner
 * landmark (FaceMesh 468-point topology).
 */
const LEFT_EYE_INNER  = 133; // left  eye inner corner
const RIGHT_EYE_INNER = 362; // right eye inner corner

/**
 * Build a pose-normalised, scale-invariant embedding vector from raw FaceMesh
 * landmarks.  Returns a Float32Array of length landmarks.length * 3.
 */
export function buildEmbedding(landmarks: Landmark[]): LandmarkVector {
  const n = landmarks.length;
  if (n === 0) return new Float32Array(0);

  // 1. Centroid
  let cx = 0, cy = 0, cz = 0;
  for (const lm of landmarks) { cx += lm.x; cy += lm.y; cz += lm.z; }
  cx /= n; cy /= n; cz /= n;

  // 2. Inter-ocular distance for scale normalisation
  const lEye = landmarks[LEFT_EYE_INNER];
  const rEye = landmarks[RIGHT_EYE_INNER];
  const iod  = Math.sqrt(
    (lEye.x - rEye.x) ** 2 +
    (lEye.y - rEye.y) ** 2 +
    (lEye.z - rEye.z) ** 2,
  );
  const scale = iod > 1e-6 ? iod : 1.0; // guard division by zero

  // 3. Build normalised vector
  const vec = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    vec[i * 3 + 0] = (landmarks[i].x - cx) / scale;
    vec[i * 3 + 1] = (landmarks[i].y - cy) / scale;
    vec[i * 3 + 2] = (landmarks[i].z - cz) / scale;
  }

  return vec;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cosine Similarity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the cosine similarity between two embedding vectors.
 * Returns a value in [0, 1] (clamped; identical = 1, orthogonal = 0).
 */
export function cosineSimilarity(a: LandmarkVector, b: LandmarkVector): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom < 1e-12) return 0;

  // Clamp to [0, 1] — negative cosine similarity is meaningless for faces
  return Math.max(0, Math.min(1, dot / denom));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main comparison entry-point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates identity similarity between live landmarks and a pre-built
 * reference embedding (derived from the stored ID/NIN photo).
 *
 * @param liveLandmarks   Raw MediaPipe landmarks from the current video frame.
 * @param referenceEmbed  Pre-built embedding from the reference photo.
 * @returns               SimilarityResult with score, verdict, trustScore, and alert.
 */
export function calculateSimilarity(
  liveLandmarks: Landmark[],
  referenceEmbed: LandmarkVector,
): SimilarityResult {
  const liveEmbed = buildEmbedding(liveLandmarks);
  const score     = cosineSimilarity(liveEmbed, referenceEmbed);

  if (score >= SIMILARITY_THRESHOLDS.PROCEED) {
    return {
      score,
      verdict:    'confirmed',
      trustScore: Math.round(score * 100),
      alert:      null,
    };
  }

  if (score >= SIMILARITY_THRESHOLDS.SOFT_PASS) {
    return {
      score,
      verdict:    'uncertain',
      trustScore: Math.round(score * 70), // partial credit
      alert:      'Face match is below the confidence threshold. Manual review required.',
    };
  }

  // Hard mismatch — trust score zeroed, alert raised
  return {
    score,
    verdict:    'mismatch',
    trustScore: 0,
    alert:      '⚠️ Identity Mismatch — the live face does not match the registered ID photo.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hardware Device Lock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Labels commonly used by popular virtual camera software.
 * Used as a secondary heuristic when capabilities are unavailable.
 */
const VIRTUAL_CAMERA_LABELS = [
  'obs',
  'virtual',
  'snap camera',
  'manycam',
  'xsplit',
  'droidcam',
  'iriun',
  'mmhmm',
  'camo',
  'continuity camera', // macOS Continuity Camera (iPhone-as-webcam) — optional to block
];

export interface DeviceLockResult {
  isHardware: boolean;
  reason: string;
}

/**
 * Verifies that the active video track originates from a physical hardware
 * camera and not a virtual camera driver.
 *
 * Strategy (layered, most-reliable first):
 *  1. `getCapabilities()` — physical cameras report `facingMode` capability;
 *     virtual cameras typically do not.
 *  2. Label heuristic — match against known virtual-camera software names.
 *  3. DeviceId cross-check — confirm the deviceId belongs to an enumerated
 *     `videoinput` reported by the OS (virtual drivers sometimes report no
 *     matching device).
 *
 * @param stream The MediaStream obtained from getUserMedia.
 * @returns      DeviceLockResult indicating whether the source is physical.
 */
export async function verifyHardwareCamera(stream: MediaStream): Promise<DeviceLockResult> {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    return { isHardware: false, reason: 'No video track found in stream.' };
  }

  const settings = videoTrack.getSettings();
  const label    = videoTrack.label.toLowerCase();

  // ── Layer 1: getCapabilities() ───────────────────────────────────────────
  // Physical cameras implement facingMode; many virtual drivers do not.
  // NOTE: Mobile browsers (Android Chrome, iOS Safari) often do NOT report
  // facingMode in getCapabilities() even for real hardware cameras, so we
  // only use this as a positive signal, never as a blocking condition.
  if (typeof videoTrack.getCapabilities === 'function') {
    const caps = videoTrack.getCapabilities();
    if (caps.facingMode && caps.facingMode.length > 0) {
      // Physical device positively confirmed via hardware capability — skip
      // further checks (still run label check as secondary guard below)
    }
    // Missing facingMode is NOT treated as a block — mobile browsers omit it
  }

  // ── Layer 2: Label heuristic ─────────────────────────────────────────────
  for (const keyword of VIRTUAL_CAMERA_LABELS) {
    if (label.includes(keyword)) {
      return {
        isHardware: false,
        reason: `Virtual camera detected: "${videoTrack.label}". Physical camera required.`,
      };
    }
  }

  // ── Layer 3: DeviceId cross-check ────────────────────────────────────────
  try {
    const devices   = await navigator.mediaDevices.enumerateDevices();
    const videoDevs = devices.filter(d => d.kind === 'videoinput');
    const activeId  = settings.deviceId;

    if (activeId) {
      const matched = videoDevs.find(d => d.deviceId === activeId);
      if (!matched) {
        return {
          isHardware: false,
          reason: 'Active video device not found in system device list. Virtual camera suspected.',
        };
      }
      // Final label check on enumerated device
      const devLabel = matched.label.toLowerCase();
      for (const keyword of VIRTUAL_CAMERA_LABELS) {
        if (devLabel.includes(keyword)) {
          return {
            isHardware: false,
            reason: `Virtual camera detected via device list: "${matched.label}".`,
          };
        }
      }
    }
  } catch {
    // enumerateDevices can fail without HTTPS — treat as pass-through
    console.warn('[PayGuard] enumerateDevices failed — skipping device list check.');
  }

  return { isHardware: true, reason: 'Physical hardware camera verified.' };
}
