/**
 * Verify Controller
 * Handles public liveness verification endpoints (no auth required).
 *
 * GET  /api/verify/:token  → validateToken
 * POST /api/verify/submit  → submitVerification
 */

import { supabase } from "../services/supabaseClient.js";

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
          photo_url,
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
    const photoUrl = data.staff.photo_url;

    return res.status(200).json({ workerName, organizationName, photoUrl });
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

    const { id: verificationId, staff_id: staffId } = verificationRequest;
    
    // Update verification_requests record.
    const { error: verificationUpdateError } = await supabase
      .from("verification_requests")
      .update({
        liveness_score: trustScore,
        final_score: trustScore, 
        final_verdict: verdict,
        challenges_passed: livenessData?.challengesPassed ?? 0,
        challenges_total: 3,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", verificationId);

    if (verificationUpdateError) {
      throw verificationUpdateError;
    }

    const isVerified = verdict === "verified";

    // Update staff record — only after the verification_requests update succeeds.
    const { error: staffUpdateError } = await supabase
      .from("staff")
      .update({
        trust_score: trustScore,
        status: isVerified ? "verified" : "flagged",
      })
      .eq("id", staffId);

    if (staffUpdateError) {
      throw staffUpdateError;
    }

    // --- AUTOMATIC PAYMENT BATCH CREATION / ADDITION ---
    if (isVerified) {
      const orgId = verificationRequest.staff.organization_id;
      const salary = verificationRequest.staff.salary || 0;
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      const batchName = `Salary Batch - ${currentMonth}`;

      // 1. Check if a pending batch already exists for this organization
      let { data: batch, error: batchError } = await supabase
        .from("payment_batches")
        .select("id, staff_count, total_amount")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (batchError && batchError.code !== 'PGRST116') {
        console.error("Error fetching payment batch:", batchError);
      }

      // 2. Create one if it doesn't exist
      if (!batch) {
        const { data: newBatch, error: createError } = await supabase
          .from("payment_batches")
          .insert({
            organization_id: orgId,
            batch_name: batchName,
            staff_count: 0,
            total_amount: 0,
            status: "pending",
            verification_rate: 100 // Default, will recalculate if needed
          })
          .select()
          .single();
          
        if (createError) console.error("Failed to create batch:", createError);
        batch = newBatch;
      }

      // 3. Add staff to the batch if not already added
      if (batch) {
        const { data: existingStaff } = await supabase
          .from("payment_batch_staff")
          .select("staff_id")
          .eq("batch_id", batch.id)
          .eq("staff_id", staffId)
          .single();

        if (!existingStaff) {
          // Insert into payment_batch_staff
          await supabase.from("payment_batch_staff").insert({
            batch_id: batch.id,
            staff_id: staffId
          });

          // Update batch totals
          await supabase
            .from("payment_batches")
            .update({
              staff_count: batch.staff_count + 1,
              total_amount: batch.total_amount + salary
            })
            .eq("id", batch.id);
        }
      }
    }

    // Log to audit_logs
    await supabase.from("audit_logs").insert({
      action: "LIVENESS_VERIFICATION_SUBMITTED",
      description: `Liveness & Face Match submitted for staff ${staffId}. Verdict: ${verdict} (Final Score: ${trustScore})`,
      entity_type: "verification_request",
      entity_id: verificationId,
    });

    return res.status(200).json({ success: true, verdict });
  } catch (error) {
    next(error);
  }
}

export default {
  validateToken,
  submitVerification,
};
