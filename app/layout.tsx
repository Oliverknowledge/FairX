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
    default: "FairX V4 — Fixed-Payout Sports Vault",
    template: "%s | FairX",
  },
  description: "An isolated fixed-payout Solana vault replay using recorded TxLINE France-Morocco evidence.",
  openGraph: {
    type: "website",
    title: "FairX V4 — Fixed-Payout Sports Vault",
    description: "A deterministic France-Morocco replay with genuine TxLINE odds, event and final-result proofs.",
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
