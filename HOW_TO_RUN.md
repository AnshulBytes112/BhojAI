# How to Run BhojAI POS System

## Prerequisites
- **Node.js** v18+ (check with `node --version`)
- **npm** (comes with Node)

---

## Quick Start (2 Steps)

### Step 1: Install Dependencies
```bash
cd c:\Users\Abish Barnodia\Desktop\last\BhojAI
npm install
```

### Step 2: Start Everything
```bash
# Terminal 1: Start the API server
npm run dev:api

# Terminal 2: Start the frontend
npx nx serve frontend
```

That's it! Your system will be running at:
- **API**: http://localhost:3333/api
- **Frontend**: http://localhost:3000

---

## Detailed Setup

### 1. Install Dependencies
```bash
cd c:\Users\ANSHUL\BhojAI
npm install
```

### 2. Initialize Database
The SQLite database is created automatically on first run. To seed sample data:

```bash
npm run seed
```

**What this does**:
- Creates `prisma/dev.db` (SQLite file)
- Applies all migrations automatically
- Inserts sample restaurant + user data

### 3. Start API Server
```bash
npm run dev:api
```

**Output** (when successful):
```
🍽️  BhojAI Restaurant OS API
📡 Listening at http://localhost:3333/api
🏥 Health: http://localhost:3333/api/health
```

Test it in browser or terminal:
```bash
curl http://localhost:3333/api/health
```

### 4. Start Frontend (in another terminal)
```bash
npx nx serve frontend
```

**Output** (when successful):
```
▲ Next.js 16.x.x
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in 2.5s
```

Open http://localhost:3000 in browser.

---

## Available Commands

```bash
# API Commands
npm run dev:api              # Start API server (hot reload)
npm run build:api           # Build API for production
npx nx serve api            # Alternative: start API server

# Frontend Commands
npx nx serve frontend       # Start frontend dev server
npx nx build frontend       # Build for production

# Database Commands
npm run seed                # Seed initial data
npx prisma studio          # Open database GUI
npx prisma migrate dev      # Create new migration

# Linting & Testing
npx nx lint                 # Run all linters
npx nx test api             # Run API tests (if configured)
npx nx test frontend        # Run frontend tests (if configured)

# Build Everything
npx nx build                # Build all projects

# Clean Cache
npx nx reset                # Clear Nx cache
```

---

## First Login

### Via Postman or cURL

**Test the API with a login request:**

```bash
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Response** (on success):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "name": "Admin User",
    "username": "admin",
    "role": "ADMIN",
    "restaurantId": "rest-123"
  }
}
```

Keep the `token` for subsequent API calls.

### Via Frontend
1. Open http://localhost:3000
2. You'll see the frontend placeholder page
3. Frontend team will build the actual login UI

---

## Default Test Credentials

After running `npm run seed`, use these to test:

| Username | Password | Role | PIN |
|----------|----------|------|-----|
| admin | admin123 | ADMIN | 1234 |
| manager | manager123 | MANAGER | 2345 |
| waiter1 | waiter123 | WAITER | 5678 |
| chef1 | chef123 | CHEF | 6789 |

---

## Testing the API

### Using Postman
1. Download [Postman](https://www.postman.com/downloads/)
2. Import the endpoints or manually create requests
3. Use the `token` from login in the `Authorization` header:
   ```
   Authorization: Bearer {TOKEN}
   ```

### Using VS Code REST Client Extension
1. Install "REST Client" extension
2. Create `requests.http` file:
   ```http
   ### Login
   POST http://localhost:3333/api/auth/login
   Content-Type: application/json

   {
     "username": "waiter1",
     "password": "waiter123",
     "pin": "5678"
   }

   ### Get Menu
   GET http://localhost:3333/api/menu/categories
   Authorization: Bearer {TOKEN}

   ### Get Tables
   GET http://localhost:3333/api/tables
   Authorization: Bearer {TOKEN}
   ```

### Using cURL
```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"waiter1","password":"waiter123"}' | jq -r '.token')

# 2. Get menu with token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3333/api/menu/categories
```

---

## Database Management

### View/Edit Database

**Using Prisma Studio** (GUI):
```bash
npx prisma studio
```
Opens browser at http://localhost:5555 with visual DB editor.

**Using SQLite CLI**:
```bash
sqlite3 prisma/dev.db

# Then type SQL:
.tables                    # List tables
SELECT * FROM User;       # View users
SELECT * FROM MenuItem;   # View menu items
.exit                     # Exit
```

---

## Troubleshooting

### Port Already in Use
```bash
# API port 3333 in use?
npx kill-port 3333

# Frontend port 3000 in use?
npx kill-port 3000
```

Or start on different port:
```bash
# API on port 4000
PORT=4000 npm run dev:api

# Frontend on port 3001
npx nx serve frontend -- --port 3001
```

### Database Locked
```bash
# Delete database and restart (fresh state)
rm prisma/dev.db
npm run seed
npm run dev:api
```

### Dependencies Issues
```bash
# Clear node_modules and reinstall
rm -r node_modules package-lock.json
npm install
```

### Prisma Client Out of Sync
```bash
# Regenerate Prisma client
npx prisma generate
```

---

## Project Structure
```
BhojAI/
├── apps/
│   ├── api/                    # Express API server
│   │   └── src/modules/
│   │       ├── auth/           # Login + 2FA
│   │       ├── pos/            # Orders, Bills, Payments
│   │       ├── menu/           # Menu CRUD
│   │       ├── ai/             # Upsell suggestions
│   │       ├── inventory/      # Stock management
│   │       ├── dashboard/      # Analytics
│   │       └── middleware/     # Auth middleware
│   └── frontend/               # Next.js web UI (to build)
├── libs/
│   └── api-interfaces/         # Shared types
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── dev.db                  # SQLite database (created after npm run seed)
│   └── migrations/             # Database migrations
├── .env                        # Environment variables
├── package.json
└── README.md
```

---

## Environment Variables

Create or check `.env` file in project root:
```env
# JWT Secret (for token signing)
JWT_SECRET=your_super_secret_key_here_32_chars_minimum

# Database URL (SQLite by default)
DATABASE_URL="file:./prisma/dev.db"

# API Port
PORT=3333
```

For production, use PostgreSQL:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/bhojai"
```

---

## Production Build & Run

### Build Everything
```bash
npx nx build api
npx nx build frontend
```

### Start Production API
```bash
# Build first
npm run build:api

# Run built version
node dist/apps/api/main.js
```

### Deploy to Server
```bash
# SSH to server, then:
cd /opt/bhojai
git pull origin main
npm install
npx prisma migrate deploy
npm run build:api
npm run build:frontend
# Configure reverse proxy (Nginx) + PM2 for process management
```

---

## Next: Frontend Development

Once API is running, frontend team can:

1. **Start frontend dev server**: `npx nx serve frontend`
2. **Follow [UI_IMPLEMENTATION_GUIDE.md](./UI_IMPLEMENTATION_GUIDE.md)** for component specs
3. **Call API endpoints** from React components using `fetch()` or `axios`
4. **Implement features by phase** (See Phase 1-4 checklist)

Example API call from frontend:
```typescript
// Login
const response = await fetch('http://localhost:3333/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'waiter1', password: 'waiter123' })
});
const { token } = await response.json();

// Get Menu
const menuResponse = await fetch('http://localhost:3333/api/menu/categories', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const menu = await menuResponse.json();
```

---

## Questions or Issues?

- **API not starting?** Check: Node version, port 3333 available, `npm install` completed
- **Frontend not loading?** Check: `npx nx serve frontend` is running, port 3000 free
- **Database errors?** Run `npm run seed` to reset, or delete `prisma/dev.db`
- **Login fails?** Verify seed data exists: `npx prisma studio` → check User table

Get started now! 🚀
