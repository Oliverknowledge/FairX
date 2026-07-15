import { redirect } from "next/navigation";

// Attack-lab was a LineGuard-at-scale simulation for the earlier product. The V4 submission shows
// the single canonical stale-order invalidation in the replay market.
export default function AttackLabPage() {
  redirect("/markets/france-morocco-v4-replay");
}
