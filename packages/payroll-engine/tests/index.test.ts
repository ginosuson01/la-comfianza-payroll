import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPayrollEngineInfo,
  PAYROLL_ENGINE_VERSION,
} from '../src/index.ts';

test('returns the payroll engine information', () => {
  const info = getPayrollEngineInfo();

  assert.equal(info.name, 'La Comfianza Payroll Engine');
  assert.equal(info.version, PAYROLL_ENGINE_VERSION);
});
