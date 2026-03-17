"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Sector,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { fetchAnalyticsData } from "@/lib/queries";

type PeriodKey = "7D" | "30D" | "90D" | "All";

const tooltipStyle = { backgroundColor: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: "8px", fontSize: "12px", color: "#e8e4df" };
const tooltipLabelStyle = { color: "#e8e4df" };
const tooltipItemStyle = { color: "#c4c0ba" };

const periodDays: Record<PeriodKey, number> = { "7D": 7, "30D": 30, "90D": 90, All: 36500 };
const periodLabels: Record<PeriodKey, string> = { "7D": "past 7 days", "30D": "past 30 days", "90D": "past 90 days", All: "all time" };

interface RawReport {
    id: string;
    status: string;
    ai_severity: number | null;
    reported_at: string;
    resolved_at: string | null;
    category_id: number | null;
    ai_category_name: string | null;
}

function filterByPeriod(reports: RawReport[], days: number): RawReport[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return reports.filter((r) => new Date(r.reported_at) >= cutoff);
}

export default function AnalyticsPage() {
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("30D");
    const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allReports, setAllReports] = useState<RawReport[]>([]);
    const [catsMap, setCatsMap] = useState<Map<number, string>>(new Map());
    const [locMap, setLocMap] = useState<Map<string, { city: string | null; neighbourhood: string | null }>>(new Map());

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchAnalyticsData();
            setAllReports(data.reports);
            setCatsMap(data.catsMap);
            setLocMap(data.locMap);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load analytics");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const reports = useMemo(() => filterByPeriod(allReports, periodDays[selectedPeriod]), [allReports, selectedPeriod]);

    // Volume data — group by date/week/month depending on period
    const volumeData = useMemo(() => {
        const buckets = new Map<string, { reports: number; resolved: number }>();
        for (const r of reports) {
            const d = r.reported_at.slice(0, 10);
            const b = buckets.get(d) || { reports: 0, resolved: 0 };
            b.reports++;
            buckets.set(d, b);
        }
        for (const r of reports) {
            if (r.resolved_at) {
                const d = r.resolved_at.slice(0, 10);
                const b = buckets.get(d) || { reports: 0, resolved: 0 };
                b.resolved++;
                buckets.set(d, b);
            }
        }
        return Array.from(buckets.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-14)
            .map(([date, v]) => ({
                month: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                reports: v.reports,
                resolved: v.resolved,
            }));
    }, [reports]);

    // Resolution time data
    const resolutionData = useMemo(() => {
        const resolved = reports.filter((r) => r.resolved_at);
        const buckets = new Map<string, { totalHours: number; count: number }>();
        for (const r of resolved) {
            const d = r.resolved_at!.slice(0, 10);
            const hours = (new Date(r.resolved_at!).getTime() - new Date(r.reported_at).getTime()) / (1000 * 60 * 60);
            const b = buckets.get(d) || { totalHours: 0, count: 0 };
            b.totalHours += hours;
            b.count++;
            buckets.set(d, b);
        }
        return Array.from(buckets.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-14)
            .map(([date, v]) => ({
                month: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                days: Number((v.totalHours / v.count / 24).toFixed(1)),
            }));
    }, [reports]);

    // Status distribution
    const statusData = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const r of reports) counts[r.status] = (counts[r.status] || 0) + 1;
        const total = reports.length || 1;
        const colorMap: Record<string, string> = { resolved: "#22c55e", in_progress: "#3b82f6", pending: "#f59e0b", closed: "#6b7280", open: "#60a5fa", assigned: "#8b5cf6", rejected: "#ef4444" };
        return Object.entries(counts).map(([name, count]) => ({
            name: name.replace("_", " "),
            value: Math.round((count / total) * 100),
            color: colorMap[name] || "#6b7280",
        }));
    }, [reports]);

    // Category radar
    const radarData = useMemo(() => {
        const catCounts: Record<string, { total: number; resolved: number }> = {};
        for (const r of reports) {
            const catName = r.category_id ? (catsMap.get(r.category_id) || "Other") : (r.ai_category_name || "Other");
            const c = catCounts[catName] || { total: 0, resolved: 0 };
            c.total++;
            if (r.status === "resolved") c.resolved++;
            catCounts[catName] = c;
        }
        return Object.entries(catCounts)
            .sort(([, a], [, b]) => b.total - a.total)
            .slice(0, 6)
            .map(([category, v]) => ({
                category: category.length > 12 ? category.slice(0, 12) + "…" : category,
                score: v.total > 0 ? Math.round((v.resolved / v.total) * 100) : 0,
            }));
    }, [reports, catsMap]);

    // Area performance
    const areaData = useMemo(() => {
        const areas: Record<string, { reports: number; resolved: number; totalHours: number; resolvedCount: number }> = {};
        for (const r of reports) {
            const loc = locMap.get(r.id);
            const area = loc?.city || loc?.neighbourhood || "Unknown";
            const a = areas[area] || { reports: 0, resolved: 0, totalHours: 0, resolvedCount: 0 };
            a.reports++;
            if (r.status === "resolved") {
                a.resolved++;
                if (r.resolved_at) {
                    a.totalHours += (new Date(r.resolved_at).getTime() - new Date(r.reported_at).getTime()) / (1000 * 60 * 60);
                    a.resolvedCount++;
                }
            }
            areas[area] = a;
        }
        return Object.entries(areas)
            .sort(([, a], [, b]) => b.reports - a.reports)
            .slice(0, 5)
            .map(([area, v]) => ({
                area,
                reports: v.reports,
                resolved: v.resolved,
                avgDays: v.resolvedCount > 0 ? Number((v.totalHours / v.resolvedCount / 24).toFixed(1)) : 0,
            }));
    }, [reports, locMap]);

    const handleExport = () => {
        const csv = [
            "Date,Reports,Resolved",
            ...volumeData.map((r) => `${r.month},${r.reports},${r.resolved}`),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `civicsight-analytics-${selectedPeriod}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading analytics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
                <AlertTriangle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button size="sm" onClick={loadData}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {(["7D", "30D", "90D", "All"] as PeriodKey[]).map((period) => (
                        <Button
                            key={period}
                            variant={period === selectedPeriod ? "default" : "ghost"}
                            size="sm"
                            className="text-xs h-8 px-3"
                            onClick={() => setSelectedPeriod(period)}
                        >
                            {period}
                        </Button>
                    ))}
                </div>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={handleExport}>
                    <Download className="w-3.5 h-3.5" /> Export Report
                </Button>
            </div>

            {/* Row 1: Report Volume + Resolution Time */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Report Volume</CardTitle>
                        <p className="text-xs text-muted-foreground">New reports vs resolved over the {periodLabels[selectedPeriod]}</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={volumeData} barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                                    <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} stroke="rgba(128,128,128,0.4)" />
                                    <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="rgba(128,128,128,0.4)" />
                                    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                                    <Bar dataKey="reports" fill="#e88c30" radius={[4, 4, 0, 0]} name="New Reports" />
                                    <Bar dataKey="resolved" fill="#22c55e" radius={[4, 4, 0, 0]} name="Resolved" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Average Resolution Time</CardTitle>
                        <p className="text-xs text-muted-foreground">Days to resolve, {periodLabels[selectedPeriod]}</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={resolutionData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                                    <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} stroke="rgba(128,128,128,0.4)" />
                                    <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="rgba(128,128,128,0.4)" domain={[0, "auto"]} tickFormatter={(v) => `${v}d`} />
                                    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number | undefined) => [`${v ?? 0} days`, "Avg Resolution"]} />
                                    <Line type="monotone" dataKey="days" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e" }} activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Row 2: Status Pie + Radar + Area Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
                        <p className="text-xs text-muted-foreground">Report status breakdown ({periodLabels[selectedPeriod]})</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData} cx="50%" cy="50%"
                                        innerRadius={55} outerRadius={80} paddingAngle={4}
                                        dataKey="value" strokeWidth={0}
                                        // @ts-expect-error activeIndex valid Recharts prop
                                        activeIndex={activePieIndex ?? undefined}
                                        activeShape={(props: any) => {
                                            const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                                            return <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={(outerRadius as number) + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} strokeWidth={0} />;
                                        }}
                                        onMouseEnter={(_, index) => setActivePieIndex(index)}
                                        onMouseLeave={() => setActivePieIndex(null)}
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} opacity={activePieIndex === null || activePieIndex === index ? 1 : 0.3} style={{ transition: "opacity 0.2s ease" }} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number | undefined, name?: string) => [`${v ?? 0}%`, name ?? ""]} cursor={false} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                            {statusData.map((item) => (
                                <div key={item.name} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-muted-foreground capitalize">{item.name}</span>
                                    </div>
                                    <span className="font-medium">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Resolution Efficiency</CardTitle>
                        <p className="text-xs text-muted-foreground">Performance score by category</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="rgba(128,128,128,0.15)" />
                                    <PolarAngleAxis dataKey="category" fontSize={10} stroke="rgba(128,128,128,0.5)" />
                                    <PolarRadiusAxis fontSize={9} stroke="rgba(128,128,128,0.3)" domain={[0, 100]} />
                                    <Radar name="score" dataKey="score" stroke="#e88c30" fill="#e88c30" fillOpacity={0.2} strokeWidth={2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Area Performance</CardTitle>
                        <p className="text-xs text-muted-foreground">Reports & resolution by district</p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 mt-2">
                            {areaData.map((area) => {
                                const resolveRate = area.reports > 0 ? Math.round((area.resolved / area.reports) * 100) : 0;
                                return (
                                    <div key={area.area} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium">{area.area}</span>
                                            <span className="text-muted-foreground">{resolveRate}% resolved · {area.avgDays}d avg</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500" style={{ width: `${resolveRate}%` }} />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                            <span>{area.resolved} resolved</span>
                                            <span>{area.reports} total</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {areaData.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-4">No location data available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
