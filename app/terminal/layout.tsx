import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer Terminal",
  description: "Inspect TxLINE ingestion, normalization, market freshness, guard decisions, and runtime-gated devnet execution.",
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
