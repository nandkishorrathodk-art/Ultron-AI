"use client";

import { useState } from "react";
import { Settings, Key, Database, Globe, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [toast, setToast] = useState<{ message: string; type: "info" | "warning" } | null>(null);

  const showToast = (message: string, type: "info" | "warning" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  return (
    <div className="flex flex-col h-full bg-background/95">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">Configure AI Providers, API Keys, and Database connections.</p>
        </div>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          
          <Card className="border-muted">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle>AI Provider (LLM)</CardTitle>
                  <CardDescription>Configure the Large Language Model used by the Agent Pipeline.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Provider Base URL</label>
                <Input defaultValue="https://integrate.api.nvidia.com/v1" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Model Name</label>
                <Input defaultValue="meta/llama-3.1-70b-instruct" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">API Key</label>
                <Input type="password" defaultValue="nvapi-***************************" />
              </div>
              <Button className="mt-2" onClick={() => showToast("Settings are loaded from .env.local — update your environment file and restart the server.", "warning")}>Save AI Settings</Button>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-yellow-500" />
                <div>
                  <CardTitle>E2B Sandbox</CardTitle>
                  <CardDescription>Configuration for the cloud code execution environment.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">E2B API Key</label>
                <Input type="password" defaultValue="e2b_********************************" />
              </div>
              <Button variant="outline" className="mt-2" onClick={() => showToast("E2B key is loaded from .env.local — update E2B_API_KEY in your environment file.", "warning")}>Update E2B Key</Button>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-500" />
                <div>
                  <CardTitle>Database Infrastructure</CardTitle>
                  <CardDescription>Qdrant Vector DB & Neo4j Knowledge Graph Connections.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Qdrant URL</label>
                  <Input defaultValue="http://localhost:6333" disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Memgraph (Neo4j) URI</label>
                  <Input defaultValue="bolt://localhost:7687" disabled />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">These settings are currently loaded from .env.local</p>
            </CardContent>
          </Card>

        </div>
      </ScrollArea>
      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm ${
          toast.type === "warning"
            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
            : "bg-green-500/10 border-green-500/30 text-green-400"
        }`}>
          {toast.type === "warning" ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 shrink-0" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
