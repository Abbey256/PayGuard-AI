/**
 * Verification Routes
 * Mounted at /api/verification in server.js
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { supabase } from "../services/supabaseClient.js";
import emailService from "../utils/emailService.js";
import crypto from "crypto";

const router = Router();

/**
 * POST /api/verification/send
 *
 * Generates a unique verification token for a staff member,
 * creates a verification_request record, and sends the email.
 *
 * Body: { staffId: string, email: string }
 */
router.post("/send", authMiddleware, async (req, res, next) => {
  try {
    const { staffId, email } = req.body;

    if (!staffId || !email) {
      return res.status(400).json({ success: false, message: "staffId and email are required" });
    }

    // Fetch the staff record to confirm it exists and get their name
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, name, first_name, last_name, organization_id")
      .eq("id", staffId)
      .single();

    if (staffError || !staff) {
      console.error("Staff fetch error:", staffError);
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }

    // Generate a secure token and set expiry to 3 days from now
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // DEDUP: expire any existing non-completed requests for this staff
    await supabase
      .from("verification_requests")
      .update({ status: "expired", token_expires_at: new Date().toISOString() })
      .eq("staff_id", staffId)
      .in("status", ["pending", "sent"]);
    // Non-fatal — don't check error here

    // Insert a fresh verification_request
    const { data: inserted, error: insertError } = await supabase
      .from("verification_requests")
      .insert({
        staff_id: staff.id,
        token,
        token_expires_at: expiresAt,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ verification_requests insert failed:", JSON.stringify(insertError, null, 2));
      return res.status(500).json({
        success: false,
        message: `Database error: ${insertError.message} [${insertError.code}]`,
        detail: insertError.details ?? insertError.hint ?? null,
      });
    }

    console.log("✅ Verification request created:", inserted?.id);

    // Send the email — use name or fall back to first+last
    const displayName = staff.name || `${staff.first_name ?? ""} ${staff.last_name ?? ""}`.trim() || "Staff Member";
    const emailResult = await emailService.sendVerificationEmail({
      full_name: displayName,
      email: email,
      verification_token: token,
    });

    if (!emailResult.success) {
      console.error("Email failed:", emailResult.error);
      return res.status(502).json({
        success: false,
        message: `Token created but email failed: ${emailResult.error}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Verification email sent to ${email}`,
    });
  } catch (error) {
    console.error("❌ /api/verification/send unexpected error:", error);
    next(error);
  }
});

export default router;
