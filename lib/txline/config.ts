import type { TxLineHealth } from "@/lib/txline/types";

/**
 * TxLINE configuration. Secrets (JWT / API token) are read from process.env
 * and must only ever be used inside app/api/txline/* route handlers. The
 * browser learns about TxLINE exclusively through the sanitized TxLineHealth
 * shape — never the raw values.
 */

export interface TxLineServerConfig {
  network: string;
  apiOrigin: string;
  jwt: string | null;
  apiToken: string | null;
  fixtureId: string | null;
  /** Endpoint paths are overridable because TxLINE deployments vary. */
  scoresStreamPath: string;
  oddsStreamPath: string;
  scoresSnapshotPath: string;
}

const env = (key: string): string | null => {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : null;
};

/** Server-side only — do not import from client components. */
export function getTxLineServerConfig(): TxLineServerConfig {
  return {
    network: env("TXLINE_NETWORK") ?? "devnet",
    apiOrigin: env("TXLINE_API_ORIGIN") ?? "https://txline-dev.txodds.com",
    jwt: env("TXLINE_JWT"),
    apiToken: env("TXLINE_API_TOKEN"),
    fixtureId: env("TXLINE_FIXTURE_ID"),
    scoresStreamPath: env("TXLINE_SCORES_STREAM_PATH") ?? "/scores/stream",
    oddsStreamPath: env("TXLINE_ODDS_STREAM_PATH") ?? "/odds/stream",
    scoresSnapshotPath: env("TXLINE_SCORES_SNAPSHOT_PATH") ?? "/scores/snapshot",
  };
}

export function hasTxLineCredentials(cfg: TxLineServerConfig = getTxLineServerConfig()): boolean {
  return Boolean(cfg.jwt || cfg.apiToken);
}

/** Sanitized shape safe to send to the browser. */
export function getTxLineHealth(): TxLineHealth {
  const cfg = getTxLineServerConfig();
  const mode = env("NEXT_PUBLIC_TXLINE_MODE");
  return {
    configuredMode: mode === "live" ? "live" : mode === "demo" ? "demo" : "live_or_demo",
    network: cfg.network,
    apiOrigin: cfg.apiOrigin,
    fixtureId: cfg.fixtureId,
    hasJwt: Boolean(cfg.jwt),
    hasApiToken: Boolean(cfg.apiToken),
    liveCapable: hasTxLineCredentials(cfg),
  };
}

/** Headers every proxied TxLINE request carries. */
export function txLineAuthHeaders(cfg: TxLineServerConfig): Record<string, string> {
  const headers: Record<string, string> = { "Cache-Control": "no-cache" };
  if (cfg.jwt) headers["Authorization"] = `Bearer ${cfg.jwt}`;
  if (cfg.apiToken) headers["X-Api-Token"] = cfg.apiToken;
  return headers;
}

/** Build a full upstream URL, appending the fixture filter when configured. */
export function txLineUrl(cfg: TxLineServerConfig, path: string): string {
  const url = new URL(path, cfg.apiOrigin);
  if (cfg.fixtureId) url.searchParams.set("fixtureId", cfg.fixtureId);
  return url.toString();
}
