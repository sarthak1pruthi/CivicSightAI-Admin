const { getSupabase } = require("../lib/supabase");
const cors = require("../lib/cors");

module.exports = cors(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabase = getSupabase();

  try {
    const [reportsRes, catsRes, locationsRes] = await Promise.all([
      supabase.from("reports").select("id, status, ai_severity, reported_at, resolved_at, category_id, ai_category_name"),
      supabase.from("categories").select("id, name, category_group").eq("is_active", true),
      supabase.from("report_locations").select("report_id, city, neighbourhood"),
    ]);

    const reports = reportsRes.data || [];
    const categories = catsRes.data || [];
    const locations = locationsRes.data || [];

    // Build maps server-side so frontend doesn't need to
    const catsMap = {};
    for (const c of categories) {
      catsMap[c.id] = c.name;
    }

    const locMap = {};
    for (const l of locations) {
      locMap[l.report_id] = l;
    }

    return res.json({ reports, categories, catsMap, locMap });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
