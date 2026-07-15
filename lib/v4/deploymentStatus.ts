import { V4_BOOTSTRAP_ADMIN, V4_PROGRAM_ID } from "@/lib/v4/program";

/**
 * Live, read-only devnet deployment status for the FairX Vault V4 program.
 *
 * This never signs or sends anything. It reads two accounts and reports the
 * honest current phase so the UI can distinguish, without ambiguity:
 *   - the program is deployed and executable (on-chain proof is live), or
 *   - only the funded upload buffer exists (deployment in progress), or
 *   - nothing exists yet, or
 *   - RPC was unavailable (never reported as success).
 */

export const UPGRADEABLE_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111";
export const V4_BUFFER_ID = "BGB1ncPYwkJBjC1jSFo1tJ68wnaB6H9t3QfwfHhUteLM";
export const V4_PROGRAM_DATA_ID = "9DrtcwJVTY4wDbJGRsiZfAj6sDFcLAHy6pBwxmRKk59V";
/** Historical upload-buffer rent (= ProgramData rent); the successful deploy purged the buffer. */
export const V4_BUFFER_EXPECTED_LAMPORTS = 2_938_602_480;
export const V4_SBF_SIZE_BYTES = 422_040;

export type V4DeploymentPhase = "DEPLOYED" | "BUFFER_FUNDED" | "NOT_STARTED" | "UNKNOWN";

export interface RpcAccountView {
  exists: boolean;
  executable: boolean;
  owner: string | null;
  lamports: number;
}

export interface V4DeploymentStatus {
  phase: V4DeploymentPhase;
  programId: string;
  bufferId: string;
  programDataId: string;
  bootstrapAdmin: string;
  /** True only when the program account is live, executable and loader-owned. */
  deployed: boolean;
  bufferFunded: boolean;
  bufferLamports: number;
  headline: string;
  detail: string;
  checkedAt: string;
  rpcUrl: string;
  explorer: { program: string; buffer: string; programData: string };
}

const explorerAddress = (address: string) => `https://explorer.solana.com/address/${address}?cluster=devnet`;

/** Pure interpretation of two account reads. Unit-tested; contains no I/O. */
export function interpretV4DeploymentState(
  program: RpcAccountView,
  buffer: RpcAccountView,
  meta: { checkedAt: string; rpcUrl: string },
): V4DeploymentStatus {
  const deployed = program.exists && program.executable && program.owner === UPGRADEABLE_LOADER_ID;
  const bufferFunded = buffer.exists && buffer.owner === UPGRADEABLE_LOADER_ID && buffer.lamports > 0;

  let phase: V4DeploymentPhase;
  let headline: string;
  let detail: string;
  if (deployed) {
    phase = "DEPLOYED";
    headline = "Program deployed on devnet";
    detail = "The FairX Vault V4 program account is live, executable and owned by the upgradeable loader. The finalized settlement lifecycle is independently verified in the next layer.";
  } else if (bufferFunded) {
    phase = "BUFFER_FUNDED";
    headline = "Deployment in progress — program not yet live";
    detail = `The upgradeable-loader upload buffer is funded with ${(buffer.lamports / 1e9).toFixed(6)} SOL of program rent, but the executable program account does not exist yet. No FairX V4 transaction has settled on-chain.`;
  } else {
    phase = "NOT_STARTED";
    headline = "No devnet deployment yet";
    detail = "Neither the program account nor a funded upload buffer is present at the approved addresses.";
  }

  return {
    phase,
    programId: V4_PROGRAM_ID,
    bufferId: V4_BUFFER_ID,
    programDataId: V4_PROGRAM_DATA_ID,
    bootstrapAdmin: V4_BOOTSTRAP_ADMIN,
    deployed,
    bufferFunded,
    bufferLamports: buffer.exists ? buffer.lamports : 0,
    headline,
    detail,
    checkedAt: meta.checkedAt,
    rpcUrl: meta.rpcUrl,
    explorer: {
      program: explorerAddress(V4_PROGRAM_ID),
      buffer: explorerAddress(V4_BUFFER_ID),
      programData: explorerAddress(V4_PROGRAM_DATA_ID),
    },
  };
}

function unknownStatus(rpcUrl: string, reason: string): V4DeploymentStatus {
  return {
    phase: "UNKNOWN",
    programId: V4_PROGRAM_ID,
    bufferId: V4_BUFFER_ID,
    programDataId: V4_PROGRAM_DATA_ID,
    bootstrapAdmin: V4_BOOTSTRAP_ADMIN,
    deployed: false,
    bufferFunded: false,
    bufferLamports: 0,
    headline: "Live devnet status unavailable",
    detail: `Could not read devnet: ${reason}. Unavailable evidence is never reported as deployed.`,
    checkedAt: new Date().toISOString(),
    rpcUrl,
    explorer: {
      program: explorerAddress(V4_PROGRAM_ID),
      buffer: explorerAddress(V4_BUFFER_ID),
      programData: explorerAddress(V4_PROGRAM_DATA_ID),
    },
  };
}

function toAccountView(value: unknown): RpcAccountView {
  if (!value || typeof value !== "object") return { exists: false, executable: false, owner: null, lamports: 0 };
  const account = value as { executable?: boolean; owner?: string; lamports?: number };
  return {
    exists: true,
    executable: Boolean(account.executable),
    owner: typeof account.owner === "string" ? account.owner : null,
    lamports: typeof account.lamports === "number" ? account.lamports : 0,
  };
}

/** Best-effort live read of the two accounts with a hard timeout and graceful UNKNOWN fallback. */
export async function fetchV4DeploymentStatus(
  rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  timeoutMs = 3500,
): Promise<V4DeploymentStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "v4-status",
        method: "getMultipleAccounts",
        params: [[V4_PROGRAM_ID, V4_BUFFER_ID], { encoding: "base64", dataSlice: { offset: 0, length: 0 } }],
      }),
    });
    if (!response.ok) return unknownStatus(rpcUrl, `RPC HTTP ${response.status}`);
    const json = (await response.json()) as { error?: { message: string }; result?: { value?: unknown[] } };
    if (json.error) return unknownStatus(rpcUrl, json.error.message);
    const values = json.result?.value;
    if (!Array.isArray(values) || values.length < 2) return unknownStatus(rpcUrl, "unexpected RPC response shape");
    return interpretV4DeploymentState(toAccountView(values[0]), toAccountView(values[1]), {
      checkedAt: new Date().toISOString(),
      rpcUrl,
    });
  } catch (error) {
    return unknownStatus(rpcUrl, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
}
