-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_ASSIGNMENT', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('PAYROLL_MANAGER', 'COMPANY_MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ConfigStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "CutoffFrequency" AS ENUM ('WEEKLY', 'SEMI_MONTHLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('REGULAR', 'SPECIAL_NON_WORKING', 'SPECIAL_WORKING', 'LOCAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeePayrollStatus" AS ENUM ('ACTIVE', 'ACTIVE_HOLD', 'RESIGNED');

-- CreateEnum
CREATE TYPE "PayBasis" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('CASH', 'ATM');

-- CreateEnum
CREATE TYPE "RecurringPayrollItemKind" AS ENUM ('ALLOWANCE', 'FIXED_DEDUCTION');

-- CreateEnum
CREATE TYPE "GovernmentIdentifierType" AS ENUM ('SSS', 'PHILHEALTH', 'PAGIBIG', 'TIN', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveUnit" AS ENUM ('DAY', 'HOUR');

-- CreateEnum
CREATE TYPE "LeaveTransactionType" AS ENUM ('INITIAL_ALLOCATION', 'ALLOCATION', 'USAGE', 'MANUAL_ADJUSTMENT', 'CARRY_OVER', 'EXPIRATION', 'RESET', 'REVERSAL');

-- CreateEnum
CREATE TYPE "DtrStatus" AS ENUM ('DRAFT', 'FOR_REVIEW', 'VALIDATED', 'LAST_PAY_REVIEW');

-- CreateEnum
CREATE TYPE "OvertimeType" AS ENUM ('REGULAR', 'REST_DAY', 'SPECIAL_HOLIDAY', 'REGULAR_HOLIDAY', 'REST_DAY_SPECIAL_HOLIDAY', 'REST_DAY_REGULAR_HOLIDAY');

-- CreateEnum
CREATE TYPE "PayrollCutoffStatus" AS ENUM ('OPEN', 'LOCKED', 'REOPENED');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('CURRENT_LOCKED', 'REOPENED_PENDING_REGENERATION', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PayrollLineCategory" AS ENUM ('EARNING', 'DEDUCTION', 'CONTRIBUTION', 'TAX', 'ADJUSTMENT', 'INFORMATION');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "cognitoSubject" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "mobile" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_company_access" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_company_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "barangay" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Philippines',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_templates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payroll_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_template_versions" (
    "id" UUID NOT NULL,
    "payrollTemplateId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT,
    "config" JSONB NOT NULL,
    "status" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_payroll_setups" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_payroll_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_payroll_setup_versions" (
    "id" UUID NOT NULL,
    "companyPayrollSetupId" UUID NOT NULL,
    "sourceTemplateVersionId" UUID,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "status" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_payroll_setup_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutoff_templates" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "CutoffFrequency" NOT NULL,
    "configuration" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cutoff_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HolidayType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "userId" UUID,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "suffix" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "barangay" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Philippines',
    "currentStatus" "EmployeePayrollStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_status_history" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "previousStatus" "EmployeePayrollStatus",
    "newStatus" "EmployeePayrollStatus" NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "changedByUserId" UUID NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_records" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "departmentId" UUID,
    "positionId" UUID,
    "companyEmployeeNumber" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_records" (
    "id" UUID NOT NULL,
    "employmentRecordId" UUID NOT NULL,
    "payBasis" "PayBasis" NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_payroll_profiles" (
    "id" UUID NOT NULL,
    "employmentRecordId" UUID NOT NULL,
    "payoutMethod" "PayoutMethod" NOT NULL,
    "bankName" TEXT,
    "accountNumberEncrypted" TEXT,
    "accountNumberLast4" TEXT,
    "contributionConfig" JSONB,
    "taxConfig" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_payroll_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_payroll_items" (
    "id" UUID NOT NULL,
    "employmentRecordId" UUID NOT NULL,
    "kind" "RecurringPayrollItemKind" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recurring_payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "government_identifiers" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "type" "GovernmentIdentifierType" NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "valueLast4" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "government_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "LeaveUnit" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_leave_accounts" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "currentBalance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_leave_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_transactions" (
    "id" UUID NOT NULL,
    "leaveAccountId" UUID NOT NULL,
    "type" "LeaveTransactionType" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_cutoffs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "cutoffTemplateId" UUID,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "payDate" DATE NOT NULL,
    "status" "PayrollCutoffStatus" NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMPTZ(3),
    "reopenedAt" TIMESTAMPTZ(3),
    "lastReopenReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payroll_cutoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtrs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "employmentRecordId" UUID NOT NULL,
    "payrollCutoffId" UUID NOT NULL,
    "status" "DtrStatus" NOT NULL DEFAULT 'DRAFT',
    "validatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dtrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtr_entries" (
    "id" UUID NOT NULL,
    "dtrId" UUID NOT NULL,
    "workDate" DATE NOT NULL,
    "regularMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "undertimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "absenceMinutes" INTEGER NOT NULL DEFAULT 0,
    "leaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightDifferentialMinutes" INTEGER NOT NULL DEFAULT 0,
    "restDay" BOOLEAN NOT NULL DEFAULT false,
    "leaveTypeId" UUID,
    "holidayId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dtr_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_entries" (
    "id" UUID NOT NULL,
    "dtrEntryId" UUID NOT NULL,
    "type" "OvertimeType" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_adjustments" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "payrollCutoffId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "type" "PayrollAdjustmentType" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "payrollCutoffId" UUID NOT NULL,
    "companyPayrollSetupVersionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PayrollRunStatus" NOT NULL,
    "generatedByUserId" UUID NOT NULL,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configSnapshot" JSONB NOT NULL,
    "totalGross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "clientPayableGross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cashPayoutTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "atmPayoutTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "activeHoldTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_employees" (
    "id" UUID NOT NULL,
    "payrollRunId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "employmentRecordId" UUID NOT NULL,
    "employeeNumberSnapshot" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT NOT NULL,
    "positionSnapshot" TEXT,
    "departmentSnapshot" TEXT,
    "payrollStatusSnapshot" "EmployeePayrollStatus" NOT NULL,
    "payoutMethodSnapshot" "PayoutMethod" NOT NULL,
    "payoutAccountLast4Snapshot" TEXT,
    "payBasisSnapshot" "PayBasis" NOT NULL,
    "baseRateSnapshot" DECIMAL(18,4) NOT NULL,
    "basicPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "allowancesTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "premiumPayTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "governmentContributionsTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherDeductionsTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cashPayout" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "atmPayout" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "heldAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "clientPayableGross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxableCompensation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "thirteenthMonthPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lastPayAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isLastPay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_run_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_line_items" (
    "id" UUID NOT NULL,
    "payrollRunEmployeeId" UUID NOT NULL,
    "category" "PayrollLineCategory" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "rate" DECIMAL(18,4),
    "amount" DECIMAL(18,2) NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "payrollRunEmployeeId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "generatedByUserId" UUID NOT NULL,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailedAt" TIMESTAMPTZ(3),

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "companyId" UUID,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "reference" TEXT,
    "details" TEXT NOT NULL,
    "metadata" JSONB,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_cognitoSubject_key" ON "users"("cognitoSubject");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "user_company_access_companyId_idx" ON "user_company_access"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "user_company_access_userId_companyId_key" ON "user_company_access"("userId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_templates_code_key" ON "payroll_templates"("code");

-- CreateIndex
CREATE INDEX "payroll_templates_status_idx" ON "payroll_templates"("status");

-- CreateIndex
CREATE INDEX "payroll_template_versions_status_idx" ON "payroll_template_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_template_versions_payrollTemplateId_version_key" ON "payroll_template_versions"("payrollTemplateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "company_payroll_setups_companyId_key" ON "company_payroll_setups"("companyId");

-- CreateIndex
CREATE INDEX "company_payroll_setups_status_idx" ON "company_payroll_setups"("status");

-- CreateIndex
CREATE INDEX "company_payroll_setup_versions_sourceTemplateVersionId_idx" ON "company_payroll_setup_versions"("sourceTemplateVersionId");

-- CreateIndex
CREATE INDEX "company_payroll_setup_versions_status_idx" ON "company_payroll_setup_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "company_payroll_setup_versions_companyPayrollSetupId_versio_key" ON "company_payroll_setup_versions"("companyPayrollSetupId", "version");

-- CreateIndex
CREATE INDEX "cutoff_templates_companyId_active_idx" ON "cutoff_templates"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "cutoff_templates_companyId_code_key" ON "cutoff_templates"("companyId", "code");

-- CreateIndex
CREATE INDEX "holidays_companyId_date_idx" ON "holidays"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_companyId_date_key" ON "holidays"("companyId", "date");

-- CreateIndex
CREATE INDEX "departments_companyId_active_idx" ON "departments"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_companyId_code_key" ON "departments"("companyId", "code");

-- CreateIndex
CREATE INDEX "positions_companyId_active_idx" ON "positions"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "positions_companyId_code_key" ON "positions"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeNumber_key" ON "employees"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_lastName_firstName_idx" ON "employees"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "employees_currentStatus_idx" ON "employees"("currentStatus");

-- CreateIndex
CREATE INDEX "employee_status_history_employeeId_effectiveDate_idx" ON "employee_status_history"("employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "employee_status_history_newStatus_idx" ON "employee_status_history"("newStatus");

-- CreateIndex
CREATE INDEX "employment_records_employeeId_startDate_idx" ON "employment_records"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "employment_records_companyId_startDate_idx" ON "employment_records"("companyId", "startDate");

-- CreateIndex
CREATE INDEX "employment_records_departmentId_idx" ON "employment_records"("departmentId");

-- CreateIndex
CREATE INDEX "employment_records_positionId_idx" ON "employment_records"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "employment_records_companyId_companyEmployeeNumber_key" ON "employment_records"("companyId", "companyEmployeeNumber");

-- CreateIndex
CREATE INDEX "compensation_records_employmentRecordId_effectiveFrom_idx" ON "compensation_records"("employmentRecordId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "employee_payroll_profiles_employmentRecordId_key" ON "employee_payroll_profiles"("employmentRecordId");

-- CreateIndex
CREATE INDEX "employee_payroll_profiles_payoutMethod_idx" ON "employee_payroll_profiles"("payoutMethod");

-- CreateIndex
CREATE INDEX "recurring_payroll_items_employmentRecordId_active_idx" ON "recurring_payroll_items"("employmentRecordId", "active");

-- CreateIndex
CREATE INDEX "recurring_payroll_items_kind_idx" ON "recurring_payroll_items"("kind");

-- CreateIndex
CREATE INDEX "government_identifiers_type_idx" ON "government_identifiers"("type");

-- CreateIndex
CREATE UNIQUE INDEX "government_identifiers_employeeId_type_key" ON "government_identifiers"("employeeId", "type");

-- CreateIndex
CREATE INDEX "leave_types_companyId_active_idx" ON "leave_types"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_companyId_code_key" ON "leave_types"("companyId", "code");

-- CreateIndex
CREATE INDEX "employee_leave_accounts_leaveTypeId_idx" ON "employee_leave_accounts"("leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_accounts_employeeId_leaveTypeId_key" ON "employee_leave_accounts"("employeeId", "leaveTypeId");

-- CreateIndex
CREATE INDEX "leave_transactions_leaveAccountId_effectiveDate_idx" ON "leave_transactions"("leaveAccountId", "effectiveDate");

-- CreateIndex
CREATE INDEX "leave_transactions_type_idx" ON "leave_transactions"("type");

-- CreateIndex
CREATE INDEX "payroll_cutoffs_companyId_status_idx" ON "payroll_cutoffs"("companyId", "status");

-- CreateIndex
CREATE INDEX "payroll_cutoffs_payDate_idx" ON "payroll_cutoffs"("payDate");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_cutoffs_companyId_startDate_endDate_key" ON "payroll_cutoffs"("companyId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "dtrs_companyId_payrollCutoffId_idx" ON "dtrs"("companyId", "payrollCutoffId");

-- CreateIndex
CREATE INDEX "dtrs_status_idx" ON "dtrs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "dtrs_employeeId_payrollCutoffId_key" ON "dtrs"("employeeId", "payrollCutoffId");

-- CreateIndex
CREATE INDEX "dtr_entries_workDate_idx" ON "dtr_entries"("workDate");

-- CreateIndex
CREATE INDEX "dtr_entries_leaveTypeId_idx" ON "dtr_entries"("leaveTypeId");

-- CreateIndex
CREATE INDEX "dtr_entries_holidayId_idx" ON "dtr_entries"("holidayId");

-- CreateIndex
CREATE UNIQUE INDEX "dtr_entries_dtrId_workDate_key" ON "dtr_entries"("dtrId", "workDate");

-- CreateIndex
CREATE INDEX "overtime_entries_dtrEntryId_idx" ON "overtime_entries"("dtrEntryId");

-- CreateIndex
CREATE INDEX "overtime_entries_type_idx" ON "overtime_entries"("type");

-- CreateIndex
CREATE INDEX "payroll_adjustments_companyId_payrollCutoffId_idx" ON "payroll_adjustments"("companyId", "payrollCutoffId");

-- CreateIndex
CREATE INDEX "payroll_adjustments_employeeId_idx" ON "payroll_adjustments"("employeeId");

-- CreateIndex
CREATE INDEX "payroll_runs_companyId_generatedAt_idx" ON "payroll_runs"("companyId", "generatedAt");

-- CreateIndex
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_payrollCutoffId_version_key" ON "payroll_runs"("payrollCutoffId", "version");

-- CreateIndex
CREATE INDEX "payroll_run_employees_employeeId_idx" ON "payroll_run_employees"("employeeId");

-- CreateIndex
CREATE INDEX "payroll_run_employees_payrollStatusSnapshot_idx" ON "payroll_run_employees"("payrollStatusSnapshot");

-- CreateIndex
CREATE INDEX "payroll_run_employees_payoutMethodSnapshot_idx" ON "payroll_run_employees"("payoutMethodSnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_employees_payrollRunId_employeeId_key" ON "payroll_run_employees"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "payroll_line_items_payrollRunEmployeeId_category_idx" ON "payroll_line_items"("payrollRunEmployeeId", "category");

-- CreateIndex
CREATE INDEX "payroll_line_items_code_idx" ON "payroll_line_items"("code");

-- CreateIndex
CREATE INDEX "payslips_generatedAt_idx" ON "payslips"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payrollRunEmployeeId_version_key" ON "payslips"("payrollRunEmployeeId", "version");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_module_action_idx" ON "audit_logs"("module", "action");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_access" ADD CONSTRAINT "user_company_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_access" ADD CONSTRAINT "user_company_access_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_template_versions" ADD CONSTRAINT "payroll_template_versions_payrollTemplateId_fkey" FOREIGN KEY ("payrollTemplateId") REFERENCES "payroll_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_payroll_setups" ADD CONSTRAINT "company_payroll_setups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_payroll_setup_versions" ADD CONSTRAINT "company_payroll_setup_versions_companyPayrollSetupId_fkey" FOREIGN KEY ("companyPayrollSetupId") REFERENCES "company_payroll_setups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_payroll_setup_versions" ADD CONSTRAINT "company_payroll_setup_versions_sourceTemplateVersionId_fkey" FOREIGN KEY ("sourceTemplateVersionId") REFERENCES "payroll_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutoff_templates" ADD CONSTRAINT "cutoff_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_records" ADD CONSTRAINT "compensation_records_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "employment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payroll_profiles" ADD CONSTRAINT "employee_payroll_profiles_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "employment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_payroll_items" ADD CONSTRAINT "recurring_payroll_items_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "employment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "government_identifiers" ADD CONSTRAINT "government_identifiers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_accounts" ADD CONSTRAINT "employee_leave_accounts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_accounts" ADD CONSTRAINT "employee_leave_accounts_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_leaveAccountId_fkey" FOREIGN KEY ("leaveAccountId") REFERENCES "employee_leave_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_cutoffs" ADD CONSTRAINT "payroll_cutoffs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_cutoffs" ADD CONSTRAINT "payroll_cutoffs_cutoffTemplateId_fkey" FOREIGN KEY ("cutoffTemplateId") REFERENCES "cutoff_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtrs" ADD CONSTRAINT "dtrs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtrs" ADD CONSTRAINT "dtrs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtrs" ADD CONSTRAINT "dtrs_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "employment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtrs" ADD CONSTRAINT "dtrs_payrollCutoffId_fkey" FOREIGN KEY ("payrollCutoffId") REFERENCES "payroll_cutoffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtr_entries" ADD CONSTRAINT "dtr_entries_dtrId_fkey" FOREIGN KEY ("dtrId") REFERENCES "dtrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtr_entries" ADD CONSTRAINT "dtr_entries_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtr_entries" ADD CONSTRAINT "dtr_entries_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "holidays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_entries" ADD CONSTRAINT "overtime_entries_dtrEntryId_fkey" FOREIGN KEY ("dtrEntryId") REFERENCES "dtr_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_payrollCutoffId_fkey" FOREIGN KEY ("payrollCutoffId") REFERENCES "payroll_cutoffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payrollCutoffId_fkey" FOREIGN KEY ("payrollCutoffId") REFERENCES "payroll_cutoffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_companyPayrollSetupVersionId_fkey" FOREIGN KEY ("companyPayrollSetupVersionId") REFERENCES "company_payroll_setup_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "employment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_payrollRunEmployeeId_fkey" FOREIGN KEY ("payrollRunEmployeeId") REFERENCES "payroll_run_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payrollRunEmployeeId_fkey" FOREIGN KEY ("payrollRunEmployeeId") REFERENCES "payroll_run_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
