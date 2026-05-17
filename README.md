# 📚 DocuMind AI — PDF Chat & Knowledge Assistant

> Upload PDFs. Ask questions. Get cited answers. — Powered by a full RAG pipeline.

---

## 🚀 Quick Start (2 commands)

```bash
# 1. Set your API key
cp .env.example .env
nano .env   # Add your GEMINI_API_KEY

# 2. Run everything
./start.sh
```

**That's it.** Open http://localhost:3000 in your browser.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| Docker Compose | v2+ | Included with Docker Desktop |

You also need a **Gemini API key** → https://aistudio.google.com/app/apikey

---

## Step-by-Step Setup

### Step 1 — Clone & Configure

```bash
# Clone the repo (or unzip the folder)
cd documind

# Copy environment template
cp .env.example .env

# Open and edit — ONLY required change is GEMINI_API_KEY
nano .env
# or: code .env
# or: notepad .env   (Windows)
```

### Step 2 — Start Everything

```bash
# Make the script executable (Linux/Mac)
chmod +x start.sh stop.sh

# Launch all services
./start.sh
```

**Windows users:**
```powershell
docker compose -f docker/docker-compose.yml up --build -d
```

### Step 3 — Open the App

| Service | URL |
|---------|-----|
| 🌐 **Frontend** | http://localhost:3000 |
| ⚙️ **Backend API** | http://localhost:8000 |
| 📖 **API Docs** | http://localhost:8000/docs |

---

## Stop / Restart

```bash
# Stop all services
./stop.sh

# Restart
./start.sh

# View logs
docker compose -f docker/docker-compose.yml logs -f

# View only backend logs
docker compose -f docker/docker-compose.yml logs -f backend

# Rebuild after code changes
docker compose -f docker/docker-compose.yml up --build -d
```

---

## Project Structure

```
documind/
├── start.sh                  ← One-command startup
├── stop.sh                   ← Stop all services
├── .env.example              ← Environment template
├── .env                      ← Your config (created from example)
│
├── backend/                  ← FastAPI Python backend
│   ├── main.py               ← App entry point
│   ├── requirements.txt      ← Python dependencies
│   ├── Dockerfile
│   ├── api/
│   │   ├── auth.py           ← JWT authentication
│   │   ├── documents.py      ← PDF upload & management
│   │   ├── chat.py           ← RAG chat endpoint
│   │   └── sessions.py       ← Chat session management
│   ├── services/
│   │   └── rag.py            ← 🧠 Core RAG pipeline (6 stages)
│   ├── models/
│   │   └── models.py         ← SQLAlchemy ORM models
│   └── utils/
│       └── database.py       ← Async DB connection
│
├── frontend/                 ← Next.js 14 TypeScript frontend
│   ├── src/
│   │   ├── app/              ← Next.js App Router pages
│   │   │   ├── login/        ← Auth page
│   │   │   └── dashboard/    ← Main app
│   │   │       ├── page.tsx          ← Dashboard overview
│   │   │       ├── documents/page.tsx ← PDF upload
│   │   │       ├── chat/page.tsx      ← RAG chat interface
│   │   │       └── settings/page.tsx  ← Configuration
│   │   ├── components/
│   │   │   └── Sidebar.tsx   ← Navigation sidebar
│   │   ├── lib/
│   │   │   └── api.ts        ← API client (axios)
│   │   └── types/index.ts    ← TypeScript types
│   └── Dockerfile
│
└── docker/
    └── docker-compose.yml    ← All 4 services defined here
```

---

## RAG Pipeline (6 Stages)

```
PDF Upload
    ↓
[Stage 1] PDF Text Extraction (PyMuPDF)
    · Extracts text block by block, preserving page numbers
    ↓
[Stage 2] Recursive Chunking
    · 800-token chunks, 150-token overlap
    · Respects paragraph → sentence → word boundaries
    ↓
[Stage 3] Embedding Generation (sentence-transformers)
    · Model: all-MiniLM-L6-v2 (local, free, 384 dimensions)
    · Normalized vectors for cosine similarity
    ↓
[Stage 4] Vector Indexing (ChromaDB)
    · Per-user isolated collections
    · HNSW index for fast approximate nearest neighbor
    ↓
[Stage 5] Semantic Retrieval
    · Top-5 most relevant chunks retrieved
    · Filtered by selected document IDs
    ↓
[Stage 6] LLM Response (Gemini Flash)
    · Context + conversation history → cited answer
    · Sources list with page numbers & relevance scores
```

---

## Architecture

```
Browser (Next.js)
      ↕ REST API
FastAPI Backend
      ↕              ↕
PostgreSQL        ChromaDB
(users,docs,      (vector
 messages)         embeddings)
      ↕
Google Gemini API
```

All services run in Docker containers and communicate over an internal network.

---

## Environment Variables (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | **YES** | — | Your Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model for answer generation |
| `POSTGRES_PASSWORD` | No | `documind_secret_2024` | DB password |
| `MONGODB_URI` | No | — | Optional MongoDB Atlas URI for future Mongo-backed features |
| `JWT_SECRET_KEY` | No (change for prod) | dev key | Token signing key |
| `PORT` | No | `8000` locally, `10000` on Render | Backend port. Render injects this automatically. |
| `CHUNK_SIZE` | No | `800` | Tokens per chunk |
| `CHUNK_OVERLAP` | No | `150` | Overlap between chunks |
| `TOP_K_RETRIEVAL` | No | `5` | Chunks retrieved per query |
| `EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | Embedding model name |

---

## Troubleshooting

**Backend won't start:**
```bash
docker compose -f docker/docker-compose.yml logs backend
# Usually: wrong API key, or postgres not ready yet (wait 30s)
```

**"API key invalid" error:**
```bash
# Check your key in .env
grep GEMINI_API_KEY .env
# Make sure it starts with AIza
```

**Port already in use:**
```bash
# Check what's using the port
lsof -i :3000   # or :8000
# Kill it, or change ports in docker-compose.yml
```

**First startup is slow (~3-5 min):**
This is normal — Docker downloads the Python ML model (~90MB) on first run. Subsequent starts are fast.

**Windows Docker issues:**
```powershell
# Run in PowerShell as Administrator
docker compose -f docker/docker-compose.yml up --build -d
```

---

## Production Deployment

### Option A: Same server, add SSL

```bash
# Install Certbot
apt install certbot
certbot certonly --standalone -d yourdomain.com

# Update .env
NEXT_PUBLIC_API_URL=https://yourdomain.com

# Start
./start.sh
```

### Option B: Cloud (Railway / Render)

1. Push to GitHub
2. Railway: `railway up` in `/backend`
3. Vercel: import `/frontend` project
4. Set environment variables in each dashboard

### Option C: Docker on any VPS

```bash
# On any Ubuntu VPS
apt install docker.io docker-compose-v2
git clone your-repo
cd documind
cp .env.example .env && nano .env
./start.sh
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| PDF Processing | PyMuPDF |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Vector DB | ChromaDB |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| LLM | Google Gemini Flash |
| Auth | JWT + bcrypt |
| Containers | Docker + Docker Compose |

---

## License

MIT — use freely in personal and commercial projects.
