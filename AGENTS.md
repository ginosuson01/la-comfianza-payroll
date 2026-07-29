# La Comfianza Payroll System

This repository implements the La Comfianza
Multi-Company Payroll System.

## Architecture

The application is a modular monolith.

Frontend:
- React
- TypeScript
- Vite

Backend:
- NestJS
- TypeScript
- REST API

Database:
- PostgreSQL
- Prisma ORM

Payroll:
- Pure TypeScript payroll engine
- packages/payroll-engine

Infrastructure:
- Docker
- AWS
- Terraform
- GitHub Actions

## Repository Structure

apps/web
Frontend application.

apps/api
Backend REST API.

packages/database
Prisma schema, migrations and database tooling.

packages/payroll-engine
Authoritative payroll calculation domain.

infra
Infrastructure definitions.

docs
Architecture, payroll rules and technical documentation.

## Architecture Rules

1. Authoritative payroll calculations must never run in the frontend.

2. Payroll calculation logic belongs in:
   packages/payroll-engine

3. The payroll engine must remain independent of:
   - React
   - NestJS
   - Prisma
   - PostgreSQL
   - AWS
   - HTTP

4. Employees and application users are separate entities.

5. Company-owned records must always be scoped to their company.

6. Authorization must always be enforced by the backend.

7. Frontend authorization checks are not security controls.

## Payroll Safety Rules

1. Do not use JavaScript floating-point arithmetic directly
   for authoritative monetary calculations.

2. Every payroll calculation rule must have automated tests.

3. Do not change payroll formulas without corresponding
   requirements and tests.

4. Locked payroll cutoffs must not be editable.

5. Unlocking payroll requires Payroll Manager authorization.

6. Unlock operations must create an audit record.

7. Historical payroll runs must never be overwritten.

8. Payroll regeneration creates a new payroll run/version.

9. Previous payroll runs must remain available for audit history.

## Audit Rules

Successful material business changes should produce audit records.

Examples:

- employee created
- employee updated
- DTR updated
- payroll generated
- payroll locked
- payroll unlocked
- user role assigned
- company updated

Never store:

- passwords
- temporary passwords
- authentication tokens
- AWS credentials
- secrets

inside audit records.

## Database Rules

1. PostgreSQL is the authoritative persistent datastore.

2. Database schema changes must use Prisma migrations.

3. Do not create migrations for undocumented business-model changes.

4. Do not hard-delete historical payroll data.

5. Production data must never be copied into local development.

## Phase 1 Authorization

Initial supported role:

PAYROLL_MANAGER

Future roles may include:

COMPANY_MANAGER
EMPLOYEE

Do not prematurely implement Phase 2 behavior.

## Engineering Rules

Before a change is considered complete:

- lint passes
- TypeScript checks pass
- tests pass
- builds pass

Do not hard-code credentials.

Do not commit .env files.

Prefer small, reviewable changes.

Do not implement unrelated functionality while completing
a scoped task.
