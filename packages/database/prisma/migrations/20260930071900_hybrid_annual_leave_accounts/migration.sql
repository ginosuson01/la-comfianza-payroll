/*
  Warnings:

  - A unique constraint covering the columns `[entitlementCycleId,balanceKind]` on the table `employee_leave_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LeaveBalanceKind" AS ENUM ('VL', 'SL', 'SHARED_VL_SL_POOL');

-- AlterTable
ALTER TABLE "employee_leave_accounts" ADD COLUMN     "balanceKind" "LeaveBalanceKind",
ADD COLUMN     "entitlementCycleId" UUID;

-- CreateIndex
CREATE INDEX "employee_leave_accounts_entitlementCycleId_idx" ON "employee_leave_accounts"("entitlementCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_accounts_entitlementCycleId_balanceKind_key" ON "employee_leave_accounts"("entitlementCycleId", "balanceKind");

-- AddForeignKey
ALTER TABLE "employee_leave_accounts" ADD CONSTRAINT "employee_leave_accounts_entitlementCycleId_fkey" FOREIGN KEY ("entitlementCycleId") REFERENCES "employee_leave_entitlement_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
