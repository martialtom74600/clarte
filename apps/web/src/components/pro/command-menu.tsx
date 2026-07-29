"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, LayoutGrid, ShoppingBag, Coins, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { clarteGlassCard } from "@/lib/clarte-design";
import { duration, ease } from "@/lib/motion";

const NAV_ITEMS = [
  { href: "/pro", label: "Dashboard", icon: Home, shortcut: "⌘1" },
  { href: "/pro/leads", label: "Mur de leads", icon: LayoutGrid, shortcut: "⌘2" },
  { href: "/pro/purchases", label: "Mes achats", icon: ShoppingBag, shortcut: "⌘3" },
  { href: "/pro/credits", label: "Crédits", icon: Coins, shortcut: "⌘4" },
];

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  const isProApp =
    pathname.startsWith("/pro") &&
    !pathname.startsWith("/pro/login") &&
    !pathname.startsWith("/pro/auth");

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    if (!isProApp) return;

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.metaKey || e.ctrlKey) {
        const num = Number(e.key);
        if (num >= 1 && num <= 4) {
          e.preventDefault();
          navigate(NAV_ITEMS[num - 1].href);
        }
      }
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isProApp, navigate]);

  if (!isProApp) return null;

  const filtered = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Rechercher</span>
        <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 px-4"
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: duration.fast, ease: ease.out }}
            >
              <div className={cn(clarteGlassCard, "overflow-hidden shadow-2xl")}>
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher ou naviguer…"
                    className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
                <ul className="max-h-64 overflow-y-auto p-2">
                  {filtered.map((item) => (
                    <li key={item.href}>
                      <button
                        type="button"
                        onClick={() => navigate(item.href)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-800 transition-colors",
                          pathname === item.href && "bg-brand-50 text-brand-800"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1 text-left">{item.label}</span>
                        <kbd className="text-[10px] text-slate-400">{item.shortcut}</kbd>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
