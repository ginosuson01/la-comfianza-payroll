export * from './attendance-pay.ts';
export * from './attendance-summary.ts';
export * from './basic-pay.ts';
export * from './core-payroll.ts';
export * from './employee-payroll-treatment.ts';
export * from './fixed-decimal.ts';
export * from './fixed-payroll-components.ts';
export * from './government-contributions.ts';
export * from './payroll-calculation.ts';
export * from './philippine-payroll-rules.ts';
export * from './premium-pay.ts';
export * from './statutory-payroll.ts';
export * from './withholding-tax.ts';

export const PAYROLL_ENGINE_VERSION = '0.1.0';

export interface PayrollEngineInfo {
  name: string;
  version: string;
}

export function getPayrollEngineInfo(): PayrollEngineInfo {
  return {
    name: 'La Comfianza Payroll Engine',
    version: PAYROLL_ENGINE_VERSION,
  };
}
