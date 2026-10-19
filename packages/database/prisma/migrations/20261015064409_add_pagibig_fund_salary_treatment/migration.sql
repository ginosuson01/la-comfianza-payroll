-- CreateEnum
CREATE TYPE "PayrollStatutoryBasisTreatment" AS ENUM ('INCLUDE', 'EXCLUDE');

-- AlterTable
ALTER TABLE "payroll_adjustments" ADD COLUMN     "pagIbigFundSalaryTreatment" "PayrollStatutoryBasisTreatment";

-- AlterTable
ALTER TABLE "recurring_payroll_items" ADD COLUMN     "pagIbigFundSalaryTreatment" "PayrollStatutoryBasisTreatment";
