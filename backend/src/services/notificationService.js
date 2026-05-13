import { supabase } from "./supabaseClient.js";

/**
 * Create notification in database
 * @param {string} userId - User ID (from Supabase auth)
 * @param {string} message - Notification message
 * @param {string} type - Type: 'info', 'success', 'warning', 'error'
 * @param {Object} metadata - Optional metadata to store with notification
 */
export async function createNotification(userId, message, type = "info", metadata = {}) {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      message,
      type,
      metadata,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    console.log(`Notification created for user ${userId}: ${message}`);
  } catch (error) {
    console.error("Error creating notification:", error.message);
    throw error;
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 */
export async function markAsRead(notificationId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) throw error;
  } catch (error) {
    console.error("Error marking notification as read:", error.message);
    throw error;
  }
}

/**
 * Get user notifications
 * @param {string} userId - User ID
 * @param {number} limit - Number of notifications to fetch
 */
export async function getUserNotifications(userId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    throw error;
  }
}

export default {
  createNotification,
  markAsRead,
  getUserNotifications,
};
