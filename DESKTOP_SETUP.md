# 🖥️ ULTRON-AI DESKTOP/VM SETUP GUIDE

## Overview
Ultron-AI is now **production-hardened** for desktop/local machine execution with:
- ✅ Automatic environment validation at startup
- ✅ Neo4j error handling with graceful fallbacks
- ✅ Qdrant availability detection with RAG degradation
- ✅ Configurable HITL approval timeouts
- ✅ Clear error messages instead of cryptic failures

---

## Prerequisites

### System Requirements
- **OS**: Linux, macOS, Windows (WSL2 recommended)
- **Node.js**: 18+ (recommended 20 LTS)
- **RAM**: 8GB minimum (16GB recommended for agent execution)
- **CPU**: 4+ cores recommended
- **Disk**: 10GB free space

### Required Services (for local development)
```bash
# Option 1: Docker Compose (Recommended)
docker-compose up -d

# This starts:
# - Centrifugo (WebSocket server)
# - PostgreSQL (if needed)
# - Redis (Upstash fallback)
```

### Optional Services (for advanced features)
- **Neo4j 5.0+** or **MemGraph** - Knowledge graph
- **Qdrant 1.0+** - Vector search for RAG
- **E2B SDK** - Cloud sandbox (defaults to local)

---

## Installation Steps

### 1. Clone & Install Dependencies
```bash
cd /path/to/Ultron-AI
pnpm install
```

### 2. Environment Configuration
Create `.env.local` with required variables:

```bash
# REQUIRED for production
NEXT_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud
NVIDIA_API_KEY=your-nvidia-nim-key-here
NEO4J_URI=bolt://localhost:7687
QDRANT_URL=http://localhost:6333

# OPTIONAL - Fallbacks provided
OPENROUTER_API_KEY=your-openrouter-key  # Fallback if NVIDIA unavailable
E2B_API_KEY=your-e2b-key                 # If using cloud sandbox
OPENAI_API_KEY=your-openai-key          # For moderation API

# LOCAL DEFAULTS (no setup needed for desktop)
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
QDRANT_API_KEY=             # Optional for local Qdrant
```

### 3. Desktop-Specific Configuration
For **local development only**, create `.env.development.local`:

```bash
NODE_ENV=development

# Use local services (automatic fallbacks if not running)
NEO4J_URI=bolt://localhost:7687
QDRANT_URL=http://localhost:6333

# Less strict AI model requirements
OPENROUTER_API_KEY=test-key-local  # Will fall back to DeepSeek

# Convex local setup
NEXT_PUBLIC_CONVEX_URL=http://localhost:3210

# Shorter timeouts for local testing
HITL_APPROVAL_TIMEOUT_MS=60000      # 1 minute (default 30 min)
MAX_COORDINATOR_ITERATIONS=10       # Shorter test runs
```

### 4. Verify Setup
```bash
# Run startup verification
node test-desktop-startup.js
```

Expected output:
```
═══════════════════════════════════════════
✅ Environment Validation
✅ Neo4j Module Initialized
✅ Qdrant Module Initialized
✅ AI Models Configured
✅ Required Directories Present

Score: 5/5 tests passed
🎉 Your desktop/VM is ready for Ultron-AI!
```

---

## Running Ultron-AI

### Option A: Web Only (Recommended for Desktop)
```bash
pnpm dev
# Opens http://localhost:3000
```

### Option B: Full Stack (Web + Trigger.dev Tasks)
```bash
pnpm dev:all
# Starts Next.js + Convex + Trigger.dev
```

### Option C: Production Build
```bash
pnpm build
pnpm start
```

---

## Error Handling & Troubleshooting

### Error: "Missing required env: NVIDIA_API_KEY"
**Solution**: Desktop mode doesn't require NVIDIA key. Set NODE_ENV=development and restart.

### Error: "Neo4j connection failed"
**Status**: Application continues without knowledge graph (features degraded)
**Fix**: 
```bash
# Option 1: Start local Neo4j
docker run -d -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:5-enterprise

# Option 2: Use MemGraph
docker run -d -p 7687:7687 memgraph/memgraph
```

### Error: "Qdrant connection failed"
**Status**: RAG context skipped, coordinator continues
**Fix**:
```bash
# Start local Qdrant
docker run -d -p 6333:6333 qdrant/qdrant
```

### Error: "HITL approval timeout"
**Status**: High-risk task auto-failed after timeout
**Action**: Increase timeout in `.env.local`:
```bash
HITL_APPROVAL_TIMEOUT_MS=3600000  # 1 hour
```

### Warning: "Using fallback for X"
**Status**: Non-critical, application still works
**Action**: Configure the service or accept degraded functionality

---

## Architecture Validation

### Desktop Components
```
┌─────────────────────────────────┐
│  Ultron-AI Web (Next.js)        │
│  - Chat Interface               │
│  - Settings Panel               │
│  - File Manager                 │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  Core Services (Environment)    │
│  ✅ AI Models (NVIDIA/OpenRouter)│
│  ✅ Database (Convex)           │
│  ⚠️  Neo4j (Optional, graceful) │
│  ⚠️  Qdrant (Optional, graceful)│
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  Sandbox Execution              │
│  - E2B (Cloud) or               │
│  - Local Execution              │
└─────────────────────────────────┘
```

---

## Features Available on Desktop

| Feature | Status | Notes |
|---------|--------|-------|
| **Chat Interface** | ✅ Full | All chat modes work |
| **File Upload** | ✅ Full | Local file system |
| **Basic Pentest** | ✅ Full | Ask/Agent modes |
| **Long-running Tasks** | ✅ Full | Trigger.dev queue |
| **Knowledge Graph** | ⚠️ Optional | Graceful fallback |
| **RAG Context** | ⚠️ Optional | Skipped if Qdrant down |
| **Attack Chains** | ⚠️ Reduced | Limited without Neo4j |
| **Audit Logs** | ✅ Full | Convex-backed |
| **Real-time Sync** | ✅ Full | WebSocket via Centrifugo |

---

## Performance Tuning

### For Limited RAM (4-8GB)
```bash
# Reduce worker threads
export NODE_OPTIONS="--max-old-space-size=2048"
pnpm dev
```

### For Multi-core Systems (8+ cores)
```bash
# Increase concurrency
export WORKER_THREADS=8
export MAX_COORDINATOR_ITERATIONS=48
pnpm dev:all
```

### For Slow Network
```bash
# Increase timeouts
export CONVEX_TIMEOUT=30000
export HITL_APPROVAL_TIMEOUT_MS=3600000
pnpm dev
```

---

## Testing the Setup

### 1. Health Check
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "environment": "development",
  "services": {
    "neo4j": "connected|unavailable",
    "qdrant": "connected|unavailable",
    "convex": "connected"
  }
}
```

### 2. Run E2E Tests
```bash
pnpm test:e2e
```

### 3. Test AI Models
```bash
node test-ai-models.js
```

### 4. Test Sandbox
```bash
node test-sandbox.js
```

---

## Production Deployment

When deploying to production VM/cloud:

1. **Set all required env vars** (see .env.example)
2. **Configure services**:
   - Neo4j: Production-grade setup
   - Qdrant: Production vector DB
   - Convex: Production project
   - Centrifugo: Production cluster

3. **Run verification**:
   ```bash
   NODE_ENV=production node test-desktop-startup.js
   ```

4. **Deploy**:
   ```bash
   pnpm build
   NODE_ENV=production node /path/to/server.js
   ```

---

## Monitoring & Logs

### Desktop Logs
```bash
# All logs go to console (colorized)
tail -f ~/.ultron-ai/logs/app.log

# Filter by level
grep "\[ERROR\]" ~/.ultron-ai/logs/app.log
```

### Real-time Monitoring
Dashboard available at: `http://localhost:3000/admin/metrics`

### Performance Metrics
```bash
# CPU/Memory usage
ps aux | grep node

# Open file descriptors
lsof -p $(pgrep -f "next dev")
```

---

## Support & Issues

### Common Issues Checklist
- [ ] Node.js version >= 18?
- [ ] pnpm installed? (`pnpm --version`)
- [ ] .env.local file created?
- [ ] `node test-desktop-startup.js` passes?
- [ ] Port 3000 available? (`lsof -i :3000`)
- [ ] Docker services running? (`docker ps`)

### Debug Mode
```bash
DEBUG=ultron-ai:* pnpm dev
```

### Report Issues
Create issue with:
1. Output of `node test-desktop-startup.js`
2. Last 50 lines from logs
3. System info: `uname -a && node --version && pnpm --version`

---

## Next Steps

After successful setup:
1. **Start chatting**: http://localhost:3000
2. **Run your first pentest**: Select "Agent" mode + target
3. **Check worklog**: View execution details
4. **Explore settings**: Customize models & behavior
5. **Deploy**: Follow production checklist above

**Happy hacking! 🚀**
