/**
 * Verify Controller
 * Handles public liveness verification endpoints (no auth required).
 *
 * GET  /api/verify/:token  → validateToken
 * POST /api/verify/submit  → submitVerification
 */

import { supabase } from "../services/supabaseClient.js";
import { compareFaces } from "../services/faceMatchService.js";

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

    // Fetch the verification request and join staff + organizations in one query.
    const { data, error } = await supabase
      .from("verification_requests")
      .select(
        `
        id,
        status,
        token_expires_at,
        staff (
          first_name,
          last_name,
          organizations (
            name
          )
        )
      `
      )
      .eq("token", token)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Verification link not found" });
    }

    // Completed status takes priority over expiry check (Requirement 18.6).
    if (data.status === "completed") {
      return res.status(409).json({ message: "Verification already completed" });
    }

    // Check expiry.
    if (new Date(data.token_expires_at) < new Date()) {
      return res.status(410).json({ message: "Verification link has expired" });
    }

    // Build response values from joined tables.
    const workerName = `${data.staff.first_name} ${data.staff.last_name}`;
    const organizationName = data.staff.organizations?.name ?? "";

    return res.status(200).json({ workerName, organizationName });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/verify/submit
 *
 * Receives the liveness result from the LivenessScanner, validates the token,
 * then updates both `verification_requests` and `staff` records.
 *
 * Expected request body:
 *   {
 *     token: string,
 *     trustScore: number,
 *     verdict: "verified" | "flagged",
 *     livenessData: {
 *       blinkCount: number,
 *       headMovementDetected: boolean,
 *       smileDetected: boolean,
 *       staticFaceDetected: boolean,
 *       completionTimeSeconds: number,
 *       challengesPassedCount: number
 *     }
 *   }
 *
 * Response matrix:
 *   200  { success: true }                          — both records updated
 *   409  { message }                                — token not found or already used
 */
export async function submitVerification(req, res, next) {
  try {
    const { token, trustScore, verdict, livenessData } = req.body;

    // Validate token — reject if not found or already completed.
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
          photo_url
        )
      `)
      .eq("token", token)
      .single();

    if (fetchError || !verificationRequest || verificationRequest.status === "completed") {
      return res.status(409).json({ message: "Token already used or not found" });
    }

    const { id: verificationId, staff_id: staffId } = verificationRequest;
    // --- FACE MATCHING STEP ---
    const adminPhotoUrl = verificationRequest.staff.photo_url;
    const snapshotBase64 = livenessData?.snapshot;
    let finalVerdict = verdict;
    let matchConfidence = null;

    if (verdict === "verified" && snapshotBase64 && adminPhotoUrl) {
      const matchResult = await compareFaces(snapshotBase64, adminPhotoUrl);
      matchConfidence = matchResult.confidence;
      if (!matchResult.match) {
        finalVerdict = "flagged";
        console.warn(`Face match failed for ${staffId}. Confidence: ${matchConfidence}%`);
      }
    }

    // Update verification_requests record.
    const { error: verificationUpdateError } = await supabase
      .from("verification_requests")
      .update({
        liveness_score: trustScore,
        final_score: matchConfidence !== null ? matchConfidence : trustScore, // Store match confidence
        final_verdict: finalVerdict,
        challenges_passed: livenessData?.challengesPassed ?? 0,
        challenges_total: 3,
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", verificationId);

    if (verificationUpdateError) {
      throw verificationUpdateError;
    }

    const isVerified = finalVerdict === "verified";
    let vAccNum = null;
    let vBankName = null;

    if (isVerified) {
      // Create Worker Virtual Account via Squad
      const { createVirtualAccount } = await import("../services/squadService.js");
      const vAccResult = await createVirtualAccount(
        `${verificationRequest.staff.first_name} ${verificationRequest.staff.last_name}`,
        verificationRequest.staff.email,
        `WORKER-${staffId}`
      );
      if (vAccResult.success) {
        vAccNum = vAccResult.data.accountNumber;
        vBankName = vAccResult.data.bankName;
      } else {
        console.warn(`Worker Virtual Account creation failed for ${staffId}: ${vAccResult.error}`);
      }
    }

    // Update staff record — only after the verification_requests update succeeds.
    const { error: staffUpdateError } = await supabase
      .from("staff")
      .update({
        trust_score: matchConfidence !== null ? matchConfidence : trustScore,
        status: isVerified ? "verified" : "flagged",
        ...(isVerified && vAccNum ? { virtual_account_number: vAccNum, virtual_account_bank: vBankName } : {})
      })
      .eq("id", staffId);

    if (staffUpdateError) {
      throw staffUpdateError;
    }

    // Log to audit_logs
    await supabase.from("audit_logs").insert({
      action: "LIVENESS_VERIFICATION_SUBMITTED",
      description: `Liveness & Face Match submitted for staff ${staffId}. Verdict: ${finalVerdict} (Match Confidence: ${matchConfidence}%)`,
      entity_type: "verification_request",
      entity_id: verificationId,
    });

    return res.status(200).json({ success: true, verdict: finalVerdict });
  } catch (error) {
    next(error);
  }
}

export default {
  validateToken,
  submitVerification,
};
