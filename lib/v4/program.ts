import { PublicKey } from "@solana/web3.js";

export const V4_PROGRAM_ID = "2x3vhmoj2itZYkFejDUBfTFUy59VK4APKDU4GvSqyF7p";
export const V4_BOOTSTRAP_ADMIN = "ELayKfQEmK6DoEeqn3Di5uzsoNu25KNytAv44qBtbrbq";

export const V4_PROGRAM_PUBLIC_KEY = new PublicKey(V4_PROGRAM_ID);
export const V4_BOOTSTRAP_ADMIN_PUBLIC_KEY = new PublicKey(V4_BOOTSTRAP_ADMIN);

export const V4_RUNTIME_STATUS = {
  phase: "Phase C",
  cluster: "devnet",
  programId: V4_PROGRAM_ID,
  bootstrapAdmin: V4_BOOTSTRAP_ADMIN,
  identitySynchronized: true,
  deployed: true,
  signed: true,
  lifecycleVerified: true,
  label: "Deployed on Solana devnet; canonical France–Morocco lifecycle verified 20/20 from RPC.",
} as const;

export function deriveV4Pda(...seeds: Buffer[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, V4_PROGRAM_PUBLIC_KEY)[0];
}

export function deriveAuthorityConfigV4Pda(): PublicKey {
  return deriveV4Pda(Buffer.from("authority-config-v4"));
}

export function deriveMarketV4Pda(marketId: Uint8Array): PublicKey {
  return deriveV4Pda(Buffer.from("market-v4"), Buffer.from(marketId));
}

export function deriveLiquidityVaultV4Pda(market: PublicKey): PublicKey {
  return deriveV4Pda(Buffer.from("liquidity-vault-v4"), market.toBuffer());
}

export function deriveQuoteReceiptV4Pda(market: PublicKey, quoteSequence: bigint): PublicKey {
  const sequence = Buffer.alloc(8);
  sequence.writeBigUInt64LE(quoteSequence);
  return deriveV4Pda(Buffer.from("quote-proof-v4"), market.toBuffer(), sequence);
}

export function deriveFixedPayoutPositionV4Pda(
  market: PublicKey,
  trader: PublicKey,
  clientOrderId: Uint8Array,
  orderNonce: bigint,
): PublicKey {
  const nonce = Buffer.alloc(8);
  nonce.writeBigUInt64LE(orderNonce);
  return deriveV4Pda(
    Buffer.from("position-v4"),
    market.toBuffer(),
    trader.toBuffer(),
    Buffer.from(clientOrderId),
    nonce,
  );
}

export function deriveResolutionReceiptV4Pda(market: PublicKey): PublicKey {
  return deriveV4Pda(Buffer.from("resolution-proof-v4"), market.toBuffer());
}

export function deriveResolutionProposalV4Pda(market: PublicKey): PublicKey {
  return deriveV4Pda(Buffer.from("resolution-proposal-v4"), market.toBuffer());
}
