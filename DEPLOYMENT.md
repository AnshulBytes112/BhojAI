# BhojAI POS - Deployment Guide

## 🚀 Fastest Deployment Options

### Option 1: **Railway.app** ⭐ RECOMMENDED (10 minutes)
Best for: Full-stack deployment, easiest setup

**Why Railway?**
- Automatic Dockerfile detection
- Zero-config PostgreSQL integration
- Free tier: 5GB storage, $5/month credit
- Supports both API (Node.js) + Frontend (Next.js)
- Real-time logs and monitoring

**Steps:**

1. **Create Railway account**
   - Sign up at https://railway.app
   - Link GitHub account

2. **Deploy**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Initialize and deploy
   railway init
   railway up
   ```

3. **Set Environment Variables in Dashboard**
   ```
   DATABASE_URL = postgresql://user:pass@...  (from Neon)
   JWT_SECRET = bhojai_super_secret_pos_key_2026
   NODE_ENV = production
   NEXT_PUBLIC_API_URL = https://your-railway-url/api
   ```

4. **Done!** Your app will be live at `https://<your-project>.railway.app`

---

### Option 2: **Render.com** (10-15 minutes)

**Why Render?**
- Free tier: 750 compute hours/month
- Built-in PostgreSQL support (can use Neon)
- Auto-deploys from GitHub on push
- SSL/HTTPS included

**Steps:**

1. **Create Render account** at https://render.com
2. **Create new Web Service**
   - Select GitHub repo
   - Runtime: Node 18
   - Build command: `npm ci && npx nx build api`
   - Start command: `npm run dev:api`
3. **Add environment variables** (same as above)
4. **Deploy API separately, Frontend separately** (Render recommends separate services)

---

### Option 3: **Vercel (Frontend) + Railway (API)** (15 minutes)

**Best for:** Optimized frontend, separate backend

**Frontend on Vercel:**
```bash
npm install -g vercel
vercel deploy apps/frontend
```

**API on Railway:** (follow Option 1)

Then update `NEXT_PUBLIC_API_URL` to Railway API URL.

---

### Option 4: **Docker (Local/VPS)** (5 minutes local, 20+ for VPS setup)

**For DigitalOcean, AWS EC2, Linode, etc.**

```bash
# Build Docker image
docker build -t bhojai-pos .

# Run locally (test)
docker run -p 3000:3000 -p 3333:3333 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your_secret" \
  bhojai-pos

# Push to Docker Hub
docker tag bhojai-pos yourusername/bhojai-pos:latest
docker push yourusername/bhojai-pos:latest

# Deploy on VPS
# SSH to server, then:
docker pull yourusername/bhojai-pos:latest
docker run -d -p 80:3000 -p 3333:3333 \
  --name bhojai \
  -e DATABASE_URL="postgresql://..." \
  yourusername/bhojai-pos:latest
```

---

## 📋 Pre-Deployment Checklist

- [ ] Build API: `npx nx build api` ✅
- [ ] Build Frontend: `npx nx build frontend` ✅
- [ ] Database URL from Neon configured in `.env` ✅
- [ ] JWT_SECRET set in `.env` ✅
- [ ] API_BASE configured for production (e.g., `https://your-domain/api`)
- [ ] Test locally: `npm run dev:api` + `npx nx serve frontend`

---

## 🔧 Environment Variables Required

```env
# Database (from Neon PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:npg_xxxxx@...

# Security
JWT_SECRET=bhojai_super_secret_pos_key_2026

# API Port
PORT=3333

# Frontend API endpoint
NEXT_PUBLIC_API_URL=https://your-domain.railway.app/api
```

---

## ✅ Post-Deployment Steps

1. **Run migrations on server**
   ```bash
   npx prisma db push
   ```

2. **Seed test data**
   ```bash
   npm run seed
   ```

3. **Test login**
   - Go to `https://your-domain/login`
   - Try credentials: `admin` / `admin123`

4. **Monitor logs**
   - Railway: Dashboard → Logs
   - Render: Logs tab
   - Docker: `docker logs bhojai`

---

## 🚨 Common Issues & Fixes

**Issue: Database connection timeout**
- Solution: Check Neon connection string in `DATABASE_URL`
- Ensure firewall allows PostgreSQL (usually port 5432)

**Issue: 404 on API calls**
- Solution: Verify `NEXT_PUBLIC_API_URL` matches deployed API domain
- Check CORS settings if different domains

**Issue: Frontend won't load assets**
- Solution: Ensure `NEXT_PUBLIC_API_URL` is absolute URL (http://... not /api)

**Issue: Memory issues**
- Solution: Reduce Docker layer caching, use `.dockerignore` to exclude node_modules

---

## 🎯 Recommended: Quick Start with Railway

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Build locally first
npx nx build api
npx nx build frontend

# 3. Login and deploy
railway login
cd /path/to/BhojAI
railway init
railway up

# 4. Add env vars in Railway dashboard
# DATABASE_URL, JWT_SECRET, NEXT_PUBLIC_API_URL

# 5. Done! Check logs
railway logs
```

Your app will be live in **~10 minutes** at `https://<project-name>.railway.app`

---

## 📞 Support

- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- Neon Docs: https://neon.tech/docs
