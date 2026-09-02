"use client";

import { useState, useEffect } from "react";
import { 
  Monitor, 
  Terminal as TerminalIcon, 
  Globe, 
  Code as CodeIcon,
  X, 
  Minus, 
  Square, 
  Wifi, 
  Volume2, 
  Cpu, 
  Database,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Search,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

interface DesktopSimulatorProps {
  sessionId: string;
}

export function DesktopSimulator({ sessionId }: DesktopSimulatorProps) {
  // Window states: closed, open, minimized, maximized
  const [windows, setWindows] = useState({
    chrome: { isOpen: true, isMinimized: false, isMaximized: false, zIndex: 10 },
    terminal: { isOpen: true, isMinimized: false, isMaximized: false, zIndex: 5 },
    vscode: { isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
  });

  const [activeWindow, setActiveWindow] = useState<"chrome" | "terminal" | "vscode">("chrome");
  const [topZIndex, setTopZIndex] = useState(10);
  
  // Custom states inside apps
  const [chromeUrl, setChromeUrl] = useState("https://scanme.nmap.org");
  const [chromeInputUrl, setChromeInputUrl] = useState("https://scanme.nmap.org");
  const [systemState, setSystemState] = useState<"IDLE" | "SCANNING" | "EXPLOITING">("IDLE");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "Welcome to Ultron Security OS v2.0 (Debian stable)",
    "System initialized. Connection to coordinator established.",
    "root@e2b-sandbox:~# whoami",
    "root",
    "root@e2b-sandbox:~# status",
    "System Status: IDLE",
    "Ready for incoming penetration test requests..."
  ]);
  
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // System state cyclic simulation to look alive
  useEffect(() => {
    const states: ("IDLE" | "SCANNING" | "EXPLOITING")[] = ["IDLE", "SCANNING", "EXPLOITING"];
    let stateIdx = 0;
    
    const interval = setInterval(() => {
      stateIdx = (stateIdx + 1) % states.length;
      const nextState = states[stateIdx];
      setSystemState(nextState);
      
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      if (nextState === "SCANNING") {
        setTerminalOutput(prev => [
          ...prev.slice(-10),
          `[${timestamp}] root@e2b-sandbox:~# nmap -sV -sC -T4 scanme.nmap.org`,
          `[${timestamp}] Starting Nmap 7.93 ( https://nmap.org )`,
          `[${timestamp}] Nmap scan report for scanme.nmap.org (45.33.32.156)`,
          `[${timestamp}] Host is up (0.082s latency).`,
          `[${timestamp}] Not shown: 995 closed tcp ports (reset)`
        ]);
        setChromeUrl("https://scanme.nmap.org/running-recon");
        setChromeInputUrl("https://scanme.nmap.org/running-recon");
      } else if (nextState === "EXPLOITING") {
        setTerminalOutput(prev => [
          ...prev.slice(-10),
          `[${timestamp}] root@e2b-sandbox:~# metasploit-framework --run-exploit`,
          `[${timestamp}] [*] Exploit Target: scanme.nmap.org`,
          `[${timestamp}] [*] Attempting vulnerability verification...`,
          `[${timestamp}] [+] Target verified vulnerable! Injecting payload...`,
          `[${timestamp}] [*] Command shell session 1 opened.`
        ]);
        setChromeUrl("https://scanme.nmap.org/exploit-success");
        setChromeInputUrl("https://scanme.nmap.org/exploit-success");
      } else {
        setTerminalOutput(prev => [
          ...prev.slice(-10),
          `[${timestamp}] root@e2b-sandbox:~# clear && status`,
          `[${timestamp}] System Status: IDLE (Session active)`,
          `[${timestamp}] CPU Usage: 1.4% | RAM: 18% used`,
          `[${timestamp}] Waiting for next orchestrator command...`
        ]);
        setChromeUrl("https://scanme.nmap.org");
        setChromeInputUrl("https://scanme.nmap.org");
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const bringToFront = (windowName: "chrome" | "terminal" | "vscode") => {
    const nextZ = topZIndex + 1;
    setTopZIndex(nextZ);
    setWindows(prev => ({
      ...prev,
      [windowName]: {
        ...prev[windowName],
        zIndex: nextZ,
        isMinimized: false
      }
    }));
    setActiveWindow(windowName);
  };

  const toggleWindow = (windowName: "chrome" | "terminal" | "vscode") => {
    if (windows[windowName].isOpen && !windows[windowName].isMinimized) {
      // Minimize
      setWindows(prev => ({
        ...prev,
        [windowName]: { ...prev[windowName], isMinimized: true }
      }));
    } else {
      // Open / Restore
      setWindows(prev => ({
        ...prev,
        [windowName]: { ...prev[windowName], isOpen: true, isMinimized: false }
      }));
      bringToFront(windowName);
    }
  };

  const closeWindow = (e: React.MouseEvent, windowName: "chrome" | "terminal" | "vscode") => {
    e.stopPropagation();
    setWindows(prev => ({
      ...prev,
      [windowName]: { ...prev[windowName], isOpen: false }
    }));
  };

  const maximizeWindow = (e: React.MouseEvent, windowName: "chrome" | "terminal" | "vscode") => {
    e.stopPropagation();
    setWindows(prev => ({
      ...prev,
      [windowName]: { ...prev[windowName], isMaximized: !prev[windowName].isMaximized }
    }));
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChromeUrl(chromeInputUrl);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTerminalOutput(prev => [
      ...prev,
      `[${timestamp}] root@e2b-sandbox:~# curl -I ${chromeInputUrl}`,
      `[${timestamp}] HTTP/1.1 200 OK`,
      `[${timestamp}] Server: Apache/2.4.41 (Ubuntu)`,
      `[${timestamp}] Content-Type: text/html; charset=UTF-8`
    ]);
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 overflow-hidden flex flex-col font-sans select-none border border-muted/30 rounded-xl shadow-2xl">
      
      {/* Desktop Space */}
      <div className="flex-1 w-full relative p-4 overflow-hidden">
        
        {/* Sleek Grid/Cyber Mesh Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.45)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />
        
        {/* Desktop Shortcut Icons */}
        <div className="absolute top-4 left-4 flex flex-col gap-6 z-0">
          <div 
            onClick={() => toggleWindow("chrome")} 
            className="flex flex-col items-center justify-center w-20 h-20 rounded-xl hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer group text-center"
          >
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform shadow-lg shadow-blue-500/5">
              <Globe className="w-6 h-6" />
            </div>
            <span className="text-xs text-slate-200 mt-2 font-medium drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Google Chrome</span>
          </div>

          <div 
            onClick={() => toggleWindow("terminal")} 
            className="flex flex-col items-center justify-center w-20 h-20 rounded-xl hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer group text-center"
          >
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-lg shadow-emerald-500/5">
              <TerminalIcon className="w-6 h-6" />
            </div>
            <span className="text-xs text-slate-200 mt-2 font-medium drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Terminal</span>
          </div>

          <div 
            onClick={() => toggleWindow("vscode")} 
            className="flex flex-col items-center justify-center w-20 h-20 rounded-xl hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer group text-center"
          >
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shadow-lg shadow-amber-500/5">
              <CodeIcon className="w-6 h-6" />
            </div>
            <span className="text-xs text-slate-200 mt-2 font-medium drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">VS Code IDE</span>
          </div>
        </div>

        {/* Windows Container */}
        
        {/* 1. GOOGLE CHROME WINDOW */}
        {windows.chrome.isOpen && !windows.chrome.isMinimized && (
          <div 
            onClick={() => bringToFront("chrome")}
            className={`absolute flex flex-col bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden transition-all ${
              windows.chrome.isMaximized 
                ? "inset-0 m-0 z-50" 
                : "top-[10%] left-[10%] w-[75%] h-[70%] md:top-[12%] md:left-[15%] md:w-[70%] md:h-[68%]"
            }`}
            style={{ zIndex: windows.chrome.zIndex }}
          >
            {/* Window Header */}
            <div className="h-10 bg-slate-950 flex items-center justify-between px-3 border-b border-slate-800 shrink-0 cursor-default">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-300 font-medium">Google Chrome</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => toggleWindow("chrome")} 
                  className="w-6 h-6 hover:bg-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-slate-200"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => maximizeWindow(e, "chrome")} 
                  className="w-6 h-6 hover:bg-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-slate-200"
                >
                  <Square className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => closeWindow(e, "chrome")} 
                  className="w-6 h-6 hover:bg-red-500/80 hover:text-white rounded flex items-center justify-center text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Browser Control Bar */}
            <div className="h-10 bg-slate-900 flex items-center gap-2 px-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-1">
                <button className="w-6 h-6 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded flex items-center justify-center">
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button className="w-6 h-6 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button className="w-6 h-6 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded flex items-center justify-center">
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Address Bar */}
              <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 h-7 gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <input 
                  type="text" 
                  value={chromeInputUrl}
                  onChange={(e) => setChromeInputUrl(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-slate-300 w-full font-mono placeholder:text-slate-600 focus:ring-0" 
                />
              </form>
            </div>

            {/* Webpage Content Viewport */}
            <div className="flex-1 bg-slate-950 overflow-auto p-6 font-sans text-slate-300">
              {chromeUrl.includes("running-recon") ? (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <Globe className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Nmap Target Reconnaissance</h2>
                      <p className="text-xs text-slate-400">Scanning network perimeter of scanme.nmap.org...</p>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Status:</span>
                      <span className="text-blue-400 font-semibold animate-pulse">Running Port Scan</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full w-[65%] rounded-full animate-pulse" />
                    </div>
                    <div className="text-xs text-slate-500 font-mono space-y-1">
                      <p>&gt; Scanning open TCP ports (1-65535)...</p>
                      <p>&gt; Port 22 (SSH) detected: OPEN</p>
                      <p>&gt; Port 80 (HTTP) detected: OPEN</p>
                      <p>&gt; Port 9929 (nping-echo) detected: OPEN</p>
                    </div>
                  </div>
                </div>
              ) : chromeUrl.includes("exploit-success") ? (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                      <AlertTriangle className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white text-red-400">Exploitation Payload Injected!</h2>
                      <p className="text-xs text-slate-400">Security breach validation completed successfully</p>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-red-500/30 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-slate-300">
                      We have simulated a deterministic check path that successfully establishes shell access. Ultron AI agent has mapped out the local network topography.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Remote control terminal session open in background (E2B VM)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Home landing */}
                  <div className="text-center py-6 space-y-2">
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Nmap Security Lab</h1>
                    <p className="text-sm text-slate-400">Welcome to scanme.nmap.org. Dedicated node for security diagnostics.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                      <h3 className="font-semibold text-white text-sm">Security Diagnostic Rules</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Authorized scanners may audit the open ports on this node. Please preserve server resources and limit concurrent connections.
                      </p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                      <h3 className="font-semibold text-white text-sm">Active Services</h3>
                      <ul className="text-xs text-slate-400 space-y-1.5 font-mono">
                        <li className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Apache HTTP Server
                        </li>
                        <li className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          OpenSSH daemon
                        </li>
                        <li className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Nping Echo Service
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. TERMINAL WINDOW */}
        {windows.terminal.isOpen && !windows.terminal.isMinimized && (
          <div 
            onClick={() => bringToFront("terminal")}
            className={`absolute flex flex-col bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden transition-all ${
              windows.terminal.isMaximized 
                ? "inset-0 m-0 z-50" 
                : "top-[20%] left-[25%] w-[65%] h-[60%] md:top-[25%] md:left-[30%] md:w-[60%] md:h-[55%]"
            }`}
            style={{ zIndex: windows.terminal.zIndex }}
          >
            {/* Window Header */}
            <div className="h-10 bg-slate-900 flex items-center justify-between px-3 border-b border-slate-800 shrink-0 cursor-default">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-300 font-mono">root@e2b-sandbox: ~ (bash)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => toggleWindow("terminal")} 
                  className="w-6 h-6 hover:bg-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-slate-200"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => maximizeWindow(e, "terminal")} 
                  className="w-6 h-6 hover:bg-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-slate-200"
                >
                  <Square className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => closeWindow(e, "terminal")} 
                  className="w-6 h-6 hover:bg-red-500/80 hover:text-white rounded flex items-center justify-center text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 p-4 font-mono text-xs text-emerald-400 overflow-y-auto space-y-1.5 selection:bg-emerald-500/30 selection:text-emerald-200 scrollbar-thin">
              {terminalOutput.map((line, idx) => (
                <p key={idx} className="leading-relaxed whitespace-pre-wrap">{line}</p>
              ))}
              <div className="flex items-center gap-1.5 mt-1 shrink-0">
                <span className="text-blue-400 font-bold">root@e2b-sandbox:~#</span>
                <span className="text-slate-100 animate-pulse font-semibold">_</span>
                {systemState === "IDLE" && (
                  <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 text-[10px] ml-auto font-sans font-bold tracking-wider animate-pulse">
                    IDLE
                  </span>
                )}
                {systemState === "SCANNING" && (
                  <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5 text-[10px] ml-auto font-sans font-bold tracking-wider animate-pulse">
                    SCANNING
                  </span>
                )}
                {systemState === "EXPLOITING" && (
                  <span className="text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5 text-[10px] ml-auto font-sans font-bold tracking-wider animate-pulse">
                    EXPLOITING
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. VS CODE IDE WINDOW */}
        {windows.vscode.isOpen && !windows.vscode.isMinimized && (
          <div 
            onClick={() => bringToFront("vscode")}
            className={`absolute flex flex-col bg-[#1e1e1e] border border-slate-800 rounded-xl shadow-2xl overflow-hidden transition-all ${
              windows.vscode.isMaximized 
                ? "inset-0 m-0 z-50" 
                : "top-[15%] left-[20%] w-[68%] h-[65%] md:top-[18%] md:left-[22%] md:w-[65%] md:h-[60%]"
            }`}
            style={{ zIndex: windows.vscode.zIndex }}
          >
            {/* Window Header */}
            <div className="h-10 bg-[#181818] flex items-center justify-between px-3 border-b border-slate-800 shrink-0 cursor-default">
              <div className="flex items-center gap-2">
                <CodeIcon className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-slate-300 font-mono">findings.md — Ultron IDE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => toggleWindow("vscode")} 
                  className="w-6 h-6 hover:bg-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-slate-200"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => maximizeWindow(e, "vscode")} 
                  className="w-6 h-6 hover:bg-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-slate-200"
                >
                  <Square className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => closeWindow(e, "vscode")} 
                  className="w-6 h-6 hover:bg-red-500/80 hover:text-white rounded flex items-center justify-center text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* IDE Workspace body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <div className="w-44 bg-[#252526] border-r border-[#1e1e1e] p-2 flex flex-col shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 tracking-wider">Workspace</span>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-200 bg-slate-700/30 px-2 py-1 rounded cursor-pointer">
                    <span className="text-amber-500 text-xs">M</span>
                    <span className="font-mono">findings.md</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded cursor-pointer">
                    <span className="text-blue-400 text-xs">C</span>
                    <span className="font-mono">recon.json</span>
                  </div>
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 bg-[#1e1e1e] p-4 overflow-auto font-mono text-xs text-slate-300">
                <div className="space-y-1">
                  <p className="text-slate-500">1  # Ultron Autonomous Security Report</p>
                  <p className="text-slate-500">2  </p>
                  <p className="text-slate-500">3  ## Vulnerability Assessment Summary</p>
                  <p><span className="text-slate-500">4</span>  - **Target Host:** <span className="text-emerald-400">scanme.nmap.org</span></p>
                  <p><span className="text-slate-500">5</span>  - **Status:** <span className="text-blue-400 animate-pulse">{systemState === "IDLE" ? "Idle - Awaiting input" : "Scanning / Active Checks in progress"}</span></p>
                  <p><span className="text-slate-500">6</span>  - **Identified Ports:** 22, 80, 9929</p>
                  <p><span className="text-slate-500">7</span>  </p>
                  <p className="text-slate-500">8  ## Active Exploits Run</p>
                  <p><span className="text-slate-500">9</span>  * Exploit module targeting web listener verified...</p>
                  <p><span className="text-slate-500">10</span>  * Session payload: <span className="text-emerald-400">meterpreter/reverse_tcp</span> active</p>
                  <p className="text-slate-500">11  </p>
                  <p className="text-slate-500">12  <span className="animate-pulse text-amber-500">|</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* OS Taskbar (Bottom Panel) */}
      <div className="h-12 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-between px-3 z-50 shrink-0 select-none">
        
        {/* Left Side: Start Menu & Quick Apps */}
        <div className="flex items-center gap-1.5">
          <div className="w-9 h-9 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-lg flex items-center justify-center text-primary cursor-pointer active:scale-95 transition-all">
            <Monitor className="w-4.5 h-4.5" />
          </div>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          {/* Quick Launch / Open Windows Taskbar tabs */}
          <button 
            onClick={() => toggleWindow("chrome")}
            className={`h-9 px-3 rounded-lg flex items-center gap-2 border transition-all text-xs font-medium ${
              windows.chrome.isOpen && !windows.chrome.isMinimized
                ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Browser</span>
          </button>

          <button 
            onClick={() => toggleWindow("terminal")}
            className={`h-9 px-3 rounded-lg flex items-center gap-2 border transition-all text-xs font-medium ${
              windows.terminal.isOpen && !windows.terminal.isMinimized
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Terminal</span>
          </button>

          <button 
            onClick={() => toggleWindow("vscode")}
            className={`h-9 px-3 rounded-lg flex items-center gap-2 border transition-all text-xs font-medium ${
              windows.vscode.isOpen && !windows.vscode.isMinimized
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <CodeIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">VS Code</span>
          </button>
        </div>

        {/* Right Side: Status widgets, Wi-Fi, Resource Meter, Time */}
        <div className="flex items-center gap-3.5 text-slate-400 text-xs">
          
          {/* Status badge */}
          <div className="flex items-center gap-1.5 bg-slate-950/50 border border-slate-800 rounded-full px-2.5 py-1 text-[10px] font-semibold">
            <span className={`w-1.5 h-1.5 rounded-full ${
              systemState === "IDLE" ? "bg-emerald-500 animate-pulse" :
              systemState === "SCANNING" ? "bg-blue-500 animate-pulse" : "bg-red-500 animate-ping"
            }`} />
            <span className={
              systemState === "IDLE" ? "text-emerald-400" :
              systemState === "SCANNING" ? "text-blue-400" : "text-red-400"
            }>
              OS: {systemState}
            </span>
          </div>

          <div className="flex items-center gap-1 hover:text-slate-200 cursor-default" title="Micro-VM Resources">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline font-mono">2.4%</span>
          </div>

          <div className="flex items-center gap-1 hover:text-slate-200 cursor-default font-mono" title="Convex DB Connected">
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden md:inline">Synced</span>
          </div>

          <div className="flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5 text-slate-400" />
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Clock */}
          <div className="font-mono font-medium text-slate-200 tracking-wider">
            {currentTime || "12:00:00"}
          </div>
        </div>

      </div>

    </div>
  );
}
