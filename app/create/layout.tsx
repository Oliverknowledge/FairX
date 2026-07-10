import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Market",
  description: "Define a protected test market, review its configuration hashes, and continue to Solana devnet execution when available.",
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
