import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Commitment,
} from "@solana/web3.js";
import { sha256 } from "js-sha256";

export const LINEGUARD_V2_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_LINEGUARD_PROGRAM_ID ?? "6k8uu3N8Eedd26be6v96Dfs5H2YrikbhQe7sSz8HWdSe"
);
export const LINEGUARD_V2_CLUSTER = "devnet" as const;
export const CANONICAL_V2_MARKET_LABEL = process.env.NEXT_PUBLIC_LINEGUARD_V2_MARKET_ID ?? "fairx-france-morocco-v2";
export const POSITION_ACCOUNT_SIZE = 108;

export type V2Side = "YES" | "NO";

export interface MarketV2State {
  address: string;
  authorityConfig: string;
  marketIdHex: string;
  fixtureId: number;
  templateId: number;
  oddsPayloadHash: string;
  oddsSequence: number;
  materialSeq: number;
  pricedAtSeq: number;
  displayedPriceMicros: number;
  fairPriceMicros: number;
  toleranceMicros: number;
  closeTime: number;
  claimDeadline: number;
  yesPoolLamports: number;
  noPoolLamports: number;
  claimedWinningLamports: number;
  resolution: number;
  tradingClosed: boolean;
  resolved: boolean;
  resolvedAt: number;
  validationPayloadHash: string;
  resolutionEventHash: string;
}

export interface MarketVaultState {
  address: string;
  market: string;
  lamports: number;
  totalDeposited: number;
  totalRefunded: number;
  totalAccepted: number;
  totalPaid: number;
  totalClaimable: number;
  roundingDust: number;
}

export interface PositionV2State {
  address: string;
  market: string;
  trader: string;
  side: V2Side;
  depositedLamports: number;
  acceptedLamports: number;
  poolWeight: number;
  entryPriceMicros: number;
  status: number;
  claimed: boolean;
}

export interface V2MarketSnapshot {
  deployed: boolean;
  marketPda: string;
  vaultPda: string;
  market: MarketV2State | null;
  vault: MarketVaultState | null;
  reason?: string;
}

const textEncoder = new TextEncoder();

function bytes32Hash(value: string): Uint8Array {
  return new Uint8Array(sha256.arrayBuffer(value));
}

function discriminator(namespace: "global" | "account", name: string): Buffer {
  return Buffer.from(sha256.arrayBuffer(`${namespace}:${name}`)).subarray(0, 8);
}

function u64(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(value);
  return out;
}

function readU64(data: Buffer, offset: number): number {
  const value = data.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("On-chain u64 exceeds JavaScript safe integer range");
  return Number(value);
}

function readI64(data: Buffer, offset: number): number {
  const value = data.readBigInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error("On-chain i64 exceeds JavaScript safe integer range");
  return Number(value);
}

function hashHex(data: Buffer, offset: number): string {
  return data.subarray(offset, offset + 32).toString("hex");
}

function assertAccount(data: Buffer, name: string, minimumSize: number): void {
  if (data.length < minimumSize || !data.subarray(0, 8).equals(discriminator("account", name))) {
    throw new Error(`Account is not a LineGuard ${name}`);
  }
}

export function marketIdBytes(label = CANONICAL_V2_MARKET_LABEL): Uint8Array {
  return bytes32Hash(label);
}

export function deriveMarketV2Pda(label = CANONICAL_V2_MARKET_LABEL): PublicKey {
  return PublicKey.findProgramAddressSync([textEncoder.encode("market-v2"), marketIdBytes(label)], LINEGUARD_V2_PROGRAM_ID)[0];
}

export function deriveMarketVaultPda(market: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([textEncoder.encode("market-vault"), market.toBytes()], LINEGUARD_V2_PROGRAM_ID)[0];
}

export function deriveOrderV2Pda(market: PublicKey, orderId: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync([textEncoder.encode("order-v2"), market.toBytes(), orderId], LINEGUARD_V2_PROGRAM_ID)[0];
}

export function derivePositionPda(market: PublicKey, trader: PublicKey, side: V2Side): PublicKey {
  return PublicKey.findProgramAddressSync(
    [textEncoder.encode("position"), market.toBytes(), trader.toBytes(), Uint8Array.of(side === "YES" ? 0 : 1)],
    LINEGUARD_V2_PROGRAM_ID
  )[0];
}

export function parseMarketV2(address: PublicKey, raw: Buffer): MarketV2State {
  assertAccount(raw, "MarketV2", 509);
  return {
    address: address.toBase58(),
    authorityConfig: new PublicKey(raw.subarray(8, 40)).toBase58(),
    marketIdHex: hashHex(raw, 40),
    fixtureId: readU64(raw, 72),
    templateId: raw.readUInt16LE(80),
    oddsPayloadHash: hashHex(raw, 281),
    oddsSequence: readU64(raw, 313),
    materialSeq: readU64(raw, 321),
    pricedAtSeq: readU64(raw, 329),
    displayedPriceMicros: readU64(raw, 337),
    fairPriceMicros: readU64(raw, 345),
    toleranceMicros: readU64(raw, 353),
    closeTime: readI64(raw, 393),
    claimDeadline: readI64(raw, 401),
    yesPoolLamports: readU64(raw, 409),
    noPoolLamports: readU64(raw, 417),
    claimedWinningLamports: readU64(raw, 425),
    resolution: raw[433],
    tradingClosed: raw[434] === 1,
    resolved: raw[435] === 1,
    resolvedAt: readI64(raw, 436),
    validationPayloadHash: hashHex(raw, 444),
    resolutionEventHash: hashHex(raw, 476),
  };
}

export function parseMarketVault(address: PublicKey, lamports: number, raw: Buffer): MarketVaultState {
  assertAccount(raw, "MarketVault", 89);
  return {
    address: address.toBase58(),
    market: new PublicKey(raw.subarray(8, 40)).toBase58(),
    lamports,
    totalDeposited: readU64(raw, 40),
    totalRefunded: readU64(raw, 48),
    totalAccepted: readU64(raw, 56),
    totalPaid: readU64(raw, 64),
    totalClaimable: readU64(raw, 72),
    roundingDust: readU64(raw, 80),
  };
}

export function parsePosition(address: PublicKey, raw: Buffer): PositionV2State {
  assertAccount(raw, "Position", POSITION_ACCOUNT_SIZE);
  return {
    address: address.toBase58(),
    market: new PublicKey(raw.subarray(8, 40)).toBase58(),
    trader: new PublicKey(raw.subarray(40, 72)).toBase58(),
    side: raw[72] === 0 ? "YES" : "NO",
    depositedLamports: readU64(raw, 73),
    acceptedLamports: readU64(raw, 81),
    poolWeight: readU64(raw, 89),
    entryPriceMicros: readU64(raw, 97),
    status: raw[105],
    claimed: raw[106] === 1,
  };
}

export async function fetchV2MarketSnapshot(connection: Connection, label = CANONICAL_V2_MARKET_LABEL): Promise<V2MarketSnapshot> {
  const marketPda = deriveMarketV2Pda(label);
  const vaultPda = deriveMarketVaultPda(marketPda);
  const [marketInfo, vaultInfo] = await connection.getMultipleAccountsInfo([marketPda, vaultPda], "confirmed");
  const base = { marketPda: marketPda.toBase58(), vaultPda: vaultPda.toBase58() };
  if (!marketInfo || !vaultInfo) return { ...base, deployed: false, market: null, vault: null, reason: "The v2 devnet market has not been initialized." };
  if (!marketInfo.owner.equals(LINEGUARD_V2_PROGRAM_ID) || !vaultInfo.owner.equals(LINEGUARD_V2_PROGRAM_ID)) {
    return { ...base, deployed: false, market: null, vault: null, reason: "Market or vault has an unexpected owner." };
  }
  try {
    const market = parseMarketV2(marketPda, Buffer.from(marketInfo.data));
    const vault = parseMarketVault(vaultPda, vaultInfo.lamports, Buffer.from(vaultInfo.data));
    if (vault.market !== market.address) throw new Error("Market-vault binding mismatch");
    return { ...base, deployed: true, market, vault };
  } catch (error) {
    return { ...base, deployed: false, market: null, vault: null, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function fetchTraderPositions(connection: Connection, trader: PublicKey): Promise<PositionV2State[]> {
  const accounts = await connection.getProgramAccounts(LINEGUARD_V2_PROGRAM_ID, {
    commitment: "confirmed" as Commitment,
    filters: [{ dataSize: POSITION_ACCOUNT_SIZE }, { memcmp: { offset: 40, bytes: trader.toBase58() } }],
  });
  return accounts.map(({ pubkey, account }) => parsePosition(pubkey, Buffer.from(account.data)));
}

export function buildOrderTransaction(args: {
  trader: PublicKey;
  market: PublicKey;
  side: V2Side;
  stakeLamports: bigint;
  maxAcceptedEdgeMicros: bigint;
  orderNonce?: string;
}): { transaction: Transaction; orderId: Uint8Array; orderPda: PublicKey; positionPda: PublicKey; vaultPda: PublicKey } {
  const orderId = bytes32Hash(args.orderNonce ?? crypto.randomUUID());
  const orderPda = deriveOrderV2Pda(args.market, orderId);
  const positionPda = derivePositionPda(args.market, args.trader, args.side);
  const vaultPda = deriveMarketVaultPda(args.market);
  const sideCode = args.side === "YES" ? 0 : 1;
  const place = new TransactionInstruction({
    programId: LINEGUARD_V2_PROGRAM_ID,
    keys: [
      { pubkey: args.trader, isSigner: true, isWritable: true },
      { pubkey: args.market, isSigner: false, isWritable: false },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: orderPda, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      discriminator("global", "place_order_v2"),
      Buffer.from(orderId),
      Buffer.from([sideCode]),
      u64(args.stakeLamports),
      u64(args.maxAcceptedEdgeMicros),
    ]),
  });
  const evaluate = new TransactionInstruction({
    programId: LINEGUARD_V2_PROGRAM_ID,
    keys: [
      { pubkey: args.market, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: orderPda, isSigner: false, isWritable: true },
      { pubkey: args.trader, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
    ],
    data: discriminator("global", "evaluate_order_v2"),
  });
  return { transaction: new Transaction().add(place, evaluate), orderId, orderPda, positionPda, vaultPda };
}

export function buildClaimTransaction(args: { trader: PublicKey; market: PublicKey; position: PublicKey }): Transaction {
  const vault = deriveMarketVaultPda(args.market);
  return new Transaction().add(new TransactionInstruction({
    programId: LINEGUARD_V2_PROGRAM_ID,
    keys: [
      { pubkey: args.trader, isSigner: true, isWritable: true },
      { pubkey: args.market, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: args.position, isSigner: false, isWritable: true },
    ],
    data: discriminator("global", "claim_position_v2"),
  }));
}

export async function prepareAndSimulate(connection: Connection, transaction: Transaction, feePayer: PublicKey): Promise<void> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) {
    const log = simulation.value.logs?.slice(-4).join("\n") ?? JSON.stringify(simulation.value.err);
    throw new Error(`Devnet simulation failed. ${log}`);
  }
}

export function explorerTransaction(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddress(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
