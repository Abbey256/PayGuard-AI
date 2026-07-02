/**
 * Face Match Service (Backend)
 *
 * NOTE: Server-side face matching is not active in this build.
 * Face comparison runs entirely in the browser using MediaPipe FaceMesh
 * cosine similarity (faceVerification.ts). The browser result is sent as
 * faceMatchScore and used as one component of the server-side trust score.
 *
 * For a government production deployment, wire this to AWS Rekognition or
 * Azure Face API so the server independently verifies the face match without
 * relying on the client's claim. See comments below for the integration pattern.
 */

/**
 * Placeholder — not called in the current verification flow.
 * The active path is: browser MediaPipe cosine similarity → faceMatchScore in POST body
 * → server recomputeTrustScore() uses it as a weighted input alongside liveness data.
 *
 * To enable server-side verification:
 *   1. Uncomment the AWS Rekognition block below
 *   2. Call compareFaces(snapshot, photoUrl) from verifyController.submitVerification
 *   3. Use the returned confidence instead of clientFaceMatchScore
 */
export async function compareFaces(snapshotBase64, referencePhotoUrl) {
  if (!snapshotBase64 || !referencePhotoUrl) {
    return { match: false, confidence: 0, error: "Missing image data" };
  }

  // ── Production: AWS Rekognition ───────────────────────────────────────────
  // import AWS from 'aws-sdk';
  // const rekognition = new AWS.Rekognition({ region: process.env.AWS_REGION });
  // const params = {
  //   SourceImage: { Bytes: Buffer.from(snapshotBase64.split(',')[1], 'base64') },
  //   TargetImage: { S3Object: { Bucket: process.env.S3_BUCKET, Name: referencePhotoUrl } },
  //   SimilarityThreshold: 80,
  // };
  // const result = await rekognition.compareFaces(params).promise();
  // const match = result.FaceMatches?.[0];
  // return {
  //   match: !!match,
  //   confidence: match?.Similarity ?? 0,
  // };

  // ── NOT IMPLEMENTED — return explicit error instead of fake success ────────
  console.warn("[PayGuard] compareFaces called but server-side face matching is not configured.");
  return {
    match: false,
    confidence: 0,
    error: "Server-side face matching not configured. Using browser cosine similarity score.",
  };
}
