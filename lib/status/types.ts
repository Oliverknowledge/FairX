export type RuntimeLevel = "ready" | "limited" | "unavailable";

export interface FairXRuntimeStatus {
  checkedAt: string;
  build: {
    commit: string;
    buildTime: string;
    environment: string;
  };
  solana: {
    cluster: "devnet" | "localnet" | "unconfigured";
    rpcConnected: boolean;
    rpcSlot?: number;
    programId: string;
    programExecutable: boolean;
    programDataAddress?: string;
    programDataLength?: number;
    deployedSlot?: number;
    deploymentSignature?: string;
    deploymentTime?: string;
    schemaCurrent: boolean;
    schemaLabel: "settlement-v5" | "settlement-v4" | "settlement-v3" | "market-config-v2" | "event-hash-v1" | "unknown";
  };
  operator: {
    configured: boolean;
    publicKey?: string;
    balanceLamports?: number;
    balanceSol?: number;
    lowBalance: boolean;
  };
  vault: {
    pda: string;
    exists: boolean;
    balanceLamports?: number;
    totalFinalizedLamports?: number;
    fillCount?: number;
  };
  txline: {
    configured: boolean;
    authenticated: boolean;
    connected: boolean;
    mode: "live_connected" | "configured_unreachable" | "unconfigured";
    network: "devnet" | "mainnet" | null;
    apiOrigin: string;
    fixtureId: string | null;
    endpoints: {
      scoresStream: string;
      oddsStream: string;
      scoresSnapshot: string;
      scoresHistorical: string;
      fixturesSnapshot: string;
      oddsSnapshot: string;
    };
    fixturesAvailable: boolean;
    scoresAvailable: boolean;
    oddsAvailable: boolean;
    scoresStreamConnected: boolean;
    oddsStreamConnected: boolean;
    lastSuccessfulRequestAt: string | null;
    canonicalSourceMode: "live" | "historical" | "captured" | "guided";
    validationAvailable: boolean;
    lastValidationPassed: boolean | null;
  };
  freshProofAvailable: boolean;
  canonicalProofAvailable: true;
  level: RuntimeLevel;
  reason?: string;
}
