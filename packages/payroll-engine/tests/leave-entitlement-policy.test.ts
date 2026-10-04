import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateLeaveEntitlement,
} from '../src/index.ts';

test(
  'allocates LACOM internal entitlement as separate 5-day VL and 5-day SL balances',
  () => {
    const result = calculateLeaveEntitlement({
      employmentGroup: 'INTERNAL',
      hireDate: '2026-01-01',
      asOfDate: '2026-07-01',
    });

    assert.equal(
      result.annualPaidLeaveDays,
      10,
    );

    assert.deepEqual(
      result.balanceAllocation,
      {
        mode: 'SEPARATE_VL_SL',

        vacationLeaveDays: 5,
        sickLeaveDays: 5,

        sharedVlSlPoolDays: 0,
      },
    );
  },
);

test(
  'allocates client entitlement as one shared 5-day VL/SL pool',
  () => {
    const result = calculateLeaveEntitlement({
      employmentGroup: 'CLIENT',
      hireDate: '2026-01-01',
      asOfDate: '2027-01-01',
    });

    assert.equal(
      result.annualPaidLeaveDays,
      5,
    );

    assert.deepEqual(
      result.balanceAllocation,
      {
        mode: 'SHARED_VL_SL_POOL',

        vacationLeaveDays: 0,
        sickLeaveDays: 0,

        sharedVlSlPoolDays: 5,
      },
    );
  },
);
