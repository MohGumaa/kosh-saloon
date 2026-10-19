/** Environment variables production needs. Only names are ever logged, never values. */
export const REQUIRED_ENV = [
  "kosh_DATABASE_URL",
  "APP_URL",
  "EMAIL_API_KEY",
  "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN",
] as const;

/** Returns the required variable names that are missing or blank, in list order. */
export function missingRequiredEnv(env: Record<string, string | undefined>): string[] {
  return REQUIRED_ENV.filter((name) => !env[name]?.trim());
}

/**
 * Builds a redacted log entry for a server error. The query string and hash are
 * dropped because some links (password reset) carry tokens there; headers,
 * cookies, and bodies are never included.
 */
export function requestErrorLog(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string; renderSource?: string },
): Record<string, string | undefined> {
  const message = error instanceof Error ? error.message : String(error);
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;

  return {
    message,
    digest,
    method: request.method,
    path: request.path.split(/[?#]/, 1)[0],
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  };
}
