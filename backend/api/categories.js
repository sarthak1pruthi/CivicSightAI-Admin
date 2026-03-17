const { getSupabase } = require("../lib/supabase");
const cors = require("../lib/cors");

module.exports = cors(async function handler(req, res) {
  const supabase = getSupabase();

  // GET — list active categories (or ?include=settings for settings page data)
  if (req.method === "GET") {
    try {
      if (req.query.include === "settings") {
        // Settings page: categories with report counts + admin info
        const [catsRes, reportsRes, adminRes] = await Promise.all([
          supabase.from("categories").select("id, name, category_group, is_active").eq("is_active", true).order("name"),
          supabase.from("reports").select("category_id"),
          supabase.from("users").select("email, full_name").eq("role", "admin").limit(1).single(),
        ]);

        if (catsRes.error) return res.status(500).json({ error: catsRes.error.message });

        const countMap = {};
        for (const r of reportsRes.data || []) {
          if (r.category_id) countMap[r.category_id] = (countMap[r.category_id] || 0) + 1;
        }

        const categories = (catsRes.data || []).map((c) => ({
          id: c.id,
          name: c.name,
          group: c.category_group,
          reportCount: countMap[c.id] || 0,
        }));

        return res.json({ categories, admin: adminRes.data || null });
      }

      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — add new category
  if (req.method === "POST") {
    try {
      const { name, category_group } = req.body;
      if (!name || !category_group) return res.status(400).json({ error: "name and category_group required" });

      const { data, error } = await supabase
        .from("categories")
        .insert({
          name: name.trim(),
          category_group: category_group.trim(),
          example_issues: "",
          min_response_days: 3,
          max_response_days: 14,
          is_active: true,
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PATCH — update category
  if (req.method === "PATCH") {
    try {
      const { id, name, category_group } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (category_group !== undefined) updates.category_group = category_group;

      const { error } = await supabase.from("categories").update(updates).eq("id", id);
      if (error) return res.status(500).json({ error: error.message });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE — soft delete (set is_active = false)
  if (req.method === "DELETE") {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const { error } = await supabase.from("categories").update({ is_active: false }).eq("id", id);
      if (error) return res.status(500).json({ error: error.message });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
