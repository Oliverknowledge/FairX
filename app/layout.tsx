import type { Metadata } from "next";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { SolanaWalletProvider } from "@/components/solana/WalletProvider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "FairX",
  title: {
    default: "FairX — Execution Integrity for Live Sports Markets",
    template: "%s | FairX",
  },
  description: "Solana execution infrastructure that returns stale-sequence order principal while synchronized live-sports trading continues.",
  openGraph: {
    type: "website",
    title: "FairX — Return the Stale Order. Keep the Market Open.",
    description: "Operator infrastructure demonstrated with a genuine TxLINE historical replay and independently verified Solana settlement.",
    siteName: "FairX",
  },
  twitter: {
    card: "summary_large_image",
    title: "FairX — Sequence-Bound Execution on Solana",
    description: "Stale-sequence principal returns. Synchronized trading continues. Every liability is publicly verifiable.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased"><SolanaWalletProvider>{children}</SolanaWalletProvider></body>
    </html>
  );
}
