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
