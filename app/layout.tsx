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
    default: "FairX — Selective Stale-Price Protection",
    template: "%s | FairX",
  },
  description: "A Solana devnet prototype that refunds stale-price exploit orders while preserving honest accepted collateral.",
  openGraph: {
    type: "website",
    title: "FairX — Selective Stale-Price Protection",
    description: "A devnet prototype: refund the stale exploit, keep honest accepted collateral in the market.",
    siteName: "FairX",
  },
  twitter: {
    card: "summary_large_image",
    title: "FairX — Selective Stale-Price Protection",
    description: "An unaudited Solana devnet settlement-guard prototype.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased"><SolanaWalletProvider>{children}</SolanaWalletProvider></body>
    </html>
  );
}
