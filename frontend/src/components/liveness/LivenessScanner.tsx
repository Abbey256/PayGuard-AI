// Feature: liveness-verification
// LivenessScanner — full implementation (Tasks 7.1–7.5)
// Camera init, FaceMesh, challenge engine wiring, orchestration, submission, UI layout.

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceGuide } from './FaceGuide';
import {
  shuffleChallenges,
  computeEAR,
  processBlink,
  computeHeadRatio,
  processHeadTurn,
  computeMouthRatio,
  processSmile,
  ChallengeType,
  BlinkState,
  HeadTurnState,
  SmileState,
} from './challengeEngine';
import {
  updateNoseTipHistory,
  isStaticFace,
  computeFaceBoundingWidth,
  isFaceSizeAdequate,
} from './antiSpoofing';
import { computeTrustScore } from './trustScore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerificationResult {
  verdict: 'verified' | 'flagged';
  trustScore: number;
}

interface LivenessScannerProps {
  token: string;
  onComplete: (result: VerificationResult) => void;
}

// MediaPipe eye landmark indices (Face Mesh)
const LEFT_EYE = { top: 159, bottom: 145, left: 33, right: 133 };
const RIGHT_EYE = { top: 386, bottom: 374, left: 362, right: 263 };

const SESSION_TIMEOUT_MS = 90_000;
const CHALLENGE_TIMEOUT_MS = 10_000;
const REQUIRED_BLINKS = 2;
const NOSE_HISTORY_MAX = 30;
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;

const CHALLENGE_INSTRUCTIONS: Record<ChallengeType, string> = {
  blink: 'Blink twice slowly',
  headTurn: 'Turn your head left, then right',
  smile: 'Smile and hold for 1 second',
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FaceMesh: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Camera: any;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LivenessScanner({ token, onComplete }: LivenessScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cleanup refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceMeshRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Submission guard
  const submittedRef = useRef(false);

  // Session state in refs (frame-loop state — not UI)
  const sessionStartRef = useRef<number>(Date.now());
  const challengeStartRef = useRef<number>(Date.now());
  const challengeOrderRef = useRef<ChallengeType[]>(['blink', 'headTurn', 'smile']);
  const challengeIndexRef = useRef(0);
  const challengesPassedRef = useRef(0);
  const noseTipHistoryRef = useRef<{ x: number; y: number }[]>([]);
  const faceSizeAdequateRef = useRef(false);
  const staticFaceDetectedRef = useRef(false);
  const lastFrameTimeRef = useRef<number>(Date.now());

  // Per-challenge state refs
  const blinkStateRef = useRef<BlinkState>({ eyeClosed: false, blinkCount: 0 });
  const headTurnStateRef = useRef<HeadTurnState>({ leftDetected: false, passed: false });
  const smileStateRef = useRef<SmileState>({ smileStartMs: null, passed: false });

  // UI state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceSize, setFaceSize] = useState(0);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(90);

  // Keep callbacks accessible without stale closures
  const tokenRef = useRef(token);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // -------------------------------------------------------------------------
  // Submit result with retry logic (Requirement 12.3–12.5)
  // -------------------------------------------------------------------------
  const submitResult = useCallback(async (result: VerificationResult) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    const body = JSON.stringify({
      token: tokenRef.current,
      trustScore: result.trustScore,
      verdict: result.verdict,
      challengesPassed: challengesPassedRef.current,
      challengesTotal: 3,
      faceSizeAdequate: faceSizeAdequateRef.current,
      staticFaceDetected: staticFaceDetectedRef.current,
      completionTimeSeconds: Math.floor((Date.now() - sessionStartRef.current) / 1000),
    });

    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const resp = await fetch(`${apiUrl}/api/verify/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          throw new Error(j.message ?? `HTTP ${resp.status}`);
        }
        onCompleteRef.current(result);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < RETRY_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }

    console.error('Submission failed after retries:', lastErr);
    setSubmitError('Could not submit your result. Please check your connection and try again.');
    onCompleteRef.current(result); // still surface the result to VerificationPage
  }, []);

  // -------------------------------------------------------------------------
  // Finalise session → compute trust score → submit
  // -------------------------------------------------------------------------
  const finaliseSession = useCallback((forceFlagged = false) => {
    if (submittedRef.current) return;

    const completionSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);

    if (forceFlagged) {
      submitResult({ verdict: 'flagged', trustScore: 0 });
      return;
    }

    const output = computeTrustScore({
      challengesPassed: challengesPassedRef.current,
      faceSizeAdequate: faceSizeAdequateRef.current,
      staticFaceDetected: staticFaceDetectedRef.current,
      completionTimeSeconds: completionSeconds,
    });

    submitResult(output);
  }, [submitResult]);

  // -------------------------------------------------------------------------
  // Advance to next challenge or finalise
  // -------------------------------------------------------------------------
  const advanceChallenge = useCallback(() => {
    const next = challengeIndexRef.current + 1;
    challengeIndexRef.current = next;
    challengeStartRef.current = Date.now();

    // Reset per-challenge state
    blinkStateRef.current = { eyeClosed: false, blinkCount: 0 };
    headTurnStateRef.current = { leftDetected: false, passed: false };
    smileStateRef.current = { smileStartMs: null, passed: false };

    if (next >= 3) {
      finaliseSession();
    } else {
      setCurrentChallengeIndex(next);
    }
  }, [finaliseSession]);

  // -------------------------------------------------------------------------
  // Countdown timer
  // -------------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const remaining = Math.max(0, 90 - elapsed);
      setTimeRemaining(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        finaliseSession(true); // timeout → flagged
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [finaliseSession]);

  // -------------------------------------------------------------------------
  // Main camera + FaceMesh init
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    // Shuffle challenge order once on mount
    challengeOrderRef.current = shuffleChallenges(['blink', 'headTurn', 'smile']);
    sessionStartRef.current = Date.now();
    challengeStartRef.current = Date.now();

    async function init() {
      // Guard: CDN global must exist
      if (typeof window.FaceMesh === 'undefined') {
        setErrorMessage('Failed to load face detection. Please check your connection and reload.');
        return;
      }

      // Camera access
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      } catch {
        if (!cancelled) {
          setErrorMessage('Camera access is required for verification. Please allow camera access and reload the page.');
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // FaceMesh init
      const faceMesh = new window.FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      // -----------------------------------------------------------------------
      // onResults — full challenge + anti-spoofing wiring (Tasks 7.2, 7.3)
      // -----------------------------------------------------------------------
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      faceMesh.onResults((results: any) => {
        if (cancelled || submittedRef.current) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth || canvas.offsetWidth;
        canvas.height = video.videoHeight || canvas.offsetHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const faceCount = results.multiFaceLandmarks?.length ?? 0;

        // Multiple-face termination (Requirement 8.1–8.3)
        if (faceCount > 1) {
          finaliseSession(true);
          return;
        }

        if (faceCount === 0) {
          setFaceDetected(false);
          setFaceSize(0);
          setFeedbackMessage('Position your face in the oval');
          return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        setFaceDetected(true);

        // Draw landmark dots
        ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
        for (const lm of landmarks) {
          ctx.beginPath();
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Face size (anti-spoofing)
        const boundingWidth = computeFaceBoundingWidth(landmarks, canvas.width);
        const faceRatio = Math.abs(landmarks[454].x - landmarks[234].x);
        setFaceSize(faceRatio);

        const adequate = isFaceSizeAdequate(boundingWidth, canvas.width);
        faceSizeAdequateRef.current = adequate;

        // Nose-tip history (static face detection)
        noseTipHistoryRef.current = updateNoseTipHistory(
          noseTipHistoryRef.current,
          { x: landmarks[1].x, y: landmarks[1].y },
          NOSE_HISTORY_MAX
        );
        const isStatic = isStaticFace(noseTipHistoryRef.current);
        staticFaceDetectedRef.current = isStatic;

        // Pause challenge if face is too far
        if (!adequate) {
          setFeedbackMessage('Move closer to the camera.');
          return;
        }

        if (isStatic) {
          setFeedbackMessage('Movement required — please move naturally.');
          return;
        }

        // Challenge timeout
        if (Date.now() - challengeStartRef.current > CHALLENGE_TIMEOUT_MS) {
          advanceChallenge();
          return;
        }

        // Per-challenge logic
        const nowMs = Date.now();
        const deltaMs = nowMs - lastFrameTimeRef.current;
        lastFrameTimeRef.current = nowMs;

        const currentType = challengeOrderRef.current[challengeIndexRef.current];

        if (currentType === 'blink') {
          const earLeft = computeEAR(landmarks, LEFT_EYE);
          const earRight = computeEAR(landmarks, RIGHT_EYE);
          const ear = (earLeft + earRight) / 2;

          blinkStateRef.current = processBlink(blinkStateRef.current, ear);
          const blinks = blinkStateRef.current.blinkCount;

          setFeedbackMessage(`Blinks detected: ${blinks} / ${REQUIRED_BLINKS}`);

          if (blinks >= REQUIRED_BLINKS) {
            challengesPassedRef.current += 1;
            setCompletedChallenges((c) => c + 1);
            advanceChallenge();
          }
        } else if (currentType === 'headTurn') {
          const ratio = computeHeadRatio(landmarks);
          headTurnStateRef.current = processHeadTurn(headTurnStateRef.current, ratio);

          if (!headTurnStateRef.current.leftDetected) {
            setFeedbackMessage('Turn your head to the LEFT');
          } else if (!headTurnStateRef.current.passed) {
            setFeedbackMessage('Now turn your head to the RIGHT');
          }

          if (headTurnStateRef.current.passed) {
            challengesPassedRef.current += 1;
            setCompletedChallenges((c) => c + 1);
            advanceChallenge();
          }
        } else if (currentType === 'smile') {
          const mouthRatio = computeMouthRatio(landmarks);
          smileStateRef.current = processSmile(smileStateRef.current, mouthRatio, deltaMs);

          const heldMs = smileStateRef.current.smileStartMs ?? 0;
          setFeedbackMessage(
            heldMs > 0
              ? `Hold your smile… ${Math.min(100, Math.floor((heldMs / 1000) * 100))}%`
              : 'Smile naturally'
          );

          if (smileStateRef.current.passed) {
            challengesPassedRef.current += 1;
            setCompletedChallenges((c) => c + 1);
            advanceChallenge();
          }
        }
      });

      faceMeshRef.current = faceMesh;

      // Camera loop
      if (videoRef.current && typeof window.Camera !== 'undefined') {
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && faceMeshRef.current) {
              await faceMeshRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        cameraRef.current = camera;
        camera.start();
      }
    }

    init();

    return () => {
      cancelled = true;
      try { cameraRef.current?.stop(); } catch { /* ignore */ }
      cameraRef.current = null;
      try { faceMeshRef.current?.close(); } catch { /* ignore */ }
      faceMeshRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Error screen
  // -------------------------------------------------------------------------
  if (errorMessage) {
    return (
      <div role="alert" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', background: '#0f172a', color: '#f8fafc',
        padding: '1.5rem', textAlign: 'center', fontSize: '1rem', lineHeight: 1.6,
      }}>
        <p>{errorMessage}</p>
      </div>
    );
  }

  const challengeTypes = challengeOrderRef.current;
  const currentInstruction = CHALLENGE_INSTRUCTIONS[challengeTypes[currentChallengeIndex]];

  // -------------------------------------------------------------------------
  // Main scanner UI (Task 7.5 — mobile-first layout)
  // -------------------------------------------------------------------------
  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', background: '#0f172a', overflow: 'hidden' }}>

      {/* Camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="Camera feed"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', transform: 'scaleX(-1)',
        }}
      />

      {/* Landmark canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', transform: 'scaleX(-1)',
        }}
      />

      {/* SVG face guide */}
      <FaceGuide faceDetected={faceDetected} faceSize={faceSize} />

      {/* Top-left logo */}
      <div style={{
        position: 'absolute', top: '1rem', left: '1rem',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
      }}>
        <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 2C16 2 6 6 6 14c0 8 10 14 10 14s10-6 10-14c0-8-10-12-10-12z" fill="#16a34a" />
          <text x="16" y="19" fontSize="11" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial,sans-serif">PG</text>
        </svg>
        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.02em' }}>
          PayGuard <span style={{ background: '#16a34a', borderRadius: '3px', padding: '0 4px', fontSize: '0.7rem' }}>AI</span>
        </span>
      </div>

      {/* Bottom secured badge */}
      <div style={{
        position: 'absolute', bottom: '1rem', right: '1rem',
        color: 'rgba(248,250,252,0.4)', fontSize: '0.65rem',
      }}>
        Secured by PayGuard AI
      </div>

      {/* Bottom panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(15,23,42,0.97) 60%, transparent)',
        padding: '2.5rem 1.5rem 2rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: i < completedChallenges
                ? '#22c55e'
                : i === currentChallengeIndex
                  ? '#60a5fa'
                  : 'rgba(248,250,252,0.2)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Challenge instruction */}
        <p style={{
          color: '#f8fafc', fontSize: 'clamp(1.1rem, 4vw, 1.4rem)',
          fontWeight: 700, textAlign: 'center', margin: 0,
        }}>
          {currentInstruction}
        </p>

        {/* Feedback */}
        <p style={{
          color: '#94a3b8', fontSize: '0.9rem',
          textAlign: 'center', minHeight: '1.4rem', margin: 0,
        }}>
          {feedbackMessage}
        </p>

        {/* Submission error */}
        {submitError && (
          <p style={{
            color: '#f87171', fontSize: '0.8rem', textAlign: 'center', margin: 0,
          }}>
            {submitError}
          </p>
        )}

        {/* Countdown */}
        <p style={{
          color: timeRemaining <= 15 ? '#f87171' : '#64748b',
          fontSize: '0.8rem', textAlign: 'center', margin: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {timeRemaining}s remaining
        </p>
      </div>
    </div>
  );
}
