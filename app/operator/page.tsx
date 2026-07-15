import { redirect } from "next/navigation";

// Operator/runtime status for the earlier deployed v2/v3 LineGuard program. The V4 product surfaces
// its live devnet status on /proof instead; this divergent v2/v3 view is retired.
export default function OperatorPage() {
  redirect("/proof");
}
