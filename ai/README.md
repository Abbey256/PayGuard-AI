# PayGuard AI — Verification Engine

Client-side AI modules for government payroll biometric verification.  
All processing runs in the worker's browser. No video or images are transmitted to the server — only the final numeric trust score.

## Module Map

```
ai/
├── liveness/livenessDetector.js   ← Challenge engine (blink, head-turn, smile)
├── facematch/faceMatch.js         ← Cosine similarity face matching
└── trustScore/trustScore.js       ← Score combinator + verdict engine
```

The production implementations of these modules that run inside the React app live at `frontend/src/components/liveness/`. These `ai/` modules are the standalone, importable versions of the same algorithms — documented, tested independently, and usable outside the frontend bundle.

---

## 1. Liveness Detection (`liveness/livenessDetector.js`)

Detects whether the person in the webcam is a live human being present at that moment.

**Technology:** MediaPipe FaceMesh — 468 3D facial landmarks per frame

### Challenge Engine

| Challenge | Algorithm | Threshold |
|-----------|-----------|-----------|
| **Blink** | Eye Aspect Ratio (EAR) — vertical opening ÷ horizontal width | EAR < 0.22 = eye closed; requires 2 full close→open cycles |
| **Head turn** | Nose-tip lateral ratio across cheek anchor points | Ratio < 0.38 = looking left; > 0.62 = looking right |
| **Smile** | Mouth Aspect Ratio (MAR) — vertical opening ÷ mouth width | MAR > 0.06 sustained for ≥ 500 ms |

### Anti-spoofing

Challenges require genuine real-time facial motion — a static photo or looped video fails because the motion sequence cannot be pre-recorded for an arbitrary challenge order.

**Hardware Camera Lock** — three-layer check:
1. `getCapabilities()` API: physical cameras report `facingMode`; virtual drivers typically do not
2. Label heuristic: rejects known virtual camera software (OBS, DroidCam, ManyCam, etc.)
3. Device-list cross-reference: active `deviceId` must match an enumerated `videoinput`

### Scoring

```
Base score:           +10  (for attempting)
Per challenge passed: +25  (max 75 for 3/3)
No static face:       +15
Cap:                  100

Verdict:  score ≥ 60 → verified   (minimum: 2/3 challenges)
          score < 60 → flagged
```

### API

```javascript
import {
  computeEAR,        // (landmarks, eyeConfig) → number
  processBlink,      // (state, ear) → state
  computeHeadRatio,  // (landmarks) → number
  processHeadTurn,   // (state, ratio) → state
  computeMouthRatio, // (landmarks) → number
  processSmile,      // (state, mar, deltaMs) → state
  evaluateLiveness,  // ({ challengesPassed, staticFaceDetected }) → result
  verifyHardwareCamera, // (MediaStream) → Promise<{ isHardware, reason }>
} from './liveness/livenessDetector.js';
```

---

## 2. Face Matching (`facematch/faceMatch.js`)

1:1 identity comparison: live worker vs. HR-uploaded reference photo.

**Why geometric matching instead of a neural embedding model?**  
Neural face models (face-api.js) require 30–90 MB downloads and WebGL. On a low-end Android phone with limited data, that fails. MediaPipe FaceMesh is already loaded for liveness — we derive identity comparison from the same 468 landmark coordinates at zero added cost.

### Embedding Strategy

```
1. Compute centroid of all 468 landmarks           → translation invariance
2. Subtract centroid from each point
3. Divide by inter-ocular distance (IOD)           → scale invariance
4. Flatten [x, y, z, x, y, z, …] → Float32Array   length = 468 × 3 = 1404
```

Cosine similarity between two such vectors:
- `1.0` = geometrically identical faces
- `~0`  = unrelated faces

### Thresholds

| Similarity | Verdict | Action |
|------------|---------|--------|
| ≥ 0.85 | `confirmed` | Identity verified |
| 0.80–0.85 | `uncertain` | Manual HR review |
| < 0.80 | `mismatch` | Payment blocked, trust score → 0 |

### API

```javascript
import {
  buildEmbedding,            // (landmarks) → Float32Array
  cosineSimilarity,          // (vecA, vecB) → number [0,1]
  compareFaces,              // (liveLandmarks, referenceEmbedding) → result
  extractReferenceEmbedding, // (photoUrl, FaceMesh) → Promise<Float32Array|null>
  SIMILARITY_THRESHOLDS,
} from './facematch/faceMatch.js';

// Example
const refEmbed = await extractReferenceEmbedding(staffPhotoUrl, FaceMesh);
const result   = compareFaces(currentFrameLandmarks, refEmbed);
// result → { score, verdict, matchScore, alert }
```

---

## 3. Trust Score Calculator (`trustScore/trustScore.js`)

Combines liveness and face-match results into the final payment decision.

### Formula

```
Trust Score = (Liveness Score × 0.50) + (Face Match Score × 0.50)
```

Both inputs are normalised to [0, 100] before weighting.

**Hard block:** if `faceMatchVerdict === 'mismatch'`, trust score is **zeroed** regardless of liveness result.

### Verdicts

| Score | Verdict | Payment outcome |
|-------|---------|-----------------|
| ≥ 90 | `verified` | Salary disbursed automatically |
| 70–89 | `review` | Payment held, HR notified within 24 h |
| < 70 | `flagged` | Payment blocked, ghost worker alert |

### API

```javascript
import {
  calculateTrustScore,           // ({ livenessScore, faceMatchScore, faceMatchVerdict }) → result
  getVerdictStyle,               // (verdict) → { bg, text, hex }
  getVerdictMessage,             // (verdict) → { title, message }
  calculateVerificationProgress, // ({ livenessScore, faceMatchScore }) → 0–100
  VERDICT_THRESHOLDS,
} from './trustScore/trustScore.js';

// Full pipeline example
const liveness  = evaluateLiveness({ challengesPassed: 3, staticFaceDetected: false });
const faceMatch = compareFaces(liveLandmarks, referenceEmbedding);

const trust = calculateTrustScore({
  livenessScore:    liveness.livenessScore,
  faceMatchScore:   faceMatch.matchScore,
  faceMatchVerdict: faceMatch.verdict,
});

console.log(trust);
// {
//   trustScore: 92,
//   verdict: 'verified',
//   isVerified: true,
//   requiresReview: false,
//   isFlagged: false,
//   breakdown: { livenessContribution: 50, faceMatchContribution: 42 }
// }
```

---

## Browser Requirements

- Camera access (`getUserMedia`)
- WebGL (for MediaPipe WASM)
- Modern browser: Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- HTTPS required in production (camera API + `enumerateDevices`)

## Privacy

- No video frames leave the device
- No raw images stored anywhere
- Only the numeric trust score and challenge metadata are sent to the backend
- Biometric processing is entirely ephemeral — session memory only

## Performance

| Step | Time |
|------|------|
| MediaPipe initialisation | 1–3 s (CDN load, one-time) |
| Reference embedding extraction | ~500 ms |
| Full challenge sequence | 10–15 s |
| Trust score calculation | < 5 ms |
