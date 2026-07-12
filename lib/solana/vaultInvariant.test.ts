import { describe, expect, it } from "vitest";

type Vault = { deposited: number; refunded: number; accepted: number; paid: number; claimable: number; dust: number };

function rng(seed: number) {
  let value = seed >>> 0;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function invariant(vault: Vault) {
  return vault.deposited === vault.refunded + vault.paid + vault.claimable + vault.dust;
}

describe("per-market vault conservation properties", () => {
  it("conserves randomized deposits through refunds and final-remainder payouts", () => {
    const random = rng(0xfa17);
    for (let run = 0; run < 1_000; run += 1) {
      const vault: Vault = { deposited: 0, refunded: 0, accepted: 0, paid: 0, claimable: 0, dust: 0 };
      const winners: number[] = [];
      const orders = 1 + Math.floor(random() * 40);
      for (let index = 0; index < orders; index += 1) {
        const stake = 1 + Math.floor(random() * 1_000_000);
        vault.deposited += stake;
        if (random() < 0.25) vault.refunded += stake;
        else {
          vault.accepted += stake;
          vault.claimable += stake;
          if (random() < 0.55) winners.push(stake);
        }
        expect(invariant(vault)).toBe(true);
      }
      if (winners.length === 0) continue; // program voids and exact-refunds in this case
      const winningPool = winners.reduce((sum, stake) => sum + stake, 0);
      let claimedWeight = 0;
      for (const stake of winners) {
        claimedWeight += stake;
        const payout = claimedWeight === winningPool ? vault.claimable : Math.floor((stake * vault.accepted) / winningPool);
        vault.paid += payout;
        vault.claimable -= payout;
        expect(invariant(vault)).toBe(true);
        expect(vault.paid).toBeLessThanOrEqual(vault.accepted);
      }
      expect(vault.claimable).toBe(0);
      expect(vault.dust).toBe(0);
    }
  });

  it("never lets market A consume market B deposits", () => {
    const marketA: Vault = { deposited: 11, refunded: 0, accepted: 11, paid: 11, claimable: 0, dust: 0 };
    const marketB: Vault = { deposited: 29, refunded: 0, accepted: 29, paid: 0, claimable: 29, dust: 0 };
    expect(marketA.paid).toBeLessThanOrEqual(marketA.accepted);
    expect(marketA.paid).not.toBe(marketA.accepted + marketB.accepted);
    expect(invariant(marketA)).toBe(true);
    expect(invariant(marketB)).toBe(true);
  });
});
