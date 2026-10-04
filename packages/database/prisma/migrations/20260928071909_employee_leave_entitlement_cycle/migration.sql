-- CreateTable
CREATE TABLE "employee_leave_entitlement_cycles" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "employmentRecordId" UUID NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "employeeType" "EmployeeType" NOT NULL,
    "employmentStartDate" DATE NOT NULL,
    "eligibilityDate" DATE NOT NULL,
    "annualEntitlementDays" DECIMAL(12,4) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "expiresOn" DATE NOT NULL,
    "initializationReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_leave_entitlement_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_leave_entitlement_cycles_employmentRecordId_idx" ON "employee_leave_entitlement_cycles"("employmentRecordId");

-- CreateIndex
CREATE INDEX "employee_leave_entitlement_cycles_calendarYear_idx" ON "employee_leave_entitlement_cycles"("calendarYear");

-- CreateIndex
CREATE INDEX "employee_leave_entitlement_cycles_initializationReviewRequi_idx" ON "employee_leave_entitlement_cycles"("initializationReviewRequired");

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_entitlement_cycles_employeeId_calendarYear_key" ON "employee_leave_entitlement_cycles"("employeeId", "calendarYear");

-- AddForeignKey
ALTER TABLE "employee_leave_entitlement_cycles" ADD CONSTRAINT "employee_leave_entitlement_cycles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_entitlement_cycles" ADD CONSTRAINT "employee_leave_entitlement_cycles_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "employment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
