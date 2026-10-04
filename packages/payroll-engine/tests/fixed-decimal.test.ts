import test from 'node:test';
import assert from 'node:assert/strict';

import {
  divideFixedDecimals,
  formatMoney,
  formatRate,
  multiplyFixedDecimals,
  parseMoney,
  parseRate,
  rescaleFixedDecimal,
} from '../src/index.ts';

test('parses and formats money exactly', () => {
  assert.equal(
    parseMoney('1234.50'),
    123450n,
  );

  assert.equal(
    formatMoney(123450n),
    '1234.50',
  );

  assert.equal(
    formatMoney(-123450n),
    '-1234.50',
  );
});

test('parses and formats four-decimal payroll rates', () => {
  assert.equal(
    parseRate('537.5000'),
    5375000n,
  );

  assert.equal(
    formatRate(5375000n),
    '537.5000',
  );
});

test('rejects decimal precision beyond the configured scale', () => {
  assert.throws(
    () => parseMoney('1.005'),
    /exceeds the allowed scale of 2/,
  );

  assert.throws(
    () => parseRate('10.00001'),
    /exceeds the allowed scale of 4/,
  );
});

test('rounds from four decimals to money using half-up rounding', () => {
  assert.equal(
    rescaleFixedDecimal(
      10050n,
      4,
      2,
    ),
    101n,
  );

  assert.equal(
    rescaleFixedDecimal(
      -10050n,
      4,
      2,
    ),
    -101n,
  );
});

test('multiplies fixed-decimal payroll rates exactly', () => {
  const dailyRate =
    parseRate('537.5000');

  const multiplier =
    parseRate('1.2500');

  const result =
    multiplyFixedDecimals(
      dailyRate,
      4,
      multiplier,
      4,
      4,
    );

  assert.equal(
    formatRate(result),
    '671.8750',
  );
});

test('divides fixed-decimal values with deterministic rounding', () => {
  const dailyRate =
    parseRate('537.5000');

  const perMinuteRate =
    divideFixedDecimals(
      dailyRate,
      4,
      480n,
      0,
      4,
    );

  assert.equal(
    formatRate(perMinuteRate),
    '1.1198',
  );
});
