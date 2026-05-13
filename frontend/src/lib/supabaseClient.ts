import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. Supabase client may not work as expected."
  );
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY ?? ""
);

export async function createNotification(userId: string, message: string, type: "info" | "warning" | "success" = "info") {
  try {
    await supabase.from("notifications").insert([{ user_id: userId, message, type, is_read: false }]);
  } catch (err) {
    console.error("Error creating notification:", err);
  }
}

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, created_at, message, type, is_read")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
  return data || [];
}
