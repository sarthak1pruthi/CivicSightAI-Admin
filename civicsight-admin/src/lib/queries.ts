import { apiFetch } from "./api";
import { supabase } from "./supabase";
import type {
  DbCategory,
  DbCitizenProfile,
  ReportWithDetails,
  WorkerWithProfile,
  ReportStatus,
  AssignmentPriority,
} from "./types";

// ─── Reports ──────────────────────────────────────────────

export async function fetchReports(): Promise<ReportWithDetails[]> {
  return apiFetch<ReportWithDetails[]>("/api/reports");
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  rejectionNote?: string
) {
  await apiFetch("/api/reports", {
    method: "PATCH",
    body: JSON.stringify({ reportId, status, rejectionNote }),
  });
}

// ─── Worker Assignment ────────────────────────────────────

export async function assignWorkerToReport(
  reportId: string,
  workerId: string,
  adminId: string,
  priority: AssignmentPriority = "normal",
  note?: string
) {
  await apiFetch("/api/assignments", {
    method: "POST",
    body: JSON.stringify({ reportId, workerId, adminId, priority, note }),
  });
}

// ─── Workers ──────────────────────────────────────────────

export async function fetchWorkers(): Promise<WorkerWithProfile[]> {
  return apiFetch<WorkerWithProfile[]>("/api/workers");
}

// ─── Citizens ─────────────────────────────────────────────

export async function fetchCitizens() {
  return apiFetch<(import("./types").DbUser & { citizen_profile?: DbCitizenProfile })[]>("/api/citizens");
}

// ─── Categories ───────────────────────────────────────────

export async function fetchCategories(): Promise<DbCategory[]> {
  return apiFetch<DbCategory[]>("/api/categories");
}

// ─── Comments ─────────────────────────────────────────────

export interface Comment {
  id: number;
  report_id: string;
  user_id: string;
  content: string;
  is_internal: boolean | null;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_role?: string;
}

export async function fetchComments(reportId: string): Promise<Comment[]> {
  return apiFetch<Comment[]>(`/api/comments?report_id=${encodeURIComponent(reportId)}`);
}

export async function postComment(reportId: string, userId: string, content: string): Promise<Comment> {
  return apiFetch<Comment>("/api/comments", {
    method: "POST",
    body: JSON.stringify({ report_id: reportId, user_id: userId, content }),
  });
}

// ─── Dashboard Stats ──────────────────────────────────────

export async function fetchDashboardStats() {
  return apiFetch<{
    totalReports: number;
    activeCitizens: number;
    totalWorkers: number;
    resolvedToday: number;
    statusCounts: Record<string, number>;
    categoryCounts: Record<string, number>;
    last7Days: { date: string; count: number }[];
    avgResolutionHours: number;
  }>("/api/dashboard");
}

// ─── Analytics ────────────────────────────────────────────

export async function fetchAnalyticsData() {
  const data = await apiFetch<{
    reports: Array<{ id: string; status: string; ai_severity: number | null; reported_at: string; resolved_at: string | null; closed_at: string | null; assigned_at: string | null; category_id: number | null; ai_category_name: string | null; citizen_id: string }>;
    categories: Array<{ id: number; name: string; category_group: string }>;
    catsMap: Record<string, string>;
    catGroupMap: Record<string, string>;
    locMap: Record<string, { report_id: string; city: string | null; neighbourhood: string | null }>;
    assignments: Record<string, { report_id: string; worker_id: string; assignment_status: string; assignment_priority: string; assigned_at: string | null; completed_at: string | null; rejected_at: string | null }>;
  }>("/api/analytics");

  // Convert plain objects back to Maps for frontend compatibility
  return {
    reports: data.reports,
    categories: data.categories,
    catsMap: new Map(Object.entries(data.catsMap).map(([k, v]) => [Number(k), v])),
    catGroupMap: new Map(Object.entries(data.catGroupMap || {}).map(([k, v]) => [Number(k), v])),
    locMap: new Map(Object.entries(data.locMap)),
    assignments: new Map(Object.entries(data.assignments || {})),
  };
}

// ─── Auth ─────────────────────────────────────────────────

export async function adminLogin(email: string, password: string) {
  const result = await apiFetch<{
    session: { access_token: string; refresh_token: string };
    user: { uid: string; role: string; full_name: string; email: string };
  }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  // Store token for subsequent requests
  if (result.session?.access_token) {
    localStorage.setItem("access_token", result.session.access_token);
  }

  // Also sign in on the client supabase for realtime subscriptions
  await supabase.auth.signInWithPassword({ email, password });

  return result;
}

export async function adminLogout() {
  try {
    await apiFetch("/api/auth", { method: "DELETE" });
  } finally {
    localStorage.removeItem("access_token");
    await supabase.auth.signOut();
  }
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentAdmin() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (!token) {
    // Fallback: check supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    // Store it for future API calls
    localStorage.setItem("access_token", session.access_token);
  }

  try {
    return await apiFetch<{ uid: string; role: string; full_name: string; email: string }>("/api/auth");
  } catch {
    return null;
  }
}
