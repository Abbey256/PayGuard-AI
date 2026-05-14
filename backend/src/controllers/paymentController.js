import { supabase } from "../services/supabaseClient.js";
import { verifyAccountName, initiateTransfer, simulateVirtualAccountCredit } from "../services/squadService.js";

import crypto from "crypto";

async function simulateFunding(req, res, next) {
  try {
    const userId = req.user?.id;
    const { amount, reason, organization_id } = req.body; 

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, squad_wallet_balance, ministry_virtual_account_number")
      .eq("id", organization_id || "") 
      .single();

    if (orgError || !org) {
      return res.status(404).json({ success: false, message: "Organization not found" });
    }

    const virtualAcc = org.ministry_virtual_account_number;
    if (!virtualAcc) {
      return res.status(400).json({ success: false, message: "No virtual account found to fund. Ensure organization is activated." });
    }

    const squadSim = await simulateVirtualAccountCredit(virtualAcc, amount * 100);

    const newBalance = (org.squad_wallet_balance ?? 0) + (amount * 100);
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ squad_wallet_balance: newBalance })
      .eq("id", org.id);

    if (updateError) throw updateError;

    const formattedAmount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
    const actorEmail = req.user?.email || "HR Admin";

    await supabase.from("audit_logs").insert({
      user_id: userId,
      actor: actorEmail,
      action: "WALLET_FUNDED",
      entity_type: "organization",
      entity_id: org.id,
      changes: { 
        amount: amount, 
        reason: reason,
        type: "Inflow",
        status: "Simulated",
        note: "Simulated sandbox funding — production uses Squad webhook" 
      },
      severity: "info",
      target_staff: `Simulated transfer of ${formattedAmount} for ${reason}`
    });

    return res.json({ 
      success: true, 
      newBalance, 
      squadSimulated: squadSim.success,
      message: `₦${amount.toLocaleString()} added to wallet successfully`
    });
  } catch (error) {
    next(error);
  }
}

async function processPayment(req, res, next) {
  try {
    const { batchId } = req.body;
    const userId = req.user?.id;

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
    const walletBalanceKobo = batch.organizations.squad_wallet_balance || 0;
    const totalAmountKobo = batch.total_amount * 100;

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

    let payguardFeeNaira = 0;

    for (const staff of verifiedStaff) {
      const { bank_code, bank_account, salary, id: staffId, first_name, last_name } = staff;
      const staffName = `${first_name} ${last_name}`;

      const lookupResult = await verifyAccountName(bank_code, bank_account);
      
      let passedNameCheck = false;
      let accountName = "Unknown";
      
      if (lookupResult.success && lookupResult.data) {
        accountName = lookupResult.data.account_name;
        const returnedNameLower = accountName.toLowerCase();
        if (returnedNameLower.includes(first_name.toLowerCase()) || returnedNameLower.includes(last_name.toLowerCase())) {
          passedNameCheck = true;
        }
      }

      if (!passedNameCheck) {
        blockedCount++;
        await supabase.from("payment_records").insert({
          batch_id: batchId,
          staff_id: staffId,
          amount: salary,
          status: "failed",
          error_message: "Account name mismatch"
        });

        await supabase.from("audit_logs").insert({
          user_id: userId,
          action: "PAYMENT_BLOCKED",
          entity_type: "staff",
          entity_id: staffId,
          changes: { reason: "account name mismatch", squad_name: accountName }
        });
        continue;
      }

      const timestamp = Date.now();
      const uniqueRef = `PG-${orgId.slice(0,8)}-${staffId.slice(0,8)}-${timestamp}`;
      const salaryKobo = salary * 100;
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

      const transferResult = await initiateTransfer({
        transactionRef: uniqueRef,
        amount: salaryKobo,
        bankCode: bank_code,
        accountNumber: bank_account,
        accountName: accountName,
        remark: `PayGuard AI - ${staffName} - ${currentMonth}`
      });

      if (transferResult.success) {
        paidCount++;
        totalDisbursedNaira += salary;
        payguardFeeNaira += (salary * 0.001);
        currentWalletBalanceKobo -= salaryKobo;

        await supabase.from("payment_records").insert({
          batch_id: batchId,
          staff_id: staffId,
          amount: salary,
          status: "completed",
          transaction_ref: uniqueRef,
          squad_transaction_id: transferResult.data?.transaction_id || "simulated"
        });

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

    await supabase
      .from("organizations")
      .update({ squad_wallet_balance: currentWalletBalanceKobo })
      .eq("id", orgId);

    await supabase
      .from("payment_batches")
      .update({ status: "processed" })
      .eq("id", batchId);

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

async function createPaymentBatch(req, res, next) {
  try {
    res.json({ success: true, message: "Create payment batch endpoint ready for implementation" });
  } catch (error) {
    next(error);
  }
}

async function approveBatch(req, res, next) {
  try {
    res.json({ success: true, message: "Approve batch endpoint ready for implementation" });
  } catch (error) {
    next(error);
  }
}

async function getPaymentStatus(req, res, next) {
  try {
    res.json({ success: true, message: "Get payment status endpoint ready for implementation" });
  } catch (error) {
    next(error);
  }
}

async function logBalanceView(req, res) {
  try {
    const userId = req.user.id;
    const actorEmail = req.user?.email || "HR Admin";

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("admin_id", userId)
      .single();

    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });

    await supabase.from("audit_logs").insert({
      user_id: userId,
      actor: actorEmail,
      action: "WALLET_BALANCE_VIEWED",
      entity_type: "organization",
      entity_id: org.id,
      changes: { note: "Wallet balance revealed by admin after password verification" },
      severity: "info",
      target_staff: "Admin viewed sensitive wallet balance"
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error logging balance view:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getWalletTransactions(req, res) {
  try {
    const userId = req.user.id;
    
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("admin_id", userId)
      .single();

    if (!org) return res.status(404).json({ success: false, message: "Organization not found" });

    const { data: transactions, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("entity_id", org.id)
      .in("action", ["WALLET_FUNDED", "PAYMENT_PROCESSED"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return res.json({ success: true, transactions });
  } catch (error) {
    console.error("Error fetching wallet transactions:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export {
  simulateFunding,
  processPayment,
  createPaymentBatch,
  approveBatch,
  getPaymentStatus,
  getWalletTransactions,
  logBalanceView,
};
