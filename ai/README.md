# PayGuard AI - Verification Engine

Client-side AI modules for government payroll verification using MediaPipe and face-api.js.

## Architecture

```
User Browser (Frontend)
    ↓
[Liveness Detection] ← MediaPipe FaceLandmarker
    ↓ (0-100 score)
[Face Matching] ← face-api.js + TensorFlow.js
    ↓ (0-100 score)
[Trust Score Calculator] ← Combines scores
    ↓ (verdict: verified/review/flagged)
[Backend Verification API]
    ↓
[Final Verdict + Payment Authorization]
```

## Modules

### 1. Liveness Detection (`liveness/livenessDetector.js`)

**Purpose**: Ensure the person is real and present during verification

**Technology**: [MediaPipe Face Landmark Detection](https://mediapipe.dev/)

**What it detects**:
- Natural blink patterns (15-30 blinks/min)
- Head movement variation (yaw, pitch, roll)
- Facial feature stability
- Eye visibility and pupil response
- Blood flow indicators (texture changes)

**Anti-spoofing**:
- ✓ Rejects 2D printed photos
- ✓ Rejects screen replay attacks
- ✓ Detects silicone/latex masks
- ✓ Requires eyes-open with natural blinks

**Input**: Video stream from webcam

**Output**:
```javascript
{
  livenessScore: 95,        // 0-100
  confidence: "high",
  blinks: 12,               // Blinks during session
  headMovement: true,
  frameSamples: [...]       // For storage
}
```

### 2. Face Matching (`facematch/faceMatch.js`)

**Purpose**: Compare captured face against government ID or reference photo

**Technology**: [face-api.js](https://github.com/justadudewhohacks/face-api.js) + TensorFlow.js

**Process**:
1. Detect faces in both images
2. Extract 512-dimensional embedding vectors
3. Calculate Euclidean distance
4. Map distance to similarity score

**Distance to Confidence Mapping**:
- `< 0.50` → 95%+ confidence (Very High Match)
- `0.50-0.60` → 70-94% confidence (Medium Match)
- `> 0.60` → Below 70% confidence (Low/No Match)

**Input**: 
- Reference image (government ID/passport)
- Captured image (from liveness session)

**Output**:
```javascript
{
  matchScore: 92,           // 0-100
  distance: 0.45,           // Euclidean distance
  isMatch: true,
  confidence: "high",
  alignmentIssues: false
}
```

### 3. Trust Score Calculator (`trustScore/trustScore.js`)

**Purpose**: Combine all verification factors into single trust verdict

**Calculation**:
```
Trust Score = (Liveness × 0.35) + (Face Match × 0.35) + (Challenges × 0.20) + (Account Match × 0.10)
```

**Verdicts**:
- **Verified** (✓): Score ≥ 90%
  - Safe to process payments
  - No manual review needed
- **Review** (⚠): Score 70-89%
  - Limited transactions allowed
  - Manual verification within 24h
- **Flagged** (✗): Score < 70%
  - Payment blocked
  - Manual verification required

**Output**:
```javascript
{
  score: 87,
  verdict: "review",
  isVerified: false,
  requiresReview: true,
  isFlagged: false,
  breakdown: {
    liveness: 95,
    facematch: 85,
    challenges: 80,
    accountName: 100
  }
}
```

## Installation

### Frontend Dependencies

```bash
npm install @mediapipe/tasks-vision face-api.js @tensorflow/tfjs
```

### Usage Example

```javascript
import { detectLiveness } from "./liveness/livenessDetector.js";
import { compareFaces } from "./facematch/faceMatch.js";
import { calculateClientTrustScore } from "./trustScore/trustScore.js";

// During verification flow
const livenessResult = await detectLiveness(videoElement, 5000);
const faceMatchResult = await compareFaces(referenceImage, capturedImage);

const trustScore = calculateClientTrustScore({
  livenessScore: livenessResult.score,
  facematchScore: faceMatchResult.matchScore,
  challengesPassed: 3,
  challengesTotal: 3,
  accountNameMatch: true
});

if (trustScore.verdict === "verified") {
  // Send to backend for payment processing
  await api.submitVerification(trustScore);
}
```

## Performance Notes

- **Liveness Detection**: ~5-10 seconds (requires 3-5 blinks)
- **Face Matching**: ~1-2 seconds
- **Trust Score Calc**: <100ms
- **Total Verification**: ~10-15 seconds

## Browser Requirements

- Webcam access (getUserMedia)
- WebGL support for TensorFlow.js
- Modern browser (Chrome, Firefox, Safari, Edge)

## Privacy & Security

- ✓ All processing happens in browser
- ✓ No video/image sent to servers until verified
- ✓ Encrypted transmission to backend
- ✓ No storage of raw biometric data
- ✓ Only embedding vectors + scores sent to backend
- ✓ GDPR compliant (local processing)

## Fallback Handling

If MediaPipe/face-api fails:
1. Automatic retry up to 3 times
2. Fall back to server-side verification
3. User prompted for manual verification
4. Support escalation available

## Future Enhancements

- [ ] 3D liveness detection (depth sensor)
- [ ] Real-time feedback UI ("Too dark", "Move closer")
- [ ] Offline mode caching
- [ ] Multi-angle verification
- [ ] Iris pattern recognition
- [ ] Emotion detection (smile/neutral)

## Model Files

Models are loaded from CDN:
- MediaPipe: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest`
- face-api.js: `https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js`

For offline/production, download and host locally:
```bash
# TensorFlow.js models
https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js
```

## Troubleshooting

### "Webcam permission denied"
- User must allow camera access in browser
- Check browser privacy settings

### "Face not detected"
- Ensure good lighting
- Position face within frame
- Remove glasses/masks

### "MediaPipe initialization failed"
- Check internet connection (CDN access)
- Browser supports WebGL
- Try different browser

### "Low liveness score"
- Move head more naturally
- Ensure multiple blinks
- Better lighting needed

## Architecture Decisions

1. **Client-side Processing**: Speed, privacy, offline capability
2. **MediaPipe + face-api**: Best balance of accuracy and performance
3. **Embedding Vectors**: 512-D for face recognition (industry standard)
4. **Weighted Scoring**: Prioritizes liveness + face match (70% combined)

## License

Proprietary - PayGuard Inc.
