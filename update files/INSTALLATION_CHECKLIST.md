# Installation Checklist - PlumbPro Inventory

Use this checklist to ensure successful installation and setup of PlumbPro Inventory with backend integration.

## Pre-Installation

### System Requirements
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] PostgreSQL 14+ installed (`psql --version`)
- [ ] Git installed (for cloning)
- [ ] Code editor (VS Code recommended)
- [ ] Terminal/Command Line access

### API Keys
- [ ] Google Gemini API key obtained from https://ai.google.dev/

## Installation Steps

### 1. Database Setup
- [ ] PostgreSQL service is running
- [ ] Created database: `plumbpro_inventory`
- [ ] Can connect: `psql -U postgres -d plumbpro_inventory`
- [ ] Know your PostgreSQL password

### 2. Backend Setup
- [ ] Navigated to `server/` directory
- [ ] Ran `npm install` successfully
- [ ] Created `server/.env` from `.env.example`
- [ ] Set `DB_PASSWORD` in `.env`
- [ ] Set `JWT_SECRET` in `.env` (use random string)
- [ ] Set `GEMINI_API_KEY` in `.env`
- [ ] Ran `npm run migrate` successfully
- [ ] Ran `npm run seed` successfully
- [ ] Tables created (check with `psql`)

### 3. Frontend Setup
- [ ] Navigated back to root directory
- [ ] Ran `npm install` successfully
- [ ] Created `.env` file
- [ ] Set `VITE_API_URL=http://localhost:5000/api` in `.env`

### 4. Starting Services
- [ ] Backend started: `cd server && npm run dev`
- [ ] Backend shows "Database connected successfully"
- [ ] Backend running on port 5000
- [ ] Health check works: `curl http://localhost:5000/health`
- [ ] Frontend started: `npm run dev` (in new terminal)
- [ ] Frontend running on port 3000
- [ ] Browser opened to http://localhost:3000

### 5. First Login
- [ ] Login page loads
- [ ] Demo credentials work: `demo@plumbpro.com` / `demo123`
- [ ] Redirected to dashboard after login
- [ ] No console errors (F12 → Console)

## Verification Tests

### Dashboard
- [ ] Dashboard displays
- [ ] Shows total inventory value
- [ ] Shows low stock alerts
- [ ] Shows upcoming jobs count
- [ ] Shows active plumbers count

### Inventory
- [ ] Can view inventory list (should show 8 items)
- [ ] Can click on an item to view details
- [ ] Can search/filter inventory
- [ ] Stock levels show correctly
- [ ] Can see supplier information

### Jobs
- [ ] Can view jobs list (should show 1 job)
- [ ] Can see job details
- [ ] Can see assigned workers
- [ ] Can see allocated materials

### Contacts
- [ ] Can view contacts list (should show 5 contacts)
- [ ] Can see suppliers
- [ ] Can see plumbers
- [ ] Contact cards display correctly

### Smart Ordering
- [ ] Can click "Generate Order Suggestions"
- [ ] AI generates suggestions (may take 5-10 seconds)
- [ ] Suggestions show item names
- [ ] Suggestions show quantities
- [ ] Suggestions show reasoning

### Stock History
- [ ] Can view stock movements
- [ ] Can filter by type
- [ ] Movements show timestamps
- [ ] Can see references/reasons

## Feature Tests

### Create Operations
- [ ] Can create new inventory item
- [ ] Item appears in list immediately
- [ ] Item has correct details
- [ ] Page refresh keeps the item (persistence test)

- [ ] Can create new contact
- [ ] Contact appears in list
- [ ] Contact has correct type badge color

- [ ] Can create new job
- [ ] Can assign workers to job
- [ ] Can allocate materials to job

### Update Operations
- [ ] Can adjust stock manually
- [ ] Adjustment creates movement log
- [ ] Stock quantity updates correctly

- [ ] Can update job status
- [ ] Status change saves immediately

### Delete Operations
- [ ] Can delete inventory item
- [ ] Item removed from list
- [ ] Confirmation works

### Job Picking
- [ ] Can allocate items to a job
- [ ] Stock shows as reserved
- [ ] Can "Confirm & Pick" job
- [ ] Stock quantity decreases
- [ ] Movement log created
- [ ] Job marked as picked

### Offline Mode
- [ ] Login and load data
- [ ] Turn off backend server
- [ ] Can still view inventory (cached)
- [ ] Can still view jobs (cached)
- [ ] Cannot create new items (expected)
- [ ] Restart backend server
- [ ] Data syncs automatically

## Backend Verification

### API Endpoints
Test these with curl or Postman:

- [ ] `GET /health` returns status
- [ ] `POST /api/auth/login` returns token
- [ ] `GET /api/inventory` returns items (with auth)
- [ ] `GET /api/jobs` returns jobs (with auth)
- [ ] `GET /api/contacts` returns contacts (with auth)
- [ ] `POST /api/smart-ordering/suggestions` works (with auth)

### Database Verification
Connect to PostgreSQL and verify:

```sql
-- Check tables exist
\dt

-- Check users
SELECT * FROM users;

-- Check inventory
SELECT COUNT(*) FROM inventory_items;

-- Check jobs
SELECT * FROM jobs;

-- Check stock movements
SELECT COUNT(*) FROM stock_movements;
```

- [ ] All 9 tables exist
- [ ] Demo user exists
- [ ] 8 inventory items exist
- [ ] 1 job exists
- [ ] 5 contacts exist
- [ ] Stock movements logged

## Security Checks

### Environment Files
- [ ] `server/.env` exists and is NOT in git
- [ ] `.env` exists and is NOT in git
- [ ] `.gitignore` includes `.env`
- [ ] No secrets in code files
- [ ] API keys only in environment files

### Authentication
- [ ] Cannot access API without token
- [ ] Invalid credentials rejected
- [ ] Token expires correctly
- [ ] Auto-logout on expired token works

### Data Isolation
- [ ] Each user sees only their data
- [ ] Cannot access other users' data
- [ ] User ID properly scoped in queries

## Performance Checks

### Loading Speed
- [ ] Dashboard loads < 2 seconds
- [ ] Inventory list loads < 1 second
- [ ] Job creation is instant
- [ ] No lag when typing
- [ ] Smooth scrolling

### Database Performance
- [ ] Queries execute quickly
- [ ] No timeout errors
- [ ] Connection pool working
- [ ] No memory leaks (leave running 30 min)

## Documentation Review

- [ ] Read `README.md` for overview
- [ ] Read `SETUP.md` for detailed setup
- [ ] Read `QUICK_START.md` for fast setup
- [ ] Read `server/README.md` for API docs
- [ ] Read `INTEGRATION_SUMMARY.md` for architecture
- [ ] Understand what was implemented

## Troubleshooting Completed

If you had issues, check which you resolved:

- [ ] Fixed database connection issues
- [ ] Fixed port conflicts
- [ ] Fixed CORS errors
- [ ] Fixed migration errors
- [ ] Fixed seed data issues
- [ ] Fixed authentication issues
- [ ] Fixed API connection issues

## Next Steps

### Immediate
- [ ] Change default passwords
- [ ] Generate new JWT secret
- [ ] Add your own data
- [ ] Create your own account
- [ ] Test all features thoroughly

### Before Production
- [ ] Set up SSL/HTTPS
- [ ] Use managed PostgreSQL
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Add rate limiting
- [ ] Set up CI/CD
- [ ] Add automated tests
- [ ] Configure logging
- [ ] Set up error tracking

### Customization
- [ ] Customize company name
- [ ] Add your logo
- [ ] Adjust categories
- [ ] Create job templates for your business
- [ ] Set up your suppliers
- [ ] Add your workers
- [ ] Configure notification emails (future)

## Final Verification

### Overall System Health
- [ ] No console errors
- [ ] No backend errors in logs
- [ ] Database queries working
- [ ] All features functional
- [ ] Performance acceptable
- [ ] Security configured
- [ ] Documentation understood

### User Experience
- [ ] Login is smooth
- [ ] Navigation is intuitive
- [ ] Data loads quickly
- [ ] Actions save immediately
- [ ] Error messages helpful
- [ ] UI is responsive

## Sign-Off

Once all items are checked:

**Installation Status:** ✅ Complete

**Date Completed:** _______________

**Installed By:** _______________

**Notes:**
_______________________________________
_______________________________________
_______________________________________

## Support Resources

If you need help:

1. **Setup Issues:** See `SETUP.md`
2. **API Questions:** See `server/README.md`
3. **Quick Reference:** See `QUICK_START.md`
4. **Architecture:** See `IMPLEMENTATION_OVERVIEW.md`

## Common Commands Reference

```bash
# Start backend
cd server && npm run dev

# Start frontend (new terminal)
npm run dev

# Reset database
cd server
npm run migrate
npm run seed

# Check PostgreSQL
pg_isready
psql -U postgres -d plumbpro_inventory

# Test API
curl http://localhost:5000/health

# View logs
# Backend: Terminal where npm run dev is running
# Frontend: Browser console (F12)
```

---

**Congratulations on completing the installation!** 🎉

Your PlumbPro Inventory system is now ready for use with:
- ✅ Complete backend API
- ✅ PostgreSQL database
- ✅ User authentication
- ✅ Offline support
- ✅ Auto-save functionality
- ✅ AI-powered smart ordering

**Total Setup Time:** Approximately 10-15 minutes

**Next:** Start using the system or customize it for your business needs!
