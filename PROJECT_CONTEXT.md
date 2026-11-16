# Project Context: Inventory Pro (Clinic Management System)

> **Client/Organization:** Maryam Nawaz Health Clinic (MNHC) / Mobile Clinic  
> **Authorized Lead:** Dr Usama Akram  
> **Project Type:** Single Page Web Application (SPA)  
> **Primary Purpose:** Medical clinic stock control, real-time pharmaceutical dispensing, procurement purchase orders, audit trails, and role-based staff management.

---

## 1. Executive Summary & Domain Overview

**Inventory Pro** is a specialized hospital and clinic inventory management system built to track pharmaceutical and clinical stock with high fidelity. The system provides an end-to-end operational pipeline:
- **Procurement:** Detecting low-stock medications, drafting and issuing Purchase Orders (POs), and receiving physical stock with automatic inventory quantity and cost recalculation.
- **Dispensing (Point of Care):** Rapid search, cart management, instant quantity validation, optimistic stock deduction, and real-time audit logging per staff member.
- **Reporting & Analytics:** Interactive multi-timescale charts (daily, weekly, monthly), category breakdowns, and exportable printable reports (HTML/PDF print sheets) or CSV files.
- **Role-Based Access Control (RBAC):** Distinct administrative and staff privileges enforced at both the UI routing level and Supabase authentication layer.

---

## 2. Technical Stack

| Layer | Technology | Details |
|---|---|---|
| **Runtime & Framework** | React 19 (`react` 19.2.0, `react-dom` 19.2.0) | Modern functional components, hooks, Context API |
| **Build Tooling & Dev Server** | Vite 7 (`vite` 7.3.1), `@vitejs/plugin-react` | Ultra-fast HMR and optimized production bundling |
| **Styling & Design** | Tailwind CSS v4 (`tailwindcss` 4.2.1, `@tailwindcss/vite` 4.2.1) | Clean medical color palette (primary emerald `#08834c`, accents, dark mode support) |
| **Backend & Database** | Supabase (`@supabase/supabase-js` 2.98.0) | Hosted PostgreSQL, Row-Level Security (RLS), Realtime WebSocket sync |
| **Edge Compute** | Supabase Edge Functions (`admin-user-manager`) | Privileged administrative operations (staff provisioning, email update, account deletion) |
| **Data Visualization** | Recharts (`recharts` 3.8.0) | Responsive dynamic Bar, Line, and Area charts |
| **Iconography** | Lucide React (`lucide-react` 0.577.0) | Unified medical, system, and category icons |
| **Date & Time** | `date-fns` 4.1.0 & Custom Formatters | Fiscal start-of-week and start-of-month calculations |
| **Data Interchange & Export** | Native CSV parser/generator, Print CSS engine | Bulk CSV import/export, print-ready reports with embedded clinic logo |

---

## 3. Directory & File Architecture

```
Inventory Management/
├── index.html                   # HTML entry point, tab metadata & favicon
├── vite.config.js               # Vite configuration with React and Tailwind v4 plugins
├── package.json                 # Dependency manifest and npm scripts
├── .env.local                   # Environment configuration (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
├── public/                      # Static assets served as-is (e.g. favicon)
├── src/
│   ├── main.jsx                 # Application entry point, attaches React root
│   ├── App.jsx                  # Main view switcher, top navigation bar, admin notification bell
│   ├── App.css / index.css      # Core Tailwind directives, custom scrollbars, animations
│   │
│   ├── assets/                  # Brand assets & clinic emblems
│   │   ├── logo.png             # Official emblem logo
│   │   ├── main.png             # Main clinic logo
│   │   └── pdf.png              # Mobile clinic banner for reports and mobile header
│   │
│   ├── context/                 # Global state management
│   │   ├── AuthContext.jsx      # Supabase auth session, user profile lookup, role verification (`admin`/`user`)
│   │   └── InventoryContext.jsx # Inventory, dispense cart, PO draft, realtime subscription, notifications
│   │
│   ├── lib/
│   │   └── supabase.js          # Configures and exports the Supabase client instance
│   │
│   ├── components/              # Shared UI components & modals
│   │   ├── Sidebar.jsx          # Responsive collapsible navigation with active indicators and logout
│   │   ├── Modals.jsx           # Global modal manager (PO receive, PO details, product edit, categories, confirm dialogs)
│   │   ├── DuplicateOrderModal.jsx # Reorder cloning tool with live catalog price sync and draft merge/replace
│   │   ├── StaffManagementCard.jsx # Admin panel for staff creation and account revoking via Edge Functions
│   │   └── AccountSettingsCard.jsx # User self-service password changes and administrative email modification
│   │
│   ├── utils/                   # Business logic helpers & constants
│   │   ├── supabaseActions.js   # Encapsulated async CRUD actions for all database tables
│   │   ├── helpers.js           # Date formatting, custom calendar calculations, CSV escape & download utilities
│   │   ├── data.js              # Icon dictionary registry mapping names to Lucide icons
│   │   └── clinicLogo.js        # Base64 encoded clinic logo string for standalone print engine
│   │
│   └── views/                   # Primary page/tab views
│       ├── AuthView.jsx         # Login portal with clinic branding and validation
│       ├── DashboardView.jsx    # Real-time KPIs, sales/dispense trends, top medicines, category metrics
│       ├── DispenseView.jsx     # POS-style pharmacy dispense cart, inventory lookup, and dispense history
│       ├── PurchaseOrderView.jsx# Reorder drafting, threshold-based suggestions, PO history, receiving flow
│       ├── InventoryView.jsx    # Master stock catalog, stock status badges (In Stock/Low/Out), search & pagination
│       ├── DataManagementView.jsx# High-performance bulk CSV import with intelligent deduplication, and backup exports
│       ├── ReportsView.jsx      # Date-bounded incoming vs outgoing reports, printable PDF format and CSV export
│       └── SettingsView.jsx     # Appearance settings, chart preferences, calendar bounds, category manager, danger zone
```

---

## 4. Database Schema & Data Models

The system interfaces with PostgreSQL hosted on Supabase:

### 1. `profiles`
Stores user profile information linked to `auth.users`.
- `id` (`uuid`, PK, FK `auth.users.id`)
- `full_name` (`text`)
- `role` (`text`: `'admin'` | `'user'`)
- `created_at` (`timestamp with time zone`)

### 2. `inventory`
Master registry for clinical stock items.
- `id` (`text`, PK, format e.g. `#MED...`)
- `name` (`text`, unique/indexed)
- `category` (`text`, maps to `categories.name`)
- `quantity` (`integer`, current on-hand units)
- `threshold` (`integer`, low-stock warning threshold)
- `unit` (`text`, e.g. 'Tablets', 'Capsules', 'Vials', 'Bottles')
- `price` (`numeric`, unit price in PKR)
- `created_at` (`timestamp with time zone`)

### 3. `categories`
Categorization tree for medicines and supplies.
- `name` (`text`, PK)
- `icon` (`text`, name of matching Lucide icon in `AVAILABLE_ICONS`)

### 4. `dispense_history` & `dispense_history_items`
Audit trail of all patient/department dispensations.
- **`dispense_history`**:
  - `record_id` (`text`, PK, timestamp-based ID)
  - `timestamp` (`timestamp with time zone`)
  - `total_amount` (`numeric`, total transaction price)
  - `dispensed_by` (`text`, name of staff member)
- **`dispense_history_items`**:
  - `id` (`bigint`/`uuid`, PK)
  - `record_id` (`text`, FK `dispense_history.record_id` ON DELETE CASCADE)
  - `item_id` (`text`, FK `inventory.id`)
  - `item_name` (`text`)
  - `dispense_qty` (`integer`)
  - `price` (`numeric`, unit price at time of dispensing)

### 5. `purchase_orders` & `purchase_order_items`
Procurement cycle tracking from draft to fulfillment.
- **`purchase_orders`**:
  - `po_id` (`text`, PK, format `PO-XXXXX`)
  - `status` (`text`: `'Pending'` | `'Completed'`)
  - `date` (`timestamp with time zone`)
  - `completion_date` (`timestamp with time zone`, nullable)
- **`purchase_order_items`**:
  - `id` (`bigint`/`uuid`, PK)
  - `po_id` (`text`, FK `purchase_orders.po_id` ON DELETE CASCADE)
  - `item_id` (`text`)
  - `item_name` (`text`)
  - `item_unit` (`text`)
  - `order_qty` (`integer`)
  - `received_qty` (`integer`, defaults to 0)
  - `price` (`numeric`)

### 6. `settings`
Global organizational preferences.
- `id` (`integer`, PK, default row 1)
- `week_start_day` (`integer`: 0=Sunday to 6=Saturday)
- `month_start_date` (`integer`: 1 to 31)
- `chart_type` (`text`: `'bar'` | `'line'` | `'area'`)

---

## 5. Key System Workflows

### 5.1 Authentication & RBAC
- **Admin Role:** Full unconstrained access across all tabs (Dashboard, Dispense, Purchase Orders, Inventory, Data Management, Reports, Settings, Staff Management, Danger Zone).
- **Staff/User Role:** Restricted access:
  - Can dispense medications and view dispensing history.
  - Can view the Dashboard in read-only mode.
  - Restricted tabs (PO, Inventory edit, Data management, Reports, Settings/Staff) are hidden from the sidebar and protected at the component render boundary.

### 5.2 Optimistic UI & Real-Time Sync
1. Every state alteration (dispensing, receiving PO, editing inventory, deleting records) executes **optimistically**:
   - Local state in `InventoryContext` immediately recalculates quantities and UI state.
   - Background worker calls async functions in `src/utils/supabaseActions.js`.
   - On network error or failure, silent recovery or fallback data refresh occurs.
2. A Supabase Realtime channel (`public-db-changes`) subscribes to Postgres table mutations:
   - When any staff member dispenses items, an admin connected on another device receives an instant in-app notification with the dispensing staff's name, item breakdown, and total amount.
   - Notifications are cached in `localStorage` for 24 hours.

### 5.3 Point of Care Dispensing Pipeline
1. Staff selects or searches for products in `DispenseView`.
2. Products are added to an active session cart (`cart`).
3. Quantity validation prevents dispensing quantities greater than available stock.
4. On confirmation:
   - Items are optimistic-deducted from `inventory`.
   - Transaction is written to `dispense_history` and `dispense_history_items`.
   - Cart resets immediately.
   - Deleting a past dispense record automatically reverses the transaction and restores the exact quantities back to `inventory`.

### 5.4 Procurement & Purchase Order Flow
1. Low-stock detection (`quantity <= threshold`) or out-of-stock items (`quantity === 0`) are highlighted.
2. One-click PO drafting calculates suggested order quantities (`Math.max((threshold * 2) - quantity, 50)`).
3. Creation logs `Pending` PO with its line items.
4. Upon delivery, the administrator opens the **Receive Stock Modal**:
   - Line items can be checked with actual received quantities and updated supplier unit prices.
   - Completing the PO marks status as `Completed` and automatically increments inventory stock and updates unit prices.
5. **Historical Reordering & Duplication:**
   - Any historical PO (Completed or Pending) can be duplicated with one click from the Order History table or PO Details modal.
   - Automatically synchronizes with current inventory catalog prices and live stock levels, with options to retain historical prices or merge/replace current drafts.

### 5.5 High-Speed CSV Import & Deduplication
In `DataManagementView`:
1. Custom non-blocking reader prevents UI thread lock during large file processing.
2. CSV rows are sanitized via `parseCSVRow`.
3. Smart deduplication logic:
   - **Intra-CSV duplicates:** Multiple rows with the same product name sum their quantities together.
   - **Database duplicates:** Items matching existing inventory by name retain their canonical ID and update pricing/thresholds instead of duplicating records.
   - **New items:** Automatically assigned unique structured IDs (`#MED<TIMESTAMP>-<RAND>-<ROW>`).
4. Category auto-provisioning automatically adds newly encountered categories to the `categories` table.

### 5.6 Reporting Engine
In `ReportsView`:
1. Administrators filter by custom date windows (defaults to past 30 days).
2. Generates aggregated analytics for incoming deliveries (purchases) and outgoing consumption (dispensations).
3. Export Options:
   - **Printable Report:** Dynamically generated print-styled HTML window including embedded base64 clinic emblem, summary cards, itemized tables, and automated browser print dialog trigger (`window.print()`).
   - **CSV Export:** Standard spreadsheet-compatible CSV download.

---

## 6. Development & Operational Commands

```bash
# Install dependencies
npm install

# Start local development server with Vite HMR
npm run dev

# Run ESLint check
npm run lint

# Compile production bundle
npm run build

# Preview production build locally
npm run preview
```

### Environment Configuration
Ensure `.env.local` exists in the root directory:
```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

