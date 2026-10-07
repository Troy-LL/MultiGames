export interface HostResolution {
  /** Host to hand PartySocket. Always a dialable value so the hook stays happy. */
  host: string
  /** Non-null when the app is misconfigured; the UI shows this instead of the
   * game. In dev, a missing host is fine (falls back to localhost). */
  configError: string | null
}

/**
 * Decide the PartyKit host from the build-time env var.
 *
 * The old code silently fell back to `localhost:1999` even in a production
 * build, so a deploy that forgot `VITE_PARTYKIT_HOST` dialed localhost and hung
 * forever with no signal. In prod we now fail loudly instead.
 *
 * Pure (no `import.meta`) so it is unit-testable.
 */
export function resolveHost(
  rawHost: string | undefined,
  isProd: boolean,
): HostResolution {
  const host = (rawHost ?? '').trim()
  if (host) return { host, configError: null }
  return {
    host: 'localhost:1999',
    configError: isProd
      ? 'VITE_PARTYKIT_HOST was not set when this app was built, so it has no game server to connect to. Set VITE_PARTYKIT_HOST at build time and redeploy.'
      : null,
  }
}
