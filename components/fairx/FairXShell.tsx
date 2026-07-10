"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/markets", label: "Markets" },
  { href: "/create", label: "Create Market" },
  { href: "/proof", label: "Proof" },
  { href: "/attack-lab", label: "Attack Lab" },
  { href: "/operator", label: "Operator" },
  { href: "/integrate", label: "Integrate" },
] as const;

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
          LineGuard
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
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-(--surface)">
      <header className="border-b border-(--border) bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-[62px] max-w-[1380px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="FairX home">
            <FairXBrand />
          </Link>

          <nav className="hidden min-w-0 items-center gap-1 md:flex" aria-label="Primary navigation">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    active ? "bg-[#eef4ff] text-(--blue)" : "text-(--ink-2) hover:bg-[#f6f7f9] hover:text-(--ink)"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <DevnetBadge className="hidden sm:inline-flex" />
            <Link
              href="/walkthrough"
              className="inline-flex h-8 items-center rounded-md bg-(--ink) px-3 text-[10.5px] font-semibold text-white transition-colors hover:bg-[#273244]"
            >
              Proof walkthrough
            </Link>
          </div>
        </div>

        <div className="border-t border-(--border) px-4 py-1.5 md:hidden">
          <nav className="mx-auto flex max-w-[1380px] items-center gap-1 overflow-x-auto" aria-label="Primary navigation">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-md px-2 py-1 text-[10.5px] font-semibold ${
                    active ? "bg-[#eef4ff] text-(--blue)" : "text-(--ink-2)"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <DevnetBadge className="ml-auto shrink-0" />
          </nav>
        </div>
      </header>

      <main className={`mx-auto max-w-[1380px] px-4 sm:px-6 ${compact ? "py-7 sm:py-10" : "py-6 sm:py-8"} ${className}`}>{children}</main>

      <footer className="mx-auto max-w-[1380px] px-4 pb-6 pt-3 text-[10px] leading-relaxed text-(--ink-3) sm:px-6">
        FairX is a devnet prototype for prediction-market integrity. It is not a real-money betting product.
      </footer>
    </div>
  );
}
