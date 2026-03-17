const { getSupabase } = require("../lib/supabase");
const cors = require("../lib/cors");

module.exports = cors(async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

  const supabase = getSupabase();

  try {
    const { uid, status } = req.body;
    if (!uid || !status) return res.status(400).json({ error: "uid and status required" });

    const { error } = await supabase
      .from("users")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("uid", uid);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
