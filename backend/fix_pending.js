import dotenv from 'dotenv';
dotenv.config();

import { supabase } from './src/services/supabaseClient.js';
import { createSubAccount } from './src/services/squadService.js';

async function fix() {
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, admin_id, status, squad_sub_account_id');
  
  if (error) {
    console.error("Error fetching orgs:", error);
    return;
  }
  console.log("Orgs found:", orgs.length);
  console.log(JSON.stringify(orgs, null, 2));

  for (const org of orgs) {
    if (org.status !== 'approved' || !org.squad_sub_account_id) {
      console.log(`Fixing org: ${org.name} (${org.id})`);
      
      let squadId = org.squad_sub_account_id;
      
      if (!squadId) {
         console.log("Creating Squad SubAccount...");
         const squadResult = await createSubAccount(org.name, "057", "0000000000");
         if (squadResult.success) {
           squadId = squadResult.data.subAccountId;
           console.log("Squad SubAccount created:", squadId);
         } else {
           console.error("Failed to create squad subaccount:", squadResult.error);
         }
      }

      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          status: 'approved',
          squad_sub_account_id: squadId,
          squad_wallet_balance: 0
        })
        .eq('id', org.id);

      if (updateError) {
        console.error("Error updating org:", updateError);
      } else {
        console.log("Org updated successfully!");
      }
    }
  }
  console.log("Done.");
}

fix();
