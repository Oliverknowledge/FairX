import type { OnChainProof } from "@/lib/receipts/types";
import { LOCAL_LINEGUARD_PROGRAM_ID, type OnChainSide } from "@/lib/solana/pdas";

export type OnChainMode = "devnet" | "localnet" | "not_configured";

export interface ParsedOnChainMarket {
  address: string;
  authority: string;
  marketIdHex: string;
  materialSeq: number;
  pricedAtSeq: number;
  displayedPriceMicros: number;
  fairPriceMicros: number;
  toleranceMicros: number;
  statusCode: number;
  status: "Trading" | "Stale" | "Repricing" | "Unknown";
  bump: number;
  /** sha256 (hex) of the normalized source event bound on-chain (zeros if never ingested). */
  sourceEventHashHex: string;
}

export interface ParsedOnChainMarketConfig {
  address: string;
  marketTypeCode: number;
  marketType: "MATCH_WINNER" | "TOTAL_GOALS" | "NEXT_GOAL" | "CUSTOM_YES_NO" | "UNKNOWN";
  fixtureIdHashHex: string;
  marketTitleHashHex: string;
  materialityConfigHashHex: string;
  settlementConfigHashHex: string;
  authority: string;
  createdAtSlot: number;
}

export interface ParsedOnChainOrder {
  address: string;
  trader: string;
  market: string;
  orderIdHex: string;
  sideCode: number;
  side: OnChainSide | "UNKNOWN";
  stakeLamports: number;
  observedPriceMicros: number;
  fairSidePriceMicros: number;
  edgeMicros: number;
  statusCode: number;
  status: "Submitted" | "Escrowed" | "Evaluated" | "Filled" | "VoidedRefunded" | "Unknown";
  verdictCode: number;
  verdict: "ALLOWED" | "STALE_ALLOWED_NO_EDGE" | "VOIDED_REFUNDED" | "UNKNOWN";
  bump: number;
  settlementDestinationCode: number;
  settlementDestination: "REFUNDED_TO_TRADER" | "FINALIZED_TO_VAULT" | "PENDING" | "UNKNOWN";
  sourceEventHashHex: string;
  materialityConfigHashHex: string;
}

export interface OnChainApiState {
  ok: boolean;
  mode: OnChainMode;
  configured: boolean;
  reason?: string;
  cluster?: "devnet" | "localnet";
  programId: string;
  programExplorerUrl?: string;
  marketPda?: string;
  marketConfigPda?: string;
  orderEscrowPda?: string;
  yesOrderEscrowPda?: string;
  noOrderEscrowPda?: string;
  selectedSide: OnChainSide;
  latestSignature?: string;
  explorerUrl?: string;
  signatures?: string[];
  explorerUrls?: string[];
  market: ParsedOnChainMarket | null;
  marketConfig: ParsedOnChainMarketConfig | null;
  order: ParsedOnChainOrder | null;
  localTestsAvailable: boolean;
}

export interface OnChainActionResponse extends OnChainApiState {
  signature?: string;
  proof?: OnChainProof;
  alreadyInitialized?: boolean;
  demo?: OnChainDemoSummary;
}

export interface OnChainDemoSummary {
  side: OnChainSide;
  marketPda: string;
  orderEscrowPda: string;
  signatures: string[];
  explorerUrls: string[];
  verdict: ParsedOnChainOrder["verdict"];
  edgeMicros: number;
  refunded: boolean;
  filled: boolean;
  orderLamports: number;
  balanceBeforePlace: number;
  balanceAfterPlace: number;
  balanceAfterEvaluate: number;
  /** REFUNDED_TO_TRADER (voided) or FINALIZED_TO_VAULT (filled). */
  settlementDestination: "REFUNDED_TO_TRADER" | "FINALIZED_TO_VAULT";
  vaultPda: string;
  vaultBalanceBeforeLamports: number;
  vaultBalanceLamports: number;
  vaultDeltaLamports: number;
  sourceEventHash: string;
}

export const DEFAULT_ONCHAIN_STATE: OnChainApiState = {
  ok: false,
  mode: "not_configured",
  configured: false,
  reason: "On-chain mode not configured.",
  programId: LOCAL_LINEGUARD_PROGRAM_ID,
  selectedSide: "YES",
  market: null,
  marketConfig: null,
  order: null,
  localTestsAvailable: true,
};

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T;
  if (!res.ok) {
    const message = typeof body === "object" && body !== null && "reason" in body ? String(body.reason) : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

export async function fetchOnChainState(side: OnChainSide = "YES"): Promise<OnChainApiState> {
  const res = await fetch(`/api/solana/lineguard/state?side=${side}`, { cache: "no-store" });
  return readJson<OnChainApiState>(res);
}

export async function postOnChainAction(path: string, body: Record<string, unknown> = {}): Promise<OnChainActionResponse> {
  const res = await fetch(`/api/solana/lineguard/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<OnChainActionResponse>(res);
}

export function verdictMatchesFrontend(onChain: ParsedOnChainOrder | null, frontendVerdict: string | null | undefined): boolean | null {
  if (!onChain || !frontendVerdict || onChain.verdict === "UNKNOWN") return null;
  return onChain.verdict === frontendVerdict;
}

export function explorerUrl(cluster: "devnet" | "localnet", signature: string): string | undefined {
  if (cluster !== "devnet") return undefined;
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function programExplorerUrl(cluster: "devnet" | "localnet", programId: string): string | undefined {
  if (cluster !== "devnet") return undefined;
  return `https://explorer.solana.com/address/${programId}?cluster=devnet`;
}
