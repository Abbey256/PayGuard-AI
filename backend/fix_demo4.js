import { supabase } from './src/services/supabaseClient.js';
import { createSubAccount } from './src/services/squadService.js';

async function fix() {
  const adminId = '3e1ae10d-c5f1-406e-a995-173d0b0cbb0e';
  const orgName = 'Federal Ministry of Works'; // or something
  
  console.log("Creating Squad SubAccount...");
  const squadResult = await createSubAccount(orgName, "057", "0000000000");
  let squadId = null;
  if (squadResult.success) {
    squadId = squadResult.data.subAccountId;
    console.log("Squad SubAccount created:", squadId);
  } else {
    console.error("Failed to create squad subaccount:", squadResult.error);
  }

  const { data, error } = await supabase.from('organizations').insert([{
    name: orgName,
    admin_id: adminId,
    email: 'demo4@ministry.gov.ng',
    status: 'approved',
    phone: '09130601642',
    state: 'FCT',
    department: 'HR',
    squad_sub_account_id: squadId,
    squad_wallet_balance: 0
  }]);

  if (error) {
    console.error("Error inserting org:", error);
  } else {
    console.log("Org inserted successfully!");
  }
}

fix();
