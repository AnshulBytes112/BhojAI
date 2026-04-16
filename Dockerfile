# Multi-stage build for BhojAI POS

# === Stage 1: Build backend API ===
FROM node:18-alpine AS api-builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY libs ./libs
RUN npm ci
RUN npx nx build api

# === Stage 2: Build frontend ===
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps/frontend ./apps/frontend
COPY libs ./libs
RUN npm ci
RUN npx nx build frontend

# === Stage 3: Runtime ===
FROM node:18-alpine
WORKDIR /app

# Install PM2 for process management
RUN npm install -g pm2

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Copy built API
COPY --from=api-builder /app/dist/apps/api ./dist/apps/api

# Copy built frontend
COPY --from=frontend-builder /app/.next ./.next
COPY --from=frontend-builder /app/public ./public
COPY apps/frontend/next.config.js ./next.config.js
COPY apps/frontend/package.json ./apps/frontend/package.json

# Install production dependencies only
RUN npm ci --only=production

# Expose ports
EXPOSE 3000 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start both API and frontend
CMD ["sh", "-c", "npx nx run api:serve & npx nx run frontend:start"]
