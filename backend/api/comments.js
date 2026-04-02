const { getSupabase } = require("../lib/supabase");
const cors = require("../lib/cors");
const { sendPushNotification } = require("../lib/fcm");

module.exports = cors(async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === "GET") {
    const { report_id } = req.query;
    if (!report_id) {
      return res.status(400).json({ error: "report_id is required" });
    }

    try {
      const { data, error } = await supabase
        .from("comments")
        .select("*, users:user_id(full_name, role)")
        .eq("report_id", report_id)
        .order("created_at", { ascending: true });

      if (error) return res.status(500).json({ error: error.message });

      // Flatten user info into each comment
      const flat = (data || []).map((c) => ({
        ...c,
        author_name: c.users?.full_name || "Unknown",
        author_role: c.users?.role || "unknown",
        users: undefined,
      }));
      return res.json(flat);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "POST") {
    const { report_id, user_id, content, is_internal } = req.body || {};

    if (!report_id || !user_id || !content) {
      return res.status(400).json({ error: "report_id, user_id, and content are required" });
    }

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          report_id,
          user_id,
          content: content.trim(),
          is_internal: is_internal || false,
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });

      // Notify the assigned worker if the comment is from an admin
      try {
        const { data: sender } = await supabase
          .from("users")
          .select("role, full_name")
          .eq("uid", user_id)
          .single();

        if (sender?.role === "admin") {
          // Find the worker assigned to this report
          const { data: report } = await supabase
            .from("reports")
            .select("assigned_worker_id")
            .eq("id", report_id)
            .single();

          if (report?.assigned_worker_id) {
            sendPushNotification(
              report.assigned_worker_id,
              {
                title: "New Message from Admin",
                body: content.trim().length > 100
                  ? content.trim().substring(0, 100) + "..."
                  : content.trim(),
              },
              { type: "new_comment", report_id }
            );
          }
        }
      } catch (notifErr) {
        console.error("Notification error (non-blocking):", notifErr.message);
      }

      return res.status(201).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
