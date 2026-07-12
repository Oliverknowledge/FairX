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
    default: "FairX — Fair Settlement for Live Prediction Markets",
    template: "%s | FairX",
  },
  description: "FairX uses LineGuard and TxLINE event evidence to refund stale-price exploits and finalize safe prediction-market trades on Solana.",
  openGraph: {
    type: "website",
    title: "FairX — Fair Settlement for Live Prediction Markets",
    description: "See LineGuard refund a stale-price exploit while allowing the opposite safe trade on Solana devnet.",
    siteName: "FairX",
  },
  twitter: {
    card: "summary_large_image",
    title: "FairX — Fair Settlement for Live Prediction Markets",
    description: "An on-chain settlement guard that blocks only trades exploiting stale information.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased"><SolanaWalletProvider>{children}</SolanaWalletProvider></body>
    </html>
  );
}
