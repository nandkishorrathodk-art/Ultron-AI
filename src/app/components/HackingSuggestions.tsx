"use client";

import { useState } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

const HACKING_QUESTIONS = [
  (name?: string) =>
    name ? `What should we hack, ${name}?` : "What should we hack?",
  (name?: string) => (name ? `Got an idea, ${name}?` : "Got an idea?"),
  (name?: string) =>
    name ? `What are we testing today, ${name}?` : "What are we testing today?",
  (name?: string) =>
    name ? `Where do we start, ${name}?` : "Where do we start?",
  (name?: string) =>
    name ? `What's our target today, ${name}?` : "What's our target today?",
  (name?: string) =>
    name ? `What's on the scope today, ${name}?` : "What's on the scope today?",
  (name?: string) =>
    name
      ? `What are we exploiting today, ${name}?`
      : "What are we exploiting today?",
  (name?: string) =>
    name ? `Ready to find some vulns, ${name}?` : "Ready to find some vulns?",
  (name?: string) =>
    name ? `What's on your mind, ${name}?` : "What's on your mind?",
];

export const HackingSuggestions = ({ onSelectSuggestion }: { onSelectSuggestion?: (query: string) => void }) => {
  const { user } = useAuth();
  const name = user?.firstName || undefined;
  const [questionFn] = useState(
    () =>
      HACKING_QUESTIONS[Math.floor(Math.random() * HACKING_QUESTIONS.length)],
  );

  const suggestions = [
    { label: "Launch Autonomous Pentest", desc: "Hands-off target planning, exploitation, and automated reporting.", query: "start autonomous scan on target.com" },
    { label: "Web Directory Fuzzing", desc: "Run ffuf and technology discovery on public endpoints.", query: "scan testphp.vulnweb.com for hidden files" },
    { label: "Recon & Port Scan", desc: "Identify exposed network services and potential entry points.", query: "run network recon on scanme.nmap.org" }
  ];

  return (
    <div className="relative mb-6 flex flex-col items-center px-4 text-center">
      <h1 className="flex items-center gap-1 text-xl font-medium leading-none text-foreground sm:text-2xl md:gap-0 md:text-3xl mb-6">
        <span className="min-h-6 pt-0.5 tracking-tight sm:min-h-7 md:min-h-8 md:pt-0">
          {questionFn(name)}
        </span>
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mt-4">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSuggestion?.(s.query)}
            className="flex flex-col items-start text-left p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/80 hover:border-zinc-700 transition-all duration-200 group"
          >
            <span className="text-sm font-semibold text-zinc-100 group-hover:text-red-500 transition-colors duration-200">{s.label}</span>
            <span className="text-xs text-zinc-400 mt-1 leading-relaxed">{s.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
