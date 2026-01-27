# PlumbPro - Feature Reference Document

## Overview
PlumbPro is a comprehensive plumbing business management SaaS application targeting all sectors of the plumbing industry: new construction, maintenance, commercial, and franchise operations.

**Current Development Status:** Pre-MVP, building alongside full-time work
**Tech Stack:** Web-based application (responsive for desktop and mobile)
**AI Integration:** Gemini API (transitioning from local AI model)

---

## Pricing Structure

### Solo Tier - $15/month
- Single user
- 100 AI queries/month
- Core features (jobs, quotes, invoices, basic inventory)
- 1-2 basic integrations
- Up to 500 active inventory items
- Email support

### Team Tier - $50/month (2-5 users included)
- Up to 5 users
- 500 AI queries/month (shared)
- Full inventory system with price history (last 12 months)
- Purchase orders and goods inward
- Stock picking system
- All integrations unlocked
- Supplier performance tracking (basic)
- Priority email support

### Business Tier - $50/month + $12/user for 6+ users
- Unlimited users at $12/user/month
- BYOK option for AI (or unlimited queries)
- Custom user roles and granular permissions
- Full price history (unlimited)
- Advanced supplier performance tracking
- Multi-location inventory support
- Advanced reporting and analytics
- API access
- Priority support + onboarding call

**Annual Billing:** 2 months free (15% effective discount)

---

## Core Features (MVP - Phase 1)

### Job Management
- Create, schedule, and track jobs
- Assign jobs to team members
- Job status tracking (quoted, scheduled, in-progress, completed)
- Job notes and documentation
- Time tracking per job
- Job templates for recurring work types

### Quoting System
- AI-assisted quote generation
- Customizable quote templates
- Material and labor line items
- Markup and margin controls
- Quote versioning
- PDF export
- Email delivery
- Quote approval workflows (for restricted users)

### Invoicing
- Auto-populated from job completion and stock usage
- Progress invoicing for staged payments
- Customizable invoice templates
- Payment tracking (paid/unpaid/partial)
- Payment terms configuration (NET 7/14/30/60)
- PDF export and email delivery
- Integration with accounting software

### Customer Management
- Customer database (contact info, addresses)
- Customer history (jobs, quotes, invoices)
- Customer notes
- Service agreements and recurring work
- Customer-specific pricing

### Basic Inventory System
- Add/edit/delete inventory items
- Current stock levels
- Low stock alerts
- Stock categories and organization
- Manual stock adjustments
- CSV import for bulk item upload
- Inventory item search and filtering

### Stock Picking for Jobs
- Allocate stock to upcoming jobs
- Real-time available stock calculation
  - Physical Stock: What's on the shelf
  - Available Stock: Physical - Allocated
  - Allocated Stock: Reserved for picked jobs
  - On Order: Items in open purchase orders
- Stock allocation reduces available stock immediately
- Prevents double-allocation conflicts
- Stock movement logging: "Allocated to Job #XXXX - Client Name"

### AI Integration (Gemini API)
- AI-assisted quote generation
- Invoice description enhancement
- Smart suggestions for material requirements
- API usage tracking per user/tier
- Rate limiting by subscription tier
- BYOK (Bring Your Own Key) option for Business tier

### User Authentication
- Secure login/registration
- Password reset functionality
- Session management
- Email verification

---

## Post-Launch Features (Phase 2)

### Purchase Order System
- Create purchase orders for suppliers
- Multi-supplier support
- PO approval workflows (for spending control)
- PO status tracking (draft, sent, received, closed)
- Expected vs actual delivery dates
- Link POs to specific jobs
- Supplier communication history

### Goods Inward / Stock Receiving
- Check-in stock against purchase orders
- Record discrepancies:
  - Expected quantity vs received quantity
  - Damaged/defective items
  - Substitutions or missing items
  - Date received vs expected delivery date
  - Notes on packaging/quality issues
- Automatic inventory updates upon completion
- Stock movement logging: "GI from PO #XXXX - Supplier Y - [Date] - +50 units"
- Optional quick check-in ("All correct" / "Issues found" / "Skip")

### Stock Return System
- Stock return process on job completion
- Review picked items vs used items
- Automatic calculation: Picked - Used = Returned
- Return stock to available inventory
- Stock movement logging: "Returned from Job #XXXX - +15 units"
- Handle scenarios:
  - Full return (job cancelled)
  - Partial return (standard usage)
  - Over-usage (needed more than picked)
  - Damaged/unusable items (write-off, not returned to available)
- Variance tracking (picked ≠ used + returned)

### Stock Movement History
- Complete audit trail of all stock movements
- Movement types:
  - Goods Inward (from PO)
  - Allocated to Job (stock picking)
  - Job Completion (consumed/used)
  - Returned from Job
  - Manual Adjustment (with reason)
  - Returns to Supplier
  - Damaged/Written Off
  - Transfer Between Locations
- Timestamp, user, and reason for each movement
- Searchable and filterable history
- Traceability (which PO, which job, which supplier)

### Price History Tracking
- Track price changes over time per item
- Record:
  - Date of price change
  - Old price → New price
  - Supplier/source
  - Optional reason field
- Automated matching when CSV re-imported:
  - Match by supplier product code
  - Flag similar items for manual review
  - Preview changes before applying
- Impact analysis on active quotes
- Update prices in draft quotes or flag for review

### Supplier Dashboard
- Supplier contact and account information
- Price trend visualization per item/category
- Items with recent price increases (30/90 day view)
- Comparison across suppliers for common items
- Price spike alerts
- Annual cost increase percentages

### Supplier Performance Tracking
- Order accuracy rate (% received as expected)
- Average discrepancy value (financial impact)
- Defect rate per supplier
- Timeline reliability (early/on-time/late)
- Most common issues by supplier
- Supplier scorecard for informed decision-making

### Basic Reporting
- Job profitability reports
- Inventory turnover rates
- Stock usage by job type
- Slow-moving inventory
- Most-used items
- Supplier lead time analysis
- Payment status summaries

### Team User Management
- Add/remove team members
- Basic role assignment
- User activity tracking

---

## Advanced Features (Phase 3)

### Smart Ordering System
- Reorder alerts based on:
  - Available stock levels
  - Allocated stock (upcoming jobs)
  - Lead times
  - Historical usage patterns
- Suggest optimal order quantities
- Account for items on order
- Recommend bulk purchases for high-turnover items
- Predictive ordering based on trends

### Advanced User Permissions & Roles

#### Default Role Templates
- **Apprentice/New Hire:**
  - View assigned jobs only
  - Basic stock picking (with approval)
  - Time tracking
  - No access to financials, pricing, customer data

- **Tradesperson:**
  - Manage assigned jobs
  - Stock picking and returns
  - Create quotes (may need approval)
  - View own job history
  - Limited customer access (contact info only)

- **Senior Tradesperson/Foreman:**
  - All Tradesperson permissions
  - Assign jobs to others
  - Approve quotes up to certain value
  - Full stock management
  - Purchase orders
  - Customer management

- **Office Admin:**
  - Full customer database
  - Invoicing and payments
  - Reporting and analytics
  - Cannot modify pricing/margins (if locked)

- **Manager:**
  - Everything except financial settings
  - User management
  - Supplier management
  - System configuration

- **Owner:**
  - Full system access
  - Financial settings and margins
  - User permission management
  - Integrations and billing

#### Granular Permission Categories

**Jobs & Scheduling:**
- View all jobs / own jobs only
- Create jobs
- Assign jobs to others
- Edit job details
- Delete/cancel jobs
- Mark jobs complete

**Stock & Inventory:**
- View inventory
- Pick stock
- Return stock
- Manual adjustments
- Create purchase orders
- Receive goods (Goods Inward)
- View stock costs

**Financial:**
- View quotes
- Create quotes
- Approve quotes (with value thresholds)
- Send invoices
- Record payments
- View profit margins
- Access financial reports
- Set pricing

**Customers:**
- View customer list
- View full customer details
- Create/edit customers
- Delete customers
- View customer history
- Export customer data

**Administrative:**
- User management
- Supplier management
- System settings
- Integration management
- View audit logs

#### Permission Features
- Custom role creation (Business tier)
- Value-based approval thresholds (e.g., quotes over $500 need manager approval)
- Approval workflows and queues
- Permission templates by tenure (0-3 months, 3-6 months, 6+ months, 1+ years)
- Audit trail of permission changes
- Failed access attempt logging

### Stock Return Editing Rules
- **Job Complete, Invoice Draft:** Full edit access to stock return
- **Invoice Sent, Unpaid:** Limited edits with warnings (affects invoice)
- **Invoice Paid:** Locked - manual adjustment only with full audit trail

### Manual Stock Adjustments
- Available when invoice is paid or for other corrections
- Required fields:
  - Who made the change
  - Date/time
  - Reason (required text field)
  - Before/after quantities
  - Related job number (if applicable)
- Full audit trail for compliance

### Multi-Location Inventory
- Separate stock tracking per location:
  - Main warehouse
  - Site sheds
  - Service vans
  - Regional depots
- Transfer stock between locations
- Location-specific stock levels
- Van stock management for service plumbers

### Integrations
- **Accounting Software:**
  - Xero
  - MYOB
  - QuickBooks
- **Plumbing-Specific Software:**
  - AroFlo
  - ServiceM8
  - Tradify (potential)
- **CRM Integration (future)**
- **Payment Gateways:**
  - Stripe
  - Square (potential)
- Sync frequency tiers (daily for Solo, real-time for Team+)

### Advanced Analytics & Reporting
- Job profitability trending
- Customer lifetime value
- Material waste analysis
- Labor efficiency metrics
- Seasonal demand patterns
- Forecasting and predictive analytics
- Custom report builder
- Automated report scheduling
- Export to Excel/PDF

### API Access (Business Tier)
- RESTful API for custom integrations
- Webhook support
- API documentation
- Rate limiting per tier
- OAuth authentication

---

## Sector-Specific Considerations

### New Construction
- Longer project timelines (weeks/months)
- Progress invoicing (staged payments)
- Blueprint/plan attachments
- Large bulk material orders
- Multi-trade coordination
- Large stock allocations per job

### Maintenance/Service
- Quick turnaround jobs (same-day)
- Emergency callout pricing and after-hours rates
- Recurring service agreements
- Van stock management
- Customer service history critical
- Quick on-site quoting (mobile-optimized)

### Commercial
- Compliance documentation tracking
- Maintenance contracts (recurring revenue)
- Larger teams on single jobs
- Specialized equipment tracking
- Safety documentation
- Multi-site management
- Longer payment terms (30-60 days NET)

### Franchise Operations
- Multi-tenant architecture (each franchisee separate)
- Brand compliance (uniform templates)
- Centralized purchasing and reporting
- Territory management
- Lead distribution
- Royalty calculations
- White-label options

---

## Technical Architecture Notes

### Frontend
- Responsive web application (desktop + mobile)
- Framework suggestions: Next.js, SvelteKit
- UI library: TailwindCSS with Shadcn/ui or DaisyUI
- Mobile-first design for field technicians

### Backend
- Suggested: Python FastAPI or Node.js/Express
- Database: PostgreSQL (complex queries, reporting, relationships)
- ORM: Prisma or SQLAlchemy
- RESTful API architecture

### AI Integration
- Gemini API (primary)
- Backend handles API calls (secure API key)
- Rate limiting per user/tier
- Usage tracking and analytics
- Caching for common queries
- BYOK support for Business tier

### Infrastructure
- Hosting: Vercel, Railway, or similar
- Database: Supabase, PlanetScale
- Authentication: Clerk or Supabase Auth
- File storage: S3 or Cloudflare R2
- Error tracking: Sentry
- Analytics: Mixpanel, PostHog

### Payment Processing
- Stripe (recommended)
- Subscription management
- Automatic invoicing
- Tax compliance (via Stripe Tax)
- Usage-based billing support

### Security
- Role-based access control (RBAC)
- Data encryption (at rest and in transit)
- Regular backups
- Audit logging
- GDPR/privacy compliance
- Two-factor authentication (optional for users)

---

## Development Phases & Timeline

### Phase 1: MVP (Months 1-6)
**Core Deliverables:**
- Job management CRUD
- Quoting and invoicing
- Customer database
- Basic inventory (add/view/edit, CSV import)
- Stock picking with allocation
- User authentication
- AI integration (Gemini)
- Payment processing setup

**Timeline:** 3-4 months solo development with AI assistance

### Phase 2: Post-Launch Iteration (Months 7-12)
**Feature Additions:**
- Purchase order system
- Goods inward process
- Stock return on job completion
- Price history tracking
- Supplier dashboard (basic)
- Stock movement history
- Basic reporting
- Team user management

**Focus:** Real user feedback drives priority

### Phase 3: Advanced Features (Year 2)
**Feature Additions:**
- Smart ordering system
- Advanced permissions and roles
- Multi-location inventory
- Supplier performance tracking
- Advanced analytics
- Additional integrations (Xero, etc.)
- API access
- Van stock management

**Focus:** Expanding to service and commercial sectors

### Phase 4: Scaling & Specialization (Year 2+)
**Feature Additions:**
- Franchise-specific features
- White-label options
- Advanced compliance tools
- Custom integrations
- Enterprise features

**Focus:** Market expansion and differentiation

---

## CSV Import Specifications

### Features
- Support for common supplier export formats
- Smart column matching (auto-detect "Product Code" vs "SKU" vs "Item ID")
- Bulk updates (re-import to refresh pricing without losing data)
- Validation warnings:
  - Duplicate items
  - Missing critical fields
  - Invalid data formats
- Preview before import
- Error reporting with line numbers

### Standard Fields
- Product Code / SKU (required, unique identifier)
- Product Name / Description (required)
- Supplier (optional, for tracking)
- Current Price (required)
- Unit of Measure (e.g., EA, MTR, PKG)
- Category (optional)
- Barcode (optional)
- Current Stock Level (optional, for initial import)

### Supplier-Specific Templates
- Pre-configured templates for major suppliers (Reece, Tradelink, etc.)
- Downloadable template examples
- Mapping guides for common formats

---

## Data & Compliance

### Audit Trails
- All stock movements logged with:
  - Timestamp
  - User who performed action
  - Action type
  - Before/after values
  - Related entities (job, PO, supplier)
  - Reason (for manual adjustments)

### Financial Records
- Invoice history (cannot edit after payment)
- Payment records
- Quote versioning
- Job costing accuracy
- Tax calculations

### User Activity Logging
- Login/logout events
- Permission changes
- Failed access attempts
- Data exports
- Critical system changes

### Data Retention
- Historical data preserved indefinitely (within storage limits)
- Soft deletes (mark as deleted, don't purge)
- Export capabilities for compliance
- GDPR right-to-deletion support

---

## Support & Onboarding

### Documentation
- Comprehensive user guides
- Video tutorials
- FAQ / Knowledge base
- API documentation (for Business tier)

### Support Channels
- **Solo Tier:** Email support (response within 48 hours)
- **Team Tier:** Priority email support (response within 24 hours)
- **Business Tier:** Priority support + onboarding call + dedicated account manager (optional)

### Onboarding
- Interactive product tour (first login)
- Sample data / demo mode
- Setup wizard for initial configuration
- CSV import assistance
- Migration support from other tools (Business tier)

---

## Marketing & Go-to-Market Strategy

### Target Audience
- Small to medium plumbing businesses (1-50 employees)
- All sectors: new construction, maintenance, commercial, franchise
- Australian market initially, global expansion potential

### Value Proposition
- "Built by someone in plumbing, for plumbers"
- Solve real inventory and admin pain points
- Not generic software adapted for plumbing
- Affordable, transparent pricing
- All features available (no artificial feature-gating)

### Distribution Channels
- Direct website sign-up
- Industry forums and Facebook groups
- Trade publications (ads and content)
- Google Ads (targeted keywords)
- Word-of-mouth / referrals
- Partnerships with suppliers or trade associations

### Launch Strategy
- **Soft Launch:** Beta with 10-20 known plumbers, gather testimonials
- **Public Launch:** Broader marketing with social proof
- **Founding Member Pricing:** Lock in lower rates for first 100 customers
- **14-Day Free Trial:** No credit card required, full feature access

---

## Success Metrics

### Product Metrics
- Trial-to-paid conversion rate (target: 70%+)
- Monthly Active Users
- Average jobs created per user per month (target: 10+)
- Stock movements logged per user
- AI query usage patterns

### Business Metrics
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (LTV)
- Churn rate (target: <5% monthly)
- Net Promoter Score (target: 30+)

### Development Metrics
- Feature release cadence
- Bug resolution time
- Uptime / reliability (target: 99.5%+)
- API response times

---

## Known Limitations & Future Considerations

### Current Limitations
- No direct supplier catalogue integration (relies on CSV import)
- No mobile app (web-responsive only)
- Limited offline capability
- Manual delivery time tracking (no supplier system integration)

### Future Enhancements (Post-Year 2)
- Native mobile apps (iOS/Android)
- Offline mode with sync
- Direct supplier integrations (APIs)
- Customer portal (view quotes, pay invoices)
- Advanced scheduling / route optimization
- Equipment maintenance tracking
- Photo documentation and job site photos
- Digital signatures for job completion
- SMS notifications
- Voice-to-text job notes

---

## Competitive Differentiation

### vs ServiceM8
- Stronger inventory and purchase order management
- Better suited for new construction (longer projects)
- More affordable Solo tier

### vs Tradify
- More comprehensive inventory system
- Supplier performance tracking
- Australian-built authenticity

### vs AroFlo
- Significantly more affordable
- Simpler, less overwhelming UI
- Focus on core needs, not enterprise bloat

### vs Xero/Accounting Software
- Plumbing-specific workflows
- Stock picking and job allocation
- Not just accounting, full business management

### PlumbPro's Unique Advantage
- Built by warehouse manager in plumbing industry
- Deep understanding of inventory pain points
- Price history and supplier tracking
- Smart ordering system
- Comprehensive stock movement audit trail
- Sector-agnostic (works for all plumbing types)

---

## Notes for Development

### Use AI Assistance For
- Boilerplate code (CRUD, API endpoints)
- Database schema design
- Error handling and validation
- Unit test generation
- Documentation writing
- Refactoring suggestions

### Keep Human Control For
- Architecture decisions
- UX/UI design
- Business logic and workflows
- Feature prioritization
- Security-critical code review
- Performance optimization

### Development Best Practices
- Modular code architecture
- Comprehensive testing (unit, integration, E2E)
- Version control (Git)
- Code comments for complex business logic
- Security audits (especially auth and payments)
- Regular backups and disaster recovery testing

---

## Contact & Feedback

**Developer:** Ryan (Warehouse Manager, Plumbing Industry)
**Development Approach:** Solo development with AI coding assistants (Codex, Claude Code)
**Status:** Pre-MVP, building alongside full-time work
**Target Launch:** 4-6 months from start

---

*This document is a living reference and will be updated as PlumbPro evolves.*
