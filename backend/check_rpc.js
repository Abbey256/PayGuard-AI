import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function checkRPC() {
  try {
    const res = await axios.get(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    });
    console.log("RPC endpoints:", Object.keys(res.data.paths).filter(p => p.startsWith('/rpc/')));
  } catch (err) {
    console.error(err.message);
  }
}
checkRPC();
