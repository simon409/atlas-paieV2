# AtlasPaie

Application de gestion de paie marocaine (Moroccan Payroll Management) — desktop app built with **Tauri v2 + React 19 + TypeScript**. Fully local, offline-first, with a SQLite database and French UI.

---

## Stack

| Layer | Tech |
|---|---|
| Desktop shell | [Tauri v2](https://v2.tauri.app/) (Rust backend) |
| Frontend | React 19, TypeScript 5.8 |
| Styling | Tailwind CSS v4 |
| Database | SQLite via `@tauri-apps/plugin-sql` |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) 0.45 |
| Icons | Lucide React |
| Charts | Recharts |
| Animations | Framer Motion |
| Decimal math | decimal.js |
| Build | Vite 7 |

---

## Architecture

```
src/
├── App.tsx                  # Root: auth session restore, route switching
├── main.tsx                 # Entry point
├── index.css                # Global styles (Tailwind v4)
│
├── auth/
│   ├── auth.ts              # login(), restoreSession(), logout()
│   └── AuthContext.tsx       # useAuth(), useCanWrite(), useIsAdmin()
│
├── db/
│   ├── schema.ts            # Drizzle ORM table definitions (9 tables)
│   ├── models.ts            # TypeScript model types
│   ├── client.ts            # SQLite / Drizzle client init
│   ├── store.ts             # Employee CRUD, DB initialization
│   ├── companyStore.ts      # Company CRUD + active company tracking
│   ├── movementStore.ts     # Payroll movements (rubriques) CRUD
│   ├── payrollRunStore.ts   # Payroll run generation, CRUD, rounding
│   └── authStore.ts         # User CRUD, PBKDF2 auth, sessions
│
├── payroll/
│   ├── engine/
│   │   ├── grossToNet.ts    # Main pipeline entry
│   │   ├── state.ts         # PayrollState + init
│   │   └── pipeline/        # Step files: cnss, amo, ir, employerCost, fraisPro
│   ├── ir/
│   │   └── annualizer.ts    # Cumulative annual IR calculation
│   ├── calculators/         # ir, cnss, amo, fraisProfessionnels
│   ├── validators/          # CNSS & IR rule validation
│   ├── rules/               # 2025.json, 2026.json payroll rule files
│   ├── debug/               # Human-readable trace/explain
│   └── index.ts             # Public API
│
├── pages/
│   ├── LoginPage.tsx         # Auth form
│   ├── DashboardPage.tsx     # KPI cards + trend chart + breakdown
│   ├── EmployeesPage.tsx     # CRUD with slide-over form, search, tabs
│   ├── MovementsPage.tsx     # Employee movements (rubriques)
│   ├── PayrollRunsPage.tsx   # Generate, validate, delete runs
│   ├── PayslipsPage.tsx      # View/print payslips
│   ├── PayrollJournalPage.tsx# Aggregated payroll journal + print
│   ├── PayrollCalculatorPage.tsx # Standalone simulation tool
│   └── SettingsPage.tsx      # Companies, users, DB management
│
├── layouts/
│   └── DashboardLayout.tsx   # Sidebar + header + content shell
│
├── router/
│   └── routes.ts             # Type-safe route definitions, navigate()
│
├── app/
│   └── CompanyContext.tsx     # Active company React context
│
├── lib/
│   ├── decimal.ts            # roundMoney(), roundIR(), D()
│   └── math.ts               # normalizeRate(), clamp()
│
├── config/
│   ├── constants.ts          # DEFAULT_PAYROLL_YEAR = 2026
│   └── environment.ts        # Environment config
│
├── types/
│   ├── global.types.ts       # CurrencyCode
│   └── payroll.types.ts      # PayrollInput, PayrollResult, CumulativeIRContext
│
└── tests/
    └── payroll/golden/       # Golden test cases (smig, mid, high, cumulative, edge)
```

---

## Routes

| Path | Page | Description |
|---|---|---|
| `/login` | LoginPage | Authentication |
| `/dashboard` | DashboardPage | Home — KPIs, chart, breakdown |
| `/dashboard/employees` | EmployeesPage | Employee management |
| `/dashboard/movements` | MovementsPage | Payroll movements (rubriques) |
| `/dashboard/runs` | PayrollRunsPage | Generate & manage payroll runs |
| `/dashboard/payslips` | PayslipsPage | View & print payslips |
| `/dashboard/journal` | PayrollJournalPage | Aggregated payroll journal |
| `/dashboard/payroll` | PayrollCalculatorPage | Standalone simulation |
| `/dashboard/settings` | SettingsPage | Companies, users, DB |

All routes except `/login` require authentication. SPA navigation via `window.history.pushState` + `popstate`.

---

## Authentication

- **Login**: email + password → PBKDF2 (100k iterations, SHA-256, 16-byte salt) → UUID session token stored in `localStorage`
- **Session expiry**: 8 hours
- **Default admin**: `admin@atlas.local` / `admin` (auto-seeded on first login attempt when no users exist)
- **Roles**:
  - `ADMIN` — full access (DB management, companies, users)
  - `MANAGER` — write access (employees, movements, payroll runs)
  - `VIEWER` — read-only

---

## Database

SQLite with 9 tables managed by Drizzle ORM:

| Table | Purpose |
|---|---|
| `companies` | Companies (name, ICE, CNSS affiliation) |
| `app_users` | Users per company with role + PBKDF2 hash |
| `auth_sessions` | Session tokens with 8h expiry |
| `employees` | Employee records (CIN, CNSS, contract, salary in cents) |
| `payroll_runs` | Payroll runs per period (DRAFT / LOCKED) |
| `payroll_items` | One per employee per run (gross, CNSS, IR, AMO, net, carry-forward) |
| `payroll_item_lines` | Line items per payroll item (BASE_SALARY, IR, CNSS, etc.) |
| `rubriques` | Payroll movements (date range, type, amount) |
| `audit_logs` | Entity change tracking |
| `payroll_adjustments` | Retroactive adjustments |

All monetary values stored as **integer cents**.

---

## Payroll Calculation Pipeline

For each employee, the engine runs in order:

1. **Gross salary** = `baseSalary + allowances + bonuses - deductions`
2. **CNSS** — capped at 6,000 MAD/mo (employee 4.48%, employer 8.98%)
3. **AMO** — uncapped (employee 2.26%, employer 4.11%)
4. **Frais professionnels** — 20% of gross, capped at 2,500 MAD/mo
5. **Net taxable** = `gross - CNSS - AMO - frais pro`
6. **IR** — progressive brackets (0%–37%), 50 MAD/dependent deduction
7. **Net salary** = `gross - CNSS - AMO - IR`
8. **Employer cost** = `gross + CNSS employer + AMO employer`

### IR Brackets (2026, monthly)

| From | To | Rate | Deduction |
|---|---|---|---|
| 0 | 3 333,00 | 0% | 0 |
| 3 333,01 | 5 000,00 | 10% | 333,33 |
| 5 000,01 | 6 667,00 | 20% | 833,33 |
| 6 667,01 | 8 333,00 | 30% | 1 500,00 |
| 8 333,01 | 15 000,00 | 34% | 1 833,33 |
| 15 000,01+ | — | 37% | 2 283,33 |

### Cumulative Annual IR (Legal Simulation)

Tracks `cumulativeTaxableIncome` and `previousIRWithheld` month-over-month. Annualizes YTD income, applies annual brackets, then computes current month IR as `cumulativeIRDue - previousIRWithheld`.

### Net Rounding (carry-forward)

Net salary is rounded **up** to the nearest whole MAD. The rounding difference is carried forward to the next month's payslip:
- Previous carry-forward is **subtracted** from the exact net before rounding (`exactNet - previousCF`)
- The result is `Math.ceil()` rounded
- New carry-forward = `roundedNet - netBeforeRound`
- Displayed as two lines on the payslip: "Reprise arrondi mois préc." (deduction) and "Arrondi sur net" (earning)

---

## Getting Started

```bash
# Install dependencies
npm install

# Run in browser (development)
npm run dev

# Build for Tauri desktop
npm run tauri build
```

> **Note:** The app uses `@tauri-apps/plugin-sql` for SQLite. When running via `npm run dev` (browser), it falls back to a JavaScript-based mock or the Tauri dev server proxy. Full DB functionality works in the Tauri desktop build.

---

## Testing

```bash
npm test
```

Golden tests validate the payroll engine against known fixtures:

| File | Input | Verifies |
|---|---|---|
| `smig.test.ts` | 4 000 MAD | IR = 0 |
| `mid.test.ts` | 6 500 MAD | IR at 10% bracket (145.10 MAD) |
| `high.test.ts` | 20 000 MAD | Frais pro capped at 2 500 MAD |
| `cumulative-ir.test.ts` | Month 3 with prior data | Legal simulation |
| `edge-cases.test.ts` | Negative salary | Error handling |

---

## Scripts

```bash
npx tsx scripts/generate-payroll.ts   # CLI: calculate payroll for a given salary
```

---

## Key Design Decisions

1. **Fully local**: No server, no cloud — all data stays in SQLite on the user's machine
2. **Money in cents**: All monetary values stored as integers (cents) to avoid floating-point drift
3. **IR rounded up**: IR is `ROUND_UP` to the nearest whole MAD (per Moroccan tax rules)
4. **Net rounding carry-forward**: Subtracts previous rounding debt before `Math.ceil()` so fractions accumulate as a company obligation, not a windfall
5. **Rubriques use date ranges**: `dateDebut` / `dateFin` instead of a single period column, enabling multi-month movements
6. **DRAFT / LOCKED runs**: Draft runs can be modified/recalculated; locked runs are frozen and appear in payslips/journal
7. **Rule files as JSON**: Payroll rules (CNSS rates, IR brackets, frais pro caps) stored as versioned JSON files for easy annual updates
