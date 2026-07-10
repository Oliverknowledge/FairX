import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Receipt Verifier",
  description: "Recompute a LineGuard receipt seal and inspect attached event, configuration, settlement, and Solana transaction evidence.",
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
