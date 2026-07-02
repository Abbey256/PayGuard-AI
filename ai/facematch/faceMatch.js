/**
 * Face Matching Module
 * 1:1 identity verification using cosine similarity on MediaPipe FaceMesh landmarks.
 *
 * Why landmark-based matching instead of a neural embedding model?
 * ─────────────────────────────────────────────────────────────────
 * Running a full face-recognition neural network (face-api.js, InsightFace) in a
 * government worker's browser on a low-end Android phone is unreliable — models
 * are 30–90 MB and require WebGL. MediaPipe FaceMesh is already loaded for
 * liveness detection, so we derive a pose-normalised geometric embedding from
 * its 468 landmarks at zero extra cost.
 *
 * Embedding strategy
 * ──────────────────
 *  1. Compute the centroid of all 468 landmarks.
 *  2. Subtract the centroid → translation invariance.
 *  3. Divide by the inter-ocular distance (IOD) → scale invariance.
 *  4. Flatten [x, y, z, x, y, z, …] into a Float32Array of length 468 × 3.
 *
 * Cosine similarity between two such vectors is 1.0 for geometrically identical
 * faces and approaches 0 for unrelated faces.
 *
 * Thresholds (tuned empirically):
 *   ≥ 0.85  → CONFIRMED   — identity verified, proceed to payment
 *   0.80–0.85 → UNCERTAIN  — flagged, requires manual HR review
 *   < 0.80  → MISMATCH    — trust_score zeroed, payment blocked
 */

// ─── Landmark indices (MediaPipe 468-point topology) ─────────────────────────

const LEFT_EYE_INNER  = 133;  // left  eye inner corner
const RIGHT_EYE_INNER = 362;  // right eye inner corner

// ─── Similarity thresholds ───────────────────────────────────────────────────

export const SIMILARITY_THRESHOLDS = {
  /** Minimum score for identity to be CONFIRMED → payment proceeds */
  CONFIRMED: 0.85,
  /** Minimum score to avoid a hard MISMATCH block (soft flag instead) */
  SOFT_PASS: 0.80,
};

// ─── Embedding builder ────────────────────────────────────────────────────────

/**
 * Builds a pose-normalised, scale-invariant embedding from raw FaceMesh landmarks.
 *
 * @param {Array<{ x: number, y: number, z: number }>} landmarks
 *   The 468 landmarks returned by MediaPipe FaceMesh for a single face.
 * @returns {Float32Array} Embedding vector of length landmarks.length × 3
 */
export function buildEmbedding(landmarks) {
  const n = landmarks.length;
  if (n === 0) return new Float32Array(0);

  // 1. Centroid
  let cx = 0, cy = 0, cz = 0;
  for (const lm of landmarks) { cx += lm.x; cy += lm.y; cz += lm.z; }
  cx /= n; cy /= n; cz /= n;

  // 2. Inter-ocular distance for scale normalisation
  const lEye = landmarks[LEFT_EYE_INNER];
  const rEye = landmarks[RIGHT_EYE_INNER];
  const iod = Math.sqrt(
    (lEye.x - rEye.x) ** 2 +
    (lEye.y - rEye.y) ** 2 +
    (lEye.z - rEye.z) ** 2,
  );
  const scale = iod > 1e-6 ? iod : 1.0;

  // 3. Normalised vector
  const vec = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    vec[i * 3 + 0] = (landmarks[i].x - cx) / scale;
    vec[i * 3 + 1] = (landmarks[i].y - cy) / scale;
    vec[i * 3 + 2] = (landmarks[i].z - cz) / scale;
  }

  return vec;
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

/**
 * Computes cosine similarity between two embedding vectors.
 * Returns a value clamped to [0, 1] (1 = identical geometry, 0 = unrelated).
 *
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number} Cosine similarity in [0, 1]
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom < 1e-12) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}

// ─── Main comparison entry point ──────────────────────────────────────────────

/**
 * Compares live FaceMesh landmarks against a pre-built reference embedding
 * (extracted from the HR-uploaded staff photo at session start).
 *
 * @param {Array<{ x: number, y: number, z: number }>} liveLandmarks
 *   Raw landmarks from the current video frame.
 * @param {Float32Array} referenceEmbedding
 *   Pre-built embedding from the staff reference photo.
 * @returns {{
 *   score:      number,           // Cosine similarity [0, 1]
 *   verdict:    'confirmed'|'uncertain'|'mismatch',
 *   matchScore: number,           // 0–100 contribution to trust score
 *   alert:      string|null       // Human-readable alert or null
 * }}
 */
export function compareFaces(liveLandmarks, referenceEmbedding) {
  if (!liveLandmarks || liveLandmarks.length === 0) {
    return {
      score: 0,
      verdict: 'mismatch',
      matchScore: 0,
      alert: 'No live landmarks captured — face match aborted.',
    };
  }

  if (!referenceEmbedding || referenceEmbedding.length === 0) {
    return {
      score: 0,
      verdict: 'mismatch',
      matchScore: 0,
      alert: 'Reference embedding unavailable — ensure staff photo is uploaded.',
    };
  }

  const liveEmbedding = buildEmbedding(liveLandmarks);
  const score = cosineSimilarity(liveEmbedding, referenceEmbedding);

  if (score >= SIMILARITY_THRESHOLDS.CONFIRMED) {
    return {
      score,
      verdict: 'confirmed',
      matchScore: Math.round(score * 100),
      alert: null,
    };
  }

  if (score >= SIMILARITY_THRESHOLDS.SOFT_PASS) {
    return {
      score,
      verdict: 'uncertain',
      matchScore: Math.round(score * 70), // partial credit
      alert: 'Face similarity below confidence threshold. Manual HR review required.',
    };
  }

  return {
    score,
    verdict: 'mismatch',
    matchScore: 0,
    alert: '⚠️ Identity mismatch — live face does not match the registered staff photo.',
  };
}

// ─── Reference embedding extraction ──────────────────────────────────────────

/**
 * Extracts a face embedding from a reference photo URL using a one-shot
 * MediaPipe FaceMesh instance. Called once per verification session at load time.
 *
 * NOTE: This function is browser-only (requires HTMLImageElement + FaceMesh WASM).
 *
 * @param {string}   photoUrl  - Public URL of the HR-uploaded staff photo
 * @param {Function} FaceMesh  - MediaPipe FaceMesh constructor (passed by caller
 *                               to keep this module free of direct CDN imports)
 * @returns {Promise<Float32Array|null>} Embedding or null if no face detected
 */
export async function extractReferenceEmbedding(photoUrl, FaceMesh) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth  || 640;
      canvas.height = img.naturalHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);

      const fm = new FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
      });

      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });

      let resolved = false;

      fm.onResults((results) => {
        if (resolved) return;
        resolved = true;
        fm.close();

        const lms = results.multiFaceLandmarks?.[0];
        if (!lms) {
          console.warn('[PayGuard] No face detected in reference photo.');
          resolve(null);
          return;
        }
        resolve(buildEmbedding(lms));
      });

      setTimeout(async () => {
        try {
          await fm.send({ image: canvas });
        } catch (err) {
          console.error('[PayGuard] Reference FaceMesh send error:', err);
          if (!resolved) { resolved = true; fm.close(); resolve(null); }
        }
      }, 300);
    };

    img.onerror = () => {
      console.error('[PayGuard] Failed to load reference photo (CORS or 404).');
      resolve(null);
    };

    img.src = photoUrl;
  });
}

export default {
  buildEmbedding,
  cosineSimilarity,
  compareFaces,
  extractReferenceEmbedding,
  SIMILARITY_THRESHOLDS,
};
