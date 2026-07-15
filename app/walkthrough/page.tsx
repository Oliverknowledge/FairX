import { redirect } from "next/navigation";

// The FairX V4 submission has one coherent surface set (Home · Replay market · Positions · Proof).
// This earlier LineGuard "How it works" route made claims for a different architecture, so it is
// retired to avoid presenting a second, divergent story beside the deployed V4 product.
export default function WalkthroughPage() {
  redirect("/");
}
