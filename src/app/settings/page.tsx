"use client";

import { useState, useEffect } from "react";
import { Settings, Key, Database, Globe, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [llmBaseUrl, setLlmBaseUrl] = useState("https://integrate.api.nvidia.com/v1");
  const [llmModel, setLlmModel] = useState("meta/llama-3.1-70b-instruct");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [e2bApiKey, setE2bApiKey] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [savingAI, setSavingAI] = useState(false);
  const [savingE2B, setSavingE2B] = useState(false);
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    // 1. First, check localStorage for client-side persistence
    const saved = localStorage.getItem("ultron_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.llmBaseUrl) setLlmBaseUrl(parsed.llmBaseUrl);
        if (parsed.llmModel) setLlmModel(parsed.llmModel);
        if (parsed.llmApiKey) setLlmApiKey(parsed.llmApiKey);
        if (parsed.e2bApiKey) setE2bApiKey(parsed.e2bApiKey);
      } catch (e) {
        console.error("Error parsing ultron_settings:", e);
      }
    }

    // 2. Fetch from backend to sync or pull loaded server env values
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          const s = data.settings;
          if (s.llmBaseUrl) setLlmBaseUrl(s.llmBaseUrl);
          if (s.llmModel) setLlmModel(s.llmModel);
          // If the backend has the keys but we don't have them in state, show placeholder
          if (s.llmApiKey && !llmApiKey) setLlmApiKey(s.llmApiKey);
          if (s.e2bApiKey && !e2bApiKey) setE2bApiKey(s.e2bApiKey);
        }
      })
      .catch((err) => console.error("Failed to load backend settings:", err))
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = async (type: "ai" | "e2b", values: any) => {
    if (type === "ai") setSavingAI(true);
    else setSavingE2B(true);

    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // Post to backend memory
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (data.success) {
        // Persist local overrides in localStorage
        const existing = localStorage.getItem("ultron_settings") || "{}";
        const current = JSON.parse(existing);
        const merged = { ...current, ...values };
        localStorage.setItem("ultron_settings", JSON.stringify(merged));

        setSuccessMsg(`Successfully saved ${type === "ai" ? "AI & Model" : "E2B Sandbox"} configurations!`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        throw new Error(data.error || "Failed to update settings");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred saving settings.");
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      if (type === "ai") setSavingAI(false);
      else setSavingE2B(false);
    }
  };

  const handleSaveAI = () => {
    saveSettings("ai", { llmBaseUrl, llmModel, llmApiKey });
  };

  const handleSaveE2B = () => {
    saveSettings("e2b", { e2bApiKey });
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
        <div className="max-w-3xl mx-auto space-y-8 pb-12">
          
          {successMsg && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading configurations...</p>
            </div>
          ) : (
            <>
              <Card className="border-muted bg-card/35 backdrop-blur-sm">
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
                    <label className="text-sm font-medium leading-none text-muted-foreground">Provider Base URL</label>
                    <Input 
                      value={llmBaseUrl} 
                      onChange={(e) => setLlmBaseUrl(e.target.value)}
                      placeholder="e.g. https://integrate.api.nvidia.com/v1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none text-muted-foreground">Model Name</label>
                    <Input 
                      value={llmModel} 
                      onChange={(e) => setLlmModel(e.target.value)}
                      placeholder="e.g. meta/llama-3.1-70b-instruct"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none text-muted-foreground">API Key</label>
                    <Input 
                      type="password" 
                      value={llmApiKey} 
                      onChange={(e) => setLlmApiKey(e.target.value)}
                      placeholder="nvapi-***************************"
                    />
                  </div>
                  <Button 
                    onClick={handleSaveAI} 
                    disabled={savingAI}
                    className="mt-2"
                  >
                    {savingAI ? "Saving AI Settings..." : "Save AI Settings"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-muted bg-card/35 backdrop-blur-sm">
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
                    <label className="text-sm font-medium leading-none text-muted-foreground">E2B API Key</label>
                    <Input 
                      type="password" 
                      value={e2bApiKey} 
                      onChange={(e) => setE2bApiKey(e.target.value)}
                      placeholder="e2b_********************************"
                    />
                  </div>
                  <Button 
                    onClick={handleSaveE2B}
                    disabled={savingE2B}
                    variant="outline" 
                    className="mt-2 hover:bg-muted/40"
                  >
                    {savingE2B ? "Updating E2B Key..." : "Update E2B Key"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-muted bg-card/10 border-dashed">
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
                      <label className="text-sm font-medium leading-none text-muted-foreground">Qdrant URL</label>
                      <Input defaultValue="http://localhost:6333" disabled className="bg-muted/15" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none text-muted-foreground">Memgraph (Neo4j) URI</label>
                      <Input defaultValue="bolt://localhost:7687" disabled className="bg-muted/15" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">These settings are currently loaded from .env.local and cannot be overridden at runtime.</p>
                </CardContent>
              </Card>
            </>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}
