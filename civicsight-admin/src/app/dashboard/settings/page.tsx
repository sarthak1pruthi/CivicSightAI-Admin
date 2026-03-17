"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Plus,
    Pencil,
    Trash2,
    Save,
    Bell,
    Key,
    Settings2,
    Tag,
    Check,
    Loader2,
    AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";

type Category = {
    id: number;
    name: string;
    group: string;
    reportCount: number;
};

export default function SettingsPage() {
    // Categories
    const [categories, setCategories] = useState<Category[]>([]);
    const [editCategory, setEditCategory] = useState<Category | null>(null);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [newCatGroup, setNewCatGroup] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Notifications
    const [notifNewReport, setNotifNewReport] = useState(true);
    const [notifStatusChange, setNotifStatusChange] = useState(true);
    const [notifWeeklyDigest, setNotifWeeklyDigest] = useState(false);
    const [notifCritical, setNotifCritical] = useState(true);
    const [notifEmail, setNotifEmail] = useState("");

    // General
    const [orgName, setOrgName] = useState("");
    const [mapRegion, setMapRegion] = useState("");
    const [aiThreshold, setAiThreshold] = useState("75");
    const [saveSuccess, setSaveSuccess] = useState(false);

    const loadCategories = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await apiFetch<{
                categories: Category[];
                admin: { email: string; full_name: string } | null;
            }>("/api/categories?include=settings");

            setCategories(data.categories);

            if (data.admin) {
                setNotifEmail(data.admin.email);
                setOrgName("CivicSight AI");
                setMapRegion("Greater Toronto Area");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load settings");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadCategories(); }, [loadCategories]);

    // Category CRUD — persisted to Supabase
    const handleAddCategory = async () => {
        if (!newCatName.trim() || !newCatGroup.trim()) return;
        try {
            const data = await apiFetch<{ id: number; name: string; category_group: string }>("/api/categories", {
                method: "POST",
                body: JSON.stringify({ name: newCatName.trim(), category_group: newCatGroup.trim() }),
            });
            setCategories((prev) => [...prev, { id: data.id, name: data.name, group: data.category_group, reportCount: 0 }]);
            setNewCatName("");
            setNewCatGroup("");
            setShowAddCategory(false);
        } catch (err) {
            console.error("Failed to add category:", err);
        }
    };

    const handleDeleteCategory = async (id: number) => {
        try {
            await apiFetch("/api/categories", {
                method: "DELETE",
                body: JSON.stringify({ id }),
            });
            setCategories((prev) => prev.filter((c) => c.id !== id));
        } catch (err) {
            console.error("Failed to delete category:", err);
        }
    };

    const handleEditCategory = async () => {
        if (!editCategory) return;
        try {
            await apiFetch("/api/categories", {
                method: "PATCH",
                body: JSON.stringify({ id: editCategory.id, name: editCategory.name, category_group: editCategory.group }),
            });
            setCategories((prev) => prev.map((c) => (c.id === editCategory.id ? editCategory : c)));
            setEditCategory(null);
        } catch (err) {
            console.error("Failed to update category:", err);
        }
    };

    // General save
    const handleSaveGeneral = () => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading settings...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
                <AlertTriangle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button size="sm" onClick={loadCategories}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Tabs defaultValue="categories" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-3 h-9">
                    <TabsTrigger value="categories" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        Categories
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="text-xs">
                        <Bell className="w-3 h-3 mr-1" />
                        Notifications
                    </TabsTrigger>
                    <TabsTrigger value="general" className="text-xs">
                        <Settings2 className="w-3 h-3 mr-1" />
                        General
                    </TabsTrigger>
                </TabsList>

                {/* ======== CATEGORIES ======== */}
                <TabsContent value="categories" className="mt-4 space-y-4">
                    <Card className="border-border/50">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm">Report Categories</CardTitle>
                                    <CardDescription className="text-xs mt-1">
                                        Manage the categories used for AI report classification
                                    </CardDescription>
                                </div>
                                <Button
                                    size="sm"
                                    className="text-xs h-8"
                                    onClick={() => setShowAddCategory(true)}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    Add Category
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                                {categories.map((cat) => (
                                    <div
                                        key={cat.id}
                                        className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <p className="text-sm font-medium">{cat.name}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {cat.group}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                                                {cat.reportCount} reports
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="w-7 h-7 text-muted-foreground hover:text-foreground"
                                                onClick={() => setEditCategory({ ...cat })}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDeleteCategory(cat.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ======== NOTIFICATIONS ======== */}
                <TabsContent value="notifications" className="mt-4 space-y-4">
                    <Card className="border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Email Notifications</CardTitle>
                            <CardDescription className="text-xs">
                                Configure when and how you receive notifications
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-medium">Notification Email</Label>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Where notifications will be sent
                                    </p>
                                </div>
                                <Input
                                    value={notifEmail}
                                    onChange={(e) => setNotifEmail(e.target.value)}
                                    className="w-64 h-9 text-sm"
                                />
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                {[
                                    {
                                        label: "New Report Submitted",
                                        desc: "Get notified when a citizen submits a new report",
                                        checked: notifNewReport,
                                        setter: setNotifNewReport,
                                    },
                                    {
                                        label: "Status Changes",
                                        desc: "Notifications when a report status is updated",
                                        checked: notifStatusChange,
                                        setter: setNotifStatusChange,
                                    },
                                    {
                                        label: "Weekly Digest",
                                        desc: "Receive a summary of all activity every Monday",
                                        checked: notifWeeklyDigest,
                                        setter: setNotifWeeklyDigest,
                                    },
                                    {
                                        label: "Critical Alerts",
                                        desc: "Immediate notification for critical severity reports",
                                        checked: notifCritical,
                                        setter: setNotifCritical,
                                    },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex items-center justify-between py-1"
                                    >
                                        <div>
                                            <Label className="text-sm font-medium">
                                                {item.label}
                                            </Label>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                {item.desc}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={item.checked}
                                            onCheckedChange={item.setter}
                                        />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ======== GENERAL ======== */}
                <TabsContent value="general" className="mt-4 space-y-4">
                    <Card className="border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">General Settings</CardTitle>
                            <CardDescription className="text-xs">
                                Configure your organization and system preferences
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Organization Name</Label>
                                    <Input
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Default Map Region</Label>
                                    <Input
                                        value={mapRegion}
                                        onChange={(e) => setMapRegion(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs">AI Confidence Threshold (%)</Label>
                                <div className="flex items-center gap-3">
                                    <Input
                                        type="number"
                                        value={aiThreshold}
                                        onChange={(e) => setAiThreshold(e.target.value)}
                                        className="h-9 text-sm w-24"
                                        min="0"
                                        max="100"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Reports below this confidence level will be flagged for manual review
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-end gap-2">
                                {saveSuccess && (
                                    <span className="text-xs text-success font-medium flex items-center gap-1 animate-fade-in-up">
                                        <Check className="w-3.5 h-3.5" />
                                        Settings saved!
                                    </span>
                                )}
                                <Button
                                    size="sm"
                                    className="text-xs h-8"
                                    onClick={handleSaveGeneral}
                                >
                                    <Save className="w-3.5 h-3.5 mr-1" />
                                    Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Add Category Dialog */}
            <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Add Category</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="space-y-2">
                            <Label className="text-xs">Category Name</Label>
                            <Input
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                placeholder="e.g. Noise Complaints"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Group</Label>
                            <Input
                                value={newCatGroup}
                                onChange={(e) => setNewCatGroup(e.target.value)}
                                placeholder="e.g. Public Safety"
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAddCategory(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" className="text-xs" onClick={handleAddCategory}>
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Category
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Category Dialog */}
            <Dialog open={!!editCategory} onOpenChange={(open) => !open && setEditCategory(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                    </DialogHeader>
                    {editCategory && (
                        <div className="space-y-4 mt-2">
                            <div className="space-y-2">
                                <Label className="text-xs">Category Name</Label>
                                <Input
                                    value={editCategory.name}
                                    onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Group</Label>
                                <Input
                                    value={editCategory.group}
                                    onChange={(e) => setEditCategory({ ...editCategory, group: e.target.value })}
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="mt-4">
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditCategory(null)}>
                            Cancel
                        </Button>
                        <Button size="sm" className="text-xs" onClick={handleEditCategory}>
                            <Save className="w-3.5 h-3.5 mr-1" />
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
