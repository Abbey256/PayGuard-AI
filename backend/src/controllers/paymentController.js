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
      const uniqueRef = `PG-${orgId}-${staffId}-${timestamp}`;
      const salaryKobo = salary * 100;
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

      const transferResult = await initiateTransfer({
        transactionRef: uniqueRef,
        amount: salaryKobo,
        bankCode: bank_code,
        accountNumber: bank_account,
        accountName: `${first_name} ${last_name}`,
        remark: `PayGuard AI - ${first_name} ${last_name} - ${currentMonth} Salary`
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
          amount_kobo: salaryKobo,
          squad_transaction_reference: uniqueRef,
          squad_response: transferResult.response || transferResult.data || {},
          status: 'success',
          paid_at: new Date().toISOString()
        });

        // (Staff payment_status column does not exist, tracking is handled via payment_records)

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
      .update({ 
        status: "processed",
        processed_at: new Date().toISOString(),
        total_paid: paidCount,
        total_amount_disbursed: totalDisbursedNaira
      })
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

/**
 * POST /api/payments/batches
 *
 * Creates a new payment batch for the authenticated admin's organisation.
 * Collects all staff with status = 'verified', computes totals, and inserts
 * both the batch record and the payment_batch_staff join rows.
 *
 * Body: { batchName?: string }
 *
 * Response:
 *   201  { success: true, batch }   — batch created
 *   400  { message }                — no verified staff found
 *   404  { message }                — organisation not found
 */
async function createPaymentBatch(req, res, next) {
  try {
    const userId = req.user?.id;
    const { batchName } = req.body;

    // 1. Resolve organisation for this admin
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('admin_id', userId)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ success: false, message: 'Organisation not found for this account.' });
    }

    // 2. Fetch all verified staff in this organisation
    const { data: verifiedStaff, error: staffError } = await supabase
      .from('staff')
      .select('id, salary')
      .eq('organization_id', org.id)
      .eq('status', 'verified');

    if (staffError) throw staffError;

    if (!verifiedStaff || verifiedStaff.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No verified staff found. Staff must complete biometric verification before a batch can be created.',
      });
    }

    const totalAmount = verifiedStaff.reduce((sum, s) => sum + (s.salary || 0), 0);
    const monthLabel  = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const name        = batchName || `${monthLabel} Payroll`;

    // 3. Create the batch record
    const { data: batch, error: batchError } = await supabase
      .from('payment_batches')
      .insert({
        organization_id: org.id,
        batch_name:      name,
        staff_count:     verifiedStaff.length,
        total_amount:    totalAmount,
        status:          'pending',
        created_by:      userId,
      })
      .select()
      .single();

    if (batchError) throw batchError;

    // 4. Insert join rows (payment_batch_staff)
    const joinRows = verifiedStaff.map(s => ({ batch_id: batch.id, staff_id: s.id }));
    const { error: joinError } = await supabase
      .from('payment_batch_staff')
      .insert(joinRows);

    if (joinError) throw joinError;

    // 5. Audit log
    await supabase.from('audit_logs').insert({
      user_id:     userId,
      action:      'PAYMENT_BATCH_CREATED',
      entity_type: 'payment_batches',
      entity_id:   batch.id,
      changes:     { staff_count: verifiedStaff.length, total_amount: totalAmount },
    });

    return res.status(201).json({ success: true, batch });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/payments/batches/:id/approve
 *
 * Marks a pending payment batch as approved so it can be processed.
 * Only the organisation's admin can approve their own batch.
 *
 * Response:
 *   200  { success: true, batch }   — approved
 *   400  { message }                — batch not in pending state
 *   403  { message }                — batch belongs to a different organisation
 *   404  { message }                — batch not found
 */
async function approveBatch(req, res, next) {
  try {
    const userId  = req.user?.id;
    const batchId = req.params.id;

    // 1. Fetch the batch to validate ownership and state
    const { data: batch, error: fetchError } = await supabase
      .from('payment_batches')
      .select('id, status, organization_id, total_amount, staff_count')
      .eq('id', batchId)
      .single();

    if (fetchError || !batch) {
      return res.status(404).json({ success: false, message: 'Payment batch not found.' });
    }

    // 2. Confirm the requesting admin owns this organisation
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', batch.organization_id)
      .eq('admin_id', userId)
      .single();

    if (orgError || !org) {
      return res.status(403).json({ success: false, message: 'You are not authorised to approve this batch.' });
    }

    // 3. Only pending batches can be approved
    if (batch.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Batch is already "${batch.status}" — only pending batches can be approved.`,
      });
    }

    // 4. Update status to approved
    const { data: updated, error: updateError } = await supabase
      .from('payment_batches')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: userId })
      .eq('id', batchId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 5. Audit log
    await supabase.from('audit_logs').insert({
      user_id:     userId,
      action:      'PAYMENT_BATCH_APPROVED',
      entity_type: 'payment_batches',
      entity_id:   batchId,
      changes:     {
        total_amount: batch.total_amount,
        staff_count:  batch.staff_count,
      },
    });

    return res.json({ success: true, batch: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/payments/status/:id
 *
 * Returns the current status, summary, and per-staff payment records
 * for a given batch. Used by the frontend to show real-time payment state.
 *
 * Response:
 *   200  { success: true, batch, records }
 *   403  { message }  — batch belongs to a different organisation
 *   404  { message }  — batch not found
 */
async function getPaymentStatus(req, res, next) {
  try {
    const userId  = req.user?.id;
    const batchId = req.params.id;

    // 1. Fetch batch with join
    const { data: batch, error: batchError } = await supabase
      .from('payment_batches')
      .select(`
        id, batch_name, status, staff_count, total_amount,
        total_paid, total_amount_disbursed,
        created_at, processed_at,
        organization_id
      `)
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return res.status(404).json({ success: false, message: 'Batch not found.' });
    }

    // 2. Ownership check
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', batch.organization_id)
      .eq('admin_id', userId)
      .single();

    if (!org) {
      return res.status(403).json({ success: false, message: 'Not authorised to view this batch.' });
    }

    // 3. Fetch per-staff payment records
    const { data: records, error: recordsError } = await supabase
      .from('payment_records')
      .select(`
        id, amount, status, error_message, paid_at,
        staff ( id, first_name, last_name, employee_id, bank_account, bank_code )
      `)
      .eq('batch_id', batchId)
      .order('paid_at', { ascending: false });

    if (recordsError) throw recordsError;

    return res.json({
      success: true,
      batch,
      records: records ?? [],
      summary: {
        total:   batch.staff_count,
        paid:    (records ?? []).filter(r => r.status === 'success').length,
        failed:  (records ?? []).filter(r => r.status === 'failed').length,
        pending: batch.staff_count - (records ?? []).length,
      },
    });
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
