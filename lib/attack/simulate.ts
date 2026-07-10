import { evaluateLineGuard } from "@/lib/lineguard/evaluate";

/**
 * Attack Lab — a Monte-Carlo-style stress test that runs many synthetic bots
 * through the EXACT same `evaluateLineGuard` primitive the terminal and the
 * on-chain program use. It is honest local simulation: no network, no chain,
 * just the guard function applied at scale so the mechanism is visible in bulk.
 */

export interface AttackScenario {
  id: number;
  side: "YES" | "NO";
  observedPrice: number;
  fairYes: number;
  fairSidePrice: number;
  edge: number;
  stake: number;
  shares: number;
  staleWindow: number;
  tolerance: number;
  verdict: string;
  /** A stale positive-edge order the guard voided + refunded. */
  blocked: boolean;
  /** A stale but non-exploitative order the guard allowed. */
  allowed: boolean;
  /** Profit this bot would have captured at the frozen price without LineGuard. */
  stealDenied: number;
}

export interface AttackLabResult {
  scenarios: AttackScenario[];
  totalBots: number;
  staleAttacks: number;
  attacksRefunded: number;
  safeTrades: number;
  safeTradesAllowed: number;
  /** Sum of unfair profit LineGuard denied ($). */
  staleProfitDenied: number;
  /** Total demo stake that passed through the guard ($). */
  protectedVolume: number;
  avgStaleWindow: number;
  /** How much stale edge would have leaked with NO guard (all attacks fill). */
  leakedWithoutGuard: number;
}

/** Deterministic PRNG (mulberry32) so a given seed reproduces the same wave. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export interface SimulateOptions {
  /** Fraction of bots that are stale-edge attackers (rest are safe no-edge traders). */
  attackerRatio?: number;
  tolerance?: number;
}

export function simulateAttackWave(count: number, seed = 42, options: SimulateOptions = {}): AttackLabResult {
  const attackerRatio = options.attackerRatio ?? 0.7;
  const tolerance = options.tolerance ?? 0.02;
  const rand = mulberry32(seed);
  const bots = Math.max(1, Math.min(2000, Math.floor(count)));
  const scenarios: AttackScenario[] = [];

  for (let i = 0; i < bots; i += 1) {
    const isAttacker = rand() < attackerRatio;
    // Frozen displayed YES price, and a favourable un-repriced jump.
    const displayed = round4(0.25 + rand() * 0.4); // 0.25 – 0.65
    const jump = round4(0.08 + rand() * 0.22); // 0.08 – 0.30 fair-value move
    const fairYes = round4(Math.min(0.98, displayed + jump));
    const staleWindow = 1 + Math.floor(rand() * 3); // 1 – 3 sequences behind
    const stake = Math.round(50 + rand() * 1950); // $50 – $2000
    const side: "YES" | "NO" = isAttacker ? "YES" : "NO";
    const observedPrice = side === "YES" ? displayed : round4(1 - displayed);

    const guard = evaluateLineGuard({
      side,
      observedPrice,
      fairYes,
      materialSeq: 1 + staleWindow,
      pricedAtSeq: 1,
      tolerance,
      orderId: `sim-${seed}-${i}`,
      marketId: "attack-lab",
      actor: "bot",
      timestamp: i,
    });

    const shares = observedPrice > 0 ? stake / observedPrice : 0;
    const blocked = guard.verdict === "VOIDED_REFUNDED";
    const allowed = !blocked;
    // Profit the bot would keep at the frozen price if it filled: shares * edge.
    const stealDenied = blocked ? round2(shares * guard.edge) : 0;

    scenarios.push({
      id: i,
      side,
      observedPrice,
      fairYes,
      fairSidePrice: guard.fairSidePrice,
      edge: guard.edge,
      stake,
      shares: Math.round(shares),
      staleWindow,
      tolerance,
      verdict: guard.verdict,
      blocked,
      allowed,
      stealDenied,
    });
  }

  const staleAttacks = scenarios.filter((s) => s.side === "YES").length;
  const attacksRefunded = scenarios.filter((s) => s.blocked).length;
  const safeTrades = scenarios.filter((s) => s.side === "NO").length;
  const safeTradesAllowed = scenarios.filter((s) => s.side === "NO" && s.allowed).length;
  const staleProfitDenied = round2(scenarios.reduce((sum, s) => sum + s.stealDenied, 0));
  const protectedVolume = round2(scenarios.reduce((sum, s) => sum + s.stake, 0));
  const avgStaleWindow = round2(scenarios.reduce((sum, s) => sum + s.staleWindow, 0) / scenarios.length);

  return {
    scenarios,
    totalBots: scenarios.length,
    staleAttacks,
    attacksRefunded,
    safeTrades,
    safeTradesAllowed,
    staleProfitDenied,
    protectedVolume,
    avgStaleWindow,
    leakedWithoutGuard: staleProfitDenied,
  };
}
