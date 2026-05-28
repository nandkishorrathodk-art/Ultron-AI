"use client";

import "./landing.css";
import Link from "next/link";
import { useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════════════
   ULTRON-AI — Premium Landing Page
   XBOW-Inspired • Dark Theme • Blood Red Accent
   ═══════════════════════════════════════════════════════════════════════════════ */

// ─── SVG Icon Components ──────────────────────────────────────────────────────
function ShieldIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BrainIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A5.5 5.5 0 0 0 4 7.5c0 1.58.7 3 1.8 4L12 21l6.2-9.5A5.5 5.5 0 0 0 14.5 2h-5z" />
      <path d="M12 2v6" /><path d="M9 8h6" />
    </svg>
  );
}

function TargetIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function LinkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function EyeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function CodeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function ZapIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function TerminalIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  );
}

function ArrowRightIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function DatabaseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function NetworkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="6" rx="1" /><rect x="16" y="16" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><path d="M12 8v4" /><path d="M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ServerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="8" x="2" y="2" rx="2" /><rect width="20" height="8" x="2" y="14" rx="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UserCheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scroll-reveal animation observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    const elements = document.querySelectorAll(".animate-in");
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  // Feature card mouse tracking for radial glow
  const handleCardMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div className="landing-page">
      {/* ═══ Navigation ═══ */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/landing" className="nav-logo">
            <div className="nav-logo-icon">
              <ShieldIcon size={20} />
            </div>
            <span className="nav-logo-text">ULTRON</span>
          </Link>

          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#architecture" className="nav-link">Architecture</a>
            <a href="#comparison" className="nav-link">Compare</a>
            <a href="#tech" className="nav-link">Tech Stack</a>
            <Link href="/" className="nav-cta">
              Launch Console <ChevronRightIcon size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ Hero Section ═══ */}
      <section className="hero-section landing-section">
        <div className="hero-bg">
          <div className="hero-glow" />
          <div className="hero-grid" />

          {/* SVG flowing lines */}
          <svg className="hero-svg-lines" viewBox="0 0 1440 900" preserveAspectRatio="none">
            <path d="M0,400 C200,350 400,500 600,400 C800,300 1000,450 1200,380 C1350,340 1440,400 1440,400" />
            <path d="M0,500 C150,450 350,550 550,480 C750,410 950,520 1150,460 C1300,420 1440,500 1440,500" />
            <path d="M0,300 C250,280 450,380 650,320 C850,260 1050,350 1250,300 C1380,270 1440,300 1440,300" />
          </svg>

          {/* Floating particles */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${10 + (i * 7.5) % 85}%`,
                top: `${20 + (i * 13) % 60}%`,
                animation: `float ${4 + (i % 3)}s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Autonomous Penetration Testing Platform
          </div>

          <h1 className="hero-title">
            The Mind of a<br />
            <span className="hero-title-accent">Hacker.</span>{" "}
            The Speed of a{" "}
            <span className="hero-title-accent">Machine.</span>
          </h1>

          <p className="hero-subtitle">
            Ultron is an AI-driven offensive security system that autonomously
            discovers, validates, and exploits vulnerabilities — with the strategic
            thinking of an expert penetration tester.
          </p>

          <div className="hero-actions">
            <Link href="/" className="btn-primary">
              <TerminalIcon size={18} />
              Launch Console
            </Link>
            <a href="#features" className="btn-secondary">
              <EyeIcon size={18} />
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* ═══ Stats Row ═══ */}
      <section className="landing-section">
        <div className="stats-row">
          <div className="stat-item animate-in">
            <div className="stat-number">8</div>
            <div className="stat-label">AI Modules</div>
          </div>
          <div className="stat-item animate-in">
            <div className="stat-number">48+</div>
            <div className="stat-label">Step Attack Chains</div>
          </div>
          <div className="stat-item animate-in">
            <div className="stat-number">6</div>
            <div className="stat-label">Attack Flow Modes</div>
          </div>
          <div className="stat-item animate-in">
            <div className="stat-number">20+</div>
            <div className="stat-label">MITRE Techniques</div>
          </div>
        </div>
      </section>

      {/* ═══ Features Grid ═══ */}
      <section id="features" className="landing-section">
        <div className="section-inner">
          <div className="animate-in">
            <div className="section-label">Core Capabilities</div>
            <h2 className="section-title">
              Engineered for<br />
              <span className="gradient-text">Autonomous Offense</span>
            </h2>
            <p className="section-desc">
              Every module is purpose-built for offensive security — from intelligent
              reconnaissance to fully automated vulnerability chaining.
            </p>
          </div>

          <div className="features-grid stagger-children">
            <div className="feature-card animate-in" onMouseMove={handleCardMouseMove}>
              <div className="feature-icon"><NetworkIcon size={22} /></div>
              <h3 className="feature-title">Penetration Task Graph</h3>
              <p className="feature-desc">
                DAG-based attack planning engine that maps dependency chains between
                reconnaissance, enumeration, exploitation, and post-exploitation
                phases. Adapts paths in real-time based on discovered attack surface.
              </p>
            </div>
            <div className="feature-card animate-in" onMouseMove={handleCardMouseMove}>
              <div className="feature-icon"><BrainIcon size={22} /></div>
              <h3 className="feature-title">Adaptive Strategy Engine</h3>
              <p className="feature-desc">
                8-level escalation system for WAF bypass, encoding mutation, rate limit
                evasion, and payload polymorphism. Learns from failed attempts and
                pivots automatically to higher-order techniques.
              </p>
            </div>
            <div className="feature-card animate-in" onMouseMove={handleCardMouseMove}>
              <div className="feature-icon"><UserCheckIcon size={22} /></div>
              <h3 className="feature-title">Human-in-the-Loop Gates</h3>
              <p className="feature-desc">
                3-tier risk classification system (Green/Yellow/Red) with mandatory
                approval gates for high-risk operations. Full control without
                interrupting the autonomous workflow.
              </p>
            </div>
            <div className="feature-card animate-in" onMouseMove={handleCardMouseMove}>
              <div className="feature-icon"><LinkIcon size={22} /></div>
              <h3 className="feature-title">Vulnerability Chaining</h3>
              <p className="feature-desc">
                Automatically detects multi-step attack paths by combining low-severity
                vulnerabilities into critical exploit chains. SSRF → IAM → RCE
                escalation paths discovered autonomously.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Terminal Demo ═══ */}
      <section className="landing-section">
        <div className="section-inner">
          <div className="animate-in" style={{ textAlign: "center" }}>
            <div className="section-label">Live Interface</div>
            <h2 className="section-title" style={{ marginLeft: "auto", marginRight: "auto" }}>
              Watch Ultron <span className="gradient-text">Think</span>
            </h2>
          </div>

          <div className="terminal-block animate-in">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green" />
              <span style={{ marginLeft: 12, fontSize: 12, color: "var(--ultron-text-muted)" }}>
                ultron@kali:~
              </span>
            </div>
            <div className="terminal-body">
              <div className="terminal-line">
                <span className="terminal-prompt">❯</span>
                <span className="terminal-cmd">ultron scan --target example.com --mode bug_bounty</span>
              </div>
              <div className="terminal-output" style={{ marginTop: 12 }}>
                <div style={{ color: "var(--ultron-accent)" }}>
                  [●] Ultron v2.0 — Autonomous Penetration Testing Engine
                </div>
                <div style={{ marginTop: 8 }}>
                  [→] Phase 1: Reconnaissance ........................ <span style={{ color: "#27c93f" }}>COMPLETE</span>
                </div>
                <div>
                  [→] Phase 2: Enumeration ........................... <span style={{ color: "#27c93f" }}>COMPLETE</span>
                </div>
                <div>
                  [→] Phase 3: Vulnerability Discovery .............. <span style={{ color: "#27c93f" }}>COMPLETE</span>
                </div>
                <div>
                  [→] Phase 4: Exploitation ......................... <span style={{ color: "#ffbd2e" }}>IN PROGRESS</span>
                </div>
                <div style={{ marginTop: 12, color: "var(--ultron-text-secondary)" }}>
                  Found 3 critical, 7 high, 12 medium vulnerabilities
                </div>
                <div style={{ color: "var(--ultron-accent)" }}>
                  [!] Chain detected: SSRF → IAM Escalation → RCE (Critical)
                </div>
                <div style={{ color: "var(--ultron-text-muted)", marginTop: 8 }}>
                  [HITL] ⚠ High-risk operation requires approval — awaiting operator...
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Architecture Flow ═══ */}
      <section id="architecture" className="landing-section">
        <div className="section-inner">
          <div className="animate-in" style={{ textAlign: "center" }}>
            <div className="section-label">Attack Pipeline</div>
            <h2 className="section-title" style={{ marginLeft: "auto", marginRight: "auto" }}>
              Five-Phase <span className="gradient-text">Kill Chain</span>
            </h2>
            <p className="section-desc" style={{ marginLeft: "auto", marginRight: "auto" }}>
              Ultron operates through a structured five-phase attack pipeline,
              each powered by specialized AI modules working in concert.
            </p>
          </div>

          <div className="arch-flow stagger-children">
            <div className="arch-node animate-in">
              <div className="arch-node-icon"><SearchIcon size={20} /></div>
              <div className="arch-node-label">Recon</div>
              <div className="arch-node-sub">OSINT • Subdomain</div>
            </div>
            <div className="arch-arrow animate-in">→</div>
            <div className="arch-node animate-in">
              <div className="arch-node-icon"><EyeIcon size={20} /></div>
              <div className="arch-node-label">Enumerate</div>
              <div className="arch-node-sub">Ports • Services</div>
            </div>
            <div className="arch-arrow animate-in">→</div>
            <div className="arch-node animate-in">
              <div className="arch-node-icon"><TargetIcon size={20} /></div>
              <div className="arch-node-label">Discover</div>
              <div className="arch-node-sub">CVE • Fuzzing</div>
            </div>
            <div className="arch-arrow animate-in">→</div>
            <div className="arch-node animate-in">
              <div className="arch-node-icon"><ZapIcon size={20} /></div>
              <div className="arch-node-label">Exploit</div>
              <div className="arch-node-sub">Validate • Chain</div>
            </div>
            <div className="arch-arrow animate-in">→</div>
            <div className="arch-node animate-in">
              <div className="arch-node-icon"><LockIcon size={20} /></div>
              <div className="arch-node-label">Post-Exploit</div>
              <div className="arch-node-sub">Persist • Report</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Comparison Table ═══ */}
      <section id="comparison" className="landing-section">
        <div className="section-inner">
          <div className="animate-in">
            <div className="section-label">Advantage</div>
            <h2 className="section-title">
              Why <span className="gradient-text">Ultron</span> Over<br />
              Traditional Pentesting?
            </h2>
            <p className="section-desc">
              Human pentesters are brilliant but constrained by time, fatigue,
              and linear thinking. Ultron eliminates those bottlenecks.
            </p>
          </div>

          <div className="animate-in" style={{ overflowX: "auto" }}>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Traditional Pentesting</th>
                  <th>Ultron AI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Speed</td>
                  <td className="cross">Days to weeks</td>
                  <td className="check">Minutes to hours</td>
                </tr>
                <tr>
                  <td>Coverage</td>
                  <td className="cross">Limited by time</td>
                  <td className="check">Full attack surface</td>
                </tr>
                <tr>
                  <td>Consistency</td>
                  <td className="cross">Varies by tester</td>
                  <td className="check">Deterministic & repeatable</td>
                </tr>
                <tr>
                  <td>Vulnerability Chaining</td>
                  <td className="cross">Manual & rare</td>
                  <td className="check">Automated multi-step</td>
                </tr>
                <tr>
                  <td>24/7 Availability</td>
                  <td className="cross">Business hours</td>
                  <td className="check">Continuous scanning</td>
                </tr>
                <tr>
                  <td>Adaptive Bypass</td>
                  <td className="cross">Experience-dependent</td>
                  <td className="check">8-level auto-escalation</td>
                </tr>
                <tr>
                  <td>Intelligence Memory</td>
                  <td className="cross">Notes & reports</td>
                  <td className="check">4-tier persistent memory</td>
                </tr>
                <tr>
                  <td>Cost</td>
                  <td className="cross">$10K–$50K per engagement</td>
                  <td className="check">Fraction of the cost</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ Technology Stack ═══ */}
      <section id="tech" className="landing-section">
        <div className="section-inner">
          <div className="animate-in" style={{ textAlign: "center" }}>
            <div className="section-label">Powered By</div>
            <h2 className="section-title" style={{ marginLeft: "auto", marginRight: "auto" }}>
              Enterprise-Grade <span className="gradient-text">Tech Stack</span>
            </h2>
          </div>

          <div className="tech-grid stagger-children">
            <div className="tech-item animate-in">
              <div className="tech-icon"><BrainIcon size={22} /></div>
              <div className="tech-name">OpenRouter</div>
              <div className="tech-desc">Multi-LLM Backend</div>
            </div>
            <div className="tech-item animate-in">
              <div className="tech-icon"><ServerIcon size={22} /></div>
              <div className="tech-name">E2B Sandbox</div>
              <div className="tech-desc">Persistent Linux VM</div>
            </div>
            <div className="tech-item animate-in">
              <div className="tech-icon"><DatabaseIcon size={22} /></div>
              <div className="tech-name">Qdrant</div>
              <div className="tech-desc">Vector Intelligence</div>
            </div>
            <div className="tech-item animate-in">
              <div className="tech-icon"><NetworkIcon size={22} /></div>
              <div className="tech-name">Neo4j</div>
              <div className="tech-desc">Knowledge Graph</div>
            </div>
            <div className="tech-item animate-in">
              <div className="tech-icon"><CodeIcon size={22} /></div>
              <div className="tech-name">Next.js</div>
              <div className="tech-desc">React Framework</div>
            </div>
            <div className="tech-item animate-in">
              <div className="tech-icon"><ShieldIcon size={22} /></div>
              <div className="tech-name">MITRE ATT&CK</div>
              <div className="tech-desc">Threat Framework</div>
            </div>
            <div className="tech-item animate-in">
              <div className="tech-icon"><ZapIcon size={22} /></div>
              <div className="tech-name">Convex</div>
              <div className="tech-desc">Real-time Database</div>
            </div>
            <div className="tech-item animate-in">
              <div className="tech-icon"><SearchIcon size={22} /></div>
              <div className="tech-name">Tavily + Serper</div>
              <div className="tech-desc">OSINT Search APIs</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA Section ═══ */}
      <section className="landing-section cta-section">
        <div className="cta-glow" />
        <div className="section-inner" style={{ paddingTop: 120, paddingBottom: 120 }}>
          <div className="animate-in">
            <h2 className="cta-title">
              Ready to Deploy<br />
              <span className="gradient-text">Your AI Hacker?</span>
            </h2>
            <p className="cta-desc">
              Stop relying on manual pentests. Let Ultron autonomously discover
              what humans miss — at machine speed, with hacker-level intelligence.
            </p>
          </div>
          <div className="animate-in" style={{ position: "relative", zIndex: 1 }}>
            <Link href="/" className="btn-primary" style={{ fontSize: 17, padding: "16px 40px" }}>
              <TerminalIcon size={20} />
              Launch Ultron Console
              <ArrowRightIcon size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-left">
            <div className="footer-logo">
              <ShieldIcon size={14} />
            </div>
            <span className="footer-name">Ultron AI</span>
            <span className="footer-copy">© {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="footer-links">
            <a href="#features" className="footer-link">Features</a>
            <a href="#architecture" className="footer-link">Architecture</a>
            <a href="#comparison" className="footer-link">Compare</a>
            <a href="#tech" className="footer-link">Stack</a>
            <Link href="/" className="footer-link">Console</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
