"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/pro", label: "Dashboard" },
  { href: "/pro/leads", label: "Leads" },
  { href: "/pro/purchases", label: "Achats" },
  { href: "/pro/credits", label: "Crédits" },
];

export function PartnerNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-6 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "hover:text-white transition-colors",
            pathname === link.href ||
              (link.href !== "/pro" && pathname.startsWith(link.href))
              ? "text-white font-medium"
              : "text-slate-400"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
