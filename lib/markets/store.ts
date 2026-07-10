import { useEffect, useSyncExternalStore } from "react";
import { marketCatalog } from "@/lib/markets/catalog";
import {
  cloneFairXMarket,
  cloneGuardedOrder,
  isFairXMarketStatus,
  isFairXMarketType,
  normalizeMaterialityRules,
  type FairXMarket,
  type FairXStoreSnapshot,
  type GuardedOrder,
} from "@/lib/markets/fairx";
import type { LineGuardReceipt } from "@/lib/receipts/types";
import type { TxLineEventType } from "@/lib/txline/types";

/** Versioned keys keep browser state entirely local and easy for the verifier to discover. */
export const FAIRX_STORAGE_KEY = "fairx:market-state:v1";
export const FAIRX_RECEIPTS_STORAGE_KEY = "fairx:receipts:v1";
export const FAIRX_LAST_RECEIPT_STORAGE_KEY = "fairx:last-receipt";

export interface FairXStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface FairXStore {
  getSnapshot(): FairXStoreSnapshot;
  getServerSnapshot(): FairXStoreSnapshot;
  subscribe(listener: () => void): () => void;
  hydrate(force?: boolean): FairXStoreSnapshot;
  replace(snapshot: Pick<FairXStoreSnapshot, "markets" | "orders" | "receipts">): FairXStoreSnapshot;
  upsertMarket(market: FairXMarket): FairXStoreSnapshot;
  addOrder(order: GuardedOrder, receipt?: LineGuardReceipt): FairXStoreSnapshot;
  addReceipt(receipt: LineGuardReceipt): FairXStoreSnapshot;
  reset(): FairXStoreSnapshot;
}

export interface UseFairXStoreResult {
  store: FairXStore;
  snapshot: FairXStoreSnapshot;
  markets: FairXMarket[];
  orders: GuardedOrder[];
  receipts: LineGuardReceipt[];
  hydrated: boolean;
  hydrate: (force?: boolean) => FairXStoreSnapshot;
  upsertMarket: (market: FairXMarket) => FairXStoreSnapshot;
  addOrder: (order: GuardedOrder, receipt?: LineGuardReceipt) => FairXStoreSnapshot;
  addReceipt: (receipt: LineGuardReceipt) => FairXStoreSnapshot;
  reset: () => FairXStoreSnapshot;
}

function cloneReceipt(receipt: LineGuardReceipt): LineGuardReceipt {
  return {
    ...receipt,
    onChain: receipt.onChain
      ? {
          ...receipt.onChain,
          txSignatures: [...receipt.onChain.txSignatures],
          explorerUrls: [...receipt.onChain.explorerUrls],
        }
      : undefined,
  };
}

function cloneSnapshot(snapshot: FairXStoreSnapshot): FairXStoreSnapshot {
  return {
    version: 1,
    markets: snapshot.markets.map((market) => cloneFairXMarket(market)),
    orders: snapshot.orders.map((order) => cloneGuardedOrder(order)),
    receipts: snapshot.receipts.map((receipt) => cloneReceipt(receipt)),
    hydrated: snapshot.hydrated,
  };
}

function seedSnapshot(hydrated = false): FairXStoreSnapshot {
  return {
    version: 1,
    markets: marketCatalog.map((market) => cloneFairXMarket(market)),
    orders: [],
    receipts: [],
    hydrated,
  };
}

function browserStorage(): FairXStorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Privacy modes and embedded demos may deny access.  State still works in
    // memory; callers can surface no persistence without crashing SSR/client.
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isSource(value: unknown): value is FairXMarket["source"] {
  return value === "live" || value === "captured" || value === "demo";
}

function isTxLineEventType(value: unknown): value is TxLineEventType {
  return (
    value === "GOAL" ||
    value === "RED_CARD" ||
    value === "YELLOW_CARD" ||
    value === "PENALTY" ||
    value === "VAR" ||
    value === "ODDS_UPDATE" ||
    value === "MATCH_STATE" ||
    value === "UNKNOWN"
  );
}

function isFairXMarket(value: unknown): value is FairXMarket {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isFairXMarketType(value.type) &&
    isFairXMarketStatus(value.status) &&
    asFiniteNumber(value.displayedPrice) !== null &&
    asFiniteNumber(value.fairPrice) !== null &&
    asFiniteNumber(value.materialSeq) !== null &&
    asFiniteNumber(value.pricedAtSeq) !== null &&
    asFiniteNumber(value.tolerance) !== null &&
    isSource(value.source) &&
    isRecord(value.materialityRules)
  );
}

function sanitizeMarket(value: FairXMarket): FairXMarket {
  const raw = value as FairXMarket & { onChain?: Record<string, unknown>; lastEvent?: Record<string, unknown> | null };
  return {
    ...raw,
    materialityRules: normalizeMaterialityRules(raw.materialityRules),
    onChain: raw.onChain
      ? {
          initialized: raw.onChain.initialized === true,
          marketPda: typeof raw.onChain.marketPda === "string" ? raw.onChain.marketPda : undefined,
          txSignatures: Array.isArray(raw.onChain.txSignatures)
            ? raw.onChain.txSignatures.filter((signature): signature is string => typeof signature === "string")
            : undefined,
          cluster: raw.onChain.cluster === "devnet" || raw.onChain.cluster === "localnet" ? raw.onChain.cluster : undefined,
          programId: typeof raw.onChain.programId === "string" ? raw.onChain.programId : undefined,
        }
      : undefined,
    lastEvent: raw.lastEvent && isRecord(raw.lastEvent)
      ? {
          fixtureId: typeof raw.lastEvent.fixtureId === "string" ? raw.lastEvent.fixtureId : raw.fixtureId ?? `custom:${raw.id}`,
          seq: asFiniteNumber(raw.lastEvent.seq) ?? raw.materialSeq,
          timestamp: asFiniteNumber(raw.lastEvent.timestamp) ?? raw.updatedAt ?? Date.now(),
          eventType: isTxLineEventType(raw.lastEvent.eventType) ? raw.lastEvent.eventType : "UNKNOWN",
          source: isSource(raw.lastEvent.source) ? raw.lastEvent.source : raw.source,
          team: typeof raw.lastEvent.team === "string" ? raw.lastEvent.team : undefined,
          player: typeof raw.lastEvent.player === "string" ? raw.lastEvent.player : undefined,
          minute: asFiniteNumber(raw.lastEvent.minute) ?? undefined,
          rawPayloadHash: typeof raw.lastEvent.rawPayloadHash === "string" ? raw.lastEvent.rawPayloadHash : undefined,
          proofStatus:
            raw.lastEvent.proofStatus === "unverified" ||
            raw.lastEvent.proofStatus === "api_verified" ||
            raw.lastEvent.proofStatus === "onchain_verified" ||
            raw.lastEvent.proofStatus === "simulated"
              ? raw.lastEvent.proofStatus
              : "simulated",
          material: asBoolean(raw.lastEvent.material, false),
          impact: typeof raw.lastEvent.impact === "string" ? raw.lastEvent.impact : "Persisted market event.",
        }
      : null,
  };
}

function isGuardedOrder(value: unknown): value is GuardedOrder {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.marketId === "string" &&
    (value.side === "YES" || value.side === "NO") &&
    typeof value.stake === "number" &&
    typeof value.observedPrice === "number" &&
    typeof value.fairSidePrice === "number" &&
    typeof value.edge === "number" &&
    (value.status === "draft" || value.status === "submitted" || value.status === "escrowed" || value.status === "evaluating" || value.status === "filled" || value.status === "refunded") &&
    (value.executionMode === "devnet_verified" || value.executionMode === "local_simulation" || value.executionMode === "demo_replay")
  );
}

function isReceipt(value: unknown): value is LineGuardReceipt {
  return isRecord(value) && typeof value.receiptId === "string" && typeof value.receiptHash === "string" && typeof value.orderId === "string";
}

function mergeMarkets(persisted: FairXMarket[]): FairXMarket[] {
  const byId = new Map<string, FairXMarket>(marketCatalog.map((market) => [market.id, cloneFairXMarket(market)]));
  for (const market of persisted) byId.set(market.id, sanitizeMarket(market));
  return Array.from(byId.values());
}

function parseSnapshot(value: unknown, hydrated: boolean): FairXStoreSnapshot {
  const base = seedSnapshot(hydrated);
  if (!isRecord(value) || value.version !== 1) return base;
  const markets = Array.isArray(value.markets) ? value.markets.filter(isFairXMarket) : [];
  const orders = Array.isArray(value.orders) ? value.orders.filter(isGuardedOrder).map((order) => cloneGuardedOrder(order)) : [];
  const receipts = Array.isArray(value.receipts) ? value.receipts.filter(isReceipt).map((receipt) => cloneReceipt(receipt)) : [];
  return { version: 1, markets: mergeMarkets(markets), orders, receipts, hydrated };
}

/**
 * Read browser state when available.  On the server (or blocked storage), it
 * returns an untouched seed catalog rather than touching `window`.
 */
export function loadFairXStore(storage: FairXStorageLike | null = browserStorage()): FairXStoreSnapshot {
  if (!storage) return seedSnapshot(false);
  try {
    const raw = storage.getItem(FAIRX_STORAGE_KEY);
    if (!raw) return seedSnapshot(true);
    return parseSnapshot(JSON.parse(raw), true);
  } catch {
    return seedSnapshot(true);
  }
}

/** Persist a full local snapshot; returns false when storage is unavailable or full. */
export function saveFairXStore(snapshot: FairXStoreSnapshot, storage: FairXStorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    const serializable = { ...cloneSnapshot(snapshot), hydrated: true };
    storage.setItem(FAIRX_STORAGE_KEY, JSON.stringify(serializable));
    // Verifier-friendly redundant indexes.  They contain no secret material.
    storage.setItem(FAIRX_RECEIPTS_STORAGE_KEY, JSON.stringify(serializable.receipts));
    const lastReceipt = serializable.receipts.at(-1);
    if (lastReceipt) storage.setItem(FAIRX_LAST_RECEIPT_STORAGE_KEY, JSON.stringify(lastReceipt));
    else storage.removeItem?.(FAIRX_LAST_RECEIPT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearFairXStore(storage: FairXStorageLike | null = browserStorage()): boolean {
  if (!storage || !storage.removeItem) return false;
  try {
    storage.removeItem(FAIRX_STORAGE_KEY);
    storage.removeItem(FAIRX_RECEIPTS_STORAGE_KEY);
    storage.removeItem(FAIRX_LAST_RECEIPT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Small helpers for clients that only need catalog persistence. */
export function loadFairXMarkets(storage: FairXStorageLike | null = browserStorage()): FairXMarket[] {
  return loadFairXStore(storage).markets;
}

export function saveFairXMarkets(markets: FairXMarket[], storage: FairXStorageLike | null = browserStorage()): boolean {
  const current = loadFairXStore(storage);
  return saveFairXStore({ ...current, markets: markets.map((market) => cloneFairXMarket(market)), hydrated: true }, storage);
}

/**
 * A tiny external store rather than a global backend.  It is safe to import in
 * Server Components because browser access only happens inside `hydrate` or a
 * caller-provided storage adapter.
 */
export function createFairXStore(initial?: Partial<Pick<FairXStoreSnapshot, "markets" | "orders" | "receipts" | "hydrated">>): FairXStore {
  let snapshot: FairXStoreSnapshot = {
    version: 1,
    markets: initial?.markets ? mergeMarkets(initial.markets) : seedSnapshot(false).markets,
    orders: initial?.orders ? initial.orders.map((order) => cloneGuardedOrder(order)) : [],
    receipts: initial?.receipts ? initial.receipts.map((receipt) => cloneReceipt(receipt)) : [],
    hydrated: initial?.hydrated ?? false,
  };
  // This stable object satisfies useSyncExternalStore's server snapshot rule.
  const serverSnapshot = cloneSnapshot(snapshot);
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };
  const commit = (next: FairXStoreSnapshot, persist = true): FairXStoreSnapshot => {
    snapshot = cloneSnapshot(next);
    if (persist) saveFairXStore(snapshot);
    emit();
    return snapshot;
  };
  const upsertById = <T extends { id: string }>(items: T[], item: T): T[] => {
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (index < 0) return [...items, item];
    return items.map((candidate, candidateIndex) => (candidateIndex === index ? item : candidate));
  };
  const upsertReceipt = (items: LineGuardReceipt[], receipt: LineGuardReceipt): LineGuardReceipt[] => {
    const index = items.findIndex((candidate) => candidate.receiptId === receipt.receiptId);
    if (index < 0) return [...items, receipt];
    return items.map((candidate, candidateIndex) => (candidateIndex === index ? receipt : candidate));
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    hydrate(force = false) {
      if (snapshot.hydrated && !force) return snapshot;
      // A browser with storage disabled still completed hydration: it should
      // render the in-memory seed catalog rather than remain in a perpetual
      // "loading" state just because persistence is unavailable.
      return commit({ ...loadFairXStore(), hydrated: true }, false);
    },
    replace(next) {
      return commit({ version: 1, markets: mergeMarkets(next.markets), orders: next.orders.map((order) => cloneGuardedOrder(order)), receipts: next.receipts.map((receipt) => cloneReceipt(receipt)), hydrated: true });
    },
    upsertMarket(market) {
      return commit({ ...snapshot, markets: upsertById(snapshot.markets, cloneFairXMarket(sanitizeMarket(market))), hydrated: true });
    },
    addOrder(order, receipt) {
      const orders = upsertById(snapshot.orders, cloneGuardedOrder(order));
      const receipts = receipt ? upsertReceipt(snapshot.receipts, cloneReceipt(receipt)) : snapshot.receipts.map((current) => cloneReceipt(current));
      return commit({ ...snapshot, orders, receipts, hydrated: true });
    },
    addReceipt(receipt) {
      return commit({ ...snapshot, receipts: upsertReceipt(snapshot.receipts, cloneReceipt(receipt)), hydrated: true });
    },
    reset() {
      clearFairXStore();
      return commit(seedSnapshot(true), false);
    },
  };
}

let defaultStore: FairXStore | null = null;

export function getDefaultFairXStore(): FairXStore {
  defaultStore ??= createFairXStore();
  return defaultStore;
}

/** React adapter for client components; it hydrates persisted creator markets after mount. */
export function useFairXStore(store: FairXStore = getDefaultFairXStore()): UseFairXStoreResult {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    store.hydrate();
  }, [store]);

  return {
    store,
    snapshot,
    markets: snapshot.markets,
    orders: snapshot.orders,
    receipts: snapshot.receipts,
    hydrated: snapshot.hydrated,
    hydrate: store.hydrate,
    upsertMarket: store.upsertMarket,
    addOrder: store.addOrder,
    addReceipt: store.addReceipt,
    reset: store.reset,
  };
}

/** Intentionally tiny convenience hook for discovery cards. */
export function useFairXMarkets(store?: FairXStore): UseFairXStoreResult {
  return useFairXStore(store ?? getDefaultFairXStore());
}
