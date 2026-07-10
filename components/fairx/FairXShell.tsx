"use client";

import Link from "next/link";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/walkthrough", label: "Proof Walkthrough" },
  { href: "/proof", label: "Proof" },
  { href: "/markets", label: "Markets" },
  { href: "/create", label: "Create Market" },
  { href: "/attack-lab", label: "Attack Lab" },
  { href: "/integrate", label: "Integrate" },
] as const;

const developerNavigation = [
  { href: "/terminal", label: "Technical terminal" },
  { href: "/operator", label: "Operator status" },
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
  const pathname = usePathname() ?? "/";

  return (
    <div className="min-h-screen bg-(--surface)">
      <header className="border-b border-(--border) bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-[62px] max-w-[1380px] items-center gap-4 px-4 sm:px-6">
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
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    active ? "bg-[#eef4ff] text-(--blue)" : "text-(--ink-2) hover:bg-[#f6f7f9] hover:text-(--ink)"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <details className="group relative hidden lg:block">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-(--ink-2) hover:bg-[#f6f7f9] hover:text-(--ink)">
              Developer <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-9 z-30 w-48 rounded-lg border border-(--border) bg-white p-1.5 shadow-[0_14px_36px_rgba(15,23,42,0.12)]">
              {developerNavigation.map((item) => <Link key={item.href} href={item.href} className="block rounded-md px-2.5 py-2 text-[10.5px] font-semibold text-(--ink-2) hover:bg-[#f6f7f9] hover:text-(--blue)">{item.label}</Link>)}
            </div>
          </details>

          <div className="ml-auto flex items-center gap-2">
            <DevnetBadge className="hidden sm:inline-flex" />
            <Link
              href="/walkthrough"
              className="inline-flex h-8 items-center rounded-md bg-(--ink) px-3 text-[10.5px] font-semibold text-white transition-colors hover:bg-[#273244]"
            >
              Run the proof walkthrough
            </Link>
          </div>
        </div>

        <div className="border-t border-(--border) px-4 py-1.5 lg:hidden">
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
            {developerNavigation.map((item) => <Link key={item.href} href={item.href} className="shrink-0 rounded-md px-2 py-1 text-[10.5px] font-semibold text-(--ink-3)">{item.label}</Link>)}
          </nav>
        </div>
      </header>

      <main className={`mx-auto max-w-[1380px] px-4 sm:px-6 ${compact ? "py-7 sm:py-10" : "py-6 sm:py-8"} ${className}`}>{children}</main>

      <footer className="mx-auto flex max-w-[1380px] flex-col gap-2 px-4 pb-6 pt-3 text-[10px] leading-relaxed text-(--ink-3) sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>FairX is a devnet-backed prototype. Devnet and sandbox funds only; no real-money settlement.</span>
        <span className="mono break-all text-[9px]">build {(process.env.NEXT_PUBLIC_COMMIT_SHA ?? "local").slice(0, 8)} · {process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "unconfigured"} · program 6k8uu3N8…HWdSe</span>
      </footer>
    </div>
  );
}
