# Vercel Environment Variables

## Required Environment Variables for Vercel

Set these in your Vercel dashboard under Project Settings > Environment Variables:

### Backend (Serverless Function)
```
NODE_ENV=production
DATABASE_URL=your-postgres-connection-string
JWT_SECRET=your-32-character-secret-key
```

### Frontend
```
NEXT_PUBLIC_API_URL=https://your-vercel-app.vercel.app/api
```

## Database Setup

For Vercel deployment, you have two options:

1. **Vercel Postgres** (Recommended)
   - Create a new Postgres database in Vercel dashboard
   - Copy the connection string to DATABASE_URL

2. **External Database** (Neon, Railway, etc.)
   - Use any external PostgreSQL service
   - Set DATABASE_URL to the connection string

## Deployment Steps

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Link your project:
```bash
vercel link
```

3. Deploy:
```bash
vercel --prod
```

4. Set environment variables in Vercel dashboard
5. Redeploy:
```bash
vercel --prod
```
