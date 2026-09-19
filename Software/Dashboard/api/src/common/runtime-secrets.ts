const PLACEHOLDER_SECRETS = new Set([
  '',
  'your-secret-key',
  'change-me-in-production',
  'change-me-in-production-use-long-random-string',
  'your-gateway-api-key',
  'your-gateway-api-key-change-in-production',
]);

export function isPlaceholderSecret(value: string | undefined | null): boolean {
  if (value == null) {
    return true;
  }
  return PLACEHOLDER_SECRETS.has(value.trim());
}

export function requireSecret(
  name: string,
  value: string | undefined | null,
  options?: { allowPlaceholderInDev?: boolean },
): string {
  const trimmed = value?.trim() ?? '';
  const isProd = process.env.NODE_ENV === 'production';
  const allowPlaceholder = options?.allowPlaceholderInDev !== false && !isProd;

  if (!trimmed) {
    throw new Error(`${name} is required.`);
  }

  if (isPlaceholderSecret(trimmed) && !allowPlaceholder) {
    throw new Error(
      `${name} is a known placeholder. Set a long random value before starting in production.`,
    );
  }

  return trimmed;
}

export function isSqliteDatabaseUrl(databaseUrl: string | undefined | null): boolean {
  return Boolean(databaseUrl?.trim().startsWith('file:'));
}

export function assertRuntimeSecrets(): void {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }
  const sqlite = isSqliteDatabaseUrl(databaseUrl);
  const postgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
  if (!sqlite && !postgres) {
    throw new Error(
      'DATABASE_URL must be a SQLite file: path (local Electron) or a postgresql:// connection string (VPS).',
    );
  }

  requireSecret('JWT_SECRET', process.env.JWT_SECRET);
  requireSecret('GATEWAY_API_KEY', process.env.GATEWAY_API_KEY);
}
