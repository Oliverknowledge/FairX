import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polymarket reference price",
  description:
    "FairX uses public Polymarket order-book data as an external reference quote for an equivalent market. TxLINE supplies the sports-event evidence and LineGuard protects Solana execution when those states diverge.",
};

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
