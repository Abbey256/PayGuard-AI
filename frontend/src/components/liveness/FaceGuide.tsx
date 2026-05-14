// Feature: liveness-verification
// FaceGuide — OPay-style portrait oval overlay with glowing animated border.

interface FaceGuideProps {
  status: string;
  faceDetected: boolean;
}

export function FaceGuide({ status, faceDetected }: FaceGuideProps) {
  const strokeColor = faceDetected ? "#16a34a" : "#ef4444";
  const glowColor = faceDetected ? "rgba(22, 163, 74, 0.6)" : "rgba(239, 68, 68, 0.4)";

  // If we are finished or failed, don't show the guide
  if (status === 'finished' || status === 'failed' || status === 'completing') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Dim Overlay with Oval Cutout */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <mask id="oval-mask">
            <rect width="100" height="100" fill="white" />
            <ellipse cx="50" cy="40" rx="32.5" ry="42" fill="black" />
          </mask>
        </defs>
        <rect width="100" height="100" fill="rgba(15, 23, 42, 0.7)" mask="url(#oval-mask)" />
        
        {/* Animated Glowing Border */}
        <ellipse
          cx="50"
          cy="40"
          rx="32.5"
          ry="42"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          className={faceDetected ? "animate-pulse-glow" : ""}
          style={{
            transition: 'stroke 0.3s ease',
            filter: faceDetected ? `drop-shadow(0 0 12px ${glowColor})` : 'none'
          }}
        />
      </svg>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 15px rgba(22, 163, 74, 0.9)); }
          50% { opacity: 0.8; filter: drop-shadow(0 0 5px rgba(22, 163, 74, 0.5)); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
