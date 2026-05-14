import { supabase } from './src/services/supabaseClient.js';

async function check() {
  const { data, error } = await supabase.from('organizations').select('*').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}

check();

check();
