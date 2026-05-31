# Moroccan Payroll App — Declarations Module Implementation Plan

# Overview

The payroll engine is already operational and capable of generating employee payroll calculations.

The next major phase is implementing the Moroccan payroll declarations system.

This module must support:

* CNSS declarations
* IR declarations
* Damancom exports
* Payroll accounting exports
* Bank transfer exports
* Annual declarations
* Frozen payroll snapshots
* Versioned payroll rules

The architecture must be enterprise-grade and scalable.

---

# High-Level Architecture

The declaration system must NEVER calculate values directly from current employee data.

Declarations must be generated from frozen payroll results.

Correct flow:

```txt
Payroll Processing
    ↓
Payroll Run Generated
    ↓
Payroll Results Frozen
    ↓
Declarations Generated
    ↓
Exports Generated
```

---

# Core Concepts

# 1. Payroll Run

Represents a payroll execution for a specific month.

Example:

```txt
2026-05 payroll run
```

Must contain:

* period
* generatedAt
* payroll results
* totals
* declaration status

---

# 2. Frozen Payroll Results

VERY IMPORTANT.

Once payroll is generated:

* salaries
* CNSS
* AMO
* IR
* deductions
* employer charges

must be frozen.

DO NOT regenerate declaration values dynamically later.

Why:

* employee data changes
* payroll rules evolve
* retroactive modifications happen
* declarations must match historical payroll

---

# 3. Declaration Engine

Consumes frozen payroll results.

Produces:

* CNSS declarations
* IR declarations
* accounting exports
* bank exports

---

# Required Modules

# Module Structure

```txt
src/
├── payroll/
├── declarations/
│   ├── cnss/
│   ├── ir/
│   ├── bank/
│   ├── accounting/
│   ├── exports/
│   └── rules/
```

---

# Database Design

# Table: payroll_runs

```sql
CREATE TABLE payroll_runs (
    id TEXT PRIMARY KEY,
    period TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    status TEXT NOT NULL,
    company_id TEXT NOT NULL
);
```

---

# Table: payroll_results

Frozen employee payroll results.

```sql
CREATE TABLE payroll_results (
    id TEXT PRIMARY KEY,

    payroll_run_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,

    gross_salary REAL NOT NULL,
    taxable_income REAL NOT NULL,

    cnss_base REAL NOT NULL,
    amo_base REAL NOT NULL,

    employee_cnss REAL NOT NULL,
    employer_cnss REAL NOT NULL,

    employee_amo REAL NOT NULL,
    employer_amo REAL NOT NULL,

    ir REAL NOT NULL,

    net_salary REAL NOT NULL,

    created_at TEXT NOT NULL
);
```

---

# Table: declarations

```sql
CREATE TABLE declarations (
    id TEXT PRIMARY KEY,

    type TEXT NOT NULL,
    period TEXT NOT NULL,

    payroll_run_id TEXT NOT NULL,

    status TEXT NOT NULL,

    generated_at TEXT NOT NULL,

    exported BOOLEAN NOT NULL DEFAULT 0
);
```

---

# Table: declaration_lines

```sql
CREATE TABLE declaration_lines (
    id TEXT PRIMARY KEY,

    declaration_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,

    gross_salary REAL,
    taxable_income REAL,

    cnss_base REAL,
    amo_base REAL,

    employee_cnss REAL,
    employer_cnss REAL,

    ir REAL,

    net_salary REAL
);
```

---

# Payroll Rules System

VERY IMPORTANT.

Moroccan payroll rules change frequently.

You MUST support versioned payroll rules.

---

# Table: payroll_rules

```sql
CREATE TABLE payroll_rules (
    id TEXT PRIMARY KEY,

    effective_date TEXT NOT NULL,

    cnss_rate REAL NOT NULL,
    employer_cnss_rate REAL NOT NULL,

    amo_rate REAL NOT NULL,
    employer_amo_rate REAL NOT NULL,

    professional_expense_rate REAL NOT NULL,

    cnss_ceiling REAL NOT NULL,

    created_at TEXT NOT NULL
);
```

---

# Table: ir_brackets

```sql
CREATE TABLE ir_brackets (
    id TEXT PRIMARY KEY,

    payroll_rule_id TEXT NOT NULL,

    min_amount REAL NOT NULL,
    max_amount REAL NOT NULL,

    rate REAL NOT NULL,
    deduction REAL NOT NULL
);
```

---

# IMPORTANT RULE

When generating payroll:

* determine the active payroll rule by effective_date
* store the payroll_rule_id used
* never recalculate old payroll with new rules

---

# CNSS Declaration Module

# Goal

Generate monthly CNSS declaration data compatible with:

* Damancom
* CNSS reporting
* internal audit

---

# Required Employee Data

Each employee must contain:

```txt
CNSS number
CIN
Full name
Birth date
Hire date
Family status
Gross salary
CNSS base
AMO base
```

---

# Required Payroll Values

Per employee:

```txt
Gross salary
CNSS base
AMO base
Employee CNSS contribution
Employer CNSS contribution
AMO contribution
Net salary
```

---

# CNSS Declaration Flow

```txt
Select Payroll Run
    ↓
Generate CNSS Declaration
    ↓
Generate Declaration Lines
    ↓
Export TXT/CSV/XML
```

---

# Suggested Service Structure

```txt
declarations/cnss/
├── cnssService.ts
├── cnssExportService.ts
├── cnssMapper.ts
├── cnssValidation.ts
└── cnssTypes.ts
```

---

# CNSS Service Responsibilities

# cnssService.ts

Responsibilities:

* create declaration
* validate payroll results
* aggregate totals
* create declaration lines

---

# Example Function

```ts
generateCnssDeclaration(payrollRunId: string)
```

---

# Damancom Export Module

VERY IMPORTANT.

This is one of the most valuable features.

---

# Export Formats

Support:

* TXT
* CSV
* XML

depending on target platform requirements.

---

# Export Service

```txt
declarations/exports/
├── txtExport.ts
├── csvExport.ts
├── xmlExport.ts
```

---

# Export Flow

```txt
Generate Declaration
    ↓
Transform Data
    ↓
Generate Export File
    ↓
Download File
```

---

# IR Declaration Module

# Goal

Generate monthly and annual income tax declarations.

---

# Required Values

Per employee:

```txt
Taxable income
Professional expenses
IR retained
Net taxable salary
```

---

# Suggested Structure

```txt
declarations/ir/
├── irService.ts
├── irAnnualService.ts
├── irExport.ts
└── irValidation.ts
```

---

# Bank Transfer Export Module

VERY IMPORTANT FEATURE.

Generates salary transfer files for banks.

---

# Supported Banks

Potential support:

* Attijariwafa Bank
* Banque Populaire
* BMCE
* CIH
* CFG

---

# Required Employee Banking Data

```txt
Bank name
RIB
IBAN
Account holder name
```

---

# Export Structure

```txt
declarations/bank/
├── bankExportService.ts
├── bankFormats/
│   ├── attijari.ts
│   ├── bp.ts
│   └── bmce.ts
```

---

# Accounting Export Module

# Goal

Export payroll accounting journal entries.

---

# Example Journal

```txt
6411 Salaires
645 CNSS
4421 IR
```

---

# Suggested Structure

```txt
declarations/accounting/
├── accountingExport.ts
├── journalMapper.ts
└── accountingTemplates.ts
```

---

# Recommended UI Structure

# New Navigation

```txt
Payroll
├── Payroll Runs
├── Variables de paie
├── Bulletins
├── Déclarations
│   ├── CNSS
│   ├── IR
│   ├── Export Banque
│   └── Export Comptable
```

---

# CNSS Declaration Screen

# Layout

```txt
┌─────────────────────────────┐
│ Déclaration CNSS           │
├─────────────────────────────┤
│ Période: 2026-05           │
│ Société: XYZ               │
│ Statut: Générée            │
├─────────────────────────────┤
│ Total brut: XXXXX          │
│ Total CNSS: XXXXX          │
│ Total AMO: XXXXX           │
├─────────────────────────────┤
│ [ Générer export TXT ]     │
│ [ Générer export CSV ]     │
│ [ Télécharger ]            │
└─────────────────────────────┘
```

---

# Validation Rules

Before generating declarations:

Validate:

* missing CNSS numbers
* invalid CIN
* negative payroll values
* duplicate employees
* invalid payroll period
* missing payroll results

---

# Error Management

Create centralized validation system.

Example:

```txt
Validation Errors
----------------
Employee Ahmed:
- Missing CNSS number

Employee Sara:
- Invalid taxable salary
```

---

# Snapshot Principle

IMPORTANT.

Declarations must always use:

```txt
payroll_results
```

NOT:

```txt
employees
```

directly.

Because employee information can change later.

---

# Recommended Development Order

# PHASE 1

Implement:

* payroll_results
* frozen payroll snapshots
* payroll rules versioning

---

# PHASE 2

Implement:

* declarations tables
* declaration generation engine

---

# PHASE 3

Implement:

* CNSS declaration generation
* declaration UI

---

# PHASE 4

Implement:

* TXT/CSV exports
* Damancom-compatible export

---

# PHASE 5

Implement:

* IR declarations
* annual declarations

---

# PHASE 6

Implement:

* accounting exports
* bank transfer exports

---

# Future Enhancements

Potential future features:

* retroactive payroll corrections
* declaration amendments
* multi-company declarations
* digital signature
* automated Damancom integration
* accounting integrations
* audit trail system

---

# Important Engineering Principles

# 1. Freeze Everything

Payroll calculations must be immutable after validation.

---

# 2. Never Recalculate Old Payroll

Always preserve historical data.

---

# 3. Version Payroll Rules

Every payroll run must know which rules were used.

---

# 4. Separate Calculation from Declaration

Payroll engine and declaration engine must remain independent.

---

# 5. Export Layer Must Be Modular

Each export format must have its own transformer.

---

# Final Goal

Target workflow:

```txt
Generate Payroll Run
    ↓
Validate Payroll
    ↓
Freeze Payroll Results
    ↓
Generate CNSS Declaration
    ↓
Generate Damancom Export
    ↓
Download File
```

This architecture is scalable, enterprise-grade, and suitable for a professional Moroccan payroll platform.
