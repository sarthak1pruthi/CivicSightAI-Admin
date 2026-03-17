const { getSupabase } = require("../lib/supabase");
const cors = require("../lib/cors");

module.exports = cors(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabase = getSupabase();

  try {
    const { data: citizens, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "citizen")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!citizens || citizens.length === 0) return res.json([]);

    const citizenIds = citizens.map((c) => c.uid);
    const [profilesRes, reportsRes] = await Promise.all([
      supabase.from("citizen_profiles").select("*").in("citizen_id", citizenIds),
      supabase.from("reports").select("citizen_id").in("citizen_id", citizenIds),
    ]);

    const profilesMap = new Map((profilesRes.data || []).map((p) => [p.citizen_id, p]));

    const reportCounts = {};
    for (const r of reportsRes.data || []) {
      reportCounts[r.citizen_id] = (reportCounts[r.citizen_id] || 0) + 1;
    }

    const result = citizens.map((c) => {
      const profile = profilesMap.get(c.uid);
      return {
        ...c,
        citizen_profile: profile
          ? { ...profile, total_reports: reportCounts[c.uid] || 0 }
          : { citizen_id: c.uid, total_reports: reportCounts[c.uid] || 0 },
      };
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
