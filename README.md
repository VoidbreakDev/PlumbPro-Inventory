# PlumbPro Inventory Management System

A comprehensive, AI-powered inventory and job management system designed specifically for plumbing and drainage businesses.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)

---

## 🎯 What is PlumbPro?

PlumbPro helps plumbing businesses manage their inventory, jobs, and team in one place. From tracking stock levels to scheduling jobs and generating invoices, PlumbPro streamlines your daily operations so you can focus on getting the job done.

---

## ✨ Key Features

### 📦 Inventory Management
- **Real-time stock tracking** - Know exactly what you have on hand
- **Smart reorder alerts** - Never run out of critical items
- **Multi-location support** - Track stock across warehouse, vans, and job sites
- **Barcode scanning** - Quick stock lookups with your phone camera
- **Price history tracking** - Monitor supplier price changes over time

### 📋 Job Management
- **Job scheduling** - Schedule and assign jobs to your team
- **Stock allocation** - Reserve materials for upcoming jobs
- **Job templates** - Reusable material lists for common jobs (e.g., "Standard Leak Repair")
- **Progress tracking** - Track job status from scheduled to completed
- **Photo documentation** - Attach before/after photos to jobs

### 🤖 AI-Powered Assistant
- **Smart ordering suggestions** - AI analyzes your usage and recommends what to order
- **Natural language search** - Find items by typing "copper pipes under $50"
- **Demand forecasting** - Predict stock needs 7-90 days ahead
- **Business insights** - Get recommendations to improve efficiency

### 📱 Mobile Field Service
- **Progressive Web App** - Works on any phone or tablet
- **GPS check-in/out** - Track time on site
- **Digital signatures** - Get customer sign-off on job completion
- **Offline mode** - Works without internet, syncs when connected
- **Voice memos** - Record notes hands-free while working

### 💰 Invoicing & Payments
- **Professional invoices** - Auto-generated from completed jobs
- **Online payments** - Customers can pay by credit card
- **Payment tracking** - See paid, unpaid, and overdue invoices at a glance
- **Customer portal** - Let customers view quotes and pay invoices online

### 📊 Reporting & Analytics
- **Business dashboard** - See key metrics at a glance
- **Job profitability** - Track costs vs revenue per job
- **Worker performance** - See completion rates and materials used
- **Supplier analysis** - Compare supplier prices and reliability
- **Export to Excel/PDF** - Share reports with your accountant

### ⚡ Workflow Automation
- **Automatic alerts** - Get notified when stock runs low
- **Customer notifications** - Auto-send job status updates
- **Scheduled reports** - Weekly stock summaries by email
- **Approval workflows** - Require manager approval for large purchases

---

## 🚀 Getting Started

### System Requirements
- Windows 10/11, macOS 10.15+, or Linux
- 4GB RAM minimum (8GB recommended)
- Internet connection for initial setup

### Installation

**Option 1: Automated Installer (Recommended)**

macOS / Linux:
```bash
chmod +x install.sh && ./install.sh
```

Windows (PowerShell as Administrator):
```powershell
.\install.ps1
```

**Option 2: Docker (Simplest)**
```bash
docker-compose up -d
```

**Option 3: Manual Setup**

See [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) for step-by-step instructions.

### First Login

After installation, access the app at `http://localhost:5173`

Default demo credentials:
- **Email:** demo@plumbpro.com
- **Password:** demo123

---

## 📖 User Guide

### Quick Start Video
*[Coming Soon]*

### Common Tasks

#### Adding Inventory Items
1. Go to **Inventory** tab
2. Click **Add Item**
3. Enter item details (name, category, quantity, reorder level)
4. Save

#### Creating a Job
1. Go to **Jobs** tab
2. Click **New Job**
3. Enter job details (title, date, assigned workers)
4. Allocate materials from inventory
5. Save

#### Picking Stock for a Job
1. Open the job
2. Click **Pick Job**
3. Confirm materials being used
4. Stock is automatically deducted from inventory

#### Generating an Invoice
1. Complete a job
2. Go to **Invoices** tab
3. Click **Create Invoice**
4. Select the customer and job
5. Add line items (materials, labor)
6. Send to customer

#### Using the AI Assistant
1. Click the **AI Assistant** button (top right)
2. Ask questions like:
   - "What items are running low?"
   - "Show me jobs for next week"
   - "Create a template for bathroom installations"

---

## 💡 Tips for Plumbers

### Stock Management Best Practices
- Set realistic reorder levels based on usage
- Use job templates to speed up common jobs
- Review the AI reorder suggestions weekly
- Take photos of damaged stock for records

### Mobile Usage
- Install the PWA on your phone for quick access
- Use voice memos to record notes while hands are dirty
- Check in when arriving on site for time tracking
- Take before/after photos for customer records

### Customer Relations
- Send quotes through the customer portal for faster approval
- Enable automatic job status notifications
- Use the customer portal to reduce "where's my invoice?" calls
- Export job history for warranty claims

---

## 📞 Support & Documentation

### Help Topics
- **[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)** - Detailed installation steps
- **[MOBILE_FEATURES.md](MOBILE_FEATURES.md)** - Mobile app guide
- **[AI_FEATURES.md](AI_FEATURES.md)** - Using the AI assistant
- **[WORKFLOW_AUTOMATION.md](WORKFLOW_AUTOMATION.md)** - Setting up automation

### Common Issues

**Can't log in?**
- Check that the server is running
- Try the demo credentials above
- Reset password via email link

**Data not saving?**
- Check internet connection
- Refresh the page and try again
- Check error message in notifications

**AI features not working?**
- Verify API key is configured (see AI_PROVIDER_SETUP.md)
- Check that you have available AI queries in your plan
- Try switching to a different AI provider

---

## 🏢 For Business Owners

### Pricing Tiers

**Solo** - $15/month
- 1 user
- 100 AI queries/month
- Core inventory & job features
- Up to 500 inventory items

**Team** - $50/month
- Up to 5 users
- 500 AI queries/month
- Purchase orders & stock picking
- All integrations
- Priority support

**Business** - $50/month + $12/user for 6+ users
- Unlimited users
- Unlimited AI queries
- Custom roles & permissions
- Multi-location support
- API access
- Priority support + onboarding

*Annual billing: 2 months free (15% discount)*

### Data Security
- All data encrypted in transit and at rest
- Automatic daily backups
- Role-based access control
- Audit trail of all changes
- GDPR compliant

---

## 🛣️ Roadmap

### Recently Added ✅
- Customer portal for quotes & invoices
- Mobile field service with GPS tracking
- AI-powered demand forecasting
- Workflow automation
- Advanced analytics dashboard

### Coming Soon
- Native iOS/Android apps
- Direct supplier integrations
- SMS notifications
- Equipment maintenance tracking
- Route optimization

---

## 🤝 Contributing

This is an open-source project. Contributions are welcome!

- Report bugs via GitHub Issues
- Submit feature requests
- Contribute code via Pull Requests

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

Built with ❤️ for the plumbing and trades industry.

**Technologies Used:**
- React & TypeScript
- PostgreSQL
- Google Gemini AI
- Tailwind CSS

---

*For technical documentation, API reference, and developer guides, see the `/docs` folder.*

---

## 🖥️ Desktop Application

PlumbPro Inventory can be packaged as a desktop application for Windows, macOS, and Linux with an embedded database and auto-updater.

### Building Desktop App

**Quick Start:**
```bash
# Prepare for deployment
./scripts/prepare-deployment.sh v1.0.0

# Build for your platform
cd desktop
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
npm run package:all    # All platforms
```

**Find installers in:** `desktop/release/{version}/`

### Auto-Updates

The desktop app includes automatic updates:
- Checks for updates on startup
- Downloads in background
- Prompts to install
- Installs on restart

Configure in `desktop/electron-builder.yml`.

### Deployment Documentation

- **[DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md)** - Quick deployment guide
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Comprehensive deployment documentation

---

## 🏢 Enterprise Features

### Multi-User Support
- Role-based access control
- User permissions and restrictions
- Activity audit logs

### Data Security
- Encrypted database storage
- Secure authentication (JWT)
- Automatic backups

### Customization
- White-label branding
- Custom fields for inventory
- Configurable workflows

---

## 🔧 Development

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Node.js + Express + PostgreSQL
- **Desktop**: Electron + electron-builder
- **AI**: Google Gemini API

### Project Structure
```
PlumbPro-Inventory/
├── components/        # React components
├── views/            # Page views
├── lib/              # API clients and utilities
├── server/           # Backend API
├── desktop/          # Electron desktop app
└── docs/             # Documentation
```

### Running Locally

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Start development server
npm run dev

# Start backend
cd server && npm start
```

---

## 📊 All Features

| Category | Features |
|----------|----------|
| **Inventory** | Stock tracking, multi-location, barcode scanning, price history, ABC classification |
| **Jobs** | Scheduling, templates, stock picking, progress tracking, photo docs |
| **Purchasing** | Smart ordering, purchase orders, supplier management, price alerts |
| **Sales** | Quotes, invoices, customer portal, service agreements |
| **CRM** | Contacts, communications, customer history, ratings |
| **Mobile** | PWA, GPS check-in, offline mode, voice notes, digital signatures |
| **AI** | Demand forecasting, smart search, anomaly detection, recommendations |
| **Assets** | Vehicle tracking, tool registry, maintenance schedules, GPS check-in/out |
| **Subcontractors** | Compliance tracking, insurance, licenses, job assignments |
| **Lead Pipeline** | Sales funnel, conversion tracking, follow-up management |
| **Analytics** | Technician performance, profitability reports, business insights |
| **Integrations** | Xero accounting, Google Calendar, payment processing |

---

## 🤝 Contributing

This is an open-source project. Contributions are welcome!

- Report bugs via GitHub Issues
- Submit feature requests
- Contribute code via Pull Requests

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

Built with ❤️ for the plumbing and trades industry.

**Technologies Used:**
- React & TypeScript
- PostgreSQL
- Google Gemini AI
- Tailwind CSS
- Electron

---

*For technical documentation, API reference, and developer guides, see the `/docs` folder.*
