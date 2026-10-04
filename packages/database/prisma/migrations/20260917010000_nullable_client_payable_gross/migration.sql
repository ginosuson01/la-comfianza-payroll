ALTER TABLE "payroll_runs"
  ALTER COLUMN "clientPayableGross" DROP DEFAULT,
  ALTER COLUMN "clientPayableGross" DROP NOT NULL;

ALTER TABLE "payroll_run_employees"
  ALTER COLUMN "clientPayableGross" DROP DEFAULT,
  ALTER COLUMN "clientPayableGross" DROP NOT NULL;
