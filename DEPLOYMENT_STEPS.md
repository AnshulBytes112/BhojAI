# BhojAI Deployment Steps - Nx Workspace

This guide covers deployment of the BhojAI restaurant management system built with Nx monorepo architecture.

## 🏗️ Project Structure

```
BhojAI/
├── apps/
│   ├── frontend/          # Next.js frontend app
│   └── api/             # Express.js backend API
├── libs/                # Shared libraries
├── prisma/              # Database schema & migrations
├── docker-compose.yml    # Local development
├── Dockerfile           # Production container
└── nx.json            # Nx configuration
```

## 🚀 Quick Deployment Commands

### 1. Build All Projects
```bash
# Build both frontend and backend
npm run build:api
npm run build:frontend

# Or build all at once
npx nx run-many --target=build --all
```

### 2. Production Start
```bash
# Start production servers
npx nx serve api --prod
npx nx serve frontend --prod
```

## 📦 Deployment Options

### Option 1: Docker Deployment (Recommended)

#### Prerequisites
- Docker & Docker Compose installed
- Environment variables configured

#### Steps
```bash
# 1. Build Docker image
docker build -t bhojai .

# 2. Run with Docker Compose
docker-compose up -d

# 3. View logs
docker-compose logs -f
```

#### Environment Variables
Create `.env` file:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bhojai"

# JWT
JWT_SECRET="your-super-secret-jwt-key"

# API
PORT=3334
NODE_ENV=production
```

### Option 2: Manual Deployment

#### Backend Deployment
```bash
# 1. Install dependencies
cd apps/api
npm install

# 2. Build the application
cd ../..
npm run build:api

# 3. Run database migrations
npx prisma migrate deploy

# 4. Seed database (optional)
npm run seed

# 5. Start production server
cd dist/apps/api
node main.js
```

#### Frontend Deployment
```bash
# 1. Install dependencies
cd apps/frontend
npm install

# 2. Build for production
cd ../..
npm run build:frontend

# 3. Deploy the built files
# The built files are in: dist/apps/frontend/.next
```

## 🌐 Platform-Specific Deployment

### Vercel (Frontend)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy frontend
cd apps/frontend
vercel --prod

# 3. Configure environment variables in Vercel dashboard
# NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

### Railway (Full Stack)
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Deploy
railway up

# 4. Configure environment variables in Railway dashboard
```

### AWS EC2
```bash
# 1. Launch EC2 instance (Ubuntu 20.04+)
# 2. Install dependencies
sudo apt update
sudo apt install -y nodejs npm postgresql docker

# 3. Clone repository
git clone <your-repo>
cd BhojAI

# 4. Build and deploy
npm install
npm run build:api
npm run build:frontend

# 5. Use PM2 for process management
npm install -g pm2
pm2 start ecosystem.config.js
```

### DigitalOcean App Platform
```bash
# 1. Install doctl
curl -sL https://github.com/digitalocean/doctl/releases/latest/download/doctl-linux-amd64.tar.gz | tar xz
sudo mv doctl /usr/local/bin

# 2. Deploy
doctl apps create --spec .do/app.yaml
```

## 🔧 Configuration Files

### Docker Compose (Development)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: bhojai
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: .
    ports:
      - "3334:3334"
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/bhojai
    depends_on:
      - postgres

  frontend:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - api
```

### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'bhojai-api',
      script: 'dist/apps/api/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3334
      }
    },
    {
      name: 'bhojai-frontend',
      script: 'dist/apps/frontend/server.js',
      instances: 'max',
      exec_mode: 'cluster'
    }
  ]
};
```

## 🗄️ Database Setup

### PostgreSQL Setup
```bash
# 1. Create database
createdb bhojai

# 2. Run migrations
npx prisma migrate deploy

# 3. Generate Prisma client
npx prisma generate

# 4. Seed data (optional)
npm run seed
```

### Environment Variables
```env
# Required
DATABASE_URL="postgresql://user:password@host:port/database"
JWT_SECRET="your-jwt-secret-key"
PORT=3334

# Optional
REDIS_URL="redis://localhost:6379"
LOG_LEVEL="info"
CORS_ORIGIN="https://yourdomain.com"
```

## 🔍 Health Checks & Monitoring

### Health Endpoints
```bash
# Backend health
curl https://your-api.com/health

# Frontend health
curl https://your-frontend.com/api/health
```

### Monitoring Setup
```bash
# PM2 Monitoring
pm2 monit

# Docker logs
docker logs -f bhojai

# Application logs
tail -f logs/app.log
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Clear Nx cache
npx nx reset

# Clear node modules
rm -rf node_modules package-lock.json
npm install

# Rebuild
npx nx run-many --target=build --all
```

#### 2. Database Connection
```bash
# Check connection
npx prisma db pull

# Test schema
npx prisma db push

# Reset database
npx prisma migrate reset
```

#### 3. Port Conflicts
```bash
# Check ports
netstat -tulpn | grep :3334
netstat -tulpn | grep :3000

# Kill processes
sudo kill -9 <PID>
```

### Performance Optimization

#### 1. Next.js Optimization
```bash
# Enable standalone output
# apps/frontend/next.config.js
module.exports = {
  output: 'standalone',
  experimental: {
    optimizeCss: true
  }
}
```

#### 2. API Optimization
```bash
# Enable compression
npm install compression

# Add to Express app
app.use(compression());
```

## 📋 Pre-Deployment Checklist

### Security
- [ ] Environment variables set
- [ ] HTTPS configured
- [ ] CORS properly configured
- [ ] Database credentials secure
- [ ] JWT secret is strong

### Performance
- [ ] Images optimized
- [ ] Database indexes created
- [ ] CDN configured
- [ ] Caching enabled

### Monitoring
- [ ] Health checks configured
- [ ] Error tracking setup
- [ ] Performance monitoring
- [ ] Backup strategy

## 🔄 CI/CD Pipeline

### GitHub Actions Example
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npx nx run-many --target=build --all
      
      - name: Deploy
        run: |
          # Your deployment script here
          docker build -t bhojai .
          docker push ${{ secrets.DOCKER_REGISTRY }}/bhojai
```

## 📞 Support

### Deployment Help
- Check logs: `docker logs -f bhojai`
- Verify environment: `printenv`
- Test locally: `npm run dev`
- Check health: `curl localhost:3334/health`

### Common Commands
```bash
# Nx project graph
npx nx graph

# List all projects
npx nx show projects

# Run specific target
npx nx run frontend:build

# Test all projects
npx nx run-many --target=test --all
```

---

**Note**: Always test deployments in a staging environment before production deployment.
