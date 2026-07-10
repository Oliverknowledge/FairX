import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Protected Market",
  description: "Inspect market freshness, provenance, local guard preview, devnet execution state, and receipt evidence.",
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
