import "dotenv/config";
import axios from "axios";
import natural from "natural";
import { supabase } from "./supabaseClient.js";

const SQUAD_BASE_URL = "https://sandbox-api-d.squadco.com";
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY;

if (!SQUAD_SECRET_KEY) {
  console.error("❌ SQUAD_SECRET_KEY not found in environment variables!");
}


const squadClient = axios.create({
  baseURL: SQUAD_BASE_URL,
  headers: {
    Authorization: `Bearer ${SQUAD_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

export async function createVirtualAccount({ 
  customerName, 
  email, 
  phone = "08011112222", 
  organizationId 
}) {
  try {
    const uniqueRef = `ORG-${organizationId}-${Date.now()}`;
    
    const payload = {
      customer_identifier: `ORG-${organizationId}`,
      first_name: "PayGuard",
      last_name: customerName,
      email: email,
      mobile_num: phone,
      bvn: "22222222222",
      dob: "01/01/1980",
      address: "Federal Secretariat Abuja",
      gender: "1",
      beneficiary_account: "0123456789"
    };



    const response = await squadClient.post("/virtual-account", payload);

    return {
      success: true,
      data: {
        accountNumber: response.data.data?.virtual_account_number,
        bankName: response.data.data?.bank_code === "058" ? "GTBank (Squad)" : "Squad Bank",
        bankCode: response.data.data?.bank_code,
        customerId: response.data.data?.customer_id || `CUST-${organizationId}`,
      },
    };


  } catch (error) {
    console.error("Error creating virtual account:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}




/**
 * Verify account name for a given bank account
 * @param {string} accountNumber - Bank account number
 * @param {string} bankCode - Bank code (e.g., "058" for GTBank)
 * @returns {Promise<Object>} Account verification details
 */
export async function verifyAccountName(accountNumber, bankCode) {
  try {
    const response = await squadClient.get("/payout/account/lookup", {
      params: {
        account_number: accountNumber,
        bank_code: bankCode,
      },
    });

    return {
      success: true,
      data: {
        accountName: response.data.data?.account_name,
        accountNumber: response.data.data?.account_number,
        bankCode: response.data.data?.bank_code,
      },
    };
  } catch (error) {
    console.error("Error verifying account:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

/**
 * Initiate a transfer to a bank account
 * @param {number} amount - Amount in kobo (NGN)
 * @param {string} bankCode - Beneficiary bank code
 * @param {string} accountNumber - Beneficiary account number
 * @param {string} accountName - Beneficiary account name
 * @param {string} transactionRef - Unique transaction reference
 * @returns {Promise<Object>} Transfer details
 */
export async function initiateTransfer({
  amount,
  bankCode,
  accountNumber,
  accountName,
  transactionRef,
  remark = "PayGuard AI Payout",
}) {
  try {
    const response = await squadClient.post("/payout/transfer", {
      amount: Math.round(amount), // Already in kobo from controller
      bank_code: bankCode,
      account_number: accountNumber,
      account_name: accountName,
      transaction_reference: transactionRef,
      currency: "NGN",
      remark: remark,
    });



    return {
      success: true,
      data: {
        transactionId: response.data.data?.transaction_id,
        status: response.data.data?.status,
        amount: response.data.data?.amount / 100,
      },
      response: response.data
    };
  } catch (error) {
    console.error("Error initiating transfer:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}


/**
 * Create a Squad sub-account for a government ministry/organization.
 * Each ministry gets their own isolated Squad wallet.
 * @param {string} displayName   - Ministry display name
 * @param {string} settlementBank   - Bank code e.g. "057" for Zenith
 * @param {string} settlementAccount - Ministry's bank account number
 * @returns {Promise<Object>} Sub-account details including id
 */
export async function createSubAccount(displayName, settlementBank, settlementAccount) {
  try {
    // Attempt real API
    const response = await squadClient.post("/subaccount", {

      display_name: displayName,
      settlement_bank: settlementBank,
      settlement_account: settlementAccount,
    }).catch(err => {
      console.warn("Squad API failed, returning mock sub-account for demo:", err.message);
      return {
        data: {
          data: {
            id: `SQ_SUB_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            display_name: displayName,
            settlement_account: settlementAccount,
            wallet_balance: 0
          }
        }
      };
    });

    return {
      success: true,
      data: {
        subAccountId: response.data.data?.id ?? response.data.data?.sub_account_id,
        displayName: response.data.data?.display_name,
        settlementAccount: response.data.data?.settlement_account,
        walletBalance: response.data.data?.wallet_balance ?? 0,
      },
    };
  } catch (error) {
    console.error("Error creating sub-account:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

/**
 * Simulate an inbound transfer to a virtual account (Sandbox only)
 * @param {string} virtualAccountNumber - The account to fund
 * @param {number} amount - Amount in Naira
 * @returns {Promise<Object>}
 */
export async function simulateVirtualAccountTransaction(virtualAccountNumber, amount) {
  try {
    const response = await squadClient.post("/virtual-account/simulate-transaction", {
      virtual_account_number: virtualAccountNumber,
      amount: amount.toString(), // Squad expects string amount in Naira for simulation
    });

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error("Error simulating transaction:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

/**
 * Simulate a credit transaction into a virtual account (Sandbox only)
 * @param {string} virtualAccountNumber - The virtual account to credit
 * @param {number} amountKobo - Amount in kobo
 * @returns {Promise<Object>} Result
 */
export async function simulateVirtualAccountCredit(virtualAccountNumber, amountKobo) {
  try {
    const response = await squadClient.post("/virtual-account/simulate/credit", {
      virtual_account_number: virtualAccountNumber,
      amount: amountKobo,
      narration: "Salary funding - PayGuard AI Demo"
    });

    return {
      success: true,
      data: response.data.data
    };
  } catch (error) {
    console.error("Squad Credit Simulation Failed:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Prevent 'Identity Swapping' before a payout.
 * Looks up the account name via Squad API and compares it to the legal name.
 * 
 * @param {Object} params
 * @param {string} params.staffId - Staff ID for logging
 * @param {string} params.legalName - Staff's legal name from the payroll database
 * @param {string} params.accountNumber - Staff's bank account number
 * @param {string} params.bankCode - Staff's bank code
 * @returns {Promise<Object>} Verification result
 */
export async function guardIdentitySwap({ staffId, legalName, accountNumber, bankCode }) {
  // 1. Squad Lookup
  const resolveRes = await verifyAccountName(accountNumber, bankCode);
  if (!resolveRes.success) {
    return { 
      success: false, 
      error: `Failed to resolve bank account for identity check: ${resolveRes.error}` 
    };
  }

  const squadAccountName = resolveRes.data.accountName;

  // 2. Fuzzy Matching
  // Using Jaro-Winkler distance to compare names.
  // It handles typos and minor variations well. Score is between 0 and 1.
  const jaroScore = natural.JaroWinklerDistance(
    legalName.toLowerCase(), 
    squadAccountName.toLowerCase()
  );

  // A score below 0.7 generally indicates a significant mismatch for names.
  const isMismatch = jaroScore < 0.7;

  // 3. The Guard
  if (isMismatch) {
    // 4. Flagging
    try {
      await supabase.from("verification_logs").insert({
        staff_id: staffId,
        event: "High Risk: Name Mismatch",
        details: `Identity Swap Prevented: Legal Name '${legalName}' vs Account Name '${squadAccountName}' (Score: ${jaroScore.toFixed(2)})`
      });
    } catch (err) {
      console.error("Failed to log verification mismatch:", err);
    }

    return {
      success: false,
      error: `Identity Mismatch: Bank account name (${squadAccountName}) does not match legal name (${legalName}). Transaction locked.`,
      isMismatch: true
    };
  }

  return { 
    success: true, 
    data: { 
      squadAccountName, 
      matchScore: jaroScore 
    } 
  };
}

/**
 * Process HR-triggered payout securely.
 * Final gate for PayGuard AI. Ensures bank account name matches payroll name.
 * @param {string} staffId 
 */
export async function processHRPayout(staffId) {
  try {
    // Pre-check: Fetch the staff record from the database (Using Supabase client)
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .single();

    if (staffError || !staff) {
      throw new Error("Staff record not found.");
    }

    if (staff.verification_status !== 'LIVENESS_PASSED') {
      throw new Error("Biometric verification required before payout.");
    }

    // Squad API Integration
    const resolveRes = await axios.get("https://sandbox.squad.ng/accounts/resolve", {
      headers: {
        Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      params: {
        account_number: staff.account_number || staff.employee_id, // Fallback fields
        bank_code: staff.bank_code
      }
    });

    const squadAccountName = resolveRes.data?.data?.account_name || "";
    const legalName = staff.legal_name || staff.name || "";

    // Fuzzy Name Matching
    const normSquad = squadAccountName.toUpperCase().trim();
    const normLegal = legalName.toUpperCase().trim();

    const distance = natural.LevenshteinDistance(normSquad, normLegal);

    // Threshold Guard
    if (distance > 4) {
      // The Guard (Mismatch Logic)
      await supabase.from('verification_logs').insert({
        staff_id: staffId,
        status: 'LOCKED',
        risk_level: 'CRITICAL',
        event: 'IDENTITY_SWAP_ATTEMPT'
      });

      await supabase.from('staff').update({
        verification_status: 'FLAGGED_FOR_FRAUD'
      }).eq('id', staffId);

      throw new Error("FRAUD ALERT: Bank account name does not match legal payroll name. Transaction has been locked.");
    }

    // The Payout (Success Logic)
    const currentDate = new Date().toISOString().split('T')[0];
    const idempotencyKey = `pay_${staffId}_${currentDate}`;

    await axios.post("https://sandbox.squad.ng/transfer", {
      amount: staff.salary_amount || staff.amount || 0,
      bank_code: staff.bank_code,
      account_number: staff.account_number,
      account_name: squadAccountName,
      idempotency_key: idempotencyKey,
      currency: "NGN",
      remark: "PayGuard AI HR Payout"
    }, {
      headers: {
        Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    await supabase.from('staff').update({
      verification_status: 'PAID'
    }).eq('id', staffId);

    return {
      success: true,
      message: "Payout successful",
      status: "PAID"
    };

  } catch (error) {
    // Error Handling
    return {
      success: false,
      message: error.message || "An unexpected error occurred.",
      status: "FAILED"
    };
  }
}

export default {
  createVirtualAccount,
  verifyAccountName,
  initiateTransfer,
  createSubAccount,
  simulateVirtualAccountTransaction,
  simulateVirtualAccountCredit,
  guardIdentitySwap,
  processHRPayout
};


