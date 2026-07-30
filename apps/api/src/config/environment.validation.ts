const ALLOWED_NODE_ENVIRONMENTS = [
  'development',
  'test',
  'production',
] as const;

function getOptionalString(
  config: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = config[key];

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string.`);
  }

  return value;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = getOptionalString(config, 'NODE_ENV', 'development');

  if (
    !ALLOWED_NODE_ENVIRONMENTS.includes(
      nodeEnv as (typeof ALLOWED_NODE_ENVIRONMENTS)[number],
    )
  ) {
    throw new Error(
      `NODE_ENV must be one of: ${ALLOWED_NODE_ENVIRONMENTS.join(', ')}`,
    );
  }

  const rawApiPort = config.API_PORT;

  const apiPort =
    rawApiPort === undefined || rawApiPort === null
      ? 3000
      : typeof rawApiPort === 'number'
        ? rawApiPort
        : typeof rawApiPort === 'string'
          ? Number(rawApiPort)
          : Number.NaN;

  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    throw new Error('API_PORT must be a valid TCP port between 1 and 65535.');
  }

  const webOrigin = getOptionalString(
    config,
    'WEB_ORIGIN',
    'http://localhost:5173',
  );

  try {
    new URL(webOrigin);
  } catch {
    throw new Error('WEB_ORIGIN must be a valid URL.');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    API_PORT: apiPort,
    WEB_ORIGIN: webOrigin,
  };
}
