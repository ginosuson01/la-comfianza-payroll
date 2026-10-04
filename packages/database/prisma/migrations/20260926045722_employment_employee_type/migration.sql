-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('LACOM_INTERNAL', 'CLIENT_EMPLOYEE');

-- AlterTable
ALTER TABLE "employment_records" ADD COLUMN     "employeeType" "EmployeeType";
