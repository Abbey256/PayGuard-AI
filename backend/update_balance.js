import { supabase } from './src/services/supabaseClient.js';

async function updateBalance() {
  const adminId = '3e1ae10d-c5f1-406e-a995-173d0b0cbb0e';
  
  const { data, error } = await supabase
    .from('organizations')
    .update({ squad_wallet_balance: 5000000000 })
    .eq('admin_id', adminId);

  if (error) {
    console.error("Error updating balance:", error);
  } else {
    console.log("Balance updated successfully to 50,000,000 NGN!");
  }
}

updateBalance();
