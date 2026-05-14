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
      .select("id, name, organization_id")
      .eq("id", staffId)
      .single();

    if (staffError || !staff) {
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }

    // Generate a secure token and set expiry to 3 days from now
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // Insert into verification_requests (create a new record for each request)
    const { error: insertError } = await supabase
      .from("verification_requests")
      .insert({
        staff_id: staff.id,
        token,
        token_expires_at: expiresAt,
        status: "pending",
      });

    if (insertError) throw insertError;

    // Send the email
    const emailResult = await emailService.sendVerificationEmail({
      full_name: staff.name,
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
    next(error);
  }
});

export default router;
