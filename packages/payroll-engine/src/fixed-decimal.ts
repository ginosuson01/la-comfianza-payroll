export const MONEY_SCALE = 2;
export const RATE_SCALE = 4;

function assertScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new Error('Decimal scale must be a non-negative integer.');
  }
}

function scaleFactor(scale: number): bigint {
  assertScale(scale);

  return 10n ** BigInt(scale);
}

export function parseFixedDecimal(
  value: string,
  scale: number,
): bigint {
  assertScale(scale);

  const normalized = value.trim();

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const negative = normalized.startsWith('-');

  const unsigned =
    normalized.startsWith('-') || normalized.startsWith('+')
      ? normalized.slice(1)
      : normalized;

  const [wholePart = '0', fractionalPart = ''] =
    unsigned.split('.');

  if (fractionalPart.length > scale) {
    throw new Error(
      `Decimal value ${value} exceeds the allowed scale of ${scale}.`,
    );
  }

  const factor = scaleFactor(scale);

  const wholeUnits = BigInt(wholePart) * factor;

  const paddedFraction =
    scale === 0
      ? ''
      : fractionalPart.padEnd(scale, '0');

  const fractionalUnits =
    paddedFraction.length > 0
      ? BigInt(paddedFraction)
      : 0n;

  const result = wholeUnits + fractionalUnits;

  return negative ? -result : result;
}

export function formatFixedDecimal(
  value: bigint,
  scale: number,
): string {
  assertScale(scale);

  const factor = scaleFactor(scale);

  const negative = value < 0n;

  const absoluteValue = negative ? -value : value;

  const wholePart = absoluteValue / factor;

  const fractionalPart = absoluteValue % factor;

  const sign = negative ? '-' : '';

  if (scale === 0) {
    return `${sign}${wholePart.toString()}`;
  }

  return (
    `${sign}${wholePart.toString()}.` +
    fractionalPart.toString().padStart(scale, '0')
  );
}

export function divideRoundHalfUp(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator === 0n) {
    throw new Error('Cannot divide by zero.');
  }

  const negative =
    (numerator < 0n) !== (denominator < 0n);

  const absoluteNumerator =
    numerator < 0n ? -numerator : numerator;

  const absoluteDenominator =
    denominator < 0n ? -denominator : denominator;

  const quotient =
    absoluteNumerator / absoluteDenominator;

  const remainder =
    absoluteNumerator % absoluteDenominator;

  const rounded =
    remainder * 2n >= absoluteDenominator
      ? quotient + 1n
      : quotient;

  return negative ? -rounded : rounded;
}

export function rescaleFixedDecimal(
  value: bigint,
  fromScale: number,
  toScale: number,
): bigint {
  assertScale(fromScale);
  assertScale(toScale);

  if (fromScale === toScale) {
    return value;
  }

  if (toScale > fromScale) {
    return (
      value *
      scaleFactor(toScale - fromScale)
    );
  }

  return divideRoundHalfUp(
    value,
    scaleFactor(fromScale - toScale),
  );
}

export function multiplyFixedDecimals(
  leftValue: bigint,
  leftScale: number,
  rightValue: bigint,
  rightScale: number,
  resultScale: number,
): bigint {
  assertScale(leftScale);
  assertScale(rightScale);
  assertScale(resultScale);

  const product =
    leftValue * rightValue;

  return rescaleFixedDecimal(
    product,
    leftScale + rightScale,
    resultScale,
  );
}

export function divideFixedDecimals(
  leftValue: bigint,
  leftScale: number,
  rightValue: bigint,
  rightScale: number,
  resultScale: number,
): bigint {
  assertScale(leftScale);
  assertScale(rightScale);
  assertScale(resultScale);

  if (rightValue === 0n) {
    throw new Error('Cannot divide by zero.');
  }

  const numerator =
    leftValue *
    scaleFactor(rightScale + resultScale);

  const denominator =
    rightValue *
    scaleFactor(leftScale);

  return divideRoundHalfUp(
    numerator,
    denominator,
  );
}

export function parseMoney(value: string): bigint {
  return parseFixedDecimal(value, MONEY_SCALE);
}

export function formatMoney(value: bigint): string {
  return formatFixedDecimal(value, MONEY_SCALE);
}

export function parseRate(value: string): bigint {
  return parseFixedDecimal(value, RATE_SCALE);
}

export function formatRate(value: bigint): string {
  return formatFixedDecimal(value, RATE_SCALE);
}
