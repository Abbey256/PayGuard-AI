import { supabase } from "../services/supabaseClient.js";
import { verifyAccountName, initiateTransfer } from "../services/squadService.js";
import crypto from "crypto";

export async function simulateFunding(req, res, next) {
  try {
    const userId = req.user?.id;
    // User requested amount in NGN (e.g. 50000000 for 50M)
    const { amount } = req.body; 

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, squad_wallet_balance")
      .eq("admin_id", userId)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ success: false, message: "Organization not found" });
    }

    // Convert NGN to kobo for database
    const amountInKobo = amount * 100;
    const newBalance = (org.squad_wallet_balance || 0) + amountInKobo;

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ squad_wallet_balance: newBalance })
      .eq("id", org.id);

    if (updateError) throw updateError;

    return res.json({ success: true, newBalance });
  } catch (error) {
    next(error);
  }
}

export async function processPayment(req, res, next) {
  try {
    const { batchId } = req.body;
    const userId = req.user?.id;

    // 1. Fetch batch and organization
    const { data: batch, error: batchError } = await supabase
      .from("payment_batches")
      .select(`
        id, total_amount, staff_count, status, organization_id,
        organizations ( id, squad_wallet_balance ),
        payment_batch_staff (
          staff ( id, first_name, last_name, salary, bank_code, bank_account, status )
        )
      `)
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return res.status(404).json({ success: false, message: "Payment batch not found" });
    }

    if (batch.status === "processed" || batch.status === "completed") {
      return res.status(400).json({ success: false, message: "Batch already processed" });
    }

    const orgId = batch.organization_id;
    // Wallet is in kobo, batch.total_amount is in Naira
    const walletBalanceKobo = batch.organizations.squad_wallet_balance || 0;
    const totalAmountKobo = batch.total_amount * 100;

    // a) Check squad_wallet_balance has enough funds
    if (walletBalanceKobo < totalAmountKobo) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    const verifiedStaff = batch.payment_batch_staff
      .map(s => s.staff)
      .filter(s => s.status === "verified");

    let paidCount = 0;
    let blockedCount = 0;
    let totalDisbursedNaira = 0;
    let currentWalletBalanceKobo = walletBalanceKobo;

    // We simulate the payguard fee as a flat percentage or fixed amount, for the demo let's say 1% or fixed
    let payguardFeeNaira = 0;

    // b) Loop through every verified staff
    for (const staff of verifiedStaff) {
      const { bank_code, bank_account, salary, id: staffId, first_name, last_name } = staff;
      const staffName = `${first_name} ${last_name}`;

      // Call Squad account name verification
      const lookupResult = await verifyAccountName(bank_code, bank_account);
      
      let passedNameCheck = false;
      let accountName = "Unknown";
      
      if (lookupResult.success && lookupResult.data) {
        accountName = lookupResult.data.account_name;
        // Simple heuristic: just check if one of the names is in the returned account name
        // (In real life, a more sophisticated string distance algorithm is used)
        const returnedNameLower = accountName.toLowerCase();
        if (returnedNameLower.includes(first_name.toLowerCase()) || returnedNameLower.includes(last_name.toLowerCase())) {
          passedNameCheck = true;
        }
      }

      if (!passedNameCheck) {
        // Block payment
        blockedCount++;
        
        await supabase.from("payment_records").insert({
          batch_id: batchId,
          staff_id: staffId,
          amount: salary,
          status: "failed",
          error_message: "Account name mismatch"
        });

        // Log to audit logs
        await supabase.from("audit_logs").insert({
          user_id: userId,
          action: "PAYMENT_BLOCKED",
          entity_type: "staff",
          entity_id: staffId,
          changes: { reason: "account name mismatch", squad_name: accountName }
        });
        continue;
      }

      // c) For each staff that passed, call POST /payout/transfer
      const uniqueRef = `PG-${staffId.slice(0,8)}-${new Date().getMonth()+1}-${crypto.randomUUID().slice(0,8)}`;
      // Salary is in Naira, transfer expects Kobo
      const salaryKobo = salary * 100;

      const transferResult = await initiateTransfer(
        uniqueRef,
        salaryKobo,
        bank_code,
        bank_account,
        accountName,
        "NGN",
        "May 2026 Salary via PayGuard AI"
      );

      if (transferResult.success) {
        paidCount++;
        totalDisbursedNaira += salary;
        payguardFeeNaira += (salary * 0.001); // e.g. 0.1% fee for demo calculation
        
        // d) On successful transfer:
        // Deduct amount
        currentWalletBalanceKobo -= salaryKobo;

        // Save to payment records
        await supabase.from("payment_records").insert({
          batch_id: batchId,
          staff_id: staffId,
          amount: salary,
          status: "completed",
          transaction_ref: uniqueRef,
          squad_transaction_id: transferResult.data?.transaction_id || "simulated"
        });

        // Log to audit logs
        await supabase.from("audit_logs").insert({
          user_id: userId,
          action: "PAYMENT_PROCESSED",
          entity_type: "staff",
          entity_id: staffId,
          changes: { amount: salary, ref: uniqueRef }
        });
      } else {
        blockedCount++;
        await supabase.from("payment_records").insert({
          batch_id: batchId,
          staff_id: staffId,
          amount: salary,
          status: "failed",
          error_message: transferResult.error
        });
      }
    }

    // Update the organization wallet balance
    await supabase
      .from("organizations")
      .update({ squad_wallet_balance: currentWalletBalanceKobo })
      .eq("id", orgId);

    // Update batch status
    await supabase
      .from("payment_batches")
      .update({ status: "processed" })
      .eq("id", batchId);

    // e) Return summary
    const remainingBalanceNaira = currentWalletBalanceKobo / 100;

    return res.json({
      success: true,
      summary: {
        total_staff: batch.staff_count,
        paid: paidCount,
        blocked: blockedCount,
        total_disbursed: totalDisbursedNaira,
        remaining_balance: remainingBalanceNaira,
        payguard_fee: Math.round(payguardFeeNaira)
      }
    });

  } catch (error) {
    next(error);
  }
}

export async function createPaymentBatch(req, res, next) {
  try {
    res.json({ success: true, message: "Create payment batch endpoint ready for implementation" });
  } catch (error) {
    next(error);
  }
}

export async function approveBatch(req, res, next) {
  try {
    res.json({ success: true, message: "Approve batch endpoint ready for implementation" });
  } catch (error) {
    next(error);
  }
}

export async function getPaymentStatus(req, res, next) {
  try {
    res.json({ success: true, message: "Get payment status endpoint ready for implementation" });
  } catch (error) {
    next(error);
  }
}

export default {
  simulateFunding,
  processPayment,
  createPaymentBatch,
  approveBatch,
  getPaymentStatus,
};
