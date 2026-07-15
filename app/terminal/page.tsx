import { redirect } from "next/navigation";

// The original LineGuard replay terminal belongs to the earlier product. The V4 submission's
// interactive settlement walkthrough is the replay market.
export default function TerminalPage() {
  redirect("/markets/france-morocco-v4-replay");
}
