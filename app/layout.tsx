import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FairX — Protected Prediction Markets",
  description:
    "A devnet prediction-market prototype powered by LineGuard, with stale-price protection built into settlement.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
