export interface TxlineValidationRecord {
  version: 1;
  source: "txline";
  network: "devnet" | "mainnet";
  programId: string;
  method: "validateStatV2";
  endpoint: "/api/scores/stat-validation";
  fixtureId: string;
  seq: number;
  statKeys: number[];
  fetchedAt: string;
  validationPayload: unknown;
  validationPayloadHash: string;
  dailyScoresRootPda: string;
  dailyScoresRootAccountHash: string;
  rootEpochDay: number;
  simulationPassed: boolean;
  validatedAt: string;
}
