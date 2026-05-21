# AtlasPaie — Moroccan Payroll Engine (Developer Implementation Spec)

## 1. Mission

Build a **Moroccan payroll engine** that is:

* Deterministic
* Legally configurable
* Fully versioned per Finance Law year (2024, 2025, 2026...)
* Audit-safe
* Ledger-based (never mutates paid history)

It must generate:

* Net salary
* Employer cost
* CNSS declarations
* AMO contributions
* IR (income tax)
* Payslips (bulletins de paie)

---

## 2. Core System Principles (NON-NEGOTIABLE)

### 2.1 Rules-Driven System (NO HARD CODE)

All payroll logic MUST come from versioned JSON rules files.

No legal values are allowed inside code.

---

### 2.2 Payroll as Pure Function

```
payroll = f(employee, period, rules_version)
```

No external state, no hidden logic.

---

### 2.3 No Floating Point Money

Use:

* integer cents OR
* decimal.js

Never JS float math.

---

### 2.4 Ledger Model (IMMUTABILITY)

Once payroll is:

* calculated
* approved
* paid/exported

➡️ It becomes IMMUTABLE

No recalculation allowed.

Corrections must use ADJUSTMENT payrolls.

---

## 3. Payroll Correction Model (CRITICAL)

### 3.1 Wrong Approach (FORBIDDEN)

* Recalculate past payroll
* Override history

### 3.2 Correct Approach

Use adjustment entries:

```
Original Payroll (LOCKED)
+ Adjustment Payroll (linked)
```

---

## 4. Required Tech Stack

* Tauri (desktop)
* React + TypeScript
* Tailwind
* SQLite
* Drizzle ORM

Optional:

* PocketBase (sync only)

---

## 5. Architecture

```
UI (React)
  ↓
Services Layer
  ↓
Payroll Engine (pure functions)
  ↓
Rules Engine (JSON)
  ↓
SQLite Database
```

---

## 6. Folder Structure

```
src/
  payroll/
    engine/
    rules/
    domain/

  db/

  services/

  utils/

  tests/
```

---

## 7. RULES ENGINE (CRITICAL DESIGN)

### 7.1 Rules File IS A LEGAL CONTRACT

Each file (example `2026.json`) is NOT config.
It is an executable payroll law definition.

---

### 7.2 REQUIRED TOP-LEVEL STRUCTURE

```json
{
  "schemaVersion": "1.0",
  "country": "MA",
  "currency": "MAD",
  "calculationMode": "deterministic_v1"
}
```

---

## 8. CNSS RULES (STRICT STRUCTURE)

❌ FORBIDDEN:

* flat rates

### ✅ REQUIRED:

```json
"cnss": {
  "ceiling": 6000,
  "contributions": [
    {
      "code": "social_security_employee",
      "rate": 0.0448,
      "base": "capped"
    },
    {
      "code": "social_security_employer",
      "rate": 0.0898,
      "base": "capped"
    }
  ]
}
```

---

## 9. AMO RULES

```json
"amo": {
  "base": "gross",
  "contributions": [
    { "role": "employee", "rate": 0.0226 },
    { "role": "employer", "rate": 0.0411 }
  ]
}
```

---

## 10. IR (INCOME TAX ENGINE)

### REQUIRED:

Must define method explicitly:

```json
"ir": {
  "method": "progressive_with_deduction",
  "brackets": []
}
```

### RULE:

* engine must NEVER guess formula
* only use declared method

---

## 11. FRAIS PROFESSIONNELS

❌ FORBIDDEN:

```json
{ "rate": 0.20, "ceiling": 2500 }
```

### REQUIRED:

```json
"frais_professionnels": {
  "method": "percentage_with_cap",
  "rate": 0.20,
  "annual_cap": 30000
}
```

OR advanced:

```json
"rules": [
  { "minAnnualGross": 0, "maxAnnualGross": 78000, "rate": 0.35 },
  { "minAnnualGross": 78000, "rate": 0.25 }
]
```

---

## 12. SENIORITY

Must include base definition:

```json
"seniority": {
  "base": "base_salary",
  "tiers": []
}
```

---

## 13. OVERTIME

❌ FORBIDDEN:

```json
"dayNormal": 1.25
```

### REQUIRED:

```json
"overtime": {
  "rules": [
    { "type": "day_normal", "multiplier": 1.25 },
    { "type": "night_normal", "multiplier": 1.5 },
    { "type": "holiday_day", "multiplier": 1.5 },
    { "type": "holiday_night", "multiplier": 2.0 }
  ]
}
```

---

## 14. PAYROLL LIFECYCLE

```
Draft → Calculate → Review → Lock → Export
```

Locked payroll = immutable.

---

## 15. PAYROLL ENGINE CORE

```ts
calculatePayroll(employee, period, rules)
```

Returns:

* gross
* cnss
* amo
* ir
* net
* employerCost
* breakdown

---

## 16. DATABASE SCHEMA

Core tables:

* employees
* payroll_runs
* payroll_items
* payroll_adjustments
* rules_versions
* audit_logs

All must include companyId (multi-tenant).

---

## 17. PAYROLL ADJUSTMENTS (CRITICAL)

### Rule:

NEVER recalculate paid payrolls.

### Instead:

Create adjustment payroll linked to original.

---

## 18. AUDIT SYSTEM

Every change must log:

* actor
* action
* before/after
* timestamp

Must be immutable.

---

## 19. TESTING STRATEGY

### Golden tests:

Real Moroccan salaries:

* 4000 MAD
* 6500 MAD threshold
* 10000 MAD

Must match exact expected net.

---

## 20. EDGE CASES

* retro salary corrections
* mid-month contract change
* multiple payroll adjustments
* overtime stacking rules

---

## 21. PERFORMANCE

* 1 employee payroll < 200ms
* batch 1000 employees < 5s target

---

## 22. AGENT CODING RULES (STRICT)

* NEVER hardcode legal values
* NEVER mutate payroll history
* ONLY use rules JSON
* ALWAYS write pure functions
* ALWAYS add tests for rule logic

---

## 23. DEFINITION OF DONE

Feature is valid ONLY if:

* deterministic
* rule-driven
* tested
* audit-logged (if modifying payroll)
* no hardcoded law values

---

## END OF SPEC
