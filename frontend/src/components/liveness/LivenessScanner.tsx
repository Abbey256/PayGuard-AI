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
} from './challengeEngine';
import { computeTrustScore } from './trustScore';

export interface VerificationResult {
  verdict: 'verified' | 'flagged';
  trustScore: number;
}

const synth = window.speechSynthesis;

const speak = (text: string, onEnd?: () => void) => {
  if (!synth) {
    if (onEnd) onEnd();
    return;
  }
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  const voices = synth.getVoices();
  const femaleVoice = voices.find(v => 
    v.name.includes('Female') || 
    v.name.includes('Samantha') ||
    v.name.includes('Google UK English Female') ||
    v.name.includes('Microsoft Zira') ||
    v.name.includes('Karen')
  );
  if (femaleVoice) utterance.voice = femaleVoice;
  
  utterance.lang = 'en-GB';
  utterance.rate = 0.85;
  utterance.pitch = 1.1;
  utterance.volume = 1;
  
  if (onEnd) {
    let fired = false;
    const fallbackTime = text.length * 80 + 1500; // rough duration
    
    const fallbackTimer = setTimeout(() => {
      if (!fired) {
        fired = true;
        onEnd();
      }
    }, fallbackTime);

    utterance.onend = () => {
      if (!fired) {
        fired = true;
        clearTimeout(fallbackTimer);
        setTimeout(onEnd, 100);
      }
    };
    utterance.onerror = () => {
      if (!fired) {
        fired = true;
        clearTimeout(fallbackTimer);
        onEnd();
      }
    };
  }
  
  synth.speak(utterance);
};

type Stage = 'tap_to_begin' | 'initializing' | 'positioning' | 'blink' | 'headTurn' | 'smile' | 'completing' | 'finished' | 'failed';

export function LivenessScanner({ token, onComplete }: { token: string; onComplete: (res: VerificationResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceMeshRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<Stage>('tap_to_begin');
  const [feedback, setFeedback] = useState('Tap anywhere to begin');
  const [faceDetected, setFaceDetected] = useState(false);
  const [trustScore, setTrustScore] = useState<number | null>(null);

  // Refs for state machine inside requestAnimationFrame / onResults
  const stageRef = useRef<Stage>('tap_to_begin');
  const detectionActiveRef = useRef(false);
  
  // Tracking challenges
  const challengesPassed = useRef(0);
  const positioningStartMs = useRef<number | null>(null);
  
  const blinkState = useRef<BlinkState>({ eyeClosed: false, blinkCount: 0 });
  const headTurnState = useRef<HeadTurnState>({ leftDetected: false, passed: false });
  const smileState = useRef<SmileState>({ smileStartMs: null, passed: false });
  const lastProcessedTime = useRef(0);
  const hasStaticFace = useRef(true); // Default true, set to false if movement detected (simplified)

  const advanceStage = useCallback((newStage: Stage, feedbackText: string, speechText: string) => {
    setStage(newStage);
    stageRef.current = newStage;
    setFeedback(feedbackText);
    detectionActiveRef.current = false; // Pause detection while speaking
    
    speak(speechText, () => {
      detectionActiveRef.current = true; // Resume detection after speaking
    });
  }, []);

  const handleTapToBegin = () => {
    if (stage !== 'tap_to_begin') return;
    
    // Unlock audio context by speaking an empty string during the user gesture
    const unlockUtterance = new SpeechSynthesisUtterance(' ');
    unlockUtterance.volume = 0; // quiet
    synth.speak(unlockUtterance);
    
    setStage('initializing');
    stageRef.current = 'initializing';
    setFeedback('Starting camera and AI...');
    initCameraAndAI();
  };

  const captureSnapshot = (): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Draw video frame to canvas
    // Flip horizontally because the video is flipped via CSS scale-x-[-1]
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Return base64 JPEG (smaller size for backend)
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const finishVerification = async (passedCount: number) => {
    advanceStage('completing', 'Processing...', 'Thank you. Processing your verification.');
    
    // Capture snapshot for backend face matching
    const snapshotBase64 = captureSnapshot();

    const result = computeTrustScore({
      challengesPassed: passedCount,
      staticFaceDetected: false, // For simplicity in this rewrite
    });

    try {
      let apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl || apiUrl.startsWith('/')) {
        apiUrl = window.location.origin;
      }
      if (window.location.protocol === 'https:' && apiUrl.startsWith('http://') && !apiUrl.includes('localhost')) {
        apiUrl = apiUrl.replace('http://', 'https://');
      }

      const payload = {
        token,
        trustScore: result.trustScore,
        verdict: result.verdict,
        livenessData: {
          blinkDetected: passedCount >= 1,
          headTurnDetected: passedCount >= 2,
          smileDetected: passedCount >= 3,
          challengesPassed: passedCount,
          snapshot: snapshotBase64 // Sent to backend for face matching
        }
      };

      await fetch(`${apiUrl}/api/verify/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to submit verification', err);
    }

    setTrustScore(result.trustScore);
    const finalStage = result.verdict === 'verified' ? 'finished' : 'failed';
    setStage(finalStage);
    stageRef.current = finalStage;
    
    if (result.verdict === 'verified') {
      speak('Verification successful. Your salary will be processed.');
    } else {
      speak('Verification unsuccessful. Please contact HR.');
    }

    onComplete(result);
  };

  const initCameraAndAI = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const fm = new FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`
      });
      
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      fm.onResults((results: any) => {
        const landmarks = results.multiFaceLandmarks?.[0];
        
        if (landmarks) {
          setFaceDetected(true);
        } else {
          setFaceDetected(false);
          positioningStartMs.current = null;
          return; // Stop processing if no face
        }

        const currentStage = stageRef.current;
        const now = Date.now();
        if (now - lastProcessedTime.current < 1000 / 15) return; // Max 15 fps
        const deltaMs = now - (lastProcessedTime.current || now);
        lastProcessedTime.current = now;

        // Stage 1: Wait for Mediapipe to load and transition to positioning
        if (currentStage === 'initializing') {
          advanceStage('positioning', 'Position your face in the oval', 'Welcome. Position your face in the oval.');
          return;
        }

        // If detection is paused (e.g. while speaking), skip challenge logic
        if (!detectionActiveRef.current) return;

        // Stage 2: Face detected for 2 seconds
        if (currentStage === 'positioning') {
          if (!positioningStartMs.current) positioningStartMs.current = now;
          if (now - positioningStartMs.current > 2000) {
            advanceStage('blink', 'Blink twice', 'Please blink twice naturally.');
          }
        }

        // Stage 3: Detect 2 blinks
        if (currentStage === 'blink') {
          const ear = (computeEAR(landmarks, { top: 159, bottom: 145, left: 33, right: 133 }) + 
                       computeEAR(landmarks, { top: 386, bottom: 374, left: 362, right: 263 })) / 2;
          blinkState.current = processBlink(blinkState.current, ear);
          setFeedback(`Blinks: ${blinkState.current.blinkCount}/2`);
          
          if (blinkState.current.blinkCount >= 2) {
            challengesPassed.current += 1;
            advanceStage('headTurn', 'Turn head left, then right', 'Good. Now turn your head left, then right.');
          }
        }

        // Stage 4: Detect Head Turn
        if (currentStage === 'headTurn') {
          const ratio = computeHeadRatio(landmarks);
          headTurnState.current = processHeadTurn(headTurnState.current, ratio);
          setFeedback(headTurnState.current.leftDetected ? 'Now turn right' : 'Turn head left');
          
          if (headTurnState.current.passed) {
            challengesPassed.current += 1;
            advanceStage('smile', 'Smile for the camera', 'Perfect. Now smile for the camera.');
          }
        }

        // Stage 5: Detect Smile
        if (currentStage === 'smile') {
          const mouthRatio = computeMouthRatio(landmarks);
          smileState.current = processSmile(smileState.current, mouthRatio, deltaMs);
          setFeedback(smileState.current.smileStartMs ? 'Hold smile...' : 'Smile for the camera');
          
          if (smileState.current.passed) {
            challengesPassed.current += 1;
            finishVerification(challengesPassed.current);
          }
        }
      });

      faceMeshRef.current = fm;

      const detectFace = async () => {
        if (stageRef.current === 'finished' || stageRef.current === 'failed') return;
        if (videoRef.current && videoRef.current.readyState >= 2) {
          try {
            await fm.send({ image: videoRef.current });
          } catch (err) {}
        }
        requestAnimationFrame(detectFace);
      };
      detectFace();

    } catch (e) {
      console.error("Camera/MediaPipe init failed", e);
      setFeedback('Camera access failed. Please refresh.');
    }
  };

  useEffect(() => {
    return () => {
      faceMeshRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // UI Render
  if (stage === 'finished' || stage === 'failed') {
    const isSuccess = stage === 'finished';
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-8 text-center text-white">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 text-4xl ${isSuccess ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
          {isSuccess ? '✓' : '×'}
        </div>
        <h2 className="text-2xl font-bold mb-2">{isSuccess ? 'Verification Successful' : 'Verification Unsuccessful'}</h2>
        <p className="text-slate-400 mb-8">Trust Score: <span className="text-white font-mono">{trustScore ?? 0}/100</span></p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      
      {stage === 'tap_to_begin' && (
        <div 
          onClick={handleTapToBegin}
          className="absolute inset-0 z-[100] bg-[#0f172a] flex flex-col items-center justify-center p-8 text-center cursor-pointer select-none"
        >
          <div className="mb-12 animate-in fade-in zoom-in duration-700">
            <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 mx-auto mb-4">
              <span className="text-white text-3xl font-black">PG</span>
            </div>
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

      {/* Camera Section */}
      <div className="h-[60%] relative bg-slate-900">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted />
        <FaceGuide status={stage} faceDetected={faceDetected} />
      </div>

      {/* Instructions Section */}
      <div className="h-[40%] bg-[#0f172a] flex flex-col items-center justify-between p-8 pt-10 border-t border-white/5">
        <div className="text-center space-y-3 w-full">
          <h2 className="text-white text-2xl font-bold tracking-tight">
            {feedback}
          </h2>
        </div>

        <div className="flex flex-col items-center gap-8 w-full">
          <div className="flex items-center gap-2 opacity-40 grayscale hover:grayscale-0 transition cursor-default">
            <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center font-bold text-[#0f172a] text-xs">PG</div>
            <span className="text-white text-sm font-bold tracking-tight">PayGuard AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
