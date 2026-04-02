const { getSupabase } = require("./supabase");

/**
 * Get a short-lived OAuth2 access token for FCM HTTP v1 API
 * using the service account credentials from env vars.
 */
async function getAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) return null;

  // Build JWT manually (avoid heavy dependency on google-auth-library)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claimSet = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const crypto = require("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${claimSet}`);
  const signature = sign.sign(privateKey, "base64url");

  const jwt = `${header}.${claimSet}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token || null;
}

/**
 * Send a push notification to a user via FCM HTTP v1 API.
 *
 * Requires env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * @param {string} userId - The Supabase user UID to notify
 * @param {object} notification - { title, body }
 * @param {object} data - Payload data for navigation (e.g. { type, report_id })
 */
async function sendPushNotification(userId, notification, data = {}) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.warn("Firebase service account not configured, skipping push notification");
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

    // Get OAuth2 access token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("Failed to get FCM access token");
      return;
    }

    // Send via FCM HTTP v1 API
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: user.fcm_token,
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: {
              ...data,
              click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
            android: {
              priority: "high",
              notification: {
                sound: "default",
                channel_id: "civicsight_notifications",
              },
            },
          },
        }),
      }
    );

    const result = await response.json();
    if (result.error) {
      console.log("FCM delivery failed:", result.error.message);
      // If token is unregistered, clean it up
      if (result.error.code === 404 || result.error.message?.includes("not found")) {
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
