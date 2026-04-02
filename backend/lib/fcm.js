const { getSupabase } = require("./supabase");

/**
 * Send a push notification to a user via Firebase Cloud Messaging (legacy HTTP API).
 *
 * Requires FIREBASE_SERVER_KEY env var (from Firebase Console > Project Settings > Cloud Messaging).
 *
 * @param {string} userId - The Supabase user UID to notify
 * @param {object} notification - { title, body }
 * @param {object} data - Payload data for navigation (e.g. { type, report_id })
 */
async function sendPushNotification(userId, notification, data = {}) {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) {
    console.warn("FIREBASE_SERVER_KEY not set, skipping push notification");
    return;
  }

  try {
    // Get user's FCM token from Supabase
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from("users")
      .select("fcm_token")
      .eq("uid", userId)
      .single();

    if (error || !user?.fcm_token) {
      console.log(`No FCM token for user ${userId}, skipping notification`);
      return;
    }

    // Send via FCM legacy HTTP API
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify({
        to: user.fcm_token,
        notification: {
          title: notification.title,
          body: notification.body,
          sound: "default",
        },
        data: {
          ...data,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
        priority: "high",
      }),
    });

    const result = await response.json();
    if (result.failure > 0) {
      console.log("FCM delivery failed:", result.results);
      // If token is invalid, clean it up
      if (result.results?.[0]?.error === "NotRegistered") {
        await supabase
          .from("users")
          .update({ fcm_token: null })
          .eq("uid", userId);
      }
    }
  } catch (err) {
    console.error("Push notification error:", err.message);
  }
}

module.exports = { sendPushNotification };
