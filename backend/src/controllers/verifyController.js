/**
 * Verify Controller
 * Handles public liveness verification endpoints (no auth required).
 *
 * GET  /api/verify/:token  → validateToken
 * POST /api/verify/submit  → submitVerification
 *
 * SECURITY NOTE — server-side trust score recomputation
 * ──────────────────────────────────────────────────────
 * The client submits livenessData (challenge booleans) but NOT the trust score.
 * The server recomputes the trust score from those challenge results so that
 * a tampered POST body (e.g. { trustScore: 100, verdict: "verified" }) cannot
 * bypass the biometric gate. The client-supplied trustScore and verdict fields
 * are intentionally ignored.
 */

import { supabase } from "../services/supabaseClient.js";

// ─── Server-side trust score computation ─────────────────────────────────────
// Mirrors the formula in ai/trustScore/trustScore.js.
// Kept inline here so verifyController has zero external dependencies and
// the gate logic is always visible in a security review.

const LIVENESS_WEIGHTS = {
  BASE:       10,   // awarded for attempting
  PER_CHALLENGE: 25, // per challenge passed (max 3 → 75)
  LIVENESS_BONUS: 15, // if no static face detected
};

const FACE_MATCH_WEIGHT = 0.50; // 50% of final score
const LIVENESS_WEIGHT   = 0.50; // 50% of final score

/**
 * Recomputes trust score and verdict entirely from submitted challenge data.
 * The face match score sent by the client is accepted as an input component
 * but the FINAL verdict is computed here — never trusted from the request body.
 *
 * @param {Object} livenessData - Challenge results from the browser session
 * @param {number} clientFaceMatchScore - 0–100 face match score from browser
 * @returns {{ serverTrustScore: number, serverVerdict: string }}
 */
function recomputeTrustScore(livenessData, clientFaceMatchScore) {
  const {
    blinkDetected       = false,
    headTurnDetected    = false,
    smileDetected       = false,
    challengesPassed    = 0,
    staticFaceDetected  = false,
  } = livenessData ?? {};

  // Count from individual booleans as a cross-check against challengesPassed
  const booleanCount =
    (blinkDetected    ? 1 : 0) +
    (headTurnDetected ? 1 : 0) +
    (smileDetected    ? 1 : 0);

  // Use the higher of the two counts (generous — benefits the worker)
  // but cap at 3 to prevent manipulation
  const confirmedChallenges = Math.min(3, Math.max(booleanCount, challengesPassed ?? 0));

  // Liveness score (0–100)
  let livenessScore = LIVENESS_WEIGHTS.BASE;
  livenessScore += confirmedChallenges * LIVENESS_WEIGHTS.PER_CHALLENGE;
  if (!staticFaceDetected) livenessScore += LIVENESS_WEIGHTS.LIVENESS_BONUS;
  livenessScore = Math.min(100, livenessScore);

  // Face match score — clamp the client value to [0, 100]
  const faceMatchScore = Math.max(0, Math.min(100, clientFaceMatchScore ?? 0));

  // Combined score
  const rawScore = (livenessScore * LIVENESS_WEIGHT) + (faceMatchScore * FACE_MATCH_WEIGHT);
  const serverTrustScore = Math.round(Math.min(100, rawScore) * 100) / 100;

  // Verdict
  let serverVerdict;
  if (serverTrustScore >= 90) {
    serverVerdict = "verified";
  } else if (serverTrustScore >= 70) {
    serverVerdict = "review";
  } else {
    serverVerdict = "flagged";
  }

  // Hard block: if liveness completely failed (no challenges + static face),
  // override verdict regardless of face match score
  if (confirmedChallenges === 0 && staticFaceDetected) {
    return { serverTrustScore: 0, serverVerdict: "flagged" };
  }

  return { serverTrustScore, serverVerdict };
}

/**
 * GET /api/verify/:token
 *
 * Validates a one-time verification token and returns the worker's name and
 * organisation name so the VerificationPage can display them before the
 * liveness scanner starts.
 *
 * Response matrix:
 *   200  { workerName, organizationName }   — valid, non-expired, not completed
 *   404  { message }                        — token not found
 *   409  { message }                        — status === "completed" (takes priority over expiry)
 *   410  { message }                        — token_expires_at is in the past
 */
export async function validateToken(req, res, next) {
  try {
    const { token } = req.params;

    // Step 1: Fetch the verification request and the staff_id linked to this token.
    const { data: verReq, error: verReqError } = await supabase
      .from("verification_requests")
      .select("id, status, token_expires_at, staff_id")
      .eq("token", token)
      .single();

    if (verReqError || !verReq) {
      return res.status(404).json({ message: "Verification link not found" });
    }

    // Completed status takes priority over expiry check.
    if (verReq.status === "completed") {
      return res.status(409).json({ message: "Verification already completed" });
    }

    // Check expiry.
    if (new Date(verReq.token_expires_at) < new Date()) {
      return res.status(410).json({ message: "Verification link has expired" });
    }

    // Step 2: Fetch the staff record directly by id — this guarantees photo_url
    // is always read, regardless of whether the FK join to organizations works.
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("first_name, last_name, photo_url, organization_id")
      .eq("id", verReq.staff_id)
      .single();

    if (staffError || !staff) {
      return res.status(404).json({ message: "Staff record not found" });
    }

    // Step 3: Fetch organization name (non-fatal if it fails).
    let organizationName = "";
    if (staff.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", staff.organization_id)
        .single();
      organizationName = org?.name ?? "";
    }

    const workerName = `${staff.first_name ?? ""} ${staff.last_name ?? ""}`.trim();
    const photoUrl = staff.photo_url ?? null;

    return res.status(200).json({ workerName, organizationName, photoUrl });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/verify/submit
 *
 * Receives liveness challenge results from the browser, RECOMPUTES the trust
 * score server-side, and updates both verification_requests and staff records.
 *
 * The client-supplied trustScore and verdict are IGNORED — the server derives
 * its own verdict from livenessData. This closes the bypass where anyone
 * could POST { trustScore: 100, verdict: "verified" } to skip biometrics.
 *
 * Expected request body:
 *   {
 *     token:          string,
 *     trustScore:     number,   ← ignored, server recomputes
 *     verdict:        string,   ← ignored, server recomputes
 *     faceMatchScore: number,   ← 0-100 from browser cosine similarity
 *     livenessData: {
 *       blinkDetected:     boolean,
 *       headTurnDetected:  boolean,
 *       smileDetected:     boolean,
 *       challengesPassed:  number,
 *       staticFaceDetected: boolean,
 *       snapshot:          string   ← base64 JPEG (stored for audit)
 *     }
 *   }
 *
 * Response:
 *   200  { success: true, verdict, trustScore }  — records updated
 *   400  { message }                             — missing photo
 *   409  { message }                             — token used / not found
 */
export async function submitVerification(req, res, next) {
  try {
    const { token, faceMatchScore, livenessData } = req.body;
    // NOTE: req.body.trustScore and req.body.verdict are intentionally destructured
    // but not used — server always recomputes from livenessData below.

    // ── 1. Validate token ─────────────────────────────────────────────────────
    const { data: verificationRequest, error: fetchError } = await supabase
      .from("verification_requests")
      .select(`
        id,
        staff_id,
        status,
        staff (
          first_name,
          last_name,
          email,
          photo_url,
          salary,
          organization_id
        )
      `)
      .eq("token", token)
      .single();

    if (fetchError || !verificationRequest || verificationRequest.status === "completed") {
      return res.status(409).json({ message: "Token already used or not found" });
    }

    if (!verificationRequest.staff.photo_url) {
      return res.status(400).json({
        message: "No reference photo on record for this staff member. Contact HR to upload a photo before verification.",
      });
    }

    const { id: verificationId, staff_id: staffId } = verificationRequest;

    // ── 2. SERVER-SIDE trust score recomputation ──────────────────────────────
    // The client-supplied score is never written to the DB.
    const { serverTrustScore, serverVerdict } = recomputeTrustScore(
      livenessData,
      faceMatchScore,
    );

    console.log(`[PayGuard] Server recomputed — score: ${serverTrustScore}, verdict: ${serverVerdict}`);

    // ── 3. Mark token as consumed (prevents replay) ───────────────────────────
    const { error: verificationUpdateError } = await supabase
      .from("verification_requests")
      .update({
        status:           "completed",
        completed_at:     new Date().toISOString(),
        liveness_score:   serverTrustScore,
        final_score:      serverTrustScore,
        final_verdict:    serverVerdict,
        challenges_passed: livenessData?.challengesPassed ?? 0,
        challenges_total:  3,
      })
      .eq("id", verificationId);

    if (verificationUpdateError) {
      console.error("verification_requests update failed:", verificationUpdateError);
      throw verificationUpdateError;
    }

    // ── 4. Update staff record with SERVER verdict ────────────────────────────
    const { error: staffUpdateError } = await supabase
      .from("staff")
      .update({
        status:      serverVerdict,
        trust_score: serverTrustScore,
      })
      .eq("id", staffId);

    if (staffUpdateError) {
      console.error("staff update failed:", staffUpdateError);
      throw staffUpdateError;
    }

    // ── 5. Auto-add to payment batch if verified ──────────────────────────────
    if (serverVerdict === "verified") {
      const orgId  = verificationRequest.staff.organization_id;
      const salary = verificationRequest.staff.salary || 0;
      const monthLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" });
      const batchName  = `Salary Batch - ${monthLabel}`;

      // Find or create a pending batch for this org
      let { data: batch, error: batchError } = await supabase
        .from("payment_batches")
        .select("id, staff_count, total_amount")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (batchError && batchError.code !== "PGRST116") {
        console.error("Error fetching payment batch:", batchError);
      }

      if (!batch) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("admin_id")
          .eq("id", orgId)
          .single();

        const { data: newBatch, error: createError } = await supabase
          .from("payment_batches")
          .insert({
            organization_id: orgId,
            batch_name:      batchName,
            staff_count:     0,
            total_amount:    0,
            status:          "pending",
            created_by:      orgData?.admin_id,
          })
          .select()
          .single();

        if (createError) console.error("Failed to create batch:", createError);
        batch = newBatch;
      }

      if (batch) {
        const { data: existingEntry } = await supabase
          .from("payment_batch_staff")
          .select("staff_id")
          .eq("batch_id", batch.id)
          .eq("staff_id", staffId)
          .single();

        if (!existingEntry) {
          await supabase.from("payment_batch_staff").insert({ batch_id: batch.id, staff_id: staffId });
          await supabase
            .from("payment_batches")
            .update({
              staff_count:  batch.staff_count  + 1,
              total_amount: batch.total_amount + salary,
            })
            .eq("id", batch.id);
        }
      }
    }

    // ── 6. Audit log ──────────────────────────────────────────────────────────
    await supabase.from("audit_logs").insert({
      action:      "STAFF_VERIFIED",
      entity_type: "staff",
      entity_id:   staffId,
      changes: {
        serverVerdict,
        serverTrustScore,
        challengesPassed:  livenessData?.challengesPassed ?? 0,
        blinkDetected:     livenessData?.blinkDetected    ?? false,
        headTurnDetected:  livenessData?.headTurnDetected ?? false,
        smileDetected:     livenessData?.smileDetected    ?? false,
        previousStatus:    "pending",
        note: "Trust score computed server-side. Client-supplied score ignored.",
      },
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({
      success:    true,
      verdict:    serverVerdict,
      trustScore: serverTrustScore,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  validateToken,
  submitVerification,
};
