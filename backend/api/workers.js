const { getSupabase } = require("../lib/supabase");
const cors = require("../lib/cors");

module.exports = cors(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabase = getSupabase();

  try {
    const { data: workers, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "worker")
      .order("full_name");

    if (error) return res.status(500).json({ error: error.message });
    if (!workers || workers.length === 0) return res.json([]);

    const workerIds = workers.map((w) => w.uid);

    const [profilesRes, assignmentsRes] = await Promise.all([
      supabase.from("worker_profiles").select("*").in("worker_id", workerIds),
      supabase.from("worker_assignments").select("worker_id, assignment_status").in("worker_id", workerIds),
    ]);

    const profilesMap = new Map((profilesRes.data || []).map((p) => [p.worker_id, p]));

    const completedCounts = new Map();
    const activeCounts = new Map();
    for (const a of assignmentsRes.data || []) {
      if (a.assignment_status === "completed" || a.assignment_status === "resolved") {
        completedCounts.set(a.worker_id, (completedCounts.get(a.worker_id) || 0) + 1);
      } else if (a.assignment_status === "assigned" || a.assignment_status === "in_progress") {
        activeCounts.set(a.worker_id, (activeCounts.get(a.worker_id) || 0) + 1);
      }
    }

    const result = workers.map((w) => {
      const profile = profilesMap.get(w.uid);
      return {
        ...w,
        worker_profile: {
          worker_id: w.uid,
          service_area: profile?.service_area || null,
          is_available: profile?.is_available ?? true,
          avg_rating: profile?.avg_rating || 0,
          max_task_limit: profile?.max_task_limit || 5,
          total_rejected: profile?.total_rejected || 0,
          total_completed: completedCounts.get(w.uid) || 0,
          current_task_count: activeCounts.get(w.uid) || 0,
          created_at: profile?.created_at || w.created_at,
          updated_at: profile?.updated_at || w.updated_at,
        },
      };
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
