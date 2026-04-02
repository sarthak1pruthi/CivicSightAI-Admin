const { getSupabase } = require("../lib/supabase");
const cors = require("../lib/cors");

module.exports = cors(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabase = getSupabase();

  try {
    const [reportsRes, catsRes, locationsRes, assignmentsRes] = await Promise.all([
      supabase.from("reports").select("id, status, ai_severity, reported_at, resolved_at, closed_at, assigned_at, category_id, ai_category_name, citizen_id"),
      supabase.from("categories").select("id, name, category_group").eq("is_active", true),
      supabase.from("report_locations").select("report_id, city, neighbourhood"),
      supabase.from("worker_assignments").select("report_id, worker_id, assignment_status, assignment_priority, assigned_at, completed_at, rejected_at"),
    ]);

    const reports = reportsRes.data || [];
    const categories = catsRes.data || [];
    const locations = locationsRes.data || [];
    const assignments = assignmentsRes.data || [];

    // Build maps server-side so frontend doesn't need to
    const catsMap = {};
    const catGroupMap = {};
    for (const c of categories) {
      catsMap[c.id] = c.name;
      catGroupMap[c.id] = c.category_group;
    }

    const locMap = {};
    for (const l of locations) {
      locMap[l.report_id] = l;
    }

    const assignmentMap = {};
    for (const a of assignments) {
      assignmentMap[a.report_id] = a;
    }

    return res.json({ reports, categories, catsMap, catGroupMap, locMap, assignments: assignmentMap });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
