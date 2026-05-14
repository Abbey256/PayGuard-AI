import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  try {
    const res = await axios.get(`${process.env.SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_KEY}`);
    const orgDef = res.data.definitions.organizations;
    console.log(Object.keys(orgDef.properties));
  } catch (err) {
    console.error(err.message);
  }
}
check();
