import axios from "axios";

const SQUAD_BASE_URL = "https://sandbox-api-d.squadco.com";
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY;

if (!SQUAD_SECRET_KEY) {
  console.warn("SQUAD_SECRET_KEY not set. Squad API calls will fail.");
}

const squadClient = axios.create({
  baseURL: SQUAD_BASE_URL,
  headers: {
    Authorization: `Bearer ${SQUAD_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/**
 * Create a virtual account for a user
 * @param {string} customerName - Customer full name
 * @param {string} email - Customer email
 * @param {string} uniqueRef - Unique reference for idempotency
 * @returns {Promise<Object>} Virtual account details
 */
export async function createVirtualAccount(customerName, email, uniqueRef) {
  try {
    const response = await squadClient.post("/virtual-account", {
      customer_name: customerName,
      email: email,
      request_ref: uniqueRef,
    });

    return {
      success: true,
      data: {
        accountNumber: response.data.data?.account_number,
        bankName: response.data.data?.bank_name,
        bankCode: response.data.data?.bank_code,
        customerId: response.data.data?.customer_id,
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
export async function initiateTransfer(
  amount,
  bankCode,
  accountNumber,
  accountName,
  transactionRef
) {
  try {
    const response = await squadClient.post("/payout/transfer", {
      amount: Math.round(amount * 100), // Convert to kobo
      bank_code: bankCode,
      account_number: accountNumber,
      account_name: accountName,
      transaction_ref: transactionRef,
    });

    return {
      success: true,
      data: {
        transactionId: response.data.data?.transaction_id,
        status: response.data.data?.status,
        amount: response.data.data?.amount / 100, // Convert back to NGN
      },
    };
  } catch (error) {
    console.error("Error initiating transfer:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

export default {
  createVirtualAccount,
  verifyAccountName,
  initiateTransfer,
};
