# New Machine Setup Guide

Complete instructions for setting up this project on a fresh computer after handing over the Entain laptop.

**Project**: AI Stock Portfolio Analyzer  
**Repo**: https://github.com/kmnaidu/stock-portfolio-dashboard  
**Production**: https://stock-portfolio-analyzer-ten.vercel.app  
**Backend**: https://stock-api-9ukf.onrender.com  

---

## BEFORE you hand over the old machine

Do these RIGHT NOW on the current (Entain) laptop:

### 1. Save the `.env` file (CRITICAL — not in Git)

Copy `server/.env` to a safe location (Google Drive, personal email, USB). It contains:

```
GEMINI_API_KEY=...
GEMINI_API_KEY_2=...
GEMINI_API_KEY_3=...
GEMINI_API_KEY_4=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
UPSTASH_VECTOR_REST_URL=...
UPSTASH_VECTOR_REST_TOKEN=...
SCRAPER_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=...
MY_WHATSAPP=...
PORT=3001
```

**⚠️ Without this file, nothing works locally. Save it now.**

### 2. Save your SSH key for GitHub (if using SSH)

```bash
cat ~/.ssh/id_ed25519       # or id_rsa
cat ~/.ssh/id_ed25519.pub
```

Save both files. Or you can create a new SSH key on the new machine.

### 3. Note your GitHub token (if using HTTPS)

If you clone via HTTPS, you'll need a GitHub Personal Access Token.
Generate one at: https://github.com/settings/tokens

### 4. Save the WhatsApp briefing plist (optional)

```bash
cp ~/Library/LaunchAgents/com.krishna.stock-briefing.plist ~/Desktop/
```

### 5. Save Kiro settings (optional)

```bash
cp -r ~/.kiro ~/Desktop/kiro-backup/
```

---

## On the NEW machine (Personal Laptop)

### Step 1: Install prerequisites

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js (v20+ required, project uses v25)
brew install node

# Verify
node --version    # Should be v20+ (v25.5.0 on old machine)
npm --version     # Should be v10+

# Install Git (usually pre-installed on macOS)
brew install git
```

### Step 2: Configure Git

```bash
git config --global user.name "Krishna Murthy Chandaka"
git config --global user.email "krishna.chandaka@gmail.com"
```

### Step 3: Set up GitHub access

**Option A: SSH (recommended)**
```bash
ssh-keygen -t ed25519 -C "krishna.chandaka@gmail.com"
cat ~/.ssh/id_ed25519.pub
# Copy the output → GitHub → Settings → SSH Keys → New SSH Key → Paste
```

**Option B: HTTPS + Token**
- Go to https://github.com/settings/tokens
- Generate a Personal Access Token (classic) with `repo` scope
- Use it as password when cloning

### Step 4: Clone the repository

```bash
# SSH
git clone git@github.com:kmnaidu/stock-portfolio-dashboard.git

# OR HTTPS
git clone https://github.com/kmnaidu/stock-portfolio-dashboard.git

cd stock-portfolio-dashboard
```

### Step 5: Install all dependencies

```bash
npm install
```

This installs dependencies for all 3 workspaces (server, client, shared) because the project uses npm workspaces.

### Step 6: Create the `.env` file

```bash
# Create the env file from the backup you saved
cp /path/to/your/saved/.env server/.env
```

Or manually create `server/.env` with:

```env
GEMINI_API_KEY=your_key_1
GEMINI_API_KEY_2=your_key_2
GEMINI_API_KEY_3=your_key_3
GEMINI_API_KEY_4=your_key_4
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
UPSTASH_VECTOR_REST_URL=https://your-vector.upstash.io
UPSTASH_VECTOR_REST_TOKEN=your_token
SCRAPER_API_KEY=your_scraper_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
MY_WHATSAPP=whatsapp:+919730252456
PORT=3001
```

### Step 7: Build and verify

```bash
# Build shared types
cd shared && npx tsc --build && cd ..

# Build server
cd server && npm run build && cd ..

# Build client
cd client && npm run build && cd ..
```

All three should complete without errors.

### Step 8: Run locally

**Terminal 1 — Server:**
```bash
cd server && npm run dev
# Expected: "Server running on port 3001"
# Expected: "✓ Upstash Redis connected"
# Expected: "✓ Google Gemini AI configured (4 keys)"
```

**Terminal 2 — Client:**
```bash
cd client && npm run dev
# Expected: "Local: http://localhost:5173/"
```

Open http://localhost:5173 in your browser. You should see the stock dashboard with live data.

---

## Install Kiro IDE

1. Download Kiro from https://kiro.dev
2. Install and sign in with your AWS Builder ID / account
3. Open the project folder: `File → Open Folder → stock-portfolio-dashboard`
4. Kiro will automatically detect:
   - `.kiro/steering/` — steering files
   - `.kiro/specs/` — project specs
   - `.kiro/settings/mcp.json` — MCP server configuration
5. MCP servers should auto-connect (check the MCP panel)

---

## Optional: WhatsApp Daily Briefing (launchd)

Only if you want automated 9:10 AM + 2:00 PM briefings on your personal laptop:

```bash
# Copy the plist to LaunchAgents
cp scripts/com.krishna.stock-briefing.plist ~/Library/LaunchAgents/

# Edit the plist to update paths (they reference the old machine's paths)
# Change: /Users/Krishna.Naidu/Documents/Krishna-KiroExperiments/StockAnalysis
# To:     /path/to/your/new/location/stock-portfolio-dashboard

# Load the agent
launchctl load ~/Library/LaunchAgents/com.krishna.stock-briefing.plist

# Verify
launchctl list | grep stock-briefing
```

**Note**: Twilio WhatsApp sandbox expires every 24 hours. You'll need to re-activate it by sending "join <word>" to the Twilio number periodically.

---

## Optional: Install Ollama (for interview prep)

```bash
brew install ollama
ollama pull mistral:7b
ollama pull codellama:7b

# Test
ollama run mistral "Write a Playwright test for a login page"
```

---

## Where to find your keys/credentials

| Service | Where to get keys |
|---|---|
| Gemini API | https://aistudio.google.com/apikey |
| Upstash Redis | https://console.upstash.com → Redis → your DB → REST API |
| Upstash Vector | https://console.upstash.com → Vector → your index → REST API |
| Twilio | https://console.twilio.com → Account → API Keys |
| GitHub | https://github.com/settings/tokens |
| Vercel | https://vercel.com/dashboard (auto-deploys, no action needed) |
| Render | https://dashboard.render.com (auto-deploys from GitHub) |

---

## Production is INDEPENDENT of your laptop

Remember: **production runs on Vercel + Render in the cloud**. It doesn't depend on your laptop at all. Even if your new machine isn't set up yet:

- ✅ Frontend keeps running: https://stock-portfolio-analyzer-ten.vercel.app
- ✅ Backend keeps running: https://stock-api-9ukf.onrender.com
- ✅ Redis cache persists: Upstash cloud
- ✅ Vector DB persists: Upstash cloud
- ✅ Git repo safe: GitHub cloud

The only things that need your laptop:
- Local development and testing
- WhatsApp daily briefing (launchd runs on your Mac)
- Cache prewarm script (runs from laptop weekly)

---

## Project structure reminder

```
stock-portfolio-dashboard/
├── client/          # React + Vite frontend (TypeScript)
├── server/          # Express backend (TypeScript)
├── shared/          # Shared types (used by both)
├── langgraph-agent/ # LangGraph investment decision agent
├── mcp-server/      # MCP server for AI IDEs
├── scripts/         # Prewarm, briefing, utilities
├── docs/            # Resumes, guides, articles
└── .kiro/           # Kiro specs, steering, MCP config
```

---

## Troubleshooting

**"Cannot find module 'shared/types'"**
```bash
cd shared && npx tsc --build && cd ..
```

**"UPSTASH_REDIS_REST_URL not set"**
Your `server/.env` file is missing or incomplete. Check Step 6.

**"npm install fails"**
Make sure you're running `npm install` from the ROOT directory (not server/ or client/ individually). The project uses npm workspaces.

**"Port 3001 already in use"**
```bash
lsof -i :3001 | grep LISTEN
kill -9 <PID>
```

**"Python service not ready"**
This is normal — the Python yfinance microservice runs on Render separately. Analyst data will work once Render's Python service wakes up (~1-2 min after first request).

---

## First thing to do after setup works

```bash
# Run the app locally, verify everything loads
# Then run prewarm to populate cache:
./scripts/prewarm-cache.sh
```

This populates analyst data for your 32 stocks. Takes ~5-10 minutes on first run.

---

*Last updated: July 9, 2026*
