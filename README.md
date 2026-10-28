# FinRoute Collect

> **A FinRoute Enterprise Microfinance Platform**  
> *Sunday Collections, Multi-Tenant PostgreSQL Ledger & Route Management System*  
> Official Website: [https://fin-route.site/](https://fin-route.site/)  
> Lead & Inquiries WhatsApp: [+91 8978388567](https://wa.me/918978388567?text=Hello%20FinRoute%2C%20I%20am%20interested%20in%20FinRoute%20Collector%20for%20microfinance%20loan%20tracking)

---

## 📌 Project Agenda & Overview

**FinRoute Collect** is an enterprise-grade, high-performance web ledger engineered specifically for microfinance institutions, field collection officers, and credit managers conducting weekly Sunday loan collections.

### The Problem It Solves
Traditional microfinance operations rely heavily on fragile physical paper ledgers or cumbersome spreadsheets that:
- Require repetitive manual calculations for customer balances, overdue amounts, and rolling cash.
- Lack freeze panes and sticky navigation on field smartphones.
- Fail when field agents are offline or working in low-connectivity rural areas.
- Introduce transcription errors between loan disbursements, collections, expenses, and bank deposits.
- Lack multi-tenant database isolation, data security hardening, and regional language support.

### The FinRoute Mission
FinRoute Collect delivers a **modern, secure, multi-tenant, offline-first digital ledger** that:
1. **Accelerates Collections**: Rapid inline payment entry with zero page reloads.
2. **Multi-Tenant Architecture**: Supports both dedicated Supabase PostgreSQL database instances per tenant and Google Sheets integration.
3. **Automates Financial Math**: Instant, real-time calculations for paid amounts, remaining balances, and cash reconciliations.
4. **Optimized for Field Mobility**: Sticky table headers and pinned freeze panes ensure effortless navigation on mobile devices and desktop computers.
5. **Native Dual-Language Localization**: Full English and Telugu (తెలుగు) dictionary support with 1-click WhatsApp customer payment reminders.
6. **Enterprise Security**: Sanitized against XSS, CSV formula injection, and unauthorized data leakage.

---

## 🚀 Key Features & Capabilities

| Feature | Description |
| :--- | :--- |
| **Dedicated Multi-Tenancy** | Independent PostgreSQL databases per tenant (Supabase) or Google Sheets sync with central authentication. |
| **Super Admin Control Center** | Accessible via `#admin` route to provision tenants, manage admin accounts, monitor active leases, and inspect live audit logs. |
| **Dual-Language i18n** | Full client-side localization for **English** and **తెలుగు (Telugu)** with local persistence and parameter interpolation. |
| **1-Click WhatsApp Reminders** | Tap `💬` next to any customer phone number to send a polite payment reminder in Telugu or English. |
| **Live Database Indicator** | Pulsating active green dot integrated directly on the *FinRoute Collect Sub-Product* header badge. |
| **Weekly Collection Matrix** | Scalable multi-week tracking (Week 1 to Week 10+) with auto-calculated status and totals. |
| **Smart Date Cascading** | Edit Week 1 date; all subsequent weeks automatically calculate and shift by `+7 days`. |
| **Sticky Navigation & Freeze Panes** | Table headings remain pinned at the top on both mobile and desktop. Customer name, ID, and serial number stay frozen on the left during horizontal scrolling. |
| **Cash Settlement Engine** | Reconciles opening cash, collections, bank deposits, new disbursements, expenses, and salaries. |
| **Village Route Grouping** | Group customers by village dividers (`రాంపూర్`, `కొత్తపేట`, etc.) and reorder rows to match collection routes. |
| **One-Click Quick Call** | Tap the `📞` icon next to any customer to directly dial them from mobile devices. |
| **Loan Renewal & Archive** | Archive completed/renewed loans with historical audit logs and clean slate for new cycles. |
| **Branded PDF Ledger Export** | Generate print-ready, high-resolution PDF collection reports on demand with XSS sanitization. |
| **Secure CSV Export** | Export route ledgers to Excel/CSV with complete protection against CSV Formula / DDE Injection. |

---

## 🌐 Localization & Telugu (తెలుగు) Support

FinRoute Collect includes a dictionary-based translation engine ([src/utils/translations.js](file:///c:/Users/genai/Downloads/Sheet/tracker-app/src/utils/translations.js)):

- **Header Language Switcher**: Toggle seamlessly between `🇬🇧 English` and `🇮🇳 తెలుగు`.
- **Domain-Tailored Terminology**: Standardized for microfinance in Andhra Pradesh & Telangana:
  - *Weekly Tracker* → *వారపు ట్రాకర్*
  - *Original Capital* → *అసలు మొత్తం*
  - *Total Payable* → *మొత్తం చెల్లించవలసినది*
  - *Outstanding Balance* → *మిగిలిన బకాయి*
  - *Active Loans* → *యాక్టివ్ లోన్లు*
  - *Paid Off* → *పూర్తయింది*
- **WhatsApp Message Templates**:
  - **Telugu**: *"నమస్కారం {name} గారు, FinRoute నుండి రిమైండర్: మీ వారం లోన్ వాయిదా మొత్తం ₹{amount} చెల్లించవలసి ఉంది. మిగిలిన మొత్తం బకాయి: ₹{balance}. ధన్యవాదాలు!"*
  - **English**: *"Namaste {name} garu, reminder from FinRoute: Your weekly installment of ₹{amount} is due. Remaining loan balance: ₹{balance}. Thank you!"*

---

## 🔒 Security Hardening & Data Protection

1. **Stored XSS Elimination in PDF Reports**:
   - All dynamic customer fields (`name`, `phone`, `villageName`, `date`, `status`) are strictly sanitized via an `escapeHtml()` sanitizer prior to rendering into `html2pdf.js`.
2. **CSV Formula Injection (DDE) Mitigation**:
   - In [src/utils/exportCSV.js](file:///c:/Users/genai/Downloads/Sheet/tracker-app/src/utils/exportCSV.js), all cell values starting with `=, +, -, @, \t, \r` are automatically prepended with a single quote (`'`), preventing malicious code execution in Excel or Google Sheets.
3. **Super Admin Authentication Guard**:
   - Super admin login ([src/components/SuperAdminPanel.jsx](file:///c:/Users/genai/Downloads/Sheet/tracker-app/src/components/SuperAdminPanel.jsx)) incorporates strict regex email format validation, password minimum length verification, and sanitized state management.
4. **Row Level Security (RLS)**:
   - Supabase master database tables (`master_tenants`, `master_super_admins`, `master_audit_logs`) are protected by explicit RLS policies prohibiting unauthorized anonymous table listing or modification.
5. **No Code File Bloat**:
   - Strict architectural guideline ensuring all project files remain strictly under **1,500 lines** of code for clean maintainability and modularity.

---

## 🧠 Core Financial Logics

### 1. Weekly Date Cascading Logic
- In microfinance Sunday collections, all collection cycles occur every 7 days.
- Field officers enter or edit the **Week 1 Date** (e.g., `25/10/2026`).
- The application parses the date and cascades `+7 days` to Week 2 (`01/11/2026`), Week 3 (`08/11/2026`), and all subsequent weeks.
- Subsequent week dates are locked from accidental individual modification to prevent date corruption across the route.

### 2. Live Customer Account Balance Calculation
For each customer row:
$$\text{Total Paid} = \sum (\text{Payments in Week 1, Week 2, \dots, Week } N)$$
$$\text{Balance Due} = \text{Disbursed Amount} - \text{Total Paid}$$

- **Status Badges**:
  - If $\text{Balance Due} \le 0$: Flagged with **Paid Off** / **పూర్తయింది**.
  - If $\text{Balance Due} > 0$: Flagged with **Active** / **యాక్టివ్**.

### 3. Cash Reconciliation & Rolling Cash Engine
At the bottom of each weekly column:
$$\text{Net Cash in Hand} = \text{Opening Cash} + \text{Collections} - \text{Bank Deposit} - \text{New Disbursed} - \text{Expenses} - \text{Salaries}$$

- **Opening Cash**: Opening balance at the start of the collection day.
- **Collections**: Auto-summed from all customer payment inputs for that week column.
- **Bank Deposit**: Amount deposited directly into the bank during the collection day.
- **New Disbursed**: Cash disbursed to new or renewing borrowers during the day.
- **Expenses**: Field operational costs (fuel, travel, meals, stationery).
- **Salaries**: Staff compensation or collection agent allowances paid out in cash.
- **Rolling Cash**: The resulting net cash automatically rolls forward as the next week's opening balance.

---

## 💻 Tech Stack & Architecture

- **Frontend Core**: React 19 + Vite (Modern ES Modules)
- **Styling**: Tailwind CSS v4 + Vanilla CSS Design Tokens
- **Icons**: Lucide React
- **Typography**:
  - Telugu: `Noto Sans Telugu` (Google Fonts)
  - English & Numbers: `Inter`
- **PDF Generation**: `html2pdf.js` with DOM XSS escaping
- **Multi-Tenant Databases**:
  - **PostgreSQL**: Dedicated Supabase tenant databases (`supabase_tenant_template.sql`)
  - **Master Gateway**: Central master Supabase instance (`supabase_master_setup.sql`)
  - **Google Sheets**: Bidirectional Google Apps Script engine (`Code.gs`)
- **Offline Persistence**: Browser `localStorage` with JSON serialization & optimistic sync queue

---

## 📁 Project Directory Structure

```text
tracker-app/
├── public/                         # Static assets (logos, icons, redirects)
├── src/
│   ├── assets/                     # Brand graphics & icons
│   ├── components/
│   │   ├── AppModals.jsx           # Reusable app modals wrapper
│   │   ├── ArchiveTable.jsx        # Lazy-loaded historical loan archive
│   │   ├── Footer.jsx              # Platform footer & finroute-collector branding
│   │   ├── Header.jsx              # Navigation, language switcher & live status dot
│   │   ├── ImportSheetModal.jsx    # Legacy Google Sheets to Supabase importer
│   │   ├── KpiDeck.jsx             # Key performance indicator summary cards
│   │   ├── LandingPage.jsx         # Product showcase with WhatsApp lead CTA
│   │   ├── LoadingScreen.jsx       # Elegant loading skeleton screens
│   │   ├── LoginScreen.jsx         # PIN authentication & tenant portal gate
│   │   ├── Modals.jsx              # Add customer, renew, and week modals
│   │   ├── SuperAdminModals.jsx    # Super Admin tenant management dialogs
│   │   ├── SuperAdminPanel.jsx     # Master tenant provisioning & audit logs
│   │   ├── Toast.jsx               # Floating toast notifications
│   │   ├── Toolbar.jsx             # Search, filter, and tab navigation
│   │   └── TrackerTable.jsx        # Main ledger matrix with frozen sticky panes
│   ├── hooks/
│   │   ├── useLedgerCalculations.js# Financial calculation logic & totals
│   │   └── useTrackerSync.js       # Auto-sync & debounced cloud queue
│   ├── services/
│   │   ├── cloudService.js         # Google Apps Script cloud sync client
│   │   ├── masterAuthService.js    # Super Admin & tenant authentication
│   │   ├── sessionService.js       # Secure session hydration & persistence
│   │   └── tenantDatabaseService.js# Supabase PostgreSQL client & data layer
│   ├── utils/
│   │   ├── customerNormalization.js# Customer data schema sanitizer
│   │   ├── exportCSV.js            # Hardened CSV exporter (DDE safe)
│   │   ├── formatters.js           # Indian Rupee (₹) & date formatters
│   │   ├── generatePdfReport.js    # XSS-sanitized PDF ledger generator
│   │   └── translations.js         # English + Telugu i18n dictionary
│   ├── App.jsx                     # Top-level state coordinator
│   ├── index.css                   # Tailwind tokens & scrollbar utilities
│   ├── initialData.js              # Fallback initial sample ledger data
│   └── main.jsx                    # Application entry point
├── supabase/
│   ├── supabase_master_setup.sql   # Master multi-tenant DB setup script
│   └── supabase_tenant_template.sql# Dedicated tenant database setup script
├── Code.gs                         # Google Apps Script cloud sync engine
├── .env.example                    # Environment variable template
├── package.json                    # Dependencies & build scripts
└── vite.config.js                  # Vite bundler configuration
```

---

## 🛠️ How to Set Up and Run Locally

### Prerequisites
- Node.js (version 18 or higher)
- npm or yarn

### 1. Installation
```powershell
cd c:\Users\genai\Downloads\Sheet\tracker-app
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Ensure your master environment variables are set:
```env
VITE_MASTER_AUTH_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
VITE_MASTER_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_MASTER_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 3. Start Development Server
```powershell
npm run dev
```
Open your browser at `http://localhost:5173`.

### 4. Build for Production
```powershell
npm.cmd run build
```
The optimized bundle will be compiled to the `dist/` directory in under 500ms.

---

## 🚀 Deployment Instructions

### Deploy to Netlify / Vercel / Cloudflare Pages

#### Method 1: Automatic Zip & Upload
Run the bundled PowerShell script to build and package `dist.zip`:
```powershell
npm run build:zip
```
Drag and drop `dist.zip` into:
- **Netlify Drop**: [https://app.netlify.com/drop](https://app.netlify.com/drop)
- **Cloudflare Pages**: Direct upload tab
- Any standard web hosting cPanel / public_html directory.

#### Method 2: Command Line Deployment
```bash
# Vercel
npx vercel deploy --prod

# Netlify
npx netlify deploy --prod --dir=dist
```

---

## 📱 User Guide: Field Operations

1. **Authentication**: Enter tenant PIN or sign in via tenant credentials.
2. **Language Selection**: Click `🇬🇧 English` or `🇮🇳 తెలుగు` in the top right to switch language.
3. **Recording Payments**: Click any weekly payment cell, type the amount, and press `Enter` (or click away). Changes persist instantly.
4. **WhatsApp Reminders**: Click `💬` next to any customer phone number to open a pre-filled reminder in the customer's preferred language.
5. **Editing Customer Info**:
   - Customer Name, Customer ID, Mobile Number, and Village Dividers are directly editable inline.
   - Click `📅` to pick a date via the native calendar picker.
6. **Cash Settlement Reconciliation**:
   - Scroll to the bottom row of any week.
   - Enter Cash in Hand, Bank Deposits, Expenses, and Salaries. Net cash carries forward automatically.
7. **Report Exports**:
   - Click **Download PDF** for a print-ready route ledger report.
   - Click **Export CSV** for an Excel-compatible spreadsheet.

---

## 📄 License & Intellectual Property

Copyright © 2026 **FinRoute**. All rights reserved.  
*FinRoute Collect — Enterprise Multi-Tenant Edition.*
