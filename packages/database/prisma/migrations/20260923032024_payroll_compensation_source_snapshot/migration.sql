-- CreateEnum
CREATE TYPE "PayrollCompensationSource" AS ENUM ('EMPLOYEE_OVERRIDE', 'COMPANY_STANDARD');

-- AlterTable
ALTER TABLE "payroll_run_employees" ADD COLUMN     "compensationSourceSnapshot" "PayrollCompensationSource";
