# PlumbPro Inventory Management System

A comprehensive, AI-powered inventory and job allocation system specifically designed for plumbing and drainage businesses.

## ✨ Features

### Core Functionality
- **Real-time Inventory Management** - Track stock levels, reorder points, and supplier information
- **Job Scheduling & Planning** - Create jobs, assign workers, and allocate materials
- **AI-Powered Smart Ordering** - Google Gemini AI analyzes inventory and suggests reorders
- **Stock Reservation System** - Two-phase picking prevents over-allocation
- **Job Templates** - Reusable material lists for common job types
- **Complete Audit Trail** - Track all stock movements with timestamps and references
- **Contact Management** - Manage suppliers, plumbers, and customers

### New in v2.0 (Backend Integration)
- ✅ **User Authentication** - Secure JWT-based login and registration
- ✅ **Data Persistence** - PostgreSQL database for reliable data storage
- ✅ **Offline Support** - IndexedDB caching for offline access
- ✅ **Auto-save** - All changes automatically synced to database
- ✅ **Multi-tenancy** - Data isolation for multiple users/companies
- ✅ **Secure API** - Backend handles API keys and sensitive operations
- ✅ **State Management** - Zustand for efficient state handling
- ✅ **Role-based Access** - Admin, Manager, User, and Viewer roles

### New in v3.0 (Analytics & AI Features)
- ✅ **Analytics Dashboard** - Interactive charts and business insights
- ✅ **Notifications System** - Email alerts and in-app notifications
- ✅ **Multi-Provider AI** - Support for Gemini, Ollama (local/free), OpenAI, Claude
  - 🔮 **Predictive Forecasting** - AI predicts stock demand 7-90 days ahead
  - 🔍 **Natural Language Search** - Find items using plain English
  - 🤖 **Auto Template Generation** - Create job templates from descriptions
  - 🚨 **Anomaly Detection** - Detect unusual stock patterns
  - 📦 **Smart Purchase Orders** - AI-powered reorder recommendations
  - 💡 **Business Insights** - Actionable recommendations with health scoring
  - ⚙️ **Flexible Configuration** - Use different AI providers per feature

### New in v4.0 (Mobile & Field Service)
- ✅ **Mobile-First PWA** - Progressive Web App installable on any device
- ✅ **GPS Check-In/Out** - Location tracking with breadcrumb trails
- ✅ **Photo Documentation** - Before/after photos with GPS tagging
- ✅ **Digital Signatures** - Customer sign-off with legal validity
- ✅ **Barcode/QR Scanning** - Quick stock lookups and verification
- ✅ **Field Notes & Voice Memos** - Rich documentation on the go
- ✅ **Offline-First** - Full functionality without internet connection
- ✅ **Real-Time Tracking** - Live GPS tracking of field workers
- ✅ **AI Job Completion Check** - Automatic verification of requirements
- ✅ **Push Notifications** - Real-time job updates and alerts

### New in v5.0 (Workflow Automation)
- ✅ **Workflow Engine** - Automate repetitive business processes
- ✅ **12 Pre-Built Templates** - Common workflows ready to use
- ✅ **5 Trigger Types** - Stock levels, job status, schedules, manual, webhooks
- ✅ **10 Action Types** - Notifications, emails, POs, assignments, and more
- ✅ **Auto-Assignment Rules** - Intelligent job routing to workers
- ✅ **Scheduled Tasks** - Daily, weekly, monthly automation
- ✅ **Stock Alert Automation** - Never run out of critical items
- ✅ **Execution Monitoring** - Full visibility and analytics
- ✅ **Customer Notifications** - Automated job status updates
- ✅ **Smart Reordering** - AI-powered purchase order creation

### New in v6.0 (UX Enhancements) 🎉
- ✅ **Toast Notifications** - Beautiful feedback system (success, error, warning, info)
- ✅ **Command Palette** - Quick access to all actions (Cmd+K / Ctrl+K)
- ✅ **Interactive Onboarding** - Guided tours for new users
- ✅ **Loading States** - Skeleton screens and progress indicators
- ✅ **Contextual Help** - Inline tooltips and help icons throughout
- ✅ **Keyboard Shortcuts** - Power user features (12+ shortcuts)
- ✅ **Empty States** - Helpful CTAs when no data exists
- ✅ **Bulk Operations** - Multi-select and batch actions
- ✅ **Advanced Search** - Quick search with autocomplete
- ✅ **WCAG 2.1 AA Accessibility** - Screen reader support, keyboard navigation, focus management

## 🚀 Quick Start

### One-Command Installation (Recommended)

**macOS / Linux:**
```bash
chmod +x install.sh && ./install.sh
```

**Windows (PowerShell as Administrator):**
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; .\install.ps1
```

The automated installer will:
- ✅ Install Node.js & PostgreSQL (if needed)
- ✅ Create & initialize database
- ✅ Install all dependencies
- ✅ Create admin account
- ✅ Set up system services
- ✅ Build production frontend
- ✅ Create desktop shortcuts

**Installation takes 3-15 minutes depending on your system.**

See [QUICK_INSTALL.md](QUICK_INSTALL.md) for detailed quick start guide.

### Manual Installation

See [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) for complete manual installation instructions.

## 📋 Documentation

### New Setup (With Backend)

See **[SETUP.md](SETUP.md)** for complete installation instructions including database setup.

**Quick summary**:
1. Install PostgreSQL
2. Set up backend: `cd server && npm install && npm run migrate && npm run seed`
3. Set up frontend: `npm install`
4. Start backend: `cd server && npm run dev`
5. Start frontend: `npm run dev`
6. Login with demo credentials: `demo@plumbpro.com` / `demo123`

### Legacy Setup (Client-only)

If you want to run the original client-only version without backend:

1. Install dependencies: `npm install`
2. Set `GEMINI_API_KEY` in `.env.local`
3. Run the app: `npm run dev`

**Note**: The client-only version has no data persistence and is for demonstration purposes only.

## 📋 Tech Stack

### Frontend
- **React 19** - Modern UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library
- **Zustand** - State management
- **Axios** - HTTP client
- **LocalForage** - Offline storage

### Backend (New)
- **Node.js** - Runtime
- **Express** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Google Gemini AI** - Smart ordering

## 📁 Project Structure

```
PlumbPro-Inventory/
├── components/          # React components
│   ├── Shared.tsx      # Reusable UI components
│   └── LoginView.tsx   # Authentication UI
├── views/              # Main application views
│   ├── DashboardView.tsx
│   ├── InventoryView.tsx
│   ├── JobsView.tsx
│   ├── OrderingView.tsx
│   ├── HistoryView.tsx
│   └── ContactsView.tsx
├── store/              # State management
│   └── useStore.ts     # Zustand store
├── lib/                # Utilities
│   ├── api.ts          # API client
│   └── storage.ts      # Offline storage
├── server/             # Backend API
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── middleware/ # Auth & validation
│   │   ├── db/         # Database setup
│   │   └── config/     # Configuration
│   └── README.md       # Backend documentation
├── App.tsx             # Main app component
├── types.ts            # TypeScript types
└── constants.tsx       # Initial data (legacy)
```

## 🔑 Key Features Explained

### Stock Reservation System
1. Create a job and allocate materials
2. Materials are reserved but not removed from inventory
3. When ready, "Confirm & Pick" removes stock and marks job as picked
4. Prevents over-allocation while allowing planning ahead

### Job Templates
- Create reusable material lists for common jobs
- Apply templates to new or existing jobs
- Adjust quantities before applying
- Examples: "Basic Leak Repair", "Basin Installation"

### Smart Ordering (AI-Powered)
- Analyzes current stock levels vs. reorder points
- Considers upcoming job requirements
- Suggests quantities with reasoning
- Multi-provider AI (Gemini, Ollama, OpenAI, Claude)

### Audit Trail
- Complete history of all stock movements
- Filter by type, item, or date range
- Track: Stock In, Stock Out, Adjustments, Allocations
- References linked to jobs or reasons

## 🔐 Security Features

- **Password Hashing** - bcryptjs with salt rounds
- **JWT Tokens** - Secure authentication with expiration
- **SQL Injection Prevention** - Parameterized queries
- **CORS Protection** - Configurable allowed origins
- **Environment Secrets** - API keys stored server-side
- **Data Isolation** - Multi-tenant architecture

## 📖 Documentation

### Installation & Setup
- **[QUICK_INSTALL.md](QUICK_INSTALL.md)** - Quick installation guide
- **[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)** - Complete installation instructions
- **[SETUP.md](SETUP.md)** - Complete setup guide with troubleshooting
- **[server/README.md](server/README.md)** - Backend API documentation

### Features
- **[UX_INTEGRATION_GUIDE.md](UX_INTEGRATION_GUIDE.md)** - ⭐ **NEW v6.0** - UX features usage guide
- **[UX_FEATURES.md](UX_FEATURES.md)** - Complete UX component reference
- **[UX_IMPLEMENTATION_SUMMARY.md](UX_IMPLEMENTATION_SUMMARY.md)** - Technical UX implementation details
- **[WORKFLOW_AUTOMATION.md](WORKFLOW_AUTOMATION.md)** - Workflow engine complete guide
- **[MOBILE_FEATURES.md](MOBILE_FEATURES.md)** - Mobile & field service complete guide
- **[AI_FEATURES.md](AI_FEATURES.md)** - Advanced AI features comprehensive guide
- **[AI_PROVIDER_SETUP.md](AI_PROVIDER_SETUP.md)** - AI provider configuration (Gemini/Ollama/OpenAI/Claude)
- **[ANALYTICS_FEATURES.md](ANALYTICS_FEATURES.md)** - Analytics and reporting guide
- **[NOTIFICATIONS_FEATURES.md](NOTIFICATIONS_FEATURES.md)** - Notifications system guide
- **[DASHBOARD_ENHANCEMENTS.md](DASHBOARD_ENHANCEMENTS.md)** - Enhanced dashboard guide

## 🎯 Use Cases

Perfect for:
- Plumbing and drainage businesses
- HVAC contractors
- General contractors managing materials
- Small to medium-sized trade businesses
- Mobile service teams

## 🌐 API Endpoints

All endpoints are prefixed with `/api`:

- **Auth**: `/auth/login`, `/auth/register`, `/auth/me`
- **Inventory**: `/inventory` (CRUD operations)
- **Jobs**: `/jobs` (CRUD + pick operation)
- **Contacts**: `/contacts` (CRUD operations)
- **Templates**: `/templates` (CRUD operations)
- **Movements**: `/movements` (read with filters)
- **Smart Ordering**: `/smart-ordering/suggestions`
- **Analytics**: `/analytics/dashboard`, `/analytics/inventory`, etc.
- **Notifications**: `/notifications` (CRUD + preferences)
- **AI**: `/ai/forecast`, `/ai/search`, `/ai/anomalies`, `/ai/insights`, etc.
- **Mobile**: `/mobile/check-in`, `/mobile/photos`, `/mobile/signatures`, `/mobile/barcode-scan`, etc.

See [server/README.md](server/README.md) for full API documentation.

## 🔄 Offline Mode

The app supports offline functionality:
- All data cached in browser using IndexedDB
- Read-only access when offline
- Automatic sync when connection restored
- Last sync timestamp displayed

## 🛠️ Development

### Run in Development Mode

**Backend**:
```bash
cd server
npm run dev  # Runs on port 5000 with auto-restart
```

**Frontend**:
```bash
npm run dev  # Runs on port 3000
```

### Build for Production

**Frontend**:
```bash
npm run build
npm run preview
```

**Backend**:
```bash
cd server
npm start
```

## 📝 Environment Variables

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

### Backend (server/.env)
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=plumbpro_inventory
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_gemini_key
CORS_ORIGIN=http://localhost:3000
```

## 🧪 Testing

Demo credentials (after running seed):
- **Email**: demo@plumbpro.com
- **Password**: demo123

Test features:
1. Login with demo account
2. View pre-loaded inventory items
3. Create a new job
4. Allocate materials to job
5. Try AI smart ordering
6. Check stock history

## 📦 Database Schema

Key tables:
- `users` - User accounts
- `inventory_items` - Stock items
- `contacts` - Suppliers, workers, customers
- `jobs` - Scheduled work
- `job_templates` - Reusable templates
- `stock_movements` - Audit trail

See database schema in `server/src/db/schema.sql`

## 🚧 Roadmap

Completed:
- ✅ Backend API with PostgreSQL
- ✅ User authentication
- ✅ Offline support
- ✅ State management
- ✅ Advanced reporting and analytics
- ✅ Email/browser notifications
- ✅ Interactive dashboard with charts
- ✅ AI-powered predictive forecasting
- ✅ Natural language search
- ✅ Anomaly detection
- ✅ Smart purchase order generation
- ✅ Business insights and recommendations

Future enhancements:
- [ ] Mobile app (React Native)
- [ ] Invoice generation
- [ ] Mobile barcode scanning
- [ ] Multi-location support
- [ ] Team collaboration features
- [ ] SMS notifications (Twilio)
- [ ] Voice commands for AI assistant
- [ ] Image recognition for inventory
- [ ] Supplier integration for auto-ordering

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

This is a demonstration project. For production use, consider:
- Adding comprehensive testing
- Implementing error boundaries
- Adding form validation library
- Setting up CI/CD pipeline
- Implementing proper logging
- Adding monitoring and analytics

## 📧 Support

For setup help, see [SETUP.md](SETUP.md)

For API documentation, see [server/README.md](server/README.md)

---

**Built with** ❤️ **for the trades industry**
