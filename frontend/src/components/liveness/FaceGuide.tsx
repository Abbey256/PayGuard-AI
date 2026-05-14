// Feature: liveness-verification
// FaceGuide — purely presentational SVG oval overlay for face positioning feedback.
// Renders a centred ellipse over the camera feed.
// Stroke is green (#22c55e) when faceDetected === true AND faceSize >= 0.2.
// Stroke is red (#ef4444) for all other prop combinations.

interface FaceGuideProps {
  faceDetected: boolean;
  faceSize: number; // bounding-box width as fraction of frame width (0–1)
}

export function FaceGuide({ faceDetected, faceSize }: FaceGuideProps) {
  const isPositioned = faceDetected && faceSize >= 0.2;
  const strokeColor = isPositioned ? "#22c55e" : "#ef4444";

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <ellipse
        cx="50"
        cy="50"
        rx="30"
        ry="40"
        fill="none"
        stroke={strokeColor}
        strokeWidth="0.8"
      />
    </svg>
  );
}
