"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type FairXShellProps = {
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function FairXBrand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-[9px] border ${
          inverse ? "border-white/20 bg-white/10 text-white" : "border-[#cfe0ff] bg-(--blue-bg) text-(--blue)"
        }`}
      >
        <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.4} />
      </span>
      <span className="leading-none">
        <span className={`block text-[15px] font-bold tracking-[-0.04em] ${inverse ? "text-white" : "text-(--ink)"}`}>FairX</span>
        <span className={`mt-1 block text-[8.5px] font-semibold uppercase tracking-[0.14em] ${inverse ? "text-white/60" : "text-(--ink-3)"}`}>
          Execution integrity
        </span>
      </span>
    </span>
  );
}

export function DevnetBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#d7e6ff] bg-[#f4f8ff] px-2.5 py-1 text-[10px] font-semibold text-[#245db8] ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
      Devnet funds only
    </span>
  );
}

/** Shared exchange frame. It intentionally keeps navigation and compliance copy present on every FairX surface. */
export function FairXShell({ children, className = "", compact = false }: FairXShellProps) {
  const pathname = usePathname() ?? "/";
  const navigation = [
    { href: "/", label: "Live Demo" },
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/proof", label: "Proof" },
  ] as const;

  return (
    <div className="min-h-screen bg-(--surface)">
      <header className="border-b border-(--border) bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-[68px] max-w-[1380px] items-center gap-5 px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="FairX home">
            <FairXBrand />
          </Link>

          <nav className="hidden min-w-0 items-center gap-0.5 lg:flex" aria-label="Primary navigation">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                    className={`inline-flex min-h-11 items-center rounded-lg px-3 text-[11px] font-semibold transition-colors ${
                    active ? "bg-[#eef4ff] text-(--blue)" : "text-(--ink-2) hover:bg-[#f6f7f9] hover:text-(--ink)"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-[#d7e6ff] bg-[#f4f8ff] px-3 py-1.5 text-[10px] font-semibold text-[#245db8] sm:inline-flex"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />V4 · Solana devnet</span>
          </div>
        </div>

        <div className="border-t border-(--border) px-3 lg:hidden">
          <nav className="mx-auto grid max-w-[520px] grid-cols-3 gap-1" aria-label="Primary navigation">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-[11px] font-semibold ${
                    active ? "bg-[#eef4ff] text-(--blue)" : "text-(--ink-2)"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className={`mx-auto max-w-[1380px] px-4 sm:px-6 ${compact ? "py-7 sm:py-10" : "py-6 sm:py-8"} ${className}`}>{children}</main>

      <footer className="mx-auto max-w-[1380px] px-4 pb-8 pt-8 text-[10px] leading-relaxed text-(--ink-3) sm:px-6">
        <div className="border-t border-(--border) pt-5 sm:flex sm:items-start sm:justify-between sm:gap-8">
          <div><p className="font-semibold text-(--ink-2)">FairX · execution firewall for live prediction markets</p><p className="mt-1">Runtime simulation using captured TxLINE-schema events · unaudited prototype · Solana devnet · no real-money settlement.</p></div>
          <div className="mt-4 sm:mt-0"><p className="font-semibold text-(--ink-2)">Evidence before claims</p><p className="mt-1">Read the deployed program, finalized lifecycle and trust assumptions on <Link href="/proof" className="font-semibold underline-offset-2 hover:underline">Proof</Link>.</p></div>
        </div>
      </footer>
    </div>
  );
}
