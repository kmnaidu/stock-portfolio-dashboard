# 🚀 Deployment Guide — Stock Portfolio Dashboard

Deploy your dashboard for free and access it from anywhere (phone, laptop, office). Total time: ~20 minutes.

## Architecture

```
Browser (anywhere with internet)
   ↓
Vercel (React frontend)  — https://your-app.vercel.app
   ↓ API calls
Render (Node.js backend) — https://stock-api.onrender.com
   ↓ internal calls
Render (Python yfinance) — https://stock-python.onrender.com
```

All free tier. No credit card required.

---

## Prerequisites

- [x] GitHub account with your code pushed (already done ✓)
- [ ] Vercel account (free) — [vercel.com](https://vercel.com) (sign up with GitHub)
- [ ] Render account (free) — [render.com](https://render.com) (sign up with GitHub)

---

## Step 1: Deploy Backend Services on Render (~10 min)

### 1.1 — Sign in to Render
1. Go to [render.com](https://render.com)
2. Click **Sign Up** → **Sign in with GitHub**
3. Authorize Render to access your repositories

### 1.2 — Deploy using Blueprint
1. In Render dashboard, click **New +** → **Blueprint**
2. Connect your GitHub repo: `kmnaidu/stock-portfolio-dashboard`
3. Render auto-detects `render.yaml` and shows 2 services:
   - `stock-python` (Python yfinance microservice)
   - `stock-api` (Node.js API)
4. Click **Apply** → both services start building

### 1.3 — Wait for deployment (~5-8 min)
- Watch the logs for both services
- You'll see `Build successful` then `Server running on port ...`
- Once both show **Live** status:
  - Your Python API URL: `https://stock-python-XXXX.onrender.com`
  - Your Node API URL: `https://stock-api-XXXX.onrender.com`

### 1.4 — Verify they work
Open in browser:
- `https://stock-api-XXXX.onrender.com/api/health` → should return `{"status":"ok"}`
- `https://stock-api-XXXX.onrender.com/api/quotes` → should return stock data

**Copy the stock-api URL** — you'll need it for the frontend.

---

## Step 2: Deploy Frontend on Vercel (~5 min)

### 2.1 — Sign in to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** → **Continue with GitHub**

### 2.2 — Import the project
1. Click **Add New** → **Project**
2. Select your repo: `stock-portfolio-dashboard`
3. Vercel asks for configuration:
   - **Framework**: Vite (auto-detected)
   - **Root Directory**: Click **Edit** → select `client`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)

### 2.3 — Add environment variable
Before clicking Deploy, expand **Environment Variables**:
- Name: `VITE_API_BASE_URL`
- Value: Paste your `stock-api` URL from Render (e.g., `https://stock-api-XXXX.onrender.com`)

Then click **Deploy**.

### 2.4 — Wait ~2 minutes
Vercel builds and deploys your React app. You'll get a URL like:
`https://stock-portfolio-dashboard-XXXX.vercel.app`

### 2.5 — Configure CORS on the backend
Back on Render → `stock-api` service → **Environment** tab:
- Edit `CORS_ORIGIN` variable
- Value: Your Vercel URL (e.g., `https://stock-portfolio-dashboard-XXXX.vercel.app`)
- Save → service redeploys automatically (~2 min)

---

## Step 3: Test Everything

1. Open your Vercel URL on your phone/laptop
2. You should see the dashboard loading
3. Stock data should appear within ~30 seconds (first load wakes up Render services)
4. Try adding a stock, clicking on one, checking the analyst data

**First load is slow (~30s)** — this is because Render free tier sleeps services after 15 min of inactivity. Subsequent loads are instant.

---

## Step 4: (Optional) Custom Domain

### On Vercel:
1. Settings → Domains → Add your domain (e.g., `stocks.yourdomain.com`)
2. Follow Vercel's DNS instructions

### Free domain options:
- [is-a.dev](https://is-a.dev) — free `yourname.is-a.dev` subdomain
- [dev.tools](https://dev.tools) — free developer domains
- Own one? Point it via DNS settings

---

## Auto-Deploy on Code Changes

Both Vercel and Render automatically redeploy when you push to GitHub:

```bash
git add .
git commit -m "Improve dashboard"
git push
```

Within 2-3 minutes, your live site updates.

---

## Free Tier Limits (Good for Personal Use)

| Platform | Free Tier Limit | Note |
|----------|----------------|------|
| Vercel | 100 GB bandwidth / month | Plenty for personal use |
| Render | 750 hours / month per service | ~25 days of 24/7 uptime |
| Render | Sleeps after 15 min inactivity | First request takes ~30s to wake up |

---

## Troubleshooting

### "Data Unavailable" everywhere
- Render service is sleeping — wait 30s and refresh
- Or the Python service isn't up yet — check Render logs

### CORS errors in browser console
- Double-check `CORS_ORIGIN` on Render matches your Vercel URL exactly
- Must include `https://` prefix, no trailing slash

### Dashboard shows but no data
- Check `VITE_API_BASE_URL` on Vercel matches your Render API URL
- Open browser DevTools → Network tab → check API calls

### Services keep sleeping (want always-on)
- Upgrade Render plan to $7/month (Starter) — no sleep
- Or use [UptimeRobot](https://uptimerobot.com) (free) to ping your API every 5 minutes to keep it awake

---

## Want to Share with Friends?

Just share your Vercel URL! Their watchlist is stored on their own browser, so each friend gets their own personal dashboard.

---

**You're live! 🎉** Access your portfolio dashboard from anywhere: phone, laptop, or any browser.
