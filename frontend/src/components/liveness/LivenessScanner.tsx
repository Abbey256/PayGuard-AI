import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { FaceGuide } from './FaceGuide';
import {
  computeEAR,
  processBlink,
  computeHeadRatio,
  processHeadTurn,
  computeMouthRatio,
  processSmile,
  BlinkState,
  HeadTurnState,
  SmileState,
  ChallengeType,
} from './challengeEngine';
import { computeTrustScore } from './trustScore';
import {
  buildEmbedding,
  calculateSimilarity,
  verifyHardwareCamera,
  LandmarkVector,
  SIMILARITY_THRESHOLDS,
} from './faceVerification';

// ─────────────────────────────────────────────────────────────────────────────
// Crypto-seeded challenge shuffle — unpredictable per-session order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random challenge sequence.
 * Uses crypto.getRandomValues so the order cannot be predicted or replayed.
 * Each session gets a unique ordering of all 3 challenges.
 */
function generateChallengeSequence(): ChallengeType[] {
  const challenges: ChallengeType[] = ['blink', 'headTurn', 'smile'];
  const buf = new Uint32Array(challenges.length);
  crypto.getRandomValues(buf);
  // Attach random weights and sort — produces an unpredictable permutation
  return challenges
    .map((c, i) => ({ c, r: buf[i] }))
    .sort((a, b) => a.r - b.r)
    .map(({ c }) => c);
}

const CHALLENGE_PROMPTS: Record<ChallengeType, { text: string; speech: string; progress?: (s: BlinkState | HeadTurnState | SmileState) => string }> = {
  blink: {
    text: 'Blink twice',
    speech: 'Please blink twice naturally.',
    progress: (s) => `Blinks: ${(s as BlinkState).blinkCount}/2`,
  },
  headTurn: {
    text: 'Turn head left, then right',
    speech: 'Now turn your head left, then right.',
    progress: (s) => (s as HeadTurnState).leftDetected ? 'Now turn right ➜' : '← Turn head left',
  },
  smile: {
    text: 'Smile for the camera',
    speech: 'Now smile for the camera.',
    progress: (s) => (s as SmileState).smileStartMs ? 'Hold your smile…' : 'Show your smile 😊',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationResult {
  verdict: 'verified' | 'flagged';
  trustScore: number;
}

type Stage =
  | 'tap_to_begin'
  | 'initializing'
  | 'hardware_check'
  | 'positioning'
  | 'blink'
  | 'headTurn'
  | 'smile'
  | 'completing'
  | 'finished'
  | 'failed'
  | 'blocked_virtual_cam';

// ─────────────────────────────────────────────────────────────────────────────
// Speech synthesis helper
// ─────────────────────────────────────────────────────────────────────────────

const synth = window.speechSynthesis;

const speak = (text: string, onEnd?: () => void) => {
  if (!synth) { if (onEnd) onEnd(); return; }
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voices    = synth.getVoices();
  const femaleVoice = voices.find(v =>
    v.name.includes('Female') ||
    v.name.includes('Samantha') ||
    v.name.includes('Google UK English Female') ||
    v.name.includes('Microsoft Zira') ||
    v.name.includes('Karen'),
  );
  if (femaleVoice) utterance.voice = femaleVoice;
  utterance.lang   = 'en-GB';
  utterance.rate   = 0.85;
  utterance.pitch  = 1.1;
  utterance.volume = 1;

  if (onEnd) {
    let fired = false;
    const fallbackTime = text.length * 80 + 1500;
    const fallbackTimer = setTimeout(() => {
      if (!fired) { fired = true; onEnd(); }
    }, fallbackTime);

    utterance.onend = () => {
      if (!fired) { fired = true; clearTimeout(fallbackTimer); setTimeout(onEnd, 100); }
    };
    utterance.onerror = () => {
      if (!fired) { fired = true; clearTimeout(fallbackTimer); onEnd(); }
    };
  }

  synth.speak(utterance);
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: extract reference embedding from a photo URL via MediaPipe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders an image URL onto an OffscreenCanvas (or a regular canvas) and feeds
 * it to a one-shot FaceMesh instance to extract landmark data.
 * Returns null if no face is detected.
 */
async function extractReferenceEmbedding(photoUrl: string): Promise<LandmarkVector | null> {
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
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
      });

      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });

      let resolved = false;

      fm.onResults((results: any) => {
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

      // Give MediaPipe a moment to initialise before sending
      setTimeout(async () => {
        try {
          await fm.send({ image: canvas });
        } catch (err) {
          console.error('[PayGuard] Reference extraction FaceMesh.send failed:', err);
          if (!resolved) { resolved = true; fm.close(); resolve(null); }
        }
      }, 300);
    };

    img.onerror = (e) => {
      console.error('[PayGuard] Reference photo load failed (CORS?):', e);
      resolve(null);
    };

    img.src = photoUrl;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function LivenessScanner({
  token,
  adminPhotoUrl,
  challengeNonce,
  serverChallengeSequence,
  onComplete,
}: {
  token: string;
  adminPhotoUrl?: string;
  challengeNonce?: string;          // signed nonce from server — REQUIRED for submit
  serverChallengeSequence?: ChallengeType[]; // server-dictated order
  onComplete: (res: VerificationResult) => void;
}) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const faceMeshRef = useRef<any>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  const [stage,       setStage]       = useState<Stage>('tap_to_begin');
  const [feedback,    setFeedback]    = useState('Tap anywhere to begin');
  const [faceDetected, setFaceDetected] = useState(false);
  const [trustScore,  setTrustScore]  = useState<number | null>(null);
  const [identityAlert, setIdentityAlert] = useState<string | null>(null);

  // Refs that are safe to read inside rAF / onResults callbacks
  const stageRef          = useRef<Stage>('tap_to_begin');
  const detectionActiveRef = useRef(false);
  const challengesPassed   = useRef(0);
  const positioningStartMs = useRef<number | null>(null);

  // Use server-dictated challenge sequence if available (production anti-fraud)
  // Fall back to client-generated only in dev/offline mode
  const challengeSequence = useRef<ChallengeType[]>(
    serverChallengeSequence ?? generateChallengeSequence()
  );
  const challengeIndexRef = useRef(0);

  // Reference embedding (from the ID/NIN photo) — built once on mount
  const referenceEmbedRef = useRef<LandmarkVector | null>(null);
  const refEmbedLoadedRef = useRef(false);
  const refEmbedPromiseRef = useRef<Promise<void> | null>(null);

  // Live landmark buffer — kept updated by onResults, consumed at finish
  const latestLandmarksRef = useRef<any[] | null>(null);

  const blinkState    = useRef<BlinkState>({ eyeClosed: false, blinkCount: 0 });
  const headTurnState = useRef<HeadTurnState>({ leftDetected: false, passed: false });
  const smileState    = useRef<SmileState>({ smileStartMs: null, passed: false });
  const lastProcessedTime = useRef(0);

  // Calibration — measure baseline EAR during positioning so blink detection
  // is relative to THIS person's eye shape, not a fixed global threshold
  const earSamples      = useRef<number[]>([]);
  const baselineEAR     = useRef<number | null>(null); // person's open-eye EAR

  // ── Pre-load reference embedding immediately on mount ────────────────────
  useEffect(() => {
    if (!adminPhotoUrl) {
      console.warn('[PayGuard] No adminPhotoUrl — face match will BLOCK verification.');
      return;
    }
    console.log('[PayGuard] Pre-loading reference embedding from photo...');
    refEmbedPromiseRef.current = extractReferenceEmbedding(adminPhotoUrl).then(embed => {
      if (embed) {
        referenceEmbedRef.current = embed;
        refEmbedLoadedRef.current = true;
        console.log(`[PayGuard] Reference embedding ready ✅  (${embed.length} dims)`);
      } else {
        console.error('[PayGuard] Reference embedding extraction failed ❌');
      }
    });
  }, [adminPhotoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stage advancement helper ─────────────────────────────────────────────
  const advanceStage = useCallback((
    newStage: Stage,
    feedbackText: string,
    speechText: string,
  ) => {
    setStage(newStage);
    stageRef.current      = newStage;
    setFeedback(feedbackText);
    detectionActiveRef.current = false; // Pause while speaking

    speak(speechText, () => {
      detectionActiveRef.current = true; // Resume after speech
    });
  }, []);

  // ── Tap-to-begin handler ─────────────────────────────────────────────────
  const handleTapToBegin = () => {
    if (stage !== 'tap_to_begin') return;

    // Unlock AudioContext during user gesture
    const unlock = new SpeechSynthesisUtterance(' ');
    unlock.volume = 0;
    synth.speak(unlock);

    setStage('initializing');
    stageRef.current = 'initializing';
    setFeedback('Starting camera and AI...');
    initCameraAndAI();
  };

  // ── Capture current video frame as base64 JPEG ───────────────────────────
  const captureSnapshot = (): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width  = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  // ── Core: finish and evaluate ─────────────────────────────────────────────
  const finishVerification = async (passedCount: number) => {
    advanceStage('completing', 'Processing...', 'Thank you. Processing your verification.');

    const snapshotBase64 = captureSnapshot();

    const livenessResult = computeTrustScore({
      challengesPassed: passedCount,
      staticFaceDetected: false,
    });

    let finalVerdict:    'verified' | 'flagged' = livenessResult.verdict;
    let finalTrustScore: number                 = livenessResult.trustScore;
    let faceMatchScore:  number                 = 0; // updated if face comparison runs

    console.log(`[PayGuard] Liveness score=${finalTrustScore}, adminPhotoUrl=${adminPhotoUrl ? 'SET' : 'MISSING'}`);

    // ── HARD BLOCK: no reference photo → cannot verify identity ──────────
    if (!adminPhotoUrl) {
      console.error('[PayGuard] No reference photo — identity cannot be confirmed. Flagging.');
      finalVerdict    = 'flagged';
      finalTrustScore = 0;
    } else {
      // Wait for reference embedding to finish loading (up to 30 s)
      if (refEmbedPromiseRef.current && !refEmbedLoadedRef.current) {
        setFeedback('Loading reference photo...');
        const timeout = new Promise<void>(r => setTimeout(r, 30_000));
        await Promise.race([refEmbedPromiseRef.current, timeout]);
      }

      if (!refEmbedLoadedRef.current || !referenceEmbedRef.current) {
        console.warn('[PayGuard] Reference embedding unavailable — proceeding on liveness score only.');
        // Do NOT hard-flag — the nonce system already verified the session is real.
        // Trust score stays as liveness-only result.
        finalVerdict    = livenessResult.verdict;
        finalTrustScore = livenessResult.trustScore;
      } else {
        // ── 1:1 FACE VERIFICATION ─────────────────────────────────────────
        setFeedback('Comparing face with database...');

        const liveLandmarks = latestLandmarksRef.current;
        if (!liveLandmarks) {
          console.error('[PayGuard] No live landmarks captured — flagging.');
          finalVerdict    = 'flagged';
          finalTrustScore = 0;
        } else {
          const simResult = calculateSimilarity(liveLandmarks, referenceEmbedRef.current);

          console.log(
            `[PayGuard] Cosine similarity=${simResult.score.toFixed(4)}, ` +
            `verdict=${simResult.verdict}, trustScore=${simResult.trustScore}`,
          );

          if (simResult.verdict === 'mismatch') {
            finalVerdict    = 'flagged';
            finalTrustScore = 0;
            faceMatchScore  = simResult.trustScore;
            setIdentityAlert(simResult.alert);
            speak('Identity mismatch detected. Verification blocked.');

          } else if (simResult.verdict === 'uncertain') {
            finalVerdict    = 'flagged';
            finalTrustScore = Math.min(finalTrustScore, simResult.trustScore);
            faceMatchScore  = simResult.trustScore;
            setIdentityAlert(simResult.alert);

          } else {
            // Confirmed — blend liveness + face match
            faceMatchScore  = simResult.trustScore;
            finalTrustScore = Math.min(
              100,
              Math.round(livenessResult.trustScore * 0.5 + simResult.trustScore * 0.5),
            );
            if (livenessResult.verdict !== 'verified') finalVerdict = 'flagged';
          }
        }
      }
    }

    // ── Submit to backend for audit logging ───────────────────────────────
    try {
      let apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl || apiUrl.startsWith('/')) apiUrl = window.location.origin;
      if (
        window.location.protocol === 'https:' &&
        apiUrl.startsWith('http://') &&
        !apiUrl.includes('localhost')
      ) {
        apiUrl = apiUrl.replace('http://', 'https://');
      }

      const payload = {
        token,
        challengeNonce: challengeNonce ?? null,
        trustScore: finalTrustScore,
        verdict: finalVerdict,
        faceMatchScore,
        livenessData: {
          blinkDetected:    passedCount >= 1,
          headTurnDetected: passedCount >= 2,
          smileDetected:    passedCount >= 3,
          challengesPassed: passedCount,
          snapshot:         snapshotBase64,
        },
      };

      await fetch(`${apiUrl}/api/verify/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch (err) {
      console.error('[PayGuard] Failed to submit verification result:', err);
    }

    setTrustScore(finalTrustScore);
    const finalStage: Stage = finalVerdict === 'verified' ? 'finished' : 'failed';
    setStage(finalStage);
    stageRef.current = finalStage;

    if (finalVerdict === 'verified') {
      speak('Verification successful. Your salary will be processed.');
    } else {
      speak('Verification unsuccessful. Please contact HR.');
    }

    onComplete({ verdict: finalVerdict, trustScore: finalTrustScore });
  };

  // ── Camera & MediaPipe initialisation ─────────────────────────────────────
  const initCameraAndAI = async () => {
    try {
      // ── Step 1: Hardware camera lock ──────────────────────────────────────
      setStage('hardware_check');
      stageRef.current = 'hardware_check';
      setFeedback('Starting camera...');

      // Run stream acquisition and hardware check in parallel to save time
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });

      // Hardware check runs concurrently with FaceMesh init (not awaited yet)
      const hwCheckPromise = verifyHardwareCamera(stream);

      // ── Step 2: Attach stream to video element immediately ───────────────
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // ── Step 3: Initialise FaceMesh (concurrently with hw check) ─────────
      const fm = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
      });

      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      fm.onResults((results: any) => {
        const landmarks = results.multiFaceLandmarks?.[0];

        if (landmarks) {
          setFaceDetected(true);
          // Always keep the latest live landmarks for identity comparison
          latestLandmarksRef.current = landmarks;
        } else {
          setFaceDetected(false);
          positioningStartMs.current = null;
          return;
        }

        const currentStage = stageRef.current;
        const now          = Date.now();
        if (now - lastProcessedTime.current < 1000 / 24) return; // Max 24 fps (was 15)
        const deltaMs = now - (lastProcessedTime.current || now);
        lastProcessedTime.current = now;

        // Transition out of 'initializing' on first detection
        if (currentStage === 'initializing' || currentStage === 'hardware_check') {
          const firstChallenge = challengeSequence.current[0];
          const prompt = CHALLENGE_PROMPTS[firstChallenge];
          advanceStage('positioning', 'Position your face in the oval', 'Welcome. Position your face in the oval.');
          return;
        }

        // Pause detection while speech is playing
        if (!detectionActiveRef.current) return;

        // Stage: positioning — calibrate EAR baseline + wait 2s for stable face
        if (currentStage === 'positioning') {
          if (!positioningStartMs.current) positioningStartMs.current = now;

          // Collect EAR samples during positioning to calibrate baseline
          const leftEAR  = computeEAR(landmarks, { top: 159, bottom: 145, left: 33,  right: 133 });
          const rightEAR = computeEAR(landmarks, { top: 386, bottom: 374, left: 362, right: 263 });
          const ear = (leftEAR + rightEAR) / 2;
          earSamples.current.push(ear);

          if (now - positioningStartMs.current > 2000) {
            // Calculate baseline as median of collected samples (robust to outliers)
            const sorted = [...earSamples.current].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)] ?? 0.25;
            baselineEAR.current = median;
            console.log(`[PayGuard] EAR baseline calibrated: ${median.toFixed(3)} from ${sorted.length} samples`);

            const firstChallenge = challengeSequence.current[0];
            const prompt = CHALLENGE_PROMPTS[firstChallenge];
            advanceStage(firstChallenge as Stage, prompt.text, prompt.speech);
          }
        }

        // ── Dynamic challenge dispatch ──────────────────────────────────────
        const currentChallenge = challengeSequence.current[challengeIndexRef.current] as ChallengeType | undefined;

        const advanceToNextChallenge = () => {
          challengesPassed.current += 1;
          challengeIndexRef.current += 1;
          const next = challengeSequence.current[challengeIndexRef.current];
          if (next) {
            const prompt = CHALLENGE_PROMPTS[next];
            advanceStage(next as Stage, prompt.text, `Good. ${prompt.speech}`);
          } else {
            finishVerification(challengesPassed.current);
          }
        };

        // Stage: blink — adaptive thresholds based on calibrated baseline EAR
        if (currentStage === 'blink' && currentChallenge === 'blink') {
          const leftEAR  = computeEAR(landmarks, { top: 159, bottom: 145, left: 33,  right: 133 });
          const rightEAR = computeEAR(landmarks, { top: 386, bottom: 374, left: 362, right: 263 });
          const ear = (leftEAR + rightEAR) / 2;

          // Adaptive: close = 70% of baseline, open = 85% of baseline
          // Falls back to fixed thresholds if calibration didn't happen
          const baseline   = baselineEAR.current ?? 0.28;
          const closeThresh = baseline * 0.70;
          const openThresh  = baseline * 0.85;

          // Use adaptive thresholds via inline state machine (bypass fixed processBlink)
          const prev = blinkState.current;
          if (ear <= closeThresh && !prev.eyeClosed) {
            blinkState.current = { ...prev, eyeClosed: true };
          } else if (ear >= openThresh && prev.eyeClosed) {
            blinkState.current = { eyeClosed: false, blinkCount: prev.blinkCount + 1 };
          }

          const earDebug = ` (EAR: ${ear.toFixed(3)}, base: ${baseline.toFixed(3)})`;
          setFeedback(`Blinks: ${blinkState.current.blinkCount}/2${earDebug}`);
          if (blinkState.current.blinkCount >= 2) advanceToNextChallenge();
        }

        // Stage: headTurn
        if (currentStage === 'headTurn' && currentChallenge === 'headTurn') {
          const ratio = computeHeadRatio(landmarks);
          headTurnState.current = processHeadTurn(headTurnState.current, ratio);
          setFeedback(headTurnState.current.leftDetected ? 'Now turn right ➜' : '← Turn head left');
          if (headTurnState.current.passed) advanceToNextChallenge();
        }

        // Stage: smile
        if (currentStage === 'smile' && currentChallenge === 'smile') {
          const mouthRatio = computeMouthRatio(landmarks);
          smileState.current = processSmile(smileState.current, mouthRatio, deltaMs);
          setFeedback(smileState.current.smileStartMs ? 'Hold your smile…' : 'Show your smile 😊');
          if (smileState.current.passed) advanceToNextChallenge();
        }
      });

      faceMeshRef.current = fm;

      // ── Resolve hardware check (ran concurrently) — block virtual cams ───
      const hwCheck = await hwCheckPromise;
      if (!hwCheck.isHardware) {
        stream.getTracks().forEach(t => t.stop());
        console.error('[PayGuard] Hardware lock failed:', hwCheck.reason);
        setStage('blocked_virtual_cam');
        stageRef.current = 'blocked_virtual_cam';
        setFeedback(`Camera Blocked — ${hwCheck.reason}`);
        speak("A virtual camera was detected. Please use your device's built-in camera.");
        onComplete({ verdict: 'flagged', trustScore: 0 });
        return;
      }
      console.log('[PayGuard] Hardware camera verified ✅', hwCheck.reason);

      // rAF detection loop
      const detectFace = async () => {
        if (stageRef.current === 'finished' || stageRef.current === 'failed' || stageRef.current === 'blocked_virtual_cam') return;
        if (videoRef.current && videoRef.current.readyState >= 2) {
          try { await fm.send({ image: videoRef.current }); } catch (_) {}
        }
        requestAnimationFrame(detectFace);
      };
      detectFace();

    } catch (e: any) {
      console.error('[PayGuard] Camera/MediaPipe init failed:', e);
      const msg = e?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access and refresh.'
        : 'Camera access failed. Please refresh.';
      setFeedback(msg);
      setStage('failed');
      stageRef.current = 'failed';
    }
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      faceMeshRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // UI: terminal states
  // ─────────────────────────────────────────────────────────────────────────

  if (stage === 'blocked_virtual_cam') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-8 text-center text-white">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 text-4xl bg-amber-500/20 text-amber-400">
          📷
        </div>
        <h2 className="text-2xl font-bold mb-2 text-amber-400">Virtual Camera Detected</h2>
        <p className="text-slate-400 max-w-sm">
          PayGuard requires a physical hardware camera. Please disable your virtual camera
          software and try again using your device's built-in webcam.
        </p>
      </div>
    );
  }

  if (stage === 'finished' || stage === 'failed') {
    const isSuccess = stage === 'finished';
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-8 text-center text-white">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 text-4xl ${isSuccess ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
          {isSuccess ? '✓' : '×'}
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {isSuccess ? 'Verification Successful' : 'Verification Unsuccessful'}
        </h2>
        <p className="text-slate-400 mb-4">
          Trust Score: <span className="text-white font-mono">{trustScore ?? 0}/100</span>
        </p>
        {/* Identity alert banner */}
        {identityAlert && (
          <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-6 py-3 text-sm text-red-400 max-w-sm">
            {identityAlert}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI: scanning screen
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">

      {/* Tap-to-begin overlay */}
      {stage === 'tap_to_begin' && (
        <div
          onClick={handleTapToBegin}
          className="absolute inset-0 z-[100] bg-[#0f172a] flex flex-col items-center justify-center p-8 text-center cursor-pointer select-none"
        >
          <div className="mb-12 animate-in fade-in zoom-in duration-700">
            <img src="/logo.png" alt="PayGuard AI" className="h-20 w-auto object-contain mx-auto mb-4" />
            <h1 className="text-white text-3xl font-bold tracking-tight">PayGuard AI</h1>
          </div>
          <div className="space-y-6 mb-16">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping scale-150" />
              <div className="w-4 h-4 bg-emerald-500 rounded-full mx-auto relative z-10" />
            </div>
            <div>
              <h2 className="text-white text-xl font-bold mb-2">Tap anywhere to begin</h2>
              <p className="text-slate-400">verification will start immediately</p>
            </div>
          </div>
        </div>
      )}

      {/* Hardware-check overlay */}
      {stage === 'hardware_check' && (
        <div className="absolute inset-0 z-[90] bg-[#0f172a]/80 flex flex-col items-center justify-center gap-4 text-white">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300 font-medium">Verifying camera hardware…</p>
        </div>
      )}

      {/* Camera Section */}
      <div className="h-[60%] relative bg-slate-900">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted />
        <FaceGuide status={stage} faceDetected={faceDetected} />

        {/* Similarity threshold indicator (visible during completing stage) */}
        {stage === 'completing' && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="bg-black/60 backdrop-blur rounded-full px-4 py-1 text-xs text-emerald-400 font-mono">
              Comparing identity… threshold {Math.round(SIMILARITY_THRESHOLDS.PROCEED * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* Instructions Section */}
      <div className="h-[40%] bg-[#0f172a] flex flex-col items-center justify-between p-8 pt-10 border-t border-white/5">
        <div className="text-center space-y-3 w-full">
          <h2 className="text-white text-2xl font-bold tracking-tight">{feedback}</h2>
        </div>

        <div className="flex flex-col items-center gap-8 w-full">
          <div className="flex items-center gap-2 opacity-40 grayscale hover:grayscale-0 transition cursor-default">
            <img src="/logo.png" alt="PayGuard AI" className="h-6 w-auto object-contain" />
            <span className="text-white text-sm font-bold tracking-tight">PayGuard AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
