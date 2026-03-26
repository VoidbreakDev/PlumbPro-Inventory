# PlumbPro Inventory Application Analysis

## Scope Reviewed

- Frontend React/Vite application
- Node/Express backend under `server/`
- Supporting docs, scripts, and packaging metadata

## What The Application Is

PlumbPro Inventory is positioned as a vertical SaaS platform for plumbing and drainage businesses. The product combines inventory control, job planning, quoting/invoicing, supplier management, workflow automation, and customer self-service into one operational system.

From the codebase and docs, the intended customer is a trade business that needs:

- Stock visibility across warehouse, vans, and job locations
- Scheduling and material allocation for service jobs
- Quotes, invoices, and customer communication
- Team/technician management
- Reporting, analytics, and AI-assisted ordering decisions

The repo also targets multiple delivery models:

- Web app via Vite/React
- Progressive web app behavior via service worker and mobile-oriented views
- Desktop packaging via Electron

## Implemented Feature Areas

The implementation appears materially broader than a simple inventory tool. Major implemented modules include:

- Inventory management, stock movements, stock transfers, returns, kit/BOM support
- Job planning, calendar, templates, picking, approvals
- Contacts, suppliers, subcontractors, team management
- Quotes, invoices, customer portal, Xero integration scaffolding
- Analytics, AI forecast, reporting, supplier analytics, price alerts
- Workflow automation and notifications
- Mobile/field-service modules including GPS, offline sync, barcode scanning, voice notes, van stock
- White-label, franchise, API access, and permissions modules

Evidence:

- Navigation exposes broad SaaS modules in `components/Navigation.tsx`
- Frontend views exist under `views/`
- Backend route modules exist under `server/src/routes/`
- Product positioning and pricing are defined in `README.md`

## Intended SaaS Use Case

This is intended to operate as a multi-tenant field-service SaaS for plumbing businesses rather than a single-company internal tool.

Signals supporting that conclusion:

- The backend repeatedly scopes data by `user_id`
- README includes pricing tiers and plan positioning (`README.md:199`)
- The backend documents JWT auth, role-based access, and tenant-style isolation
- Modules like white-label, franchise, API keys, webhooks, customer portal, and Xero imply SaaS monetization and external customer access

## Product Maturity Observations

- The repo is feature-rich but unevenly hardened.
- Some README claims appear ahead of production readiness.
- There is evidence of ongoing prototyping and shipping-from-repo behavior: generated artifacts, release bundles, local `.env`, logs, and utility scripts are present in the working tree.
- Automated test coverage is minimal. The current test suite only ran one example test file.

## Current Execution Checks

I ran the project’s available checks from the repository.

### Frontend build

- `npm run build`: passed
- Result: production build completes successfully
- Warning: Vite reports a very large JS chunk (`dist/assets/index-uMJhC77T.js` ~2.9 MB minified), which is a performance concern rather than a hard failure

### Frontend tests

- `npm test -- --run`: passed
- Limitation: only `tests/unit/example.test.ts` ran, so this does not validate core product flows

### Frontend lint

- `npm run lint`: failed
- Cause: `eslint` is referenced in `package.json` scripts but is not installed in dependencies/devDependencies
- Evidence:
  - lint script exists in `package.json:13`
  - no `eslint` package is declared in `package.json:35-45`

### Backend build

- `npm run build` inside `server/`: failed
- Cause: the backend package has no `build` script
- Evidence: `server/package.json:7-11`

## Functional Errors / Implementation Risks

### 1. Customer portal queries are likely broken for normal data

The customer portal filters jobs using `builder::uuid`, but the schema defines `jobs.builder` as `VARCHAR(255)`.

- Query usage: `server/src/routes/portal.js:177-179`, `server/src/routes/portal.js:193`, `server/src/routes/portal.js:212`
- Schema definition: `server/src/db/schema.sql:105-116`

Impact:

- If `builder` contains a normal text value such as a builder/company name, PostgreSQL can throw `invalid input syntax for type uuid`
- This can break portal dashboard, recent jobs, and pending quote retrieval

### 2. Admin bootstrap script is out of sync with the live schema

`server/create-admin.js` inserts into `users (email, password, company, created_at)`, while the main auth flow uses fields like `password_hash`, `full_name`, and `company_name`.

- Evidence: `server/create-admin.js:14-18`

Impact:

- The script is likely non-functional against the current schema
- It increases the chance of unsafe manual admin creation or one-off production fixes

## Security Findings

### 1. Sensitive environment file is tracked in git

The repository ignores `.env`, but `.env` is already tracked.

- Ignore rule: `.gitignore:11-14`
- Tracked file evidence: `git ls-files` shows `.env`

Impact:

- High risk of secret leakage if real credentials are stored there
- Also indicates repo hygiene issues around operational secrets

Recommended action:

- Remove tracked `.env` from version control
- Rotate any secrets that have ever been stored in it
- Keep only `.env.example`

### 2. Xero OAuth state handling is weak and not actually verified

The Xero OAuth flow generates a random value, but instead of storing and validating it server-side, it base64-encodes the user ID plus the random string and returns that state to the client. The callback then trusts the decoded `userId`.

- State generation and return: `server/src/routes/xero.js:57-77`
- Callback trust of decoded user ID: `server/src/routes/xero.js:102-110`

Impact:

- CSRF protection is incomplete
- A forged callback with attacker-controlled `state` could bind an OAuth result to the wrong account if an authorization code can be obtained

Recommended action:

- Store an opaque state server-side with expiry
- Bind it to the initiating authenticated session
- Reject callbacks whose state is absent, reused, or mismatched

### 3. Auth tokens are stored in `localStorage`

Business auth tokens and portal auth tokens are persisted in `localStorage`.

- Main auth token storage: `store/useStore.ts:154-155`, `store/useStore.ts:181-182`
- Portal token storage: `views/CustomerPortalView.tsx:58-60`

Impact:

- Any XSS issue can exfiltrate bearer tokens
- This is especially sensitive for a SaaS app with billing/customer data and cross-tenant access boundaries

Recommended action:

- Prefer secure, `HttpOnly`, `SameSite` cookies for session tokens
- If bearer tokens remain client-side, reduce exposure window and harden CSP further

### 4. AI key encryption falls back to `JWT_SECRET`

If `AI_KEYS_ENCRYPTION_SECRET` is missing, the app derives the encryption key from `JWT_SECRET`.

- Evidence: `server/src/services/aiKeyService.js:7-13`

Impact:

- Token-signing and secret-encryption become coupled
- Compromise or rotation of one secret affects another security domain

Recommended action:

- Require a dedicated encryption secret
- Fail startup if it is missing

## Additional Security / Operational Concerns

- The repo contains development/testing affordances around disabling auth (`server/disable-auth.sh`). Even though the current checked route files still use auth middleware, this should not live in a production-facing repository without strict safeguards.
- The root repo contains built assets, release outputs, logs, and local artifacts. That increases the chance of accidental data leakage and supply-chain confusion.
- The backend exposes many advanced modules, but there is no meaningful automated security test coverage visible in the repo.

## Overall Assessment

PlumbPro Inventory is clearly intended to be a trade-focused operational SaaS platform with inventory, job, finance, and customer-service capabilities. The architecture supports that direction, and the frontend production build currently succeeds.

However, the application is not yet operationally clean enough to be considered hardened SaaS infrastructure. The biggest issues from this review are:

- repo secret hygiene (`.env` tracked)
- weak OAuth state validation in Xero integration
- token storage in `localStorage`
- a likely live portal query defect caused by schema/query mismatch
- incomplete engineering quality gates (`lint` broken, minimal tests, no backend build script)

## Recommended Next Priorities

1. Remove tracked secrets and rotate credentials.
2. Fix the customer portal `builder::uuid` query/schema mismatch.
3. Repair engineering checks: add/install ESLint and define a backend verification script.
4. Replace or reduce `localStorage` token exposure.
5. Rework Xero OAuth state handling to use server-side state validation.
6. Add real integration tests for auth, tenant isolation, inventory CRUD, jobs, portal, and invoicing.
