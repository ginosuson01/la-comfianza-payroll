import type {
  EmployeePayrollStatus,
  PayBasis,
  PayoutMethod,
  PayrollCompensationSource,
  PayrollLineCategory,
  PayrollRunStatus,
} from '@payroll/database';

export interface PayslipCompanySnapshot {
  id: string;
  code: string;
  name: string;

  addressLine1: string | null;
  addressLine2: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;

  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface PayslipPayrollSource {
  payrollRunId: string;
  payrollRunEmployeeId: string;

  version: number;
  status: PayrollRunStatus;

  generatedAt: Date;

  cutoff: {
    startDate: Date;
    endDate: Date;
    payDate: Date;
  };
}

export interface PayslipEmployeeSnapshot {
  employeeId: string;
  employmentRecordId: string;

  employeeNumber: string;
  employeeName: string;

  position: string | null;
  department: string | null;

  payrollStatus: EmployeePayrollStatus;

  payoutMethod: PayoutMethod;
  payoutAccountLast4: string | null;

  payBasis: PayBasis;
  baseRate: string;

  compensationSource: PayrollCompensationSource | null;
}

export interface PayslipLineItem {
  id: string;

  category: PayrollLineCategory;

  code: string;
  description: string;

  quantity: string | null;
  rate: string | null;
  amount: string;

  sequence: number;

  metadata: unknown;
}

export interface PayslipTotals {
  basicPay: string;
  allowancesTotal: string;
  premiumPayTotal: string;

  grossPay: string;

  governmentContributionsTotal: string;
  taxTotal: string;
  otherDeductionsTotal: string;
  totalDeductions: string;

  netPay: string;

  cashPayout: string;
  atmPayout: string;
  heldAmount: string;

  clientPayableGross: string | null;

  taxableCompensation: string;
  withholdingTax: string;

  thirteenthMonthPay: string;
  lastPayAmount: string;
  isLastPay: boolean;
}

export interface PayslipData {
  company: PayslipCompanySnapshot;

  payroll: PayslipPayrollSource;

  employee: PayslipEmployeeSnapshot;

  totals: PayslipTotals;

  lineItems: PayslipLineItem[];

  /**
   * Current employee email used only as a convenience when the
   * Payroll Manager chooses a recipient. It is not historical
   * payroll data and is not part of payroll computation.
   */
  suggestedRecipientEmail: string | null;
}
