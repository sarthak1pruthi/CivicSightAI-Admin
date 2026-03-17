"use client";

import { Sidebar, Header } from "@/components/layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/queries";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        getSession().then((session) => {
            if (!session) router.replace("/");
            else setChecking(false);
        });
    }, [router]);

    if (checking) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-background">
                <Sidebar />
                <div className="pl-[260px] transition-all duration-300">
                    <Header />
                    <main className="p-6">{children}</main>
                </div>
            </div>
        </TooltipProvider>
    );
}
