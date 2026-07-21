"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/ops/jobs", label: "Jobs" },
  { href: "/ops/scans", label: "Scans" },
  { href: "/ops/designs", label: "Designs" },
  { href: "/ops/accounts", label: "Accounts" },
];

export default function OpsNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/ops/jobs" className="flex items-center gap-2.5">
          <span className="relative w-[22px] h-[22px] inline-block shrink-0">
            <span className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-full bg-partli-accent" />
            <span className="absolute top-1/2 left-0 -translate-y-1/2 h-[2px] w-full bg-partli-accent" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full bg-partli-primary" />
          </span>
          <span className="text-[19px] font-semibold tracking-tight text-partli-ink">
            partli
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-partli-primary text-white"
                    : "text-slate-500 hover:text-partli-ink hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
