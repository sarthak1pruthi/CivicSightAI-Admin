const { getSupabase } = require("../lib/supabase");
const cors = require("../lib/cors");

module.exports = cors(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabase = getSupabase();

  try {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);

    const [reportsRes, usersRes] = await Promise.all([
      supabase
        .from("reports")
        .select("id, report_number, description, status")
        .or(`description.ilike.%${query}%,status.ilike.%${query}%`)
        .order("reported_at", { ascending: false })
        .limit(5),
      supabase
        .from("users")
        .select("uid, full_name, email")
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5),
    ]);

    const reportItems = (reportsRes.data || []).map((r) => ({
      type: "report",
      label: `RPT-${String(r.report_number).padStart(4, "0")} — ${(r.description || "").slice(0, 60)}`,
      href: "/dashboard/reports",
    }));

    const userItems = (usersRes.data || []).map((u) => ({
      type: "user",
      label: `${u.full_name || "Unnamed"} — ${u.email}`,
      href: "/dashboard/users",
    }));

    return res.json([...reportItems, ...userItems].slice(0, 10));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
