<p align="center">
  <img src="public/icon-512x512.png" width="150" alt="Ultron-AI Logo">
</p>

<h1 align="center">Ultron-AI</h1>

<h2 align="center">The Ultimate AI-Powered Penetration Testing Platform</h2>

<div align="center">

[![License](https://img.shields.io/badge/License-Apache%202.0-red.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://typescriptlang.org)

</div>

## 🧠 What is Ultron-AI?

Ultron-AI is a next-generation AI pentesting platform that combines autonomous attack intelligence with production-grade infrastructure:

- **Penetration Task Graph (PTG)** — Hierarchical attack planning engine
- **Multi-Model AI** — NVIDIA NIM (primary) + OpenRouter fallback (Gemini, Claude, DeepSeek, Kimi)
- **E2B Sandbox** — Secure code execution in cloud VMs
- **Knowledge Graph** — Neo4j-backed persistent security findings
- **RAG Intelligence** — CVE/MITRE context via Qdrant vector search
- **Attack Chain Detection** — Automatic linking of vulnerability chains
- **Human-in-the-Loop** — Approval gates for high-risk commands
- **Real-time Observability** — Live pentest monitoring with audit logs

## 🚀 Getting Started

### Prerequisites

**Required:**
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- [Convex](https://www.convex.dev/) — Database and backend

**Optional (for full features):**
- [E2B](https://e2b.dev/) — Sandbox execution
- [OpenRouter](https://openrouter.ai/) — Multi-model AI
- [NVIDIA NIM](https://build.nvidia.com/) — Pentest-specific models
- [Stripe](https://stripe.com/) — Payments
- [Neo4j](https://neo4j.com/) — Knowledge graph
- [Qdrant](https://qdrant.tech/) — Vector search

### Setup

```bash
# Clone
git clone https://github.com/nandkishorrathodk-art/Ultron-AI.git
cd Ultron-AI

# Install dependencies
pnpm install

# Copy env file and configure
cp .env.example .env.local

# Start dev server (Next.js + Convex)
pnpm run dev
```

## 🏗️ Architecture

```
Ultron-AI/
├── src/
│   ├── app/           # Next.js App Router (26 routes)
│   ├── components/    # UI components (100+)
│   ├── lib/           # Core business logic
│   │   ├── agent/     # Pentest engine (PTG, coordinator, strategies)
│   │   ├── ai/        # AI providers + 10 tools
│   │   ├── chat/      # Chat processor, summarization
│   │   └── ...        # Auth, billing, rate-limit, etc.
│   ├── middleware.ts   # Custom JWT auth
│   └── types/         # TypeScript types
├── convex/            # Database (34 tables)
├── docker/            # Sandbox container
├── e2b/               # E2B sandbox templates
├── packages/          # Desktop + Local sandbox
├── trigger/           # Durable agent tasks
└── scripts/           # Admin scripts
```

## 📄 License

Apache 2.0 — See [LICENSE](LICENSE)
