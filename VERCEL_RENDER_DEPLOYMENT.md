# Vercel & Render Deployment Guide

## 🚀 Vercel Deployment (Frontend)

### Prerequisites
- Vercel account (free)
- GitHub/GitLab/Bitbucket repository
- Node.js 18+ installed locally

### Option 1: Vercel CLI Deployment

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Login to Vercel
```bash
vercel login
```

#### 3. Deploy Frontend
```bash
# Navigate to frontend directory
cd apps/frontend

# Deploy to production
vercel --prod

# Follow the prompts:
# - Set up and deploy? [Y/n] y
# - Which scope do you want to deploy to? (your-username)
# - Link to existing project? [y/N] n
# - What's your project's name? bhojai-frontend
# - In which directory is your code located? ./
```

#### 4. Configure Environment Variables
```bash
# Via Vercel CLI
vercel env add

# Or via Vercel Dashboard:
# 1. Go to vercel.com/dashboard
# 2. Select your project
# 3. Settings → Environment Variables
# 4. Add:
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NEXT_PUBLIC_APP_NAME=BhojAI
```

### Option 2: Vercel Dashboard Deployment

#### 1. Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your Git repository
4. Select the `apps/frontend` directory as root

#### 2. Configure Build Settings
```json
{
  "buildCommand": "cd ../.. && npm run build:frontend",
  "outputDirectory": "dist/apps/frontend/.next",
  "installCommand": "cd ../.. && npm install",
  "framework": "nextjs"
}
```

#### 3. Environment Variables
Add these in Project Settings:
```
NEXT_PUBLIC_API_URL=https://your-backend-url.vercel.app
NODE_ENV=production
```

#### 4. Deploy
- Click "Deploy"
- Vercel will automatically deploy on git push

### Vercel Configuration Files

#### vercel.json (Create in project root)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "apps/frontend/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "apps/frontend/$1"
    }
  ]
}
```

#### .vercelignore (Create in project root)
```
node_modules
.env
.env.local
dist
.nx
coverage
*.log
```

---

## 🎨 Render Deployment (Backend + Frontend)

### Prerequisites
- Render account (free tier available)
- GitHub repository
- Docker installed (recommended)

### Option 1: Backend API Deployment

#### 1. Prepare Backend for Render
Create `render.yaml` in `apps/api` directory:
```yaml
services:
  - type: web
    name: bhojai-api
    env: docker
    repo: https://github.com/yourusername/bhojai
    rootDir: apps/api
    dockerfilePath: ./Dockerfile
    dockerContext: ../../
    plan: free
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3334
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
```

#### 2. Create Dockerfile for Backend
Create `apps/api/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY ../../package*.json ./
COPY ../../apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY ../../ .
COPY ../../apps/api ./apps/api
COPY ../../dist ./dist

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3334

# Start the application
CMD ["node", "dist/apps/api/main.js"]
```

#### 3. Deploy via Render Dashboard
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: bhojai-api
   - **Environment**: Docker
   - **Root Directory**: `apps/api`
   - **Docker Context**: `../../`
   - **Plan**: Free
5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=3334
   DATABASE_URL=your_postgres_connection_string
   JWT_SECRET=your_jwt_secret
   ```
6. Click "Create Web Service"

### Option 2: Frontend Deployment on Render

#### 1. Create render.yaml for Frontend
Create `apps/frontend/render.yaml`:
```yaml
services:
  - type: web
    name: bhojai-frontend
    env: static
    repo: https://github.com/yourusername/bhojai
    rootDir: apps/frontend
    buildCommand: cd ../.. && npm run build:frontend
    publishDir: ../../dist/apps/frontend/.next
    plan: free
    envVars:
      - key: NEXT_PUBLIC_API_URL
        value: https://your-api-name.onrender.com
```

#### 2. Deploy Static Frontend
1. In Render Dashboard: "New +" → "Static Site"
2. Connect repository
3. Configure:
   - **Name**: bhojai-frontend
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `cd ../.. && npm run build:frontend`
   - **Publish Directory**: `../../dist/apps/frontend/.next`
   - **Node Version**: 18
4. Add Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-api-name.onrender.com
   ```
5. Click "Create Static Site"

### Option 3: Full Stack with Docker Compose

#### 1. Create Docker Compose for Render
Create `docker-compose.render.yml`:
```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3334:3334"
    environment:
      - NODE_ENV=production
      - PORT=3334
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: bhojai
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

#### 2. Deploy to Render
1. Push Docker Compose configuration to GitHub
2. In Render: "New +" → "Docker Service"
3. Connect repository and select `docker-compose.render.yml`
4. Configure environment variables

---

## 🔧 Environment Configuration

### Backend Environment Variables
```env
# Required for Render
NODE_ENV=production
PORT=3334

# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Security
JWT_SECRET=your-super-secret-jwt-key-here

# Optional
CORS_ORIGIN=https://your-frontend-domain.vercel.app
LOG_LEVEL=info
```

### Frontend Environment Variables
```env
# API Configuration
NEXT_PUBLIC_API_URL=https://your-api-name.onrender.com

# App Configuration
NEXT_PUBLIC_APP_NAME=BhojAI
NODE_ENV=production
```

---

## 🚀 Deployment Commands Summary

### Vercel (Frontend)
```bash
# Quick deploy
cd apps/frontend
vercel --prod

# With custom domain
vercel --prod --prod-url bhojai.yourdomain.com

# Link existing project
vercel link
vercel --prod
```

### Render (Backend)
```bash
# Build locally before pushing
npm run build:api

# Test production build
cd dist/apps/api
node main.js

# Push to trigger Render deployment
git add .
git commit -m "Deploy to Render"
git push origin main
```

### Render (Frontend)
```bash
# Build frontend
npm run build:frontend

# Test build locally
cd dist/apps/frontend/.next
npx serve -s . -p 3000

# Push to trigger deployment
git push origin main
```

---

## 🔍 Troubleshooting

### Vercel Issues

#### Build Failures
```bash
# Check build logs in Vercel dashboard
# Verify build command:
cd ../.. && npm run build:frontend

# Local test:
npx vercel build
```

#### Environment Variables
```bash
# Verify variables are accessible
vercel env ls

# Test locally:
vercel env pull .env.local
```

### Render Issues

#### Docker Build Failures
```bash
# Test Docker build locally
docker build -t bhojai-test .

# Run container locally
docker run -p 3334:3334 bhojai-test
```

#### Database Connection
```bash
# Test database connection
npx prisma db pull

# Verify schema
npx prisma db push
```

---

## 📋 Pre-Deployment Checklist

### Vercel (Frontend)
- [ ] Repository connected to Vercel
- [ ] Build command configured correctly
- [ ] Environment variables set
- [ ] Custom domain configured (optional)
- [ ] Deployed to production

### Render (Backend)
- [ ] Dockerfile created and tested
- [ ] Environment variables configured
- [ ] Database connection working
- [ ] Health endpoint accessible
- [ ] SSL certificate active

### Cross-Platform
- [ ] CORS configured correctly
- [ ] API URL updated in frontend
- [ ] Environment variables match
- [ ] Both services accessible
- [ ] End-to-end testing complete

---

## 🌐 URLs After Deployment

### Vercel Frontend
```
Primary: https://your-project-name.vercel.app
Custom: https://bhojai.yourdomain.com (if configured)
```

### Render Backend
```
API: https://your-service-name.onrender.com
Health: https://your-service-name.onrender.com/health
```

### Render Frontend (Static)
```
Primary: https://your-static-site.onrender.com
```

---

## 🔄 CI/CD Integration

### GitHub Actions for Both Platforms
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Vercel CLI
        run: npm install -g vercel
      
      - name: Deploy to Vercel
        run: |
          cd apps/frontend
          vercel --prod --token ${{ secrets.VERCEL_TOKEN }}

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Render
        run: |
          # Render auto-deploys on git push
          echo "Backend will be deployed by Render webhook"
```

---

**Note**: Always test deployments in preview/staging environments before production deployment.
