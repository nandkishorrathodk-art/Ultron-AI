# Ultron v3.0 — ULTRON-X

AI-powered autonomous penetration testing platform with persistent sandbox, model fallback chain, and human-in-the-loop safety gates.

## Architecture

```
Client (Next.js 16 + React 19 + Tailwind 4 + shadcn/ui)
  ↓
Gateway (API Auth + Risk Classifier + Input Sanitization)
  ↓
Orchestrator (Flow Engine — 4-level hierarchy: Flow → Task → Subtask → Action)
  ↓
13 Specialist Agents (per-agent LLM assignment)
  ↓
MCP Tool Layer (Terminal, Browser, Search, File, Knowledge, Report)
  ↓
E2B Cloud Sandbox (persistent VM per session)
  ↓
Intelligence Layer (Graphiti KG + pgvector RAG + Preference-Based CoT)
  ↓
Persistence (Convex + Neo4j + Qdrant/pgvector)
```

## Features

- **5 AI Tools**: `execute_bash`, `web_search`, `read_file`, `write_file`, `install_tool`
- **Model Fallback Chain**: Nvidia NIM → OpenRouter Claude → OpenRouter Llama 70B
- **12 Model Roster**: Per-agent LLM assignment with runtime switching
- **Human-in-the-Loop**: Red-risk commands require manual approval
- **Persistent Sandbox**: E2B VM state survives between chat turns
- **6 Flow Modes**: Standard, CTF, Bug Bounty, Continuous, AI Red Team, CI/CD
- **Preference-Based CoT**: Filters noisy tool output before LLM sees it (PTFusion 2026)
- **Full Observability**: LLM reasoning traces + attack replay
- **API Authentication**: Bearer token auth on all routes

## Quick Start

```bash
# 1. Clone
git clone https://github.com/nandkishorrathodk-art/Ultron-AI.git
cd Ultron-AI

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys (at minimum: E2B_API_KEY + one LLM key)

# 4. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `E2B_API_KEY` | Yes | E2B sandbox API key |
| `LLM_API_KEY` | Yes* | Nvidia NIM API key (primary LLM) |
| `OPENROUTER_API_KEY` | Yes* | OpenRouter API key (fallback + agent models) |
| `NEXT_PUBLIC_CONVEX_URL` | No | Convex deployment URL (for persistence) |
| `PERPLEXITY_API_KEY` | No | Perplexity API key (web search) |
| `TAVILY_API_KEY` | No | Tavily API key (web search fallback) |
| `ULTRON_API_KEY` | No | API authentication token |

\* At least one LLM provider key is required.

See `.env.example` for the full list.

## Tech Stack

- **Frontend**: Next.js 16.2.6, React 19, Tailwind CSS 4, shadcn/ui
- **AI SDK**: Vercel AI SDK v6 (`@ai-sdk/openai`, `@ai-sdk/react`)
- **Sandbox**: E2B Cloud (persistent Linux VMs)
- **Database**: Convex (real-time), Neo4j (knowledge graph), Qdrant (vector search)
- **Background**: Trigger.dev (long-running pentest tasks)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Main chat API (model chain + 5 tools)
│   │   ├── execute-approved/      # HITL-approved command execution
│   │   └── sandboxes/             # Active sandbox monitoring
│   ├── sandbox/page.tsx           # Sandbox monitor UI
│   ├── settings/page.tsx          # Settings page
│   └── page.tsx                   # Main chat UI
├── components/
│   ├── AgentApprovalGate.tsx      # HITL approval gate component
│   ├── AppSidebar.tsx             # Navigation sidebar
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── agent/
│   │   ├── flow.ts                # Flow Engine + 4-level hierarchy types
│   │   └── modules/               # Agent modules (generation, intelligence, etc.)
│   ├── auth.ts                    # API authentication
│   ├── cot-filter.ts              # Preference-Based CoT output filter
│   ├── models.ts                  # Model roster (12 models, per-agent)
│   ├── neo4j.ts                   # Knowledge graph client (lazy init)
│   ├── qdrant.ts                  # Vector search client (lazy init)
│   ├── sandbox-manager.ts         # E2B sandbox lifecycle management
│   └── utils.ts                   # Utility functions
└── trigger/
    └── pentest.ts                 # Trigger.dev long-running tasks
convex/
├── schema.ts                      # v3.0 database schema
├── conversations.ts               # Chat CRUD
├── sessions.ts                    # Flow CRUD
├── hitl.ts                        # HITL approval CRUD
├── audit.ts                       # Observability events
└── reports.ts                     # Attack report CRUD
```

## Security

- All API routes require Bearer token authentication when `ULTRON_API_KEY` is set
- Command inputs are sanitized to prevent shell injection
- Risk classifier detects and gates dangerous commands (RED = requires approval)
- HITL approval gate requires explicit user consent for high-risk operations
- Session IDs use `crypto.randomUUID()` to prevent collisions

## License

Private build. Authorized security testing only.
