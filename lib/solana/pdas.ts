import { PublicKey } from "@solana/web3.js";

export const LOCAL_LINEGUARD_PROGRAM_ID = "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe";
export const LINEGUARD_MARKET_LABEL = "eng-win";
export const LINEGUARD_YES_ORDER_LABEL = "yes-attack-order";
export const LINEGUARD_NO_ORDER_LABEL = "no-stale-order";

export type OnChainSide = "YES" | "NO";

export function bytes32(label: string): Uint8Array {
  const out = new Uint8Array(32);
  new TextEncoder().encode(label.slice(0, 32)).forEach((byte, i) => {
    out[i] = byte;
  });
  return out;
}

export function orderLabelForSide(side: OnChainSide): string {
  return side === "YES" ? LINEGUARD_YES_ORDER_LABEL : LINEGUARD_NO_ORDER_LABEL;
}

export function sideCode(side: OnChainSide): 0 | 1 {
  return side === "YES" ? 0 : 1;
}

export function deriveMarketPda(programId: string, marketId = bytes32(LINEGUARD_MARKET_LABEL)): PublicKey {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("market"), marketId], new PublicKey(programId))[0];
}

export function deriveOrderPda(programId: string, market: PublicKey, orderId: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("order"), market.toBytes(), orderId], new PublicKey(programId))[0];
}

export function deriveDefaultPdas(programId: string, side: OnChainSide = "YES") {
  return deriveLineGuardPdas(programId, LINEGUARD_MARKET_LABEL, orderLabelForSide(side));
}

export function deriveLineGuardPdas(programId: string, marketLabel: string, orderLabel: string) {
  const marketId = bytes32(marketLabel);
  const orderId = bytes32(orderLabel);
  const marketPda = deriveMarketPda(programId, marketId);
  const orderEscrowPda = deriveOrderPda(programId, marketPda, orderId);
  return { marketLabel, orderLabel, marketId, orderId, marketPda, orderEscrowPda };
}
