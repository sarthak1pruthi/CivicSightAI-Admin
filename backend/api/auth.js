const { getSupabase } = require("../lib/supabase");
const cors = require("../lib/cors");

module.exports = cors(async function handler(req, res) {
  const supabase = getSupabase();

  // POST /api/auth — login
  if (req.method === "POST") {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "email and password required" });

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return res.status(401).json({ error: error.message });

      const { data: userData, error: userErr } = await supabase
        .from("users")
        .select("uid, role, full_name, email")
        .eq("uid", data.user.id)
        .single();

      if (userErr || !userData) return res.status(404).json({ error: "User profile not found" });
      if (userData.role !== "admin") return res.status(403).json({ error: "Access denied: admin role required" });

      return res.json({ session: data.session, user: userData });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE /api/auth — logout
  if (req.method === "DELETE") {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const authedClient = require("@supabase/supabase-js").createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
        await authedClient.auth.signOut();
      }
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/auth — get current admin (via token)
  if (req.method === "GET") {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      const token = authHeader.slice(7);
      const { createClient } = require("@supabase/supabase-js");
      const authedClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user }, error } = await authedClient.auth.getUser();
      if (error || !user) return res.status(401).json({ error: "Invalid session" });

      const { data: userData } = await supabase
        .from("users")
        .select("uid, role, full_name, email")
        .eq("uid", user.id)
        .single();

      if (!userData || userData.role !== "admin") return res.status(403).json({ error: "Not an admin" });

      return res.json(userData);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
