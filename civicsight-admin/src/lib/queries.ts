import { supabase } from "./supabase";
import type {
  DbReport,
  DbUser,
  DbCategory,
  DbReportLocation,
  DbReportImage,
  DbWorkerAssignment,
  DbWorkerProfile,
  DbCitizenProfile,
  ReportWithDetails,
  WorkerWithProfile,
  ReportStatus,
  AssignmentPriority,
} from "./types";

// ─── Reports ──────────────────────────────────────────────

export async function fetchReports(): Promise<ReportWithDetails[]> {
  const { data: reports, error } = await supabase
    .from("reports")
    .select("*")
    .order("reported_at", { ascending: false });

  if (error) throw error;
  if (!reports || reports.length === 0) return [];

  // Gather unique IDs
  const citizenIds = [...new Set(reports.map((r: DbReport) => r.citizen_id))];
  const categoryIds = [
    ...new Set(reports.map((r: DbReport) => r.category_id).filter(Boolean)),
  ] as number[];
  const reportIds = reports.map((r: DbReport) => r.id);

  // Parallel fetch related data
  const [usersRes, catsRes, locsRes, imgsRes, assignRes] = await Promise.all([
    supabase.from("users").select("*").in("uid", citizenIds),
    categoryIds.length > 0
      ? supabase.from("categories").select("*").in("id", categoryIds)
      : { data: [], error: null },
    supabase.from("report_locations").select("*").in("report_id", reportIds),
    supabase.from("report_images").select("*").in("report_id", reportIds),
    supabase.from("worker_assignments").select("*").in("report_id", reportIds),
  ]);

  const usersMap = new Map(
    (usersRes.data || []).map((u: DbUser) => [u.uid, u])
  );
  const catsMap = new Map(
    (catsRes.data || []).map((c: DbCategory) => [c.id, c])
  );
  const locsMap = new Map(
    (locsRes.data || []).map((l: DbReportLocation) => [l.report_id, l])
  );
  const imgsMap = new Map<string, DbReportImage[]>();
  for (const img of imgsRes.data || []) {
    const list = imgsMap.get(img.report_id) || [];
    list.push(img);
    imgsMap.set(img.report_id, list);
  }

  // Get assigned worker details
  const assignMap = new Map<string, DbWorkerAssignment>();
  const workerIds: string[] = [];
  for (const a of assignRes.data || []) {
    assignMap.set(a.report_id, a);
    if (a.worker_id) workerIds.push(a.worker_id);
  }

  let workersMap = new Map<string, DbUser>();
  if (workerIds.length > 0) {
    const { data: workers } = await supabase
      .from("users")
      .select("*")
      .in("uid", [...new Set(workerIds)]);
    workersMap = new Map((workers || []).map((w: DbUser) => [w.uid, w]));
  }

  return reports.map((r: DbReport): ReportWithDetails => {
    const assignment = assignMap.get(r.id);
    return {
      ...r,
      citizen: usersMap.get(r.citizen_id),
      category: r.category_id ? catsMap.get(r.category_id) : undefined,
      location: locsMap.get(r.id),
      images: imgsMap.get(r.id) || [],
      assignment: assignment
        ? { ...assignment, worker: workersMap.get(assignment.worker_id) }
        : undefined,
    };
  });
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus
) {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

  if (status === "assigned") updates.assigned_at = new Date().toISOString();
  if (status === "completed") updates.resolved_at = new Date().toISOString();
  if (status === "closed") updates.closed_at = new Date().toISOString();

  const { error } = await supabase
    .from("reports")
    .update(updates)
    .eq("id", reportId);

  if (error) throw error;
}

// ─── Worker Assignment ────────────────────────────────────

export async function assignWorkerToReport(
  reportId: string,
  workerId: string,
  adminId: string,
  priority: AssignmentPriority = "normal",
  note?: string
) {
  // 1. Create assignment row
  const { error: assignErr } = await supabase
    .from("worker_assignments")
    .upsert(
      {
        report_id: reportId,
        worker_id: workerId,
        assigned_by: adminId,
        assignment_status: "assigned",
        assignment_priority: priority,
        assigned_at: new Date().toISOString(),
        assignment_note: note || null,
        last_update_at: new Date().toISOString(),
      },
      { onConflict: "report_id" }
    );

  if (assignErr) throw assignErr;

  // 2. Update report status to assigned and set assigned_worker_id
  const { error: reportErr } = await supabase
    .from("reports")
    .update({
      status: "assigned",
      assigned_worker_id: workerId,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (reportErr) throw reportErr;

  // 3. Increment worker task count
  const { data: profile } = await supabase
    .from("worker_profiles")
    .select("current_task_count")
    .eq("worker_id", workerId)
    .single();

  if (profile) {
    await supabase
      .from("worker_profiles")
      .update({
        current_task_count: profile.current_task_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("worker_id", workerId);
  }
}

// ─── Workers ──────────────────────────────────────────────

export async function fetchWorkers(): Promise<WorkerWithProfile[]> {
  const { data: workers, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "worker")
    .order("full_name");

  if (error) throw error;
  if (!workers || workers.length === 0) return [];

  const workerIds = workers.map((w: DbUser) => w.uid);

  // Fetch profiles and assignments in parallel
  const [profilesRes, assignmentsRes] = await Promise.all([
    supabase.from("worker_profiles").select("*").in("worker_id", workerIds),
    supabase
      .from("worker_assignments")
      .select("worker_id, assignment_status")
      .in("worker_id", workerIds),
  ]);

  const profilesMap = new Map(
    (profilesRes.data || []).map((p: DbWorkerProfile) => [p.worker_id, p])
  );

  // Count completed and active assignments per worker
  const completedCounts = new Map<string, number>();
  const activeCounts = new Map<string, number>();
  for (const a of assignmentsRes.data || []) {
    if (a.assignment_status === "completed") {
      completedCounts.set(a.worker_id, (completedCounts.get(a.worker_id) || 0) + 1);
    } else if (a.assignment_status === "assigned" || a.assignment_status === "in_progress") {
      activeCounts.set(a.worker_id, (activeCounts.get(a.worker_id) || 0) + 1);
    }
  }

  return workers.map((w: DbUser): WorkerWithProfile => {
    const profile = profilesMap.get(w.uid);
    return {
      ...w,
      worker_profile: profile
        ? {
            ...profile,
            total_completed: completedCounts.get(w.uid) || 0,
            current_task_count: activeCounts.get(w.uid) || 0,
          }
        : undefined,
    };
  });
}

// ─── Citizens ─────────────────────────────────────────────

export async function fetchCitizens() {
  const { data: citizens, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "citizen")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!citizens || citizens.length === 0) return [];

  const citizenIds = citizens.map((c: DbUser) => c.uid);
  const { data: profiles } = await supabase
    .from("citizen_profiles")
    .select("*")
    .in("citizen_id", citizenIds);

  const profilesMap = new Map(
    (profiles || []).map((p: DbCitizenProfile) => [p.citizen_id, p])
  );

  return citizens.map((c: DbUser) => ({
    ...c,
    citizen_profile: profilesMap.get(c.uid),
  }));
}

// ─── Categories ───────────────────────────────────────────

export async function fetchCategories(): Promise<DbCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data || [];
}

// ─── Dashboard Stats ──────────────────────────────────────

export async function fetchDashboardStats() {
  const [reportsRes, usersRes, workersRes] = await Promise.all([
    supabase.from("reports").select("id, status, ai_severity, reported_at, resolved_at, category_id"),
    supabase.from("users").select("uid, role, status").eq("role", "citizen"),
    supabase.from("users").select("uid").eq("role", "worker"),
  ]);

  const reports = reportsRes.data || [];
  const citizens = usersRes.data || [];
  const workers = workersRes.data || [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalReports = reports.length;
  const activeCitizens = citizens.filter((c: { status: string }) => c.status === "active").length;
  const totalWorkers = workers.length;

  const resolvedToday = reports.filter((r: { resolved_at: string | null }) => {
    if (!r.resolved_at) return false;
    const resolved = new Date(r.resolved_at);
    resolved.setHours(0, 0, 0, 0);
    return resolved.getTime() === today.getTime();
  }).length;

  const statusCounts: Record<string, number> = {};
  for (const r of reports) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  // Reports by category
  const categoryCounts: Record<number, number> = {};
  for (const r of reports) {
    if (r.category_id) {
      categoryCounts[r.category_id] = (categoryCounts[r.category_id] || 0) + 1;
    }
  }

  // Reports over last 7 days
  const last7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = reports.filter((r: { reported_at: string }) =>
      r.reported_at.startsWith(dateStr)
    ).length;
    last7Days.push({ date: dateStr, count });
  }

  // Average resolution time (hours)
  const resolvedReports = reports.filter(
    (r: { resolved_at: string | null; reported_at: string }) => r.resolved_at
  );
  let avgResolutionHours = 0;
  if (resolvedReports.length > 0) {
    const totalHours = resolvedReports.reduce(
      (sum: number, r: { resolved_at: string | null; reported_at: string }) => {
        const diff =
          new Date(r.resolved_at!).getTime() -
          new Date(r.reported_at).getTime();
        return sum + diff / (1000 * 60 * 60);
      },
      0
    );
    avgResolutionHours = totalHours / resolvedReports.length;
  }

  return {
    totalReports,
    activeCitizens,
    totalWorkers,
    resolvedToday,
    statusCounts,
    categoryCounts,
    last7Days,
    avgResolutionHours,
  };
}

// ─── Analytics ────────────────────────────────────────────

export async function fetchAnalyticsData() {
  const [reportsRes, catsRes, locationsRes] = await Promise.all([
    supabase.from("reports").select("id, status, ai_severity, reported_at, resolved_at, category_id, ai_category_name"),
    supabase.from("categories").select("id, name, category_group").eq("is_active", true),
    supabase.from("report_locations").select("report_id, city, neighbourhood"),
  ]);

  const reports = reportsRes.data || [];
  const categories = catsRes.data || [];
  const locations = locationsRes.data || [];

  const catsMap = new Map(categories.map((c: { id: number; name: string }) => [c.id, c.name]));
  const locMap = new Map(locations.map((l: { report_id: string; city: string | null; neighbourhood: string | null }) => [l.report_id, l]));

  return { reports, categories, catsMap, locMap };
}

// ─── Auth ─────────────────────────────────────────────────

export async function adminLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Verify user has admin role
  const { data: userData, error: userErr } = await supabase
    .from("users")
    .select("uid, role, full_name, email")
    .eq("uid", data.user.id)
    .single();

  if (userErr || !userData) throw new Error("User profile not found");
  if (userData.role !== "admin") throw new Error("Access denied: admin role required");

  return { session: data.session, user: userData };
}

export async function adminLogout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: user } = await supabase
    .from("users")
    .select("uid, role, full_name, email")
    .eq("uid", session.user.id)
    .single();

  if (!user || user.role !== "admin") return null;
  return user;
}
