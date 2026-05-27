"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Settings, Terminal, Shield, PlusCircle } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  {
    title: "New Pentest",
    url: "/",
    icon: PlusCircle,
  },
  {
    title: "Agent Sandbox",
    url: "/sandbox",
    icon: Terminal,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [recentScans, setRecentScans] = useState<string[]>([]);

  useEffect(() => {
    // 1. Initial load of recent sessions from active sandboxes API
    const fetchActiveSessions = () => {
      fetch("/api/sandboxes")
        .then((res) => res.json())
        .then((data) => {
          const activeSbs = data.sandboxes ?? [];
          const sessionIds = activeSbs.map((sb: any) => sb.sessionId);
          
          // Merge with stored sessions from localStorage for persistence
          const stored = localStorage.getItem("ultron_recent_scans");
          let scans = sessionIds;
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              // deduplicate and maintain order
              scans = Array.from(new Set([...sessionIds, ...parsed]));
            } catch (e) {
              console.error(e);
            }
          }
          
          // Limit to last 5 scans
          const trimmed = scans.slice(0, 5);
          setRecentScans(trimmed);
          localStorage.setItem("ultron_recent_scans", JSON.stringify(trimmed));
        })
        .catch(() => {
          // Fallback to localStorage if API fails or auth is pending
          const stored = localStorage.getItem("ultron_recent_scans");
          if (stored) {
            try {
              setRecentScans(JSON.parse(stored).slice(0, 5));
            } catch {}
          }
        });
    };

    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 font-bold text-xl text-primary">
          <Shield className="w-6 h-6" />
          <span>Ultron</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<a href={item.url} />}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Recent Scans</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentScans.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground italic">
                  No recent scans
                </div>
              ) : (
                recentScans.map((scan) => (
                  <SidebarMenuItem key={scan}>
                    <SidebarMenuButton render={<a href={`/?sessionId=${scan}`} />}>
                      <MessageSquare className="w-4 h-4 mr-2 text-primary/70 shrink-0" />
                      <span className="truncate font-mono text-xs">
                        {scan.startsWith("session_") ? scan.replace("session_", "Session ") : scan}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t text-sm text-muted-foreground text-center">
        Ultron v3.0
      </SidebarFooter>
    </Sidebar>
  );
}
