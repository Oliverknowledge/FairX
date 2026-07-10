import {
  clampFairXPrice,
  isFairXMarketType,
  normalizeMaterialityRules,
  type FairXMarket,
  type FairXMarketType,
  type FairXOnChainMarket,
  type FairXSource,
  type MaterialityRules,
} from "@/lib/markets/fairx";

export interface CreateFairXMarketInput {
  title: string;
  fixtureId?: string;
  type: FairXMarketType;
  /** Friendly alias for form clients that name this field `marketType`. */
  marketType?: FairXMarketType;
  backedTeam?: string;
  targetSide?: string;
  resolutionNote?: string;
  /** The YES quote shown when the market is created. */
  initialDisplayedPrice?: number;
  /** Short alias accepted to keep imperative callers concise. */
  displayedPrice?: number;
  /** Optional initial fair YES quote; defaults to the displayed quote. */
  initialFairPrice?: number;
  fairPrice?: number;
  tolerance: number;
  materialityRules?: Partial<MaterialityRules>;
  source?: FairXSource;
  createdBy?: "demo" | "user";
  liquidity?: number;
  escrow?: number;
  onChain?: Partial<FairXOnChainMarket>;
}

export interface CreateFairXMarketOptions {
  /** Deterministic IDs make tests and imported demos reproducible. */
  id?: string;
  now?: number;
  /** An optional deterministic entropy source for clients that need unique IDs. */
  idFactory?: () => string;
}

export interface MarketCreationValidation {
  valid: boolean;
  errors: Partial<Record<keyof CreateFairXMarketInput | "materialityRules", string>>;
  value?: NormalizedCreateFairXMarketInput;
}

interface NormalizedCreateFairXMarketInput {
  title: string;
  fixtureId?: string;
  type: FairXMarketType;
  backedTeam?: string;
  targetSide?: string;
  resolutionNote?: string;
  displayedPrice: number;
  fairPrice: number;
  tolerance: number;
  materialityRules: MaterialityRules;
  source: FairXSource;
  createdBy: "demo" | "user";
  liquidity?: number;
  escrow?: number;
  onChain?: Partial<FairXOnChainMarket>;
}

export class FairXMarketValidationError extends Error {
  readonly errors: MarketCreationValidation["errors"];

  constructor(errors: MarketCreationValidation["errors"]) {
    super("Market creation input is invalid.");
    this.name = "FairXMarketValidationError";
    this.errors = errors;
  }
}

const PRICE_MIN = 0.01;
const PRICE_MAX = 0.99;

function compactText(value: string | undefined): string | undefined {
  const result = value?.trim().replace(/\s+/g, " ");
  return result || undefined;
}

function isSource(value: unknown): value is FairXSource {
  return value === "live" || value === "captured" || value === "demo";
}

function validProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= PRICE_MIN && value <= PRICE_MAX;
}

function validNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Validate without throwing so the Create page can display field-level errors.
 * The returned `value` is compacted and fully populated when valid.
 */
export function validateFairXMarketInput(input: CreateFairXMarketInput): MarketCreationValidation {
  const errors: MarketCreationValidation["errors"] = {};
  const title = compactText(input.title);
  const fixtureId = compactText(input.fixtureId);
  const backedTeam = compactText(input.backedTeam);
  const targetSide = compactText(input.targetSide);
  const resolutionNote = compactText(input.resolutionNote);
  const type = input.marketType ?? input.type;
  const displayedPrice = input.initialDisplayedPrice ?? input.displayedPrice;
  const fairPrice = input.initialFairPrice ?? input.fairPrice ?? displayedPrice;
  const rules = normalizeMaterialityRules(input.materialityRules);

  if (!title || title.length < 3) errors.title = "Use a market title of at least 3 characters.";
  else if (title.length > 140) errors.title = "Keep the title below 140 characters.";

  if (!isFairXMarketType(type)) errors.type = "Choose a supported controlled-market type.";
  if (type !== "CUSTOM_YES_NO" && !fixtureId) errors.fixtureId = "A fixture ID is required for this market type.";
  if (fixtureId && fixtureId.length > 120) errors.fixtureId = "Keep the fixture ID below 120 characters.";

  if ((type === "MATCH_WINNER" || type === "NEXT_GOAL") && !backedTeam) {
    errors.backedTeam = "Name the team or target side backed by YES.";
  }
  if (type === "TOTAL_GOALS" && !targetSide && !resolutionNote) {
    errors.targetSide = "Describe the total-goals threshold backed by YES.";
  }
  if (type === "CUSTOM_YES_NO" && !targetSide && !resolutionNote) {
    errors.targetSide = "Describe what a YES outcome means for this sandbox market.";
  }

  if (!validProbability(displayedPrice)) errors.initialDisplayedPrice = "Initial displayed price must be between 1¢ and 99¢.";
  if (!validProbability(fairPrice)) errors.initialFairPrice = "Initial fair price must be between 1¢ and 99¢.";
  if (!validProbability(input.tolerance) && !(typeof input.tolerance === "number" && input.tolerance === 0)) {
    errors.tolerance = "Tolerance must be a finite value from 0¢ to 99¢.";
  }
  if (typeof input.tolerance === "number" && input.tolerance > 0.25) {
    errors.tolerance = "Tolerance above 25¢ is not appropriate for this guard.";
  }
  if (!Object.values(rules).some(Boolean)) {
    errors.materialityRules = "Enable at least one materiality rule so the market can be protected.";
  }
  if (input.source !== undefined && !isSource(input.source)) errors.source = "Choose a valid settlement source.";
  if (input.liquidity !== undefined && !validNonNegative(input.liquidity)) errors.liquidity = "Liquidity must be a non-negative amount.";
  if (input.escrow !== undefined && !validNonNegative(input.escrow)) errors.escrow = "Escrow must be a non-negative amount.";

  if (Object.keys(errors).length) return { valid: false, errors };

  return {
    valid: true,
    errors,
    value: {
      title: title!,
      fixtureId,
      type,
      backedTeam,
      targetSide: targetSide ?? backedTeam,
      resolutionNote,
      displayedPrice: clampFairXPrice(displayedPrice!),
      fairPrice: clampFairXPrice(fairPrice!),
      tolerance: Math.round(input.tolerance * 10_000) / 10_000,
      materialityRules: rules,
      source: input.source ?? "demo",
      createdBy: input.createdBy ?? "user",
      liquidity: input.liquidity,
      escrow: input.escrow ?? input.liquidity,
      onChain: input.onChain,
    },
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return slug || "market";
}

function createMarketId(title: string, now: number, idFactory?: () => string): string {
  const suffix = idFactory?.() ?? Math.random().toString(36).slice(2, 8);
  return `fxm-${slugify(title)}-${now.toString(36)}-${suffix}`;
}

/**
 * Create a local sandbox market descriptor.  This function never sends a Solana
 * transaction; `onChain.initialized` remains false unless a caller attaches
 * the result of a real initialization flow later.
 */
export function createFairXMarket(input: CreateFairXMarketInput, options: CreateFairXMarketOptions = {}): FairXMarket {
  const validation = validateFairXMarketInput(input);
  if (!validation.valid || !validation.value) throw new FairXMarketValidationError(validation.errors);

  const now = options.now ?? Date.now();
  const value = validation.value;
  const id = options.id ?? createMarketId(value.title, now, options.idFactory);

  return {
    id,
    title: value.title,
    fixtureId: value.fixtureId,
    type: value.type,
    status: "TRADING",
    displayedPrice: value.displayedPrice,
    fairPrice: value.fairPrice,
    materialSeq: 1,
    pricedAtSeq: 1,
    tolerance: value.tolerance,
    source: value.source,
    materialityRules: { ...value.materialityRules },
    createdBy: value.createdBy,
    backedTeam: value.backedTeam,
    targetSide: value.targetSide,
    resolutionNote:
      value.resolutionNote ??
      (value.type === "CUSTOM_YES_NO" ? `Sandbox market: YES means ${value.targetSide ?? value.title}.` : undefined),
    liquidity: value.liquidity,
    escrow: value.escrow,
    createdAt: now,
    updatedAt: now,
    staleOpenedAt: null,
    lastRepriceAt: now,
    lastEvent: null,
    onChain: {
      initialized: value.onChain?.initialized === true,
      marketPda: value.onChain?.marketPda,
      marketConfigPda: value.onChain?.marketConfigPda,
      marketType: value.onChain?.marketType,
      fixtureIdHash: value.onChain?.fixtureIdHash,
      marketTitleHash: value.onChain?.marketTitleHash,
      materialityConfigHash: value.onChain?.materialityConfigHash,
      settlementConfigHash: value.onChain?.settlementConfigHash,
      oracleAuthority: value.onChain?.oracleAuthority,
      settled: value.onChain?.settled,
      lastOrderSignature: value.onChain?.lastOrderSignature,
      txSignatures: value.onChain?.txSignatures ? [...value.onChain.txSignatures] : undefined,
      cluster: value.onChain?.cluster,
      programId: value.onChain?.programId,
    },
  };
}
