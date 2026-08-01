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

function getOptionalNullableString(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = config[key];

  if (value === undefined || value === null || value === '') {
    return undefined;
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

  const awsRegion = getOptionalString(config, 'AWS_REGION', 'ap-southeast-1');

  const cognitoUserPoolId = getOptionalNullableString(
    config,
    'COGNITO_USER_POOL_ID',
  );

  const cognitoClientId = getOptionalNullableString(
    config,
    'COGNITO_CLIENT_ID',
  );

  if (nodeEnv === 'production' && (!cognitoUserPoolId || !cognitoClientId)) {
    throw new Error(
      'COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are required in production.',
    );
  }

  try {
    new URL(webOrigin);
  } catch {
    throw new Error('WEB_ORIGIN must be a valid URL.');
  }

  const databaseUrl = getRequiredString(config, 'DATABASE_URL');

  try {
    const parsedDatabaseUrl = new URL(databaseUrl);

    if (
      parsedDatabaseUrl.protocol !== 'postgresql:' &&
      parsedDatabaseUrl.protocol !== 'postgres:'
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    API_PORT: apiPort,
    WEB_ORIGIN: webOrigin,
    DATABASE_URL: databaseUrl,
    AWS_REGION: awsRegion,
    COGNITO_USER_POOL_ID: cognitoUserPoolId,
    COGNITO_CLIENT_ID: cognitoClientId,
  };
}

function getRequiredString(
  config: Record<string, unknown>,
  key: string,
): string {
  const value = config[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}
