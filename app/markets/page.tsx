import { redirect } from "next/navigation";

// The single supported market is the V4 replay. The redundant one-item list route
// redirects straight to it (the old france-morocco-france-win slug is out of V4 scope).
export default function MarketsIndexPage() {
  redirect("/markets/france-morocco-v4-replay");
}
