-- CreateTable
CREATE TABLE "company_compensation_records" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "payBasis" "PayBasis" NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_compensation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_compensation_records_companyId_effectiveFrom_idx" ON "company_compensation_records"("companyId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "company_compensation_records" ADD CONSTRAINT "company_compensation_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
