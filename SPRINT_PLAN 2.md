# PlumbPro Inventory — Sprint Implementation Plan

Generated: 2026-03-23
Status: Ready for execution

---

## Sprint 1 — Replace All Browser Native Dialogs

**Priority:** P0 | **Effort:** Low | **Impact:** High (UX/trust)

Replace every `alert()`, `confirm()`, and `window.prompt()` with app-native UI using the existing `ToastNotification` (`useToast()`) and `ConfirmationModal` components.

### Tasks

- [ ] **S1-1** `views/SettingsView.tsx` — Replace 7 `alert()` calls (lines 202, 206, 229, 244, 263, 303, 311) with `useToast()` success/error toasts for Xero connect/disconnect/sync and API key feedback
- [ ] **S1-2** `views/OrderingView.tsx` — Replace 4 `alert()` calls (lines 156, 190, 270, 1092) with toasts for stock check results, PO creation success, bulk PO creation, and item selection validation
- [ ] **S1-3** `views/ApprovalsView.tsx` — Replace 2 `alert()` calls (lines 91, 103) with inline validation message and error toast
- [ ] **S1-4** `views/KitManagementView.tsx` — Replace `window.prompt('New category name')` (line 240) with an inline modal/dialog input
- [ ] **S1-5** `components/BulkSupplierOperations.tsx` — Replace `alert()` (line 86) with error toast for CSV parse failure
- [ ] **S1-6** `components/CommandPalette.tsx` — Wire "Create Backup" action (line 224) to real backup API endpoint instead of stub alert
- [ ] **S1-7** `components/CommandPalette.tsx` — Wire "Edit Profile" action (line 261) to navigate to Settings tab instead of stub alert

### Acceptance Criteria

- Zero `alert()`, `confirm()`, or `window.prompt()` calls remain in any `.tsx` or `.ts` file (excluding `node_modules`)
- All feedback uses `useToast()` or `ConfirmationModal` from existing components
- No functional regression in any affected view

---

## Sprint 2 — Build Real JobPlanningView

**Priority:** P0 | **Effort:** Medium | **Impact:** High (feature gap)

`views/JobPlanningView.tsx` is currently 69 lines — a header, an AroFlo banner, and a pass-through to `<JobsView />`. Build a real planning interface.

### Tasks

- [ ] **S2-1** Create `views/job-planning/JobPlanningBoard.tsx` — Visual scheduling board with date-range calendar view showing jobs per day/week
- [ ] **S2-2** Create `views/job-planning/TechnicianCapacity.tsx` — Workload indicators per technician (assigned hours vs. available)
- [ ] **S2-3** Create `views/job-planning/QuickJobCreator.tsx` — Template-to-job quick-creation flow (select template → assign date/tech → create)
- [ ] **S2-4** Rewrite `views/JobPlanningView.tsx` to compose the new subcomponents into a full planning dashboard
- [ ] **S2-5** Add drag-to-reschedule interaction on the scheduling board (move jobs between dates/technicians)
- [ ] **S2-6** Keep the AroFlo "Coming Soon" banner but scope it as a future integration hook at the top of the view

### Acceptance Criteria

- JobPlanningView is a distinct, useful view (not a JobsView wrapper)
- Users can see job schedule, technician workload, and create jobs from templates
- Drag-to-reschedule updates job date and assigned technician via API

---

## Sprint 3 — Invoice Currency & CommandPalette Wiring

**Priority:** P0 | **Effort:** Very Low | **Impact:** Medium

### Tasks

- [ ] **S3-1** `server/src/routes/invoices.js:524` — Remove hardcoded `currency: 'aud'` and pull from user/tenant settings (fall back to `'aud'` if unset)
- [ ] **S3-2** Add currency selector to `views/SettingsView.tsx` under a Billing/Regional section
- [ ] **S3-3** Create backend endpoint or add field to settings route for storing user currency preference
- [ ] **S3-4** Update invoice PDF export to use the configured currency symbol

### Acceptance Criteria

- Invoices use the currency configured in settings
- Default remains AUD for existing users without a preference set
- Currency symbol renders correctly in invoice PDF exports

---

## Sprint 4 — API Error Response Standardization

**Priority:** P1 | **Effort:** Medium | **Impact:** High (reliability)

### Tasks

- [ ] **S4-1** Create `server/src/middleware/errorHandler.js` — Global Express error handler with standard response shape: `{ error: string, code: string, details?: any }`
- [ ] **S4-2** Create `server/src/utils/apiErrors.js` — Error class hierarchy (`ValidationError`, `NotFoundError`, `AuthError`, `ConflictError`) that maps to HTTP status codes
- [ ] **S4-3** Audit and update all 46 route files in `server/src/routes/` to use the standardized error classes instead of ad-hoc `res.status().json()` error patterns
- [ ] **S4-4** Update frontend `lib/errors.ts` and API interceptors to handle the new standardized error shape
- [ ] **S4-5** Add global error handler registration in `server/src/app.js`

### Acceptance Criteria

- All API error responses follow `{ error, code, details? }` shape
- Frontend error handling correctly parses and displays standardized errors
- No unhandled Express errors crash the process

---

## Sprint 5 — Core Test Coverage

**Priority:** P1 | **Effort:** High | **Impact:** High (safety net)

### Tasks

- [ ] **S5-1** Set up Supertest integration test infrastructure in `tests/integration/` with database setup/teardown helpers
- [ ] **S5-2** Write integration tests: Auth routes (register, login, JWT validation, token expiry)
- [ ] **S5-3** Write integration tests: Inventory CRUD (create, read, update, delete, stock adjustment with movement tracking)
- [ ] **S5-4** Write integration tests: Job lifecycle (create → allocate items → pick → complete, verify stock deduction)
- [ ] **S5-5** Write integration tests: Quote → Invoice journey (create quote, approve, convert to invoice, record payment)
- [ ] **S5-6** Write integration tests: Customer portal (magic-link generation, token verification, quote approval/rejection)
- [ ] **S5-7** Write integration tests: Team management (invite, accept invite, role assignment, permissions enforcement)
- [ ] **S5-8** Add CI gate — tests must pass before merge (update `.github/workflows/` if applicable)

### Acceptance Criteria

- All 6 core business flows have passing integration tests
- Tests run against a real test database (not mocks)
- Tests can run in CI and locally via `npm run test`

---

## Sprint 6 — Offline Sync Hardening

**Priority:** P1 | **Effort:** Medium | **Impact:** Medium

### Tasks

- [ ] **S6-1** `lib/offlineQueue.ts` — Add conflict detection: compare server version timestamp against local mutation timestamp before applying
- [ ] **S6-2** `lib/offlineQueue.ts` — Add configurable retry with exponential backoff for failed sync operations
- [ ] **S6-3** `components/OfflineSyncStatus.tsx` — Show queue depth (N pending mutations), failing items, and last sync time
- [ ] **S6-4** Add user-facing conflict resolution UI — when a conflict is detected, show both versions and let user choose
- [ ] **S6-5** Validate service worker sync behavior in Chrome, Safari, and Firefox
- [ ] **S6-6** Add structured logging for sync events (queue, retry, conflict, resolution)

### Acceptance Criteria

- Conflicting offline/online mutations are detected and surfaced to the user
- Failed sync operations retry with backoff and are visible in the UI
- Sync queue state is observable (pending count, failures, last success)

---

## Sprint 7 — Permissions Audit

**Priority:** P1 | **Effort:** Low | **Impact:** High (security)

### Tasks

- [ ] **S7-1** Audit `server/src/routes/franchise.js` — Verify all endpoints require `owner` or `admin` role
- [ ] **S7-2** Audit `server/src/routes/developmentProjects.js` and `server/src/routes/apiAccess.js` — Verify `admin` role requirement
- [ ] **S7-3** Audit `server/src/routes/whiteLabel.js` — Verify `owner` role requirement
- [ ] **S7-4** Audit `server/src/routes/portal.js` — Verify portal routes use only portal token auth (not JWT user auth)
- [ ] **S7-5** Audit all remaining routes for consistent `authenticateToken` middleware usage
- [ ] **S7-6** Add missing role checks where found and write tests for permission boundaries
- [ ] **S7-7** Verify frontend route guards match backend protection (hidden nav items can't be navigated to directly)

### Acceptance Criteria

- Every protected route enforces appropriate role-based access
- Portal routes are isolated from the main auth flow
- No route can be accessed without proper authentication and authorization

---

## Sprint 8 — Large File Splitting

**Priority:** P2 | **Effort:** High | **Impact:** Medium (maintainability)

### Tasks

- [ ] **S8-1** Split `App.tsx` (1,975 lines) into:
  - `AppShell.tsx` — layout, sidebar, header
  - `AppModals.tsx` — global modal registry and state
  - `AppProviders.tsx` — context providers wrapping
  - Keep `App.tsx` as thin composition root
- [ ] **S8-2** Split `views/TeamManagementView.tsx` (1,740 lines) into:
  - `views/team/TeamDashboard.tsx` — stats and overview
  - `views/team/TeamMemberCard.tsx` — member display
  - `views/team/InviteModal.tsx` — invitation form
  - `views/team/RoleEditor.tsx` — role/permissions editing
- [ ] **S8-3** Split `views/QuotesView.tsx` (1,471 lines) into:
  - `views/quotes/QuoteList.tsx` — listing and search
  - `views/quotes/QuoteEditor.tsx` — line items and form
  - `views/quotes/QuotePreview.tsx` — PDF preview
- [ ] **S8-4** Split `views/OrderingView.tsx` (1,385 lines) into:
  - `views/ordering/SmartSuggestions.tsx` — AI ordering suggestions
  - `views/ordering/PriceAlertsList.tsx` — price alert display
  - `views/ordering/OrderForm.tsx` — PO creation form
- [ ] **S8-5** Review and lazy-load `lib/franchiseAPI.ts` (31,879 lines), `lib/onboardingService.ts` (14,045 lines), and `lib/exportUtils.ts` (12,708 lines) via dynamic imports

### Acceptance Criteria

- `App.tsx` is under 300 lines
- Split views maintain identical functionality (no regressions)
- Large lib files are lazy-loaded and don't increase initial bundle size
- All existing tests still pass

---

## Sprint 9 — Franchise Module Activation

**Priority:** P3 | **Effort:** Very Low | **Impact:** Low

The franchise module code is fully built (1,330-line view + 1,328-line backend). This sprint is activation only.

### Tasks

- [ ] **S9-1** Update `app/moduleCatalog.ts` — Change franchise status from `'deferred'` to `'active'`
- [ ] **S9-2** Add Franchise to navigation in `components/Navigation.tsx` behind `owner` role gate
- [ ] **S9-3** Verify franchise CRUD flow works end-to-end with demo data
- [ ] **S9-4** Run franchise database migration if not already applied
- [ ] **S9-5** Write one integration test for franchise create/read/update lifecycle

### Acceptance Criteria

- Franchise module is accessible to `owner` role users via navigation
- CRUD operations work against the database
- Non-owner users cannot see or access franchise features

---

## Sprint 10 — Additional Language Support

**Priority:** P3 | **Effort:** Low | **Impact:** Low (ongoing)

i18n infrastructure is complete. This is translation file creation.

### Tasks

- [ ] **S10-1** Create `locales/fr.json` — French translations (copy structure from `en.json`)
- [ ] **S10-2** Create `locales/de.json` — German translations
- [ ] **S10-3** Update `components/LanguageSwitcher.tsx` — Add French and German to `SUPPORTED_LANGUAGES` array
- [ ] **S10-4** Audit newer views (post-i18n implementation) for hardcoded English strings that bypass `t()` calls
- [ ] **S10-5** Add translation coverage check script to flag missing keys across locale files

### Acceptance Criteria

- Language switcher offers EN, ES, FR, DE
- All UI strings in core views use `t()` translation calls
- No missing translation keys cause fallback to raw key strings in any supported language

---

## Sprint Execution Order

| Order | Sprint | Priority | Effort | Impact | Dependencies |
|-------|--------|----------|--------|--------|-------------|
| 1 | Sprint 1 — Browser Dialogs | P0 | Low | High | None |
| 2 | Sprint 3 — Invoice Currency | P0 | Very Low | Medium | None |
| 3 | Sprint 2 — JobPlanningView | P0 | Medium | High | None |
| 4 | Sprint 7 — Permissions Audit | P1 | Low | High | None |
| 5 | Sprint 4 — Error Standardization | P1 | Medium | High | None |
| 6 | Sprint 5 — Test Coverage | P1 | High | High | Sprint 4 (uses standardized errors) |
| 7 | Sprint 6 — Offline Sync | P1 | Medium | Medium | None |
| 8 | Sprint 8 — File Splitting | P2 | High | Medium | Sprint 5 (tests provide safety net) |
| 9 | Sprint 9 — Franchise Activation | P3 | Very Low | Low | Sprint 7 (permissions verified) |
| 10 | Sprint 10 — Languages | P3 | Low | Low | None |

---

## Update Log

| Date | Update |
|------|--------|
| 2026-03-23 | Initial plan created from full codebase analysis |

---

## Notes

- The `APPLICATION_ANALYSIS_REPORT.md` lists several P0 items (portal emails, team invitations, white-label uploads, voice memos, stock scanner) that have since been **completed** — those are excluded from this plan.
- The existing `ToastNotification` component and `useToast()` hook should be used for all Sprint 1 replacements.
- The existing `ConfirmationModal` component should be used for any confirm-style dialogs.
- All sprint tasks are designed to be independently executable by a CLI agent.
