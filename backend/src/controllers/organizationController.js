/**
 * Organization Controller
 * Handles post-signup setup: creates Squad sub-account + saves to DB.
 * Called immediately after successful Supabase auth signup — no approval gate.
 */

import { supabase } from "../services/supabaseClient.js";
import { createSubAccount, createVirtualAccount } from "../services/squadService.js";

/**
 * POST /api/organizations/setup
 * Body: { orgId, orgName, adminId, email, phone, settlementBank?, settlementAccount? }
 */
export async function setupOrganization(req, res, next) {
  try {
    // adminId comes from the verified JWT — not from request body
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { orgId, orgName, email = "org@example.com", phone = "08000000000", settlementBank = "057", settlementAccount = "0000000000" } = req.body;

    if (!orgId || !orgName) {
      return res.status(400).json({ success: false, message: "orgId and orgName are required" });
    }

    // 1. Create Squad sub-account
    const squadResult = await createSubAccount(orgName, settlementBank, settlementAccount);
    const squadSubAccountId = squadResult.success ? squadResult.data.subAccountId : null;

    // 2. Create Ministry Virtual Account
    const virtualAccResult = await createVirtualAccount({
      customerName: orgName,
      email: email,
      phone: phone,
      organizationId: orgId
    });



    const virtualAccountNum = virtualAccResult.success ? virtualAccResult.data.accountNumber : null;
    const virtualBankName = virtualAccResult.success ? virtualAccResult.data.bankName : null;

    if (!virtualAccResult.success) {
      console.warn(`Ministry Virtual Account creation failed for ${orgName}: ${virtualAccResult.error}`);
    }

    // Update the organizations row: approve + save squad info + virtual account
    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        status: "approved",
        squad_sub_account_id: squadSubAccountId,
        squad_wallet_balance: 0,
        ministry_virtual_account_number: virtualAccountNum,
        ministry_virtual_account_bank: virtualBankName,
        // updated_at will be handled by DB default/trigger if present
      })
      .eq("id", orgId)
      .eq("admin_id", adminId); // safety: only owner can update their org

    if (updateError) {
      console.error("❌ Organization update failed:", updateError.message);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to activate organization",
        error: updateError.message 
      });
    }


    return res.json({
      success: true,
      subAccountId: squadSubAccountId,
      virtualAccountNumber: virtualAccountNum,
      virtualBankName: virtualBankName,
      squadReady: squadResult.success && virtualAccResult.success,
      message: "Organization activated with Squad wallet and Virtual Account",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/organizations/me
 * Returns the current user's organization details including Squad info.
 */
export async function getMyOrganization(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, status, squad_sub_account_id, squad_wallet_balance, created_at, admin_id")
      .eq("admin_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Organization not found" });

    return res.json({ success: true, organization: data });
  } catch (error) {
    next(error);
  }
}

export default { setupOrganization, getMyOrganization };
