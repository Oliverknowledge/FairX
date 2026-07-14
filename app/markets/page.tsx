import { redirect } from "next/navigation";

// The single supported market is the primary Trade destination. The redundant
// one-item list route now redirects straight to it.
export default function MarketsIndexPage() {
  redirect("/markets/france-morocco-france-win");
}
