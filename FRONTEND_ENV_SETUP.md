# Frontend Environment Variables Setup

## 📋 Required Environment Variables

### Core Configuration
```env
# API Configuration (Required)
NEXT_PUBLIC_API_URL=https://your-api-domain.com

# Application Environment (Required)
NODE_ENV=production

# Application Name (Optional)
NEXT_PUBLIC_APP_NAME=BhojAI

# Application Version (Optional)
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## 🌐 Platform-Specific Environment Variables

### Vercel Deployment
```env
# Production API URL
NEXT_PUBLIC_API_URL=https://your-api-name.onrender.com

# Vercel-specific
NODE_ENV=production
VERCEL_ENV=production
VERCEL_URL=https://your-project-name.vercel.app

# Optional: Custom Domain
NEXT_PUBLIC_APP_URL=https://bhojai.yourdomain.com
```

### Render Deployment
```env
# Production API URL
NEXT_PUBLIC_API_URL=https://your-api-name.onrender.com

# Render-specific
NODE_ENV=production
RENDER_ENV=production
RENDER_EXTERNAL_URL=https://your-frontend.onrender.com

# Port (if needed)
PORT=3000
```

### Local Development
```env
# Local API
NEXT_PUBLIC_API_URL=http://localhost:3334

# Development mode
NODE_ENV=development

# Debug mode (optional)
NEXT_PUBLIC_DEBUG=true
```

## 🔧 Environment Variable Files

### 1. `.env.local` (Local Development)
Create in project root:
```env
# Local development
NEXT_PUBLIC_API_URL=http://localhost:3334
NODE_ENV=development
NEXT_PUBLIC_DEBUG=true
```

### 2. `.env.production` (Production)
Create in project root:
```env
# Production
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NODE_ENV=production
NEXT_PUBLIC_DEBUG=false
```

### 3. Vercel Dashboard Variables
Go to Vercel Dashboard → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL=https://your-api-name.onrender.com
NODE_ENV=production
```

### 4. Render Dashboard Variables
Go to Render Dashboard → Service → Environment:
```
NEXT_PUBLIC_API_URL=https://your-api-name.onrender.com
NODE_ENV=production
PORT=3000
```

## 📱 Frontend Configuration Files

### Next.js Configuration (apps/frontend/next.config.js)
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Environment-specific output
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  
  // API configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  },
  
  // CORS and headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### TypeScript Types (apps/frontend/src/types/env.d.ts)
```typescript
// Environment variable types
interface ImportMetaEnv {
  readonly NEXT_PUBLIC_API_URL: string;
  readonly NEXT_PUBLIC_APP_NAME?: string;
  readonly NEXT_PUBLIC_APP_VERSION?: string;
  readonly NEXT_PUBLIC_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Make environment variables available globally
declare global {
  var __DEV__: boolean;
}

// Development check
global.__DEV__ = process.env.NODE_ENV === 'development';
```

## 🚀 Usage in Frontend Code

### API Configuration (apps/frontend/src/lib/api.ts)
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3334';

export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
};
```

### Environment Check (apps/frontend/src/utils/env.ts)
```typescript
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3334',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'BhojAI',
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  debug: process.env.NEXT_PUBLIC_DEBUG === 'true',
};
```

### Component Usage (Example)
```typescript
import { config } from '../utils/env';

export default function Header() {
  return (
    <div>
      <h1>{config.appName}</h1>
      {config.debug && <span>Debug Mode</span>}
    </div>
  );
}
```

## 🔍 Environment Variable Validation

### Validation Script (scripts/validate-env.js)
```javascript
const requiredEnvVars = [
  'NEXT_PUBLIC_API_URL',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

### Package.json Script
```json
{
  "scripts": {
    "validate-env": "node scripts/validate-env.js",
    "build": "npm run validate-env && npx nx build frontend",
    "dev": "npm run validate-env && npx nx dev frontend"
  }
}
```

## 🌍 Multi-Environment Setup

### Development (.env.development)
```env
NEXT_PUBLIC_API_URL=http://localhost:3334
NODE_ENV=development
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_APP_NAME=BhojAI (Dev)
```

### Staging (.env.staging)
```env
NEXT_PUBLIC_API_URL=https://staging-api.yourdomain.com
NODE_ENV=staging
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_APP_NAME=BhojAI (Staging)
```

### Production (.env.production)
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NODE_ENV=production
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_APP_NAME=BhojAI
```

## 🔐 Security Considerations

### Safe Variables
```env
# ✅ Safe to expose (NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_NAME=BhojAI
NEXT_PUBLIC_VERSION=1.0.0

# ❌ Never expose in frontend
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
API_SECRET_KEY=your-api-key
```

### CORS Configuration
```env
# Allowed origins for API
NEXT_PUBLIC_ALLOWED_ORIGINS=https://yourdomain.com,https://yourdomain.vercel.app
```

## 📋 Deployment Checklist

### Before Deployment
- [ ] All NEXT_PUBLIC_ variables are set
- [ ] API URL is accessible
- [ ] Environment variables are validated
- [ ] Build process completes without errors
- [ ] Environment-specific configurations are correct

### Platform-Specific
- [ ] **Vercel**: Variables set in dashboard
- [ ] **Render**: Variables set in service settings
- [ ] **Local**: .env.local file exists
- [ ] **Docker**: Variables passed to container

### Testing
- [ ] API calls work in production
- [ ] Environment-specific features work
- [ ] Debug mode is disabled in production
- [ ] CORS is properly configured

---

## 🚨 Common Issues & Solutions

### Issue: API calls failing
```bash
# Check if NEXT_PUBLIC_API_URL is set
echo $NEXT_PUBLIC_API_URL

# Test API connectivity
curl https://your-api-domain.com/health
```

### Issue: Environment variables not loading
```bash
# Restart development server
npm run dev

# Clear Next.js cache
rm -rf .next
npm run dev
```

### Issue: Build failures
```bash
# Validate environment variables
npm run validate-env

# Check Next.js configuration
npx next info
```

---

**Important**: Always prefix frontend environment variables with `NEXT_PUBLIC_` to make them available in the browser.
