import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE keys in backend/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDemo() {
  console.log("Fixing demo3 account...");

  // 1. Get the demo3 user
  const { data: usersData, error: userQueryError } = await supabase.auth.admin.listUsers();
  const demoUser = usersData?.users.find(u => u.email === "demo3@ministry.gov.ng");

  if (!demoUser) {
    console.log("Could not find demo3@ministry.gov.ng in auth users.");
    return;
  }

  const authUserId = demoUser.id;

  // 2. Insert into public.users
  await supabase.from("users").upsert([{
    id: authUserId,
    email: "demo3@ministry.gov.ng",
    phone: "09130601654",
  }]);

  // 3. Insert into organizations
  const { data: orgData, error: orgError } = await supabase.from("organizations").upsert([{
    name: "Ministry of Demo",
    status: "approved",
    admin_id: authUserId,
    phone: "09130601654",
    state: "FCT",
    department: "Payroll"
  }]).select("id").single();

  if (orgError) {
    console.error("Org Error:", orgError);
    return;
  }

  console.log("Organization created! ID:", orgData.id);

  // 4. Trigger Squad Wallet
  console.log("Setting up Squad Wallet...");
  const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/organizations/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orgId: orgData.id,
      orgName: "Ministry of Demo",
      adminId: authUserId,
    }),
  });

  const text = await response.text();
  console.log("Squad Response:", text);
  console.log("DONE! Refresh your browser now.");
}

fixDemo();
